import { Queue } from "bullmq";
import { createRedisClient } from "../config/redis.js";

const connection = createRedisClient();

export const GENERATION_QUEUE_NAME = "generation";

export const generationQueue = new Queue(GENERATION_QUEUE_NAME, {
    connection,
    defaultJobOptions: {
        attempts: 2,
        backoff: {
            type: "exponential",
            delay: 1000,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
    },
});

/**
 * Enqueues an initial website generation job with deterministic jobId.
 *
 * @param {Object} data
 * @param {string} data.projectId
 * @param {string} data.prompt
 * @param {string} data.userId
 * @param {number} data.unitsReserved
 * @param {number} [data.version=0]
 * @returns {Promise<import('bullmq').Job>}
 */
export async function addGenerationJob({ projectId, prompt, userId, unitsReserved, version = 0 }) {
    const jobId = `generate_${projectId}_v${version}`;
    return await generationQueue.add(
        "generate",
        {
            type: "generate",
            projectId,
            prompt,
            userId,
            unitsReserved,
            version,
        },
        {
            jobId,
        }
    );
}

/**
 * Enqueues a project revision chat job with deterministic jobId.
 *
 * @param {Object} data
 * @param {string} data.projectId
 * @param {string} data.prompt
 * @param {string} data.userId
 * @param {number} data.unitsReserved
 * @param {number} data.version
 * @returns {Promise<import('bullmq').Job>}
 */
export async function addRevisionJob({ projectId, prompt, userId, unitsReserved, version }) {
    const jobId = `revise_${projectId}_v${version}`;
    return await generationQueue.add(
        "revise",
        {
            type: "revise",
            projectId,
            prompt,
            userId,
            unitsReserved,
            version,
        },
        {
            jobId,
        }
    );
}
