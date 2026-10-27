import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { getUserCreditSummary } from "../services/credits.js";
import { UsageLog } from "../models/UsageLog.js";

const creditRouter = Router();

// Require authentication for all credit and usage endpoints
creditRouter.use(authMiddleware);

// GET /api/credits
// Returns user credit balance, integer units, plan, and recent 20 ledger transactions
creditRouter.get("/credits", async (req, res, next) => {
    try {
        const summary = await getUserCreditSummary(req.user.userId, 20);
        res.json(summary);
    } catch (err) {
        next(err);
    }
});

// GET /api/usage
// Returns aggregated usage statistics and 30-day summary for the authenticated user
creditRouter.get("/usage", async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const [totals, thirtyDayLogs] = await Promise.all([
            UsageLog.aggregate([
                { $match: { userId: new (await import("mongoose")).default.Types.ObjectId(userId) } },
                {
                    $group: {
                        _id: null,
                        totalGenerations: {
                            $sum: { $cond: [{ $eq: ["$action", "generate"] }, 1, 0] },
                        },
                        totalRevisions: {
                            $sum: { $cond: [{ $eq: ["$action", "revise"] }, 1, 0] },
                        },
                        totalTokens: { $sum: "$totalTokens" },
                        totalCostUsd: { $sum: "$costUsd" },
                        successfulGenerations: {
                            $sum: {
                                $cond: [
                                    { $and: [{ $eq: ["$action", "generate"] }, { $eq: ["$status", "success"] }] },
                                    1,
                                    0,
                                ],
                            },
                        },
                    },
                },
            ]),
            UsageLog.find({
                userId,
                createdAt: { $gte: thirtyDaysAgo },
            })
                .sort({ createdAt: -1 })
                .limit(100),
        ]);

        const summary = totals[0] || {
            totalGenerations: 0,
            totalRevisions: 0,
            totalTokens: 0,
            totalCostUsd: 0,
            successfulGenerations: 0,
        };

        res.json({
            totalGenerations: summary.totalGenerations,
            totalRevisions: summary.totalRevisions,
            totalTokens: summary.totalTokens,
            totalCostUsd: Math.round(summary.totalCostUsd * 10000) / 10000,
            last30DaysSummary: {
                count: thirtyDayLogs.length,
                logs: thirtyDayLogs,
            },
        });
    } catch (err) {
        next(err);
    }
});

export default creditRouter;
