import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import {
  profileUpdateLimiter,
  changePasswordLimiter,
  accountDeleteLimiter,
} from "../middleware/rateLimiters.js";
import {
  updateProfile,
  changePassword,
  setPassword,
  logoutAll,
  getSummary,
  deleteAccount,
  restoreAccount,
  getActivity,
  streamActivity,
} from "../controllers/accountController.js";

const accountRouter = Router();

// Account summary & profile
accountRouter.get("/summary", authMiddleware, getSummary);
accountRouter.patch("/profile", authMiddleware, profileUpdateLimiter, updateProfile);

// Live Activity & Heatmap
accountRouter.get("/activity", authMiddleware, getActivity);
accountRouter.get("/activity/stream", authMiddleware, streamActivity);

// Usage summary fallback for account page
accountRouter.get("/usage", authMiddleware, async (req, res, next) => {
  try {
    const { UsageLog } = await import("../models/UsageLog.js");
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

// Security & credentials
accountRouter.post("/change-password", authMiddleware, changePasswordLimiter, changePassword);
accountRouter.post("/set-password", authMiddleware, changePasswordLimiter, setPassword);
accountRouter.post("/logout-all", authMiddleware, logoutAll);

// Deletion & restoration
accountRouter.post("/delete", authMiddleware, accountDeleteLimiter, deleteAccount);
accountRouter.post("/restore", restoreAccount);

export default accountRouter;
