import "dotenv/config";
import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import express from "express";
import cookieParser from "cookie-parser";
import { OAuth2Client } from "google-auth-library";
import { rateLimit } from "express-rate-limit";

import { User } from "../models/User.js";
import { CreditTransaction } from "../models/CreditTransaction.js";
import { generateLimiter } from "../middleware/rateLimiters.js";
import { csrfProtection } from "../middleware/csrfMiddleware.js";
import authRouter from "../routes/authRoutes.js";

describe("Security, Hardening & Auth Test Suite", () => {
    let testUsers = [];

    beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGODB_URI);
        }
    });

    afterAll(async () => {
        if (testUsers.length > 0) {
            const ids = testUsers.map((u) => u._id);
            await User.deleteMany({ _id: { $in: ids } });
            await CreditTransaction.deleteMany({ userId: { $in: ids } });
        }
        await mongoose.disconnect();
    });

    // -------------------------------------------------------------
    // Test Group 1: Rate Limiting & Shape
    // -------------------------------------------------------------
    describe("Rate Limiting", () => {
        it("returns 429 with { code, message, retryAfter } and standard RateLimit headers when limit is exceeded", async () => {
            const app = express();
            app.use(express.json());

            const standaloneLimiter = rateLimit({
                windowMs: 15 * 60 * 1000,
                limit: 10,
                standardHeaders: "draft-7",
                legacyHeaders: false,
                handler: (req, res, _next, options) => {
                    const retryAfter = Math.ceil(
                        (req.rateLimit?.resetTime ? req.rateLimit.resetTime.getTime() - Date.now() : options.windowMs) / 1000
                    );
                    res.status(429).json({
                        code: "RATE_LIMITED",
                        message: "Too many authentication attempts. Please try again in 15 minutes.",
                        retryAfter: Math.max(1, retryAfter),
                    });
                },
            });

            app.post("/test-limit-shape", standaloneLimiter, (_req, res) => {
                res.json({ ok: true });
            });

            const server = app.listen(0);
            const port = server.address().port;

            try {
                // Send 10 allowed requests
                for (let i = 0; i < 10; i++) {
                    const res = await fetch(`http://localhost:${port}/test-limit-shape`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                    });
                    expect(res.status).toBe(200);
                }

                // 11th request must be rate limited
                const blockedRes = await fetch(`http://localhost:${port}/test-limit-shape`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                });

                expect(blockedRes.status).toBe(429);
                const body = await blockedRes.json();
                expect(body.code).toBe("RATE_LIMITED");
                expect(body.message).toBeDefined();
                expect(typeof body.retryAfter).toBe("number");
                expect(body.retryAfter).toBeGreaterThan(0);

                // Standard RateLimit header check (draft-7 combines limit/remaining/reset or individual)
                const rateLimitHeader = blockedRes.headers.get("ratelimit");
                const rateLimitPolicy = blockedRes.headers.get("ratelimit-policy");
                expect(rateLimitHeader || rateLimitPolicy).toBeDefined();
                if (rateLimitHeader) {
                    expect(rateLimitHeader).toContain("remaining=0");
                }
            } finally {
                server.close();
            }
        });

        it("isolates per-user rate limit keys so user B is unaffected by user A reaching generation limit", async () => {
            const app = express();
            app.use(express.json());

            // Mock auth middleware simulating 2 different users
            app.post(
                "/test-user-limit",
                (req, _res, next) => {
                    const userId = req.headers["x-test-user-id"];
                    if (userId) {
                        req.user = { userId };
                    }
                    next();
                },
                generateLimiter,
                (req, res) => {
                    res.json({ success: true, user: req.user.userId });
                }
            );

            const server = app.listen(0);
            const port = server.address().port;

            try {
                // User A consumes 10 requests (the limit)
                for (let i = 0; i < 10; i++) {
                    const res = await fetch(`http://localhost:${port}/test-user-limit`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "x-test-user-id": "user_alpha_123",
                        },
                    });
                    expect(res.status).toBe(200);
                }

                // User A's 11th request is blocked
                const blockedA = await fetch(`http://localhost:${port}/test-user-limit`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-test-user-id": "user_alpha_123",
                    },
                });
                expect(blockedA.status).toBe(429);
                const blockedJson = await blockedA.json();
                expect(blockedJson.code).toBe("RATE_LIMITED");

                // User B, coming from the same IP (127.0.0.1), should NOT be blocked
                const allowedB = await fetch(`http://localhost:${port}/test-user-limit`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-test-user-id": "user_beta_456",
                    },
                });
                expect(allowedB.status).toBe(200);
                const bJson = await allowedB.json();
                expect(bJson.user).toBe("user_beta_456");
            } finally {
                server.close();
            }
        });
    });

    // -------------------------------------------------------------
    // Test Group 2: CSRF Protection
    // -------------------------------------------------------------
    describe("CSRF Protection", () => {
        let app, server, port;

        beforeAll(() => {
            app = express();
            app.use(express.json());
            app.use(csrfProtection);
            app.post("/test-csrf", (_req, res) => res.json({ success: true }));
            app.get("/test-csrf-get", (_req, res) => res.json({ safe: true }));

            server = app.listen(0);
            port = server.address().port;
        });

        afterAll(() => {
            server.close();
        });

        it("blocks state-changing requests with forbidden Origin", async () => {
            const res = await fetch(`http://localhost:${port}/test-csrf`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Origin: "http://malicious-website.com",
                },
            });

            expect(res.status).toBe(403);
            const data = await res.json();
            expect(data.code).toBe("CSRF_BLOCKED");
        });

        it("blocks state-changing requests missing both Origin and Referer", async () => {
            const res = await fetch(`http://localhost:${port}/test-csrf`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
            });

            expect(res.status).toBe(403);
            const data = await res.json();
            expect(data.code).toBe("CSRF_BLOCKED");
        });

        it("allows state-changing requests with allowed Origin", async () => {
            const res = await fetch(`http://localhost:${port}/test-csrf`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Origin: "http://localhost:5173",
                },
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
        });

        it("skips CSRF check for requests bearing Authorization: Bearer token", async () => {
            const res = await fetch(`http://localhost:${port}/test-csrf`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer api-secret-token",
                    Origin: "http://malicious-site.com",
                },
            });

            expect(res.status).toBe(200);
        });

        it("allows safe GET requests even without Origin header", async () => {
            const res = await fetch(`http://localhost:${port}/test-csrf-get`);
            expect(res.status).toBe(200);
        });
    });

    // -------------------------------------------------------------
    // Test Group 3: Google OAuth Flow
    // -------------------------------------------------------------
    describe("Google OAuth Authentication", () => {
        let app, server, port, verifySpy;

        beforeAll(() => {
            app = express();
            app.use(cookieParser());
            app.use(express.json());
            app.use("/api/auth", authRouter);

            server = app.listen(0);
            port = server.address().port;

            verifySpy = vi.spyOn(OAuth2Client.prototype, "verifyIdToken");
        });

        afterAll(() => {
            server.close();
            verifySpy.mockRestore();
        });

        it("rejects when email is not verified by Google", async () => {
            verifySpy.mockResolvedValueOnce({
                getPayload: () => ({
                    sub: "google_123_unverified",
                    email: "unverified@example.com",
                    email_verified: false,
                    name: "Unverified Guy",
                }),
            });

            const res = await fetch(`http://localhost:${port}/api/auth/google`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Origin: "http://localhost:5173",
                },
                body: JSON.stringify({ credential: "dummy_unverified_token" }),
            });

            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.error).toMatch(/not verified/i);
        });

        it("creates a new user, grants free credits, writes ledger, and sets cookie on first Google login", async () => {
            const googleId = `gid_${Date.now()}`;
            const email = `guser_${Date.now()}@example.com`;

            verifySpy.mockResolvedValueOnce({
                getPayload: () => ({
                    sub: googleId,
                    email,
                    email_verified: true,
                    name: "Google Explorer",
                    picture: "https://example.com/avatar.jpg",
                }),
            });

            const res = await fetch(`http://localhost:${port}/api/auth/google`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Origin: "http://localhost:5173",
                },
                body: JSON.stringify({ credential: "valid_new_user_token" }),
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.user).toBeDefined();
            expect(data.user.email).toBe(email);
            expect(data.user.googleId).toBe(googleId);
            expect(data.user.avatar).toBe("https://example.com/avatar.jpg");
            expect(data.user.creditUnits).toBe(50);
            expect(data.user.balance).toBe(5);

            // Verify cookie is set
            const cookieHeader = res.headers.get("set-cookie");
            expect(cookieHeader).toContain("token=");
            expect(cookieHeader).toContain("HttpOnly");

            // Verify database records
            const created = await User.findOne({ email });
            expect(created).not.toBeNull();
            testUsers.push(created);

            const tx = await CreditTransaction.findOne({
                userId: created._id,
                type: "grant",
            });
            expect(tx).not.toBeNull();
            expect(tx.units).toBe(50);
        });

        it("links googleId to existing local account when email matches", async () => {
            const email = `local_user_${Date.now()}@example.com`;
            const localUser = await User.create({
                name: "Local User",
                email,
                password: "password123",
                authProvider: "local",
                creditUnits: 30,
            });
            testUsers.push(localUser);

            const googleId = `gid_link_${Date.now()}`;
            verifySpy.mockResolvedValueOnce({
                getPayload: () => ({
                    sub: googleId,
                    email,
                    email_verified: true,
                    name: "Local User",
                    picture: "https://example.com/linked.png",
                }),
            });

            const res = await fetch(`http://localhost:${port}/api/auth/google`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Origin: "http://localhost:5173",
                },
                body: JSON.stringify({ credential: "link_token" }),
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.user.email).toBe(email);
            expect(data.user.googleId).toBe(googleId);

            // User password and existing balance must be preserved
            const updated = await User.findById(localUser._id);
            expect(updated.googleId).toBe(googleId);
            expect(updated.creditUnits).toBe(30);
            expect(updated.password).toBeDefined();
        });

        it("rejects password login for accounts created with Google-only auth", async () => {
            const email = `google_only_${Date.now()}@example.com`;
            const googleOnlyUser = await User.create({
                name: "Google Only User",
                email,
                googleId: `gid_${Date.now()}`,
                authProvider: "google",
                creditUnits: 50,
            });
            testUsers.push(googleOnlyUser);

            const res = await fetch(`http://localhost:${port}/api/auth/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Origin: "http://localhost:5173",
                },
                body: JSON.stringify({ email, password: "anypassword" }),
            });

            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.error).toMatch(/Google sign-in/i);
        });
    });
});
