import { redisClient } from "../config/redis.js";
import { Project } from "../models/Project.js";

/**
 * Publishes a real-time event to the Redis Pub/Sub channel "project:<id>"
 * and persists a compact progress snapshot to the MongoDB Project document.
 *
 * @param {string} projectId
 * @param {Object} event
 * @param {string} event.type - e.g. "queued"|"plan_ready"|"file_started"|"file_done"|"file_failed"|"validating"|"completed"|"failed"|"cancelled"|"credits_refunded"
 * @param {Object} [event.data={}]
 * @returns {Promise<Object>} The published event with assigned sequential id
 */
export async function publishEvent(projectId, event) {
    if (!projectId || !event?.type) {
        throw new Error("projectId and event.type are required to publish an event");
    }

    // Generate atomic sequential event ID for this project using Redis
    let eventId = Date.now();
    try {
        const counterKey = `project:event_counter:${projectId}`;
        const nextId = await redisClient.incr(counterKey);
        await redisClient.expire(counterKey, 3600); // 1 hour TTL
        eventId = nextId;
    } catch (err) {
        // Fallback to timestamp if Redis counter is temporarily degraded
        eventId = Date.now();
    }

    const payload = {
        id: eventId,
        type: event.type,
        projectId,
        timestamp: Date.now(),
        data: event.data || {},
    };

    // 1. Publish to Redis channel "project:<id>"
    const channel = `project:${projectId}`;
    try {
        await redisClient.publish(channel, JSON.stringify(payload));
    } catch (pubErr) {
        console.error(`[Events Pub/Sub Error] Failed to publish event to ${channel}:`, pubErr.message);
    }

    // 2. Persist compact progress snapshot to MongoDB Project document so Mongo stays the source of truth
    try {
        const updateFields = { updatedAt: new Date() };

        if (event.type === "queued") {
            updateFields.status = "queued";
        } else if (event.type === "plan_ready") {
            updateFields.status = "generating";
            if (event.data?.filesPlanned) updateFields.filesPlanned = event.data.filesPlanned;
            if (event.data?.plannedFiles) updateFields.filesPlanned = event.data.plannedFiles;
            if (event.data?.name) updateFields.name = event.data.name;
        } else if (event.type === "file_started") {
            updateFields.currentFile = event.data?.path || event.data?.file || null;
            updateFields.status = "generating";
        } else if (event.type === "file_done") {
            updateFields.currentFile = null;
            if (event.data?.path) {
                updateFields.$addToSet = { filesGenerated: event.data.path };
            }
        } else if (event.type === "completed") {
            updateFields.status = "completed";
            updateFields.currentFile = null;
            if (event.data?.durationSec) updateFields.generationDuration = event.data.durationSec;
            if (event.data?.version !== undefined) updateFields.version = event.data.version;
            updateFields.completedAt = new Date();
        } else if (event.type === "failed") {
            updateFields.status = "failed";
            updateFields.currentFile = null;
            updateFields.error = event.data?.error || "Generation failed";
            if (event.data?.durationSec) updateFields.generationDuration = event.data.durationSec;
            updateFields.completedAt = new Date();
        } else if (event.type === "cancelled") {
            updateFields.status = "cancelled";
            updateFields.currentFile = null;
            updateFields.error = "Generation was cancelled by user";
            updateFields.completedAt = new Date();
        }

        const addToSet = updateFields.$addToSet;
        delete updateFields.$addToSet;

        const mongoUpdate = { $set: updateFields };
        if (addToSet) {
            mongoUpdate.$addToSet = addToSet;
        }

        await Project.findByIdAndUpdate(projectId, mongoUpdate);
    } catch (dbErr) {
        console.error(`[Events DB Error] Failed to update project snapshot ${projectId}:`, dbErr.message);
    }

    return payload;
}

/**
 * Returns a compact progress snapshot from the Project document for newly connected SSE clients.
 * @param {string} projectId
 * @returns {Promise<Object|null>}
 */
export async function getProjectProgressSnapshot(projectId) {
    const project = await Project.findById(projectId).select(
        "name status filesPlanned filesGenerated currentFile error version generationStartedAt generationDuration completedAt updatedAt"
    );
    if (!project) return null;

    return {
        id: 0,
        type: "snapshot",
        projectId: project._id.toString(),
        timestamp: Date.now(),
        data: {
            name: project.name,
            status: project.status,
            filesPlanned: project.filesPlanned || [],
            filesGenerated: project.filesGenerated || [],
            currentFile: project.currentFile || null,
            error: project.error || null,
            version: project.version || 0,
            generationStartedAt: project.generationStartedAt,
            generationDuration: project.generationDuration,
            completedAt: project.completedAt,
        },
    };
}
