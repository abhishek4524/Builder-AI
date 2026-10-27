import "dotenv/config";
import { Redis } from "ioredis";

export const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

/**
 * Creates a configured Redis client instance.
 * For BullMQ and general worker use, maxRetriesPerRequest must be null.
 *
 * @param {Object} [options={}]
 * @returns {Redis}
 */
export function createRedisClient(options = {}) {
    const client = new Redis(REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        retryStrategy(times) {
            return Math.min(times * 100, 3000);
        },
        ...options,
    });

    client.on("error", (err) => {
        // Prevent unhandled error event crash when Redis is offline
        if (process.env.NODE_ENV !== "test" && !process.env.VITEST) {
            console.error(`[Redis Error] ${err.message}`);
        }
    });

    return client;
}

// Dedicated client for publishing events and general Redis cache/status operations
export const redisClient = createRedisClient();

/**
 * Factory to create a separate Redis subscriber connection.
 * Note: A Redis connection in subscriber mode CANNOT be shared with regular commands or other queues.
 * @returns {Redis}
 */
export function createRedisSubscriber() {
    return createRedisClient();
}

/**
 * Checks Redis health via PING.
 * @returns {Promise<boolean>}
 */
export async function isRedisHealthy() {
    try {
        const reply = await redisClient.ping();
        return reply === "PONG";
    } catch {
        return false;
    }
}
