import crypto from "crypto";
import { Project } from "../models/Project.js";
import { User } from "../models/User.js";
import { CREDITS_CONFIG } from "../config/credits.js";
import { reserveCredits, refundCredits, InsufficientCreditsError } from "../services/credits.js";
import { addGenerationJob, generationQueue } from "../queues/generationQueue.js";
import { publishEvent, getProjectProgressSnapshot } from "../services/events.js";
import { createRedisSubscriber, redisClient } from "../config/redis.js";
import { UsageLog } from "../models/UsageLog.js";
import { publishUserActivityEvent } from "../services/activity.js";

function hashContent(content) {
    return crypto.createHash("md5").update(content).digest("hex").slice(0, 12);
}

/**
 * Returns project query filter. Admins have omnipotent read/manage access
 * across all users' projects in builder, preview, and inspections.
 */
export function getProjectOwnershipQuery(req, id) {
    if (req.user?.isAdmin) {
        return { _id: id };
    }
    return { _id: id, owner: req.user.userId };
}

// Track active SSE connections per user to prevent connection exhaustion
const userSSEConnections = new Map();

// POST /api/projects
// Create and queue a new project generation job.
export async function createProject(req, res) {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== "string") {
        res.status(400).json({ error: "prompt is required" });
        return;
    }
    if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }

    // EMAIL VERIFICATION PAUSED — re-enable this block when email service is live in production
    // const userRecord = await User.findById(req.user.userId).select("emailVerified");
    // if (userRecord && userRecord.emailVerified === false) {
    //     return res.status(403).json({
    //         code: "EMAIL_NOT_VERIFIED",
    //         error: "Please verify your email address before generating a website.",
    //     });
    // }

    // 1. Guard: Block more than 1 active generation per user at a time
    const activeProject = await Project.findOne({
        owner: req.user.userId,
        status: { $in: ["queued", "pending", "generating", "revising"] },
    });
    if (activeProject) {
        return res.status(409).json({
            code: "GENERATION_IN_PROGRESS",
            message: "A website generation is already in progress. Please wait.",
        });
    }

    // 2. Reserve credits atomically before enqueueing
    const unitsToCharge = CREDITS_CONFIG.COST_GENERATE_UNITS;
    try {
        await reserveCredits(req.user.userId, unitsToCharge, {
            reason: "Generate new project",
        });
    } catch (err) {
        if (err.code === "INSUFFICIENT_CREDITS" || err instanceof InsufficientCreditsError) {
            return res.status(402).json({
                code: "INSUFFICIENT_CREDITS",
                balance: err.balance,
                required: err.required,
            });
        }
        throw err;
    }

    const now = new Date();
    let project;
    try {
        project = await Project.create({
            name: "Planning project...",
            description: prompt,
            files: {},
            messages: [
                { role: "user", content: prompt },
                { role: "assistant", content: "Planning project structure..." },
            ],
            version: 0,
            owner: req.user.userId,
            status: "queued",
            filesPlanned: [],
            filesGenerated: [],
            currentFile: null,
            error: null,
            generationStartedAt: now,
            generationDuration: null,
            completedAt: null,
            creditsRefunded: false,
        });
    } catch (createErr) {
        await refundCredits(req.user.userId, unitsToCharge, {
            reason: `Project DB creation failed: ${createErr.message}`,
        });
        throw createErr;
    }

    // 3. Enqueue job into BullMQ
    try {
        await addGenerationJob({
            projectId: project._id.toString(),
            prompt,
            userId: req.user.userId,
            unitsReserved: unitsToCharge,
            version: 0,
        });

        await publishEvent(project._id.toString(), {
            type: "queued",
            data: { message: "Project queued for generation" },
        });
    } catch (queueErr) {
        console.error(`[Queue Error] Failed to enqueue generation job:`, queueErr);
        await Project.findByIdAndUpdate(project._id, {
            status: "failed",
            error: "Queue service unavailable",
        });

        await refundCredits(req.user.userId, unitsToCharge, {
            projectId: project._id,
            reason: "Queue unavailable; generation aborted",
        });

        return res.status(503).json({
            error: "Generation service temporarily unavailable. Credits have been refunded.",
        });
    }

    // Return project immediately
    res.status(201).json({
        _id: project._id,
        name: project.name,
        description: project.description,
        files: {},
        messages: project.messages,
        version: project.version,
        status: project.status,
        filesPlanned: project.filesPlanned,
        filesGenerated: project.filesGenerated,
        currentFile: project.currentFile,
        error: project.error,
        generationStartedAt: project.generationStartedAt,
        generationDuration: project.generationDuration,
        completedAt: project.completedAt,
        createdAt: project.createdAt,
    });
}

