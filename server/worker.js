import dns from "dns";
dns.setDefaultResultOrder("ipv4first");

import "dotenv/config";
import crypto from "crypto";
import { Worker } from "bullmq";
import { connectToDatabase } from "./config/db.js";
import { createRedisClient, createRedisSubscriber, redisClient } from "./config/redis.js";
import { GENERATION_QUEUE_NAME, generationQueue } from "./queues/generationQueue.js";
import { Project } from "./models/Project.js";
import { UsageLog } from "./models/UsageLog.js";
import { generateProject, reviseProject } from "./services/ai.js";
import { applyOperations } from "./services/diff.js";
import { buildManifest } from "./controllers/chatController.js";
import { refundCredits } from "./services/credits.js";
import { publishEvent } from "./services/events.js";
import { publishUserActivityEvent } from "./services/activity.js";

function hashContent(content) {
    return crypto.createHash("md5").update(content).digest("hex").slice(0, 12);
}

// Active in-memory abort controllers mapped by projectId
const activeAbortControllers = new Map();

/**
 * Idempotently refunds credits for a project so retries or concurrent calls
 * never refund more than once.
 */
async function refundProjectCreditsOnce(projectId, userId, units, reason) {
    if (!userId || !units) return;

    // Atomically claim the refund right on the Project document
    const updated = await Project.findOneAndUpdate(
        { _id: projectId, creditsRefunded: { $ne: true } },
        { $set: { creditsRefunded: true } },
        { returnDocument: "after" }
    );

    if (updated) {
        try {
            await refundCredits(userId, units, { projectId, reason });
            await publishEvent(projectId, {
                type: "credits_refunded",
                data: { unitsRefunded: units, reason },
            });
            console.log(`[Worker Credits] Refunded ${units} units for project ${projectId}. Reason: ${reason}`);
        } catch (err) {
            console.error(`[Worker Credits Error] Refund failed for project ${projectId}:`, err.message);
        }
    }
}

/**
 * Reconciles projects left in transient states on worker restart.
 */
async function reconcileStaleProjects() {
    try {
        console.log("[Worker Recovery] Checking for abandoned project generations...");
        const staleProjects = await Project.find({
            status: { $in: ["queued", "generating", "revising"] },
        });

        if (staleProjects.length === 0) {
            console.log("[Worker Recovery] No stale projects found.");
            return;
        }

        // Get currently active and waiting jobs in BullMQ
        const activeJobs = await generationQueue.getJobs(["active", "waiting", "delayed"]);
        const liveProjectIds = new Set(activeJobs.map((j) => j.data?.projectId).filter(Boolean));

        for (const proj of staleProjects) {
            const pid = proj._id.toString();
            if (!liveProjectIds.has(pid)) {
                console.warn(`[Worker Recovery] Reconciling stale project ${pid} (status: ${proj.status})`);
                proj.status = "failed";
                proj.error = "Worker process was restarted while task was in progress";
                proj.completedAt = new Date();
                await proj.save();

                // Idempotently refund credits
                const units = proj.version === 0 ? 20 : 5;
                await refundProjectCreditsOnce(
                    pid,
                    proj.owner.toString(),
                    units,
                    "Refund due to worker restart recovery"
                );

                await publishEvent(pid, {
                    type: "failed",
                    data: { error: proj.error },
                });
            }
        }
    } catch (recErr) {
        console.error("[Worker Recovery Error]", recErr.message);
    }
}

/**
 * Main processor function for BullMQ jobs.
 */
