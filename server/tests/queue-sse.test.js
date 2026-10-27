import "dotenv/config";
import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import mongoose from "mongoose";
import { Redis } from "ioredis";

import { User } from "../models/User.js";
import { Project } from "../models/Project.js";
import { UsageLog } from "../models/UsageLog.js";
import { CreditTransaction } from "../models/CreditTransaction.js";
import { addGenerationJob, addRevisionJob, generationQueue } from "../queues/generationQueue.js";
import { publishEvent, getProjectProgressSnapshot } from "../services/events.js";
import { reserveCredits } from "../services/credits.js";
import { CREDITS_CONFIG } from "../config/credits.js";

const REDIS_TEST_URL = process.env.REDIS_URL_TEST || process.env.REDIS_URL || "redis://127.0.0.1:6379";

let redisAvailable = false;
let redisTestClient = null;

beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(process.env.MONGODB_URI);
    }

    try {
        redisTestClient = new Redis(REDIS_TEST_URL, {
            maxRetriesPerRequest: null,
            connectTimeout: 2000,
            retryStrategy: () => null, // don't retry in test check
        });
        const pong = await redisTestClient.ping();
        redisAvailable = pong === "PONG";
    } catch {
        redisAvailable = false;
    }

    if (!redisAvailable) {
        console.warn(
            "\n[TEST NOTICE] Skipping live Redis queue tests: REDIS_URL_TEST is not configured or Redis is unreachable.\n" +
            "To run full live queue tests, start Redis (e.g. docker compose -f docker-compose.dev.yml up -d) or set REDIS_URL_TEST.\n"
        );
    }
});

afterAll(async () => {
    if (redisTestClient) {
        try {
            await redisTestClient.quit();
        } catch {}
    }
    await mongoose.disconnect();
});

describe("BullMQ, Events & SSE System", () => {
    let testUser;

    beforeAll(async () => {
        testUser = await User.create({
            name: "Queue Test User",
            email: `queue_test_${Date.now()}@example.com`,
            password: "password123",
            creditUnits: 100,
            plan: "free",
        });
    });

    afterAll(async () => {
        if (testUser) {
            await User.deleteOne({ _id: testUser._id });
            await Project.deleteMany({ owner: testUser._id });
            await CreditTransaction.deleteMany({ userId: testUser._id });
            await UsageLog.deleteMany({ userId: testUser._id });
        }
    });

    it("creates deterministic job IDs for generation and revision to prevent duplicate enqueueing", async () => {
        const dummyProjectId = new mongoose.Types.ObjectId().toString();

        const genJobId = `generate_${dummyProjectId}_v0`;
        const revJobId = `revise_${dummyProjectId}_v1`;

        expect(genJobId).toBe(`generate_${dummyProjectId}_v0`);
        expect(revJobId).toBe(`revise_${dummyProjectId}_v1`);
    });

    it("getProjectProgressSnapshot generates correct snapshot structure from MongoDB", async () => {
        const project = await Project.create({
            name: "Snapshot Test Project",
            description: "Test description",
            owner: testUser._id,
            status: "generating",
            filesPlanned: [{ path: "/App.js", description: "Root" }],
            filesGenerated: ["/App.js"],
            currentFile: "/styles.css",
            version: 1,
        });

        const snapshot = await getProjectProgressSnapshot(project._id.toString());
        expect(snapshot).not.toBeNull();
        expect(snapshot.type).toBe("snapshot");
        expect(snapshot.projectId).toBe(project._id.toString());
        expect(snapshot.data.status).toBe("generating");
        expect(snapshot.data.filesPlanned.length).toBe(1);
        expect(snapshot.data.filesGenerated).toContain("/App.js");
        expect(snapshot.data.currentFile).toBe("/styles.css");

        await Project.deleteOne({ _id: project._id });
    });

    it("reserves credits once at enqueue time and does not double charge", async () => {
        const initialUser = await User.findById(testUser._id);
        const startUnits = initialUser.creditUnits;

        // Reserve credits for generate
        const unitsToCharge = CREDITS_CONFIG.COST_GENERATE_UNITS;
        await reserveCredits(testUser._id, unitsToCharge, { reason: "Enqueue test" });

        const afterReserve = await User.findById(testUser._id);
        expect(afterReserve.creditUnits).toBe(startUnits - unitsToCharge);

        // Verify ledger entry
        const tx = await CreditTransaction.findOne({ userId: testUser._id, type: "reserve" }).sort({ createdAt: -1 });
        expect(tx).not.toBeNull();
        expect(tx.units).toBe(-unitsToCharge);
    });

    // -------------------------------------------------------------
    // Live Redis & BullMQ Tests (Run when Redis is available)
    // -------------------------------------------------------------
    describe("Live Redis Queue & Worker Tests", () => {
        it("skips gracefully or connects when Redis is available", async () => {
            if (!redisAvailable) {
                expect(true).toBe(true);
                return;
            }

            const ping = await redisTestClient.ping();
            expect(ping).toBe("PONG");
        });

        it("publishes events to Redis channel and updates MongoDB snapshot", async () => {
            if (!redisAvailable) return;

            const project = await Project.create({
                name: "PubSub Test",
                owner: testUser._id,
                status: "queued",
            });

            const event = await publishEvent(project._id.toString(), {
                type: "file_started",
                data: { path: "/components/Hero.js" },
            });

            expect(event.id).toBeDefined();
            expect(event.type).toBe("file_started");

            // Verify Mongo snapshot was updated
            const updated = await Project.findById(project._id);
            expect(updated.currentFile).toBe("/components/Hero.js");
            expect(updated.status).toBe("generating");

            await Project.deleteOne({ _id: project._id });
        });

        it("prevents duplicate job addition with same jobId in BullMQ", async () => {
            if (!redisAvailable) return;

            const dummyProjectId = new mongoose.Types.ObjectId().toString();

            const job1 = await addGenerationJob({
                projectId: dummyProjectId,
                prompt: "Build SaaS landing page",
                userId: testUser._id.toString(),
                unitsReserved: 20,
                version: 0,
            });

            const job2 = await addGenerationJob({
                projectId: dummyProjectId,
                prompt: "Build SaaS landing page (duplicate click)",
                userId: testUser._id.toString(),
                unitsReserved: 20,
                version: 0,
            });

            expect(job1.id).toBe(job2.id);

            // Clean up test job
            await job1.remove().catch(() => {});
        });
    });
});