// POST /api/projects/:id/cancel
// Cancels a waiting or running generation/revision job and refunds credits.
export async function cancelProject(req, res) {
    const { id } = req.params;
    if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const project = await Project.findOne(getProjectOwnershipQuery(req, id));
    if (!project) {
        return res.status(404).json({ error: "Project not found" });
    }

    if (["completed", "failed", "cancelled"].includes(project.status)) {
        return res.status(400).json({ error: `Cannot cancel a project that is already ${project.status}` });
    }

    // Set cancellation flag in Redis
    await redisClient.set(`cancel:${id}`, "1", "EX", 600);

    // Notify active workers via Pub/Sub to trigger AbortController
    try {
        await redisClient.publish("project:cancel", JSON.stringify({ projectId: id }));
    } catch (pubErr) {
        console.error("[Cancel PubSub Error]", pubErr.message);
    }

    // Attempt to remove waiting/delayed job from BullMQ queue
    try {
        const jobId = project.version === 0 ? `generate_${id}_v0` : `revise_${id}_v${project.version}`;
        const job = await generationQueue.getJob(jobId);
        if (job) {
            const state = await job.getState();
            if (["waiting", "delayed"].includes(state)) {
                await job.remove();
                console.log(`[Cancel] Removed job ${jobId} directly from queue`);
            }
        }
    } catch (qErr) {
        console.warn(`[Cancel Queue Warning] Could not remove job:`, qErr.message);
    }

    // Atomically claim refund right on Project to ensure single refund
    const updated = await Project.findOneAndUpdate(
        { _id: id, creditsRefunded: { $ne: true } },
        {
            $set: {
                status: "cancelled",
                error: "Generation was cancelled by user",
                completedAt: new Date(),
                creditsRefunded: true,
            },
        },
        { returnDocument: "after" }
    );

    const units = project.version === 0 ? CREDITS_CONFIG.COST_GENERATE_UNITS : CREDITS_CONFIG.COST_REVISE_UNITS;
    if (updated) {
        try {
            await refundCredits(req.user.userId, units, {
                projectId: id,
                reason: "Generation cancelled by user",
            });
            await publishEvent(id, {
                type: "credits_refunded",
                data: { unitsRefunded: units, reason: "Generation cancelled by user" },
            });
        } catch (refErr) {
            console.error("[Cancel Refund Error]", refErr.message);
        }
    } else {
        await Project.findByIdAndUpdate(id, {
            status: "cancelled",
            error: "Generation was cancelled by user",
            completedAt: new Date(),
        });
    }

    await publishEvent(id, {
        type: "cancelled",
        data: { message: "Cancelled by user" },
    });

    res.json({ success: true, message: "Generation cancelled successfully" });
}

// GET /api/projects/:id/events
// Server-Sent Events (SSE) stream for real-time progress updates.
export async function streamProjectEvents(req, res) {
    const { id } = req.params;
    if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const userId = req.user.userId.toString();
    const currentConns = userSSEConnections.get(userId) || 0;
    if (currentConns >= 8) {
        return res.status(429).json({ error: "Too many concurrent event stream connections" });
    }
    userSSEConnections.set(userId, currentConns + 1);

    const project = await Project.findOne(getProjectOwnershipQuery(req, id));
    if (!project) {
        userSSEConnections.set(userId, Math.max(0, (userSSEConnections.get(userId) || 1) - 1));
        return res.status(404).json({ error: "Project not found" });
    }

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    if (typeof res.flushHeaders === "function") {
        res.flushHeaders();
    }

    // 1. Immediately send initial snapshot from MongoDB so reloads/reconnects always get latest state
    const snapshot = await getProjectProgressSnapshot(id);
    if (snapshot) {
        res.write(`id: 0\nevent: snapshot\ndata: ${JSON.stringify(snapshot.data)}\n\n`);
    }

    // If project is already terminated, finish stream immediately
    if (["completed", "failed", "cancelled"].includes(project.status)) {
        res.write(`event: ${project.status}\ndata: ${JSON.stringify({ status: project.status })}\n\n`);
        userSSEConnections.set(userId, Math.max(0, (userSSEConnections.get(userId) || 1) - 1));
        return res.end();
    }

    // 2. Subscribe to Redis Pub/Sub channel for live events
    const subscriber = createRedisSubscriber();
    const channel = `project:${id}`;
    let isClosed = false;

    await subscriber.subscribe(channel);

    subscriber.on("message", (chan, message) => {
        if (chan !== channel || isClosed) return;
        try {
            const event = JSON.parse(message);
            res.write(`id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`);

            if (["completed", "failed", "cancelled"].includes(event.type)) {
                cleanup();
            }
        } catch (e) {
            console.error("[SSE Event Parse Error]", e.message);
        }
    });

    // 3. Heartbeat ping
    const heartbeatMs = parseInt(process.env.SSE_HEARTBEAT_MS || "20000", 10);
    const heartbeatTimer = setInterval(() => {
        if (!isClosed) {
            res.write(": ping\n\n");
        }
    }, heartbeatMs);

    const cleanup = () => {
        if (isClosed) return;
        isClosed = true;
        clearInterval(heartbeatTimer);
        userSSEConnections.set(userId, Math.max(0, (userSSEConnections.get(userId) || 1) - 1));
        subscriber.unsubscribe(channel).catch(() => {});
        subscriber.quit().catch(() => {});
        res.end();
    };

    req.on("close", cleanup);
    req.on("error", cleanup);
}

