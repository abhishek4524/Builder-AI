import { User } from "../models/User.js";
import { Project } from "../models/Project.js";
import { UsageLog } from "../models/UsageLog.js";
import { CreditTransaction } from "../models/CreditTransaction.js";
import { Payment } from "../models/Payment.js";
import { grantCredits } from "../services/credits.js";
import { isRedisHealthy } from "../config/redis.js";
import { generationQueue } from "../queues/generationQueue.js";
import mongoose from "mongoose";

// ─── Helper ──────────────────────────────────────────────────────────────────
function startOfDayUTC(date) {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    return d;
}

function nDaysAgo(n) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - n);
    d.setUTCHours(0, 0, 0, 0);
    return d;
}

// ─── GET /api/admin/overview ──────────────────────────────────────────────────
/**
 * Top-level KPI summary card data.
 */
export async function getOverview(req, res) {
    const now = new Date();
    const today = startOfDayUTC(now);
    const yesterday = nDaysAgo(1);
    const last7 = nDaysAgo(7);
    const last30 = nDaysAgo(30);
    const prevPeriodStart = nDaysAgo(60);

    const [
        totalUsers,
        usersLast30,
        usersPrev30,
        usersToday,
        totalProjects,
        projectsLast30,
        totalGenerations,
        genLast30,
        successGenLast30,
        totalRevisions,
        revLast30,
        totalTokens,
        totalCostUsd,
        costLast30,
        totalRevenuePaise,
        revenueLast30Paise,
        activeNow,
    ] = await Promise.all([
        User.countDocuments({ status: { $ne: "deleted" } }),
        User.countDocuments({ createdAt: { $gte: last30 }, status: { $ne: "deleted" } }),
        User.countDocuments({ createdAt: { $gte: prevPeriodStart, $lt: last30 }, status: { $ne: "deleted" } }),
        User.countDocuments({ createdAt: { $gte: today }, status: { $ne: "deleted" } }),
        Project.countDocuments({}),
        Project.countDocuments({ createdAt: { $gte: last30 } }),
        UsageLog.countDocuments({ action: "generate" }),
        UsageLog.countDocuments({ action: "generate", createdAt: { $gte: last30 } }),
        UsageLog.countDocuments({ action: "generate", status: "success", createdAt: { $gte: last30 } }),
        UsageLog.countDocuments({ action: "revise" }),
        UsageLog.countDocuments({ action: "revise", createdAt: { $gte: last30 } }),
        UsageLog.aggregate([{ $group: { _id: null, total: { $sum: "$totalTokens" } } }]),
        UsageLog.aggregate([{ $group: { _id: null, total: { $sum: "$costUsd" } } }]),
        UsageLog.aggregate([{ $match: { createdAt: { $gte: last30 } } }, { $group: { _id: null, total: { $sum: "$costUsd" } } }]),
        Payment.aggregate([
            { $match: { status: { $in: ["paid", "captured"] } } },
            { $group: { _id: null, total: { $sum: "$amountPaise" } } },
        ]),
        Payment.aggregate([
            { $match: { status: { $in: ["paid", "captured"] }, createdAt: { $gte: last30 } } },
            { $group: { _id: null, total: { $sum: "$amountPaise" } } },
        ]),
        // Users active in last 24h (created a project or revision)
        UsageLog.distinct("userId", { createdAt: { $gte: yesterday } }),
    ]);

    const userGrowthPct = usersPrev30 === 0 ? null : (((usersLast30 - usersPrev30) / usersPrev30) * 100).toFixed(1);
    const successRate30 = genLast30 === 0 ? null : ((successGenLast30 / genLast30) * 100).toFixed(1);

    res.json({
        users: {
            total: totalUsers,
            last30Days: usersLast30,
            today: usersToday,
            growthPct: userGrowthPct,
            activeUsers24h: activeNow.length,
        },
        projects: {
            total: totalProjects,
            last30Days: projectsLast30,
        },
        generations: {
            total: totalGenerations,
            last30Days: genLast30,
            successRateLast30: successRate30,
        },
        revisions: {
            total: totalRevisions,
            last30Days: revLast30,
        },
        compute: {
            totalTokens: totalTokens[0]?.total || 0,
            totalCostUsd: Math.round((totalCostUsd[0]?.total || 0) * 10000) / 10000,
            costLast30Usd: Math.round((costLast30[0]?.total || 0) * 10000) / 10000,
        },
        revenue: {
            totalPaise: totalRevenuePaise[0]?.total || 0,
            last30Paise: revenueLast30Paise[0]?.total || 0,
        },
    });
}

