import { redisClient } from "../config/redis.js";
import { UsageLog } from "../models/UsageLog.js";
import { Project } from "../models/Project.js";
import mongoose from "mongoose";

/**
 * Publishes a live user activity update to the Redis Pub/Sub channel "user:<userId>:activity"
 * @param {string|mongoose.Types.ObjectId} userId
 * @param {Object} data
 */
export async function publishUserActivityEvent(userId, data = {}) {
    if (!userId) return;
    const channel = `user:${userId.toString()}:activity`;
    const payload = {
        type: "activity_update",
        timestamp: Date.now(),
        data,
    };
    try {
        await redisClient.publish(channel, JSON.stringify(payload));
    } catch (err) {
        console.warn(`[Activity PubSub Warning] Failed to publish to ${channel}:`, err.message);
    }
}

/**
 * Helper to format Date to "YYYY-MM-DD"
 */
function formatDateKey(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

const MONTH_NAMES = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

/**
 * Retrieves activity stats and the 52/53-week heatmap grid for a given user.
 * @param {string|mongoose.Types.ObjectId} userId
 * @returns {Promise<Object>}
 */
export async function getUserActivityData(userId) {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    // Calculate grid start date:
    // 52 full weeks prior to the start of this week (Sunday)
    const currentDayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - currentDayOfWeek - (52 * 7));
    startDate.setHours(0, 0, 0, 0);

    // 1. Fetch usage logs for user in the date range
    const logs = await UsageLog.find({
        userId: userObjectId,
        createdAt: { $gte: startDate, $lte: today },
        status: { $ne: "failed" },
    }).select("action createdAt projectId").lean();

    // Map of dates -> counts
    const countsMap = new Map();

    const incrementDate = (d) => {
        if (!d) return;
        const key = formatDateKey(d);
        countsMap.set(key, (countsMap.get(key) || 0) + 1);
    };

    const projectIdsWithLogs = new Set();
    for (const log of logs) {
        incrementDate(log.createdAt);
        if (log.projectId) {
            projectIdsWithLogs.add(log.projectId.toString());
        }
    }

    // 2. Fetch projects to capture historical creations and user chat messages
    // (fallback for projects or revisions before UsageLog was enabled)
    const projects = await Project.find({
        owner: userObjectId,
        $or: [
            { createdAt: { $gte: startDate, $lte: today } },
            { "messages.timestamp": { $gte: startDate, $lte: today } },
        ],
    }).select("_id createdAt messages").lean();

    for (const p of projects) {
        const pId = p._id.toString();
        // If this project has no UsageLogs recorded at all, fallback to its createdAt and user messages
        if (!projectIdsWithLogs.has(pId)) {
            if (p.createdAt && p.createdAt >= startDate && p.createdAt <= today) {
                incrementDate(p.createdAt);
            }
            if (Array.isArray(p.messages)) {
                for (const m of p.messages) {
                    if (m.role === "user" && m.timestamp && m.timestamp >= startDate && m.timestamp <= today) {
                        incrementDate(m.timestamp);
                    }
                }
            }
        }
    }

    // 3. Build 53 weeks x 7 days grid
    const weeks = [];
    const months = [];
    let lastMonthIndex = -1;

    let cursor = new Date(startDate);
    const totalDays = 53 * 7;
    let dayCount = 0;

    let currentWeek = [];

    const nowTimestamp = Date.now();

    while (dayCount < totalDays) {
        const dateKey = formatDateKey(cursor);
        const dayOfWeek = cursor.getDay();
        const monthIndex = cursor.getMonth();
        const isFuture = cursor.getTime() > nowTimestamp;
        const count = isFuture ? 0 : (countsMap.get(dateKey) || 0);

        currentWeek.push({
            date: dateKey,
            count,
            dayOfWeek,
            isFuture,
        });

        // When reaching a new month on the 1st day of the week or first few days
        if (dayOfWeek === 0) {
            const colIndex = Math.floor(dayCount / 7);
            if (monthIndex !== lastMonthIndex) {
                months.push({
                    name: MONTH_NAMES[monthIndex],
                    colIndex,
                });
                lastMonthIndex = monthIndex;
            }
        }

        if (currentWeek.length === 7) {
            weeks.push(currentWeek);
            currentWeek = [];
        }

        cursor.setDate(cursor.getDate() + 1);
        dayCount++;
    }

    // 4. Calculate Stats
    // Past 365 days stats:
    const pastYearStartDate = new Date(today);
    pastYearStartDate.setDate(today.getDate() - 365);
    const pastYearStartKey = formatDateKey(pastYearStartDate);
    const todayKey = formatDateKey(today);

    let totalEdits = 0;
    let daysActive = 0;

    for (const [key, cnt] of countsMap.entries()) {
        if (key >= pastYearStartKey && key <= todayKey && cnt > 0) {
            totalEdits += cnt;
            daysActive++;
        }
    }

    const dailyAverage = (totalEdits / 365).toFixed(1);
    const percentOfYear = Math.round((daysActive / 365) * 100);

    // Current Streak calculation:
    // Check today:
    let currentStreak = 0;
    const streakCursor = new Date(today);
    const todayCount = countsMap.get(todayKey) || 0;

    if (todayCount > 0) {
        currentStreak++;
        streakCursor.setDate(streakCursor.getDate() - 1);
        while (true) {
            const k = formatDateKey(streakCursor);
            if ((countsMap.get(k) || 0) > 0) {
                currentStreak++;
                streakCursor.setDate(streakCursor.getDate() - 1);
            } else {
                break;
            }
        }
    } else {
        // Today has 0 edits so far. Check if yesterday had edits
        streakCursor.setDate(streakCursor.getDate() - 1);
        const yesterdayKey = formatDateKey(streakCursor);
        if ((countsMap.get(yesterdayKey) || 0) > 0) {
            while (true) {
                const k = formatDateKey(streakCursor);
                if ((countsMap.get(k) || 0) > 0) {
                    currentStreak++;
                    streakCursor.setDate(streakCursor.getDate() - 1);
                } else {
                    break;
                }
            }
        }
    }

    // Longest Streak in the year
    let longestStreak = 0;
    let tempStreak = 0;
    const yearCursor = new Date(pastYearStartDate);
    while (yearCursor <= today) {
        const k = formatDateKey(yearCursor);
        if ((countsMap.get(k) || 0) > 0) {
            tempStreak++;
            if (tempStreak > longestStreak) longestStreak = tempStreak;
        } else {
            tempStreak = 0;
        }
        yearCursor.setDate(yearCursor.getDate() + 1);
    }

    return {
        stats: {
            totalEdits,
            dailyAverage,
            daysActive,
            percentOfYear,
            currentStreak,
            longestStreak,
        },
        weeks,
        months,
    };
}