async function processGenerationJob(job) {
    const { type, projectId, prompt, userId, unitsReserved, version } = job.data;
    console.log(`[Worker] Started job ${job.id} (${type}) for project ${projectId}`);

    // Check if job was marked cancelled in Redis before worker picked it up
    const isCancelled = await redisClient.get(`cancel:${projectId}`);
    if (isCancelled) {
        console.log(`[Worker] Project ${projectId} was cancelled before processing started`);
        await Project.findByIdAndUpdate(projectId, {
            status: "cancelled",
            error: "Generation was cancelled by user",
            completedAt: new Date(),
        });
        await refundProjectCreditsOnce(projectId, userId, unitsReserved, "Job cancelled before execution");
        await publishEvent(projectId, {
            type: "cancelled",
            data: { message: "Cancelled by user" },
        });
        return { cancelled: true };
    }

    const abortController = new AbortController();
    activeAbortControllers.set(projectId, abortController);

    try {
        if (type === "generate") {
            await publishEvent(projectId, { type: "queued", data: { status: "queued" } });

            let saveQueue = Promise.resolve();

            const result = await generateProject(
                prompt,
                {
                    onPlan: async (plan) => {
                        console.log(`[Worker AI] Plan created for ${projectId}: ${plan.files.length} files`);
                        const fileList = plan.files.map((f) => `-\`${f.path}\`: ${f.description}`).join("\n");

                        await Project.findByIdAndUpdate(projectId, {
                            name: plan.projectName || "Generated Project",
                            status: "generating",
                            filesPlanned: plan.files,
                            $push: {
                                messages: {
                                    role: "assistant",
                                    content: `Planned website structure:\n${fileList}`,
                                    timestamp: new Date(),
                                },
                            },
                        });

                        await publishEvent(projectId, {
                            type: "plan_ready",
                            data: {
                                name: plan.projectName,
                                filesPlanned: plan.files,
                            },
                        });
                    },
                    onFileStart: async (path) => {
                        await Project.findByIdAndUpdate(projectId, { currentFile: path });
                        await publishEvent(projectId, {
                            type: "file_started",
                            data: { path },
                        });
                    },
                    onFileComplete: async (path, code) => {
                        saveQueue = saveQueue.then(async () => {
                            const project = await Project.findById(projectId);
                            if (!project) return;

                            project.files = project.files || {};
                            project.files[path] = { content: code, hash: hashContent(code) };
                            project.filesGenerated = Array.from(new Set([...(project.filesGenerated || []), path]));
                            project.messages.push({
                                role: "assistant",
                                content: `Created file "${path}"`,
                                timestamp: new Date(),
                            });
                            project.currentFile = null;
                            project.markModified("files");
                            await project.save();

                            await publishEvent(projectId, {
                                type: "file_done",
                                data: { path },
                            });
                        }).catch((err) => {
                            console.error(`[Worker AI] Error saving file ${path}:`, err);
                        });
                        await saveQueue;
                    },
                },
                { signal: abortController.signal }
            );

            await saveQueue;

            const project = await Project.findById(projectId);
            if (project) {
                project.status = "completed";
                project.version = 1;
                if (result.description) project.name = result.description;
                const startTime = project.generationStartedAt || project.createdAt || new Date();
                const durationSec = Math.max(1, Math.round((Date.now() - new Date(startTime).getTime()) / 1000));
                project.generationDuration = durationSec;
                project.completedAt = new Date();
                project.messages.push({
                    role: "assistant",
                    content: `Website generation complete in ${durationSec}s! You can view and edit the files.`,
                    timestamp: new Date(),
                });
                await project.save();

                await publishEvent(projectId, {
                    type: "completed",
                    data: {
                        durationSec,
                        version: 1,
                        name: project.name,
                    },
                });
            }

            // Write UsageLog on success
            if (userId) {
                await UsageLog.create({
                    userId,
                    projectId,
                    action: "generate",
                    model: result.model || process.env.OPENROUTER_MODEL || "unknown",
                    promptTokens: result.usage?.promptTokens || 0,
                    completionTokens: result.usage?.completionTokens || 0,
                    totalTokens: result.usage?.totalTokens || 0,
                    costUsd: result.costUsd || 0,
                    unitsCharged: unitsReserved,
                    status: "success",
                });
                await publishUserActivityEvent(userId, { type: "generate", projectId });
            }

            console.log(`[Worker] Successfully completed generate job for ${projectId}`);
            return { success: true };
        } else if (type === "revise") {
            const project = await Project.findById(projectId);
            if (!project) throw new Error(`Project ${projectId} not found`);

            await publishEvent(projectId, {
                type: "validating",
                data: { message: "AI Agent is revising codebase..." },
            });

            const manifest = buildManifest(project.files);
            const relevantFiles = {};
            for (const [path, entry] of Object.entries(project.files || {})) {
                relevantFiles[path] = entry.content;
            }
            const recentMessages = project.messages.slice(-4).map((m) => ({
                role: m.role,
                content: m.content,
            }));

            const result = await reviseProject(prompt, manifest, relevantFiles, recentMessages, {
                signal: abortController.signal,
            });

            const { files: updatedFiles, applied, errors } = applyOperations(project.files, result.operations);

            project.files = updatedFiles;
            project.markModified("files");
            project.version += 1;
            project.status = "completed";
            project.messages.push({
                role: "assistant",
                content: result.description + (errors.length > 0 ? `\n\nSome operations failed: ${errors.join(", ")}` : ""),
                timestamp: new Date(),
            });

            await project.save();

            await publishEvent(projectId, {
                type: "completed",
                data: {
                    version: project.version,
                    operationsApplied: applied.length,
                    errors: errors.length,
                },
            });

            // Write UsageLog for revision
            if (userId) {
                await UsageLog.create({
                    userId,
                    projectId,
                    action: "revise",
                    model: result.model || process.env.OPENROUTER_MODEL || "unknown",
                    promptTokens: result.usage?.promptTokens || 0,
                    completionTokens: result.usage?.completionTokens || 0,
                    totalTokens: result.usage?.totalTokens || 0,
                    costUsd: result.costUsd || 0,
                    unitsCharged: unitsReserved,
                    status: "success",
                });
                await publishUserActivityEvent(userId, { type: "revise", projectId });
            }

            console.log(`[Worker] Successfully completed revise job for ${projectId}`);
            return { success: true };
        }
    } catch (err) {
        const isAbort =
            err.name === "AbortError" ||
            abortController.signal.aborted ||
            (await redisClient.get(`cancel:${projectId}`));

        if (isAbort) {
            console.log(`[Worker] Job ${job.id} aborted for project ${projectId}`);
            await Project.findByIdAndUpdate(projectId, {
                status: "cancelled",
                error: "Generation was cancelled by user",
                completedAt: new Date(),
            });
            await refundProjectCreditsOnce(projectId, userId, unitsReserved, "Generation cancelled by user");
            await publishEvent(projectId, {
                type: "cancelled",
                data: { message: "Cancelled by user" },
            });
            return { cancelled: true };
        }

        console.error(`[Worker Job Error] Job ${job.id} error:`, err.message, err.responseBody || err.data || "");

        // Check if this was the last attempt
        const maxAttempts = job.opts.attempts || 2;
        const isFinalFailure = job.attemptsMade >= maxAttempts - 1;

        if (isFinalFailure) {
            console.error(`[Worker] Job ${job.id} reached final failure (${maxAttempts} attempts)`);
            await Project.findByIdAndUpdate(projectId, {
                status: "failed",
                error: err.message,
                completedAt: new Date(),
            });

            await refundProjectCreditsOnce(
                projectId,
                userId,
                unitsReserved,
                `Generation failed after retries: ${err.message}`
            );

            await publishEvent(projectId, {
                type: "failed",
                data: { error: err.message },
            });

            if (userId) {
                try {
                    await UsageLog.create({
                        userId,
                        projectId,
                        action: type,
                        model: process.env.OPENROUTER_MODEL || "unknown",
                        promptTokens: 0,
                        completionTokens: 0,
                        totalTokens: 0,
                        costUsd: 0,
                        unitsCharged: 0,
                        status: "failed",
                    });
                } catch (logErr) {
                    console.error("[UsageLog Failure Error]", logErr.message);
                }
            }
        }

        // Re-throw so BullMQ marks attempt as failed and schedules backoff retry if attempts remain
        throw err;
    } finally {
        activeAbortControllers.delete(projectId);
    }
}