// ─── GET /api/admin/users/growth ─────────────────────────────────────────────
/**
 * Daily new user signups for the past N days (default 30).
 */
export async function getUsersGrowth(req, res) {
    const days = Math.min(parseInt(req.query.days || "30", 10), 90);
    const since = nDaysAgo(days - 1);

    const rows = await User.aggregate([
        { $match: { createdAt: { $gte: since }, status: { $ne: "deleted" } } },
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                count: { $sum: 1 },
            },
        },
        { $sort: { _id: 1 } },
    ]);

    // Fill missing days with 0
    const map = Object.fromEntries(rows.map((r) => [r._id, r.count]));
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
        const d = nDaysAgo(i);
        const key = d.toISOString().slice(0, 10);
        result.push({ date: key, count: map[key] || 0 });
    }

    res.json({ data: result });
}

// ─── GET /api/admin/projects/activity ────────────────────────────────────────
/**
 * Daily project creation + revisions for the past N days.
 */
export async function getProjectsActivity(req, res) {
    const days = Math.min(parseInt(req.query.days || "30", 10), 90);
    const since = nDaysAgo(days - 1);

    const [projectRows, revisionRows] = await Promise.all([
        Project.aggregate([
            { $match: { createdAt: { $gte: since } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    count: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
        ]),
        UsageLog.aggregate([
            { $match: { action: "revise", createdAt: { $gte: since } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    count: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
        ]),
    ]);

    const pMap = Object.fromEntries(projectRows.map((r) => [r._id, r.count]));
    const rMap = Object.fromEntries(revisionRows.map((r) => [r._id, r.count]));

    const result = [];
    for (let i = days - 1; i >= 0; i--) {
        const d = nDaysAgo(i);
        const key = d.toISOString().slice(0, 10);
        result.push({ date: key, projects: pMap[key] || 0, revisions: rMap[key] || 0 });
    }

    res.json({ data: result });
}

// ─── GET /api/admin/compute/daily ────────────────────────────────────────────
/**
 * Daily AI token usage & compute cost for the past N days.
 */
export async function getComputeDaily(req, res) {
    const days = Math.min(parseInt(req.query.days || "30", 10), 90);
    const since = nDaysAgo(days - 1);

    const rows = await UsageLog.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                tokens: { $sum: "$totalTokens" },
                costUsd: { $sum: "$costUsd" },
                calls: { $sum: 1 },
            },
        },
        { $sort: { _id: 1 } },
    ]);

    const map = Object.fromEntries(rows.map((r) => [r._id, r]));
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
        const d = nDaysAgo(i);
        const key = d.toISOString().slice(0, 10);
        const row = map[key];
        result.push({
            date: key,
            tokens: row?.tokens || 0,
            costUsd: Math.round((row?.costUsd || 0) * 100000) / 100000,
            calls: row?.calls || 0,
        });
    }

    res.json({ data: result });
}

// ─── GET /api/admin/users/list ────────────────────────────────────────────────
/**
 * Paginated user list with project count, credit balance, plan.
 */