// GET /api/projects
// List all projects owned by the user.
export async function listProjects(req, res) {
    if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }

    const projects = await Project.find(
        { owner: req.user.userId },
        { name: 1, description: 1, version: 1, createdAt: 1, updatedAt: 1, generationDuration: 1, status: 1 }
    ).sort({ updatedAt: -1 });

    res.json(projects);
}

// GET /api/projects/:id
// Get full project details.
export async function getProject(req, res) {
    if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }

    const project = await Project.findOne(getProjectOwnershipQuery(req, req.params.id));
    if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
    }

    const filesObj = {};
    for (const [path, entry] of Object.entries(project.files || {})) {
        filesObj[path] = entry.content;
    }

    res.json({
        _id: project._id,
        name: project.name,
        description: project.description,
        files: filesObj,
        messages: project.messages,
        version: project.version,
        status: project.status,
        filesPlanned: project.filesPlanned,
        filesGenerated: project.filesGenerated,
        currentFile: project.currentFile,
        error: project.error,
        generationStartedAt: project.generationStartedAt || project.createdAt,
        generationDuration: project.generationDuration,
        completedAt: project.completedAt,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
    });
}

// DELETE /api/projects/:id
export async function deleteProject(req, res) {
    if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }

    const result = await Project.findOneAndDelete(getProjectOwnershipQuery(req, req.params.id));
    if (!result) {
        res.status(404).json({ error: "Project not found" });
        return;
    }

    res.json({ success: true });
}

// PUT /api/projects/:id/files
export async function updateProjectFiles(req, res) {
    const { files } = req.body;
    if (!files || typeof files !== "object") {
        res.status(400).json({ error: "files object is required" });
        return;
    }
    if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }

    const project = await Project.findOne(getProjectOwnershipQuery(req, req.params.id));
    if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
    }

    if (["queued", "pending", "generating", "revising"].includes(project.status)) {
        res.status(400).json({ error: "Cannot modify files while website generation is in progress" });
        return;
    }

    const newFiles = {};
    for (const [path, content] of Object.entries(files)) {
        if (typeof content === "string") {
            newFiles[path] = { content, hash: hashContent(content) };
        }
    }
    project.files = newFiles;
    await project.save();

    // Log manual edit activity and broadcast live update
    try {
        await UsageLog.create({
            userId: req.user.userId,
            projectId: project._id,
            action: "edit",
            model: "manual",
            unitsCharged: 0,
            status: "success",
        });
        await publishUserActivityEvent(req.user.userId, {
            type: "edit",
            projectId: project._id,
        });
    } catch (logErr) {
        console.warn("[ProjectController Activity Log Error]", logErr.message);
    }

    const filesObj = {};
    for (const [path, entry] of Object.entries(project.files || {})) {
        filesObj[path] = entry.content;
    }

    res.json({
        _id: project._id,
        name: project.name,
        description: project.description,
        files: filesObj,
        messages: project.messages,
        version: project.version,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
    });
}

// POST /api/projects/:id/publish
export async function publishProject(req, res) {
    if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }

    const project = await Project.findOneAndUpdate(
        getProjectOwnershipQuery(req, req.params.id),
        { published: true },
        { returnDocument: "after" }
    );

    if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
    }

    res.json({ success: true, published: project.published });
}

// GET /api/projects/public/:id
export async function getPublicProject(req, res) {
    const project = await Project.findById(req.params.id);
    if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
    }
    if (!project.published) {
        res.status(403).json({ error: "Project is not published yet" });
        return;
    }

    const filesObj = {};
    for (const [path, entry] of Object.entries(project.files || {})) {
        filesObj[path] = entry.content;
    }

    res.json({
        _id: project._id,
        name: project.name,
        description: project.description,
        files: filesObj,
        version: project.version,
    });
}