// Start worker initialization
await connectToDatabase();

const workerConnection = createRedisClient();
const concurrency = parseInt(process.env.WORKER_CONCURRENCY || "2", 10);

console.log(`[Worker] Starting BullMQ Worker on queue "${GENERATION_QUEUE_NAME}" with concurrency ${concurrency}...`);

export const worker = new Worker(GENERATION_QUEUE_NAME, processGenerationJob, {
    connection: workerConnection,
    concurrency,
});

// Pub/Sub cancellation listener
const cancelSub = createRedisSubscriber();
await cancelSub.subscribe("project:cancel");
cancelSub.on("message", (channel, message) => {
    if (channel === "project:cancel") {
        try {
            const { projectId } = JSON.parse(message);
            const ac = activeAbortControllers.get(projectId);
            if (ac) {
                console.log(`[Worker PubSub] Received cancel signal for active project ${projectId}`);
                ac.abort();
            }
        } catch (e) {
            console.error("[Worker PubSub Cancel Parse Error]", e.message);
        }
    }
});

// Run recovery for stale jobs on startup
await reconcileStaleProjects();

worker.on("completed", (job) => {
    console.log(`[Worker Event] Job ${job.id} completed successfully`);
});

worker.on("failed", (job, err) => {
    console.error(`[Worker Event] Job ${job?.id} failed with error: ${err.message}`);
});

// Graceful shutdown
const handleShutdown = async (signal) => {
    console.log(`[Worker] Received ${signal}. Closing gracefully...`);
    try {
        await worker.close();
        await cancelSub.quit();
        process.exit(0);
    } catch (err) {
        console.error("[Worker Shutdown Error]", err);
        process.exit(1);
    }
};

process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));