export async function getUsersList(req, res) {
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(50, Math.max(5, parseInt(req.query.limit || "20", 10)));
    const search = req.query.search?.trim() || "";
    const sort = req.query.sort || "createdAt";
    const order = req.query.order === "asc" ? 1 : -1;

    const filter = { status: { $ne: "deleted" } };
    if (search) {
        filter.$or = [
            { name: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
        ];
    }

    const [users, total] = await Promise.all([
        User.find(filter)
            .select("-password")
            .sort({ [sort]: order })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
        User.countDocuments(filter),
    ]);

    // Attach project counts
    const userIds = users.map((u) => u._id);
    const projCounts = await Project.aggregate([
        { $match: { owner: { $in: userIds } } },
        { $group: { _id: "$owner", count: { $sum: 1 } } },
    ]);
    const countMap = Object.fromEntries(projCounts.map((p) => [p._id.toString(), p.count]));

    const enriched = users.map((u) => ({
        ...u,
        projectCount: countMap[u._id.toString()] || 0,
        balance: u.creditUnits / 10,
    }));

    res.json({ users: enriched, total, page, limit, pages: Math.ceil(total / limit) });
}

// ─── GET /api/admin/revenue/daily ─────────────────────────────────────────────
/**
 * Daily revenue (payments captured) for the past N days.
 */
export async function getRevenueDaily(req, res) {
    const days = Math.min(parseInt(req.query.days || "30", 10), 90);
    const since = nDaysAgo(days - 1);

    const rows = await Payment.aggregate([
        { $match: { status: { $in: ["paid", "captured"] }, createdAt: { $gte: since } } },
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                totalPaise: { $sum: "$amountPaise" },
                count: { $sum: 1 },
            },
        },
        { $sort: { _id: 1 } },
    ]);

    const map = Object.fromEntries(rows.map((r) => [r._id, r]));
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
        const d = nDaysAgo(i);
        const key = d.toISOString().slice(0, 10);
        const row = map[key];
        result.push({
            date: key,
            amountInr: (row?.totalPaise || 0) / 100,
            transactions: row?.count || 0,
        });
    }

    res.json({ data: result });
}

// ─── GET /api/admin/models/breakdown ─────────────────────────────────────────
/**
 * AI model usage breakdown (calls, tokens, cost).
 */
export async function getModelBreakdown(req, res) {
    const rows = await UsageLog.aggregate([
        {
            $group: {
                _id: "$model",
                calls: { $sum: 1 },
                tokens: { $sum: "$totalTokens" },
                costUsd: { $sum: "$costUsd" },
                success: { $sum: { $cond: [{ $eq: ["$status", "success"] }, 1, 0] } },
            },
        },
        { $sort: { calls: -1 } },
    ]);

    res.json({ data: rows.map((r) => ({ model: r._id || "unknown", ...r, _id: undefined })) });
}

// ─── GET /api/admin/projects/status ──────────────────────────────────────────
/**
 * Project status distribution (pie chart data).
 */
export async function getProjectStatusBreakdown(req, res) {
    const rows = await Project.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
    ]);

    res.json({ data: rows.map((r) => ({ status: r._id, count: r.count })) });
}

// ─── GET /api/admin/recent ────────────────────────────────────────────────────
/**
 * Recent activity feed: last 15 users + last 15 projects.
 */
export async function getRecentActivity(req, res) {
    const [recentUsers, recentProjects] = await Promise.all([
        User.find({ status: { $ne: "deleted" } })
            .select("name email plan creditUnits createdAt authProvider")
            .sort({ createdAt: -1 })
            .limit(15)
            .lean(),
        Project.find({})
            .select("name status owner createdAt completedAt generationDuration version")
            .sort({ createdAt: -1 })
            .limit(15)
            .populate("owner", "name email")
            .lean(),
    ]);

    res.json({
        recentUsers: recentUsers.map((u) => ({ ...u, balance: u.creditUnits / 10 })),
        recentProjects,
    });
}

// ─── GET /api/admin/plans/breakdown ──────────────────────────────────────────
/**
 * User plan distribution.
 */
export async function getPlanBreakdown(req, res) {
    const rows = await User.aggregate([
        { $match: { status: { $ne: "deleted" } } },
        { $group: { _id: "$plan", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
    ]);

    res.json({ data: rows.map((r) => ({ plan: r._id || "free", count: r.count })) });
}

// ─── POST /api/admin/users/:id/credits ───────────────────────────────────────
/**
 * Admin action: Grant or deduct credits for a user.
 */
export async function adjustUserCredits(req, res) {
    const { id } = req.params;
    const { credits, reason } = req.body;
    const numCredits = Number(credits);

    if (isNaN(numCredits) || numCredits === 0) {
        return res.status(400).json({ error: "Invalid credit amount" });
    }

    const units = Math.round(numCredits * 10);
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const adminEmail = req.adminUser?.email || "Admin";

    if (units > 0) {
        await grantCredits(id, units, { reason: reason || `Admin top-up by ${adminEmail}` });
    } else {
        await User.findByIdAndUpdate(id, { $inc: { creditUnits: units } });
        await CreditTransaction.create({
            userId: id,
            type: "adjustment",
            units: units,
            balanceAfter: Math.max(0, user.creditUnits + units),
            reason: reason || `Admin deduction by ${adminEmail}`,
        });
    }

    const updated = await User.findById(id).select("-password");
    res.json({
        message: `${numCredits > 0 ? "+" : ""}${numCredits} credits updated for ${user.email}`,
        user: { ...updated.toObject(), balance: updated.creditUnits / 10 },
    });
}

// ─── PATCH /api/admin/users/:id/plan ─────────────────────────────────────────
/**
 * Admin action: Switch user plan between free and pro.
 */
export async function updateUserPlan(req, res) {
    const { id } = req.params;
    const { plan } = req.body;

    if (!["free", "pro", "enterprise"].includes(plan)) {
        return res.status(400).json({ error: "Invalid plan. Choose 'free' or 'pro'." });
    }

    const updateData = {
        plan,
        planExpiresAt: plan === "pro" ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null,
    };

    const updated = await User.findByIdAndUpdate(id, updateData, { returnDocument: "after" }).select("-password");
    if (!updated) return res.status(404).json({ error: "User not found" });

    res.json({
        message: `Plan changed to ${plan.toUpperCase()} for ${updated.email}`,
        user: { ...updated.toObject(), balance: updated.creditUnits / 10 },
    });
}

// ─── GET /api/admin/projects/list ───────────────────────────────────────────
/**
 * Paginated and searchable projects list for admin view.
 */
export async function getProjectsList(req, res) {
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(50, Math.max(5, parseInt(req.query.limit || "15", 10)));
    const search = req.query.search?.trim() || "";
    const status = req.query.status || "";

    const filter = {};
    if (status && status !== "all") {
        filter.status = status;
    }
    if (search) {
        filter.name = { $regex: search, $options: "i" };
    }

    const [projects, total] = await Promise.all([
        Project.find(filter)
            .select("name status version generationDuration createdAt completedAt currentFile isPublished")
            .populate("owner", "name email")
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
        Project.countDocuments(filter),
    ]);

    res.json({ projects, total, page, limit, pages: Math.ceil(total / limit) });
}

// ─── GET /api/admin/system/health ────────────────────────────────────────────
/**
 * System health, queues, memory, and runtime statistics.
 */
export async function getSystemHealth(req, res) {
    let redisOk = false;
    try {
        redisOk = await isRedisHealthy();
    } catch {}

    let queueCounts = { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };
    try {
        queueCounts = await generationQueue.getJobCounts("waiting", "active", "completed", "failed", "delayed");
    } catch {}

    const mem = process.memoryUsage();
    const uptimeSec = Math.floor(process.uptime());

    res.json({
        server: {
            status: "operational",
            nodeVersion: process.version,
            uptimeSeconds: uptimeSec,
            memoryRssMb: Math.round(mem.rss / 1024 / 1024),
            memoryHeapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
        },
        database: {
            mongoStatus: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
        },
        redis: {
            status: redisOk ? "connected" : "disconnected",
        },
        queue: {
            name: "generation",
            counts: queueCounts,
        },
        ai: {
            model: process.env.OPENROUTER_MODEL || "default",
            maxConcurrency: process.env.AI_MAX_CONCURRENCY || "3",
            workerConcurrency: process.env.WORKER_CONCURRENCY || "2",
        },
    });
}
