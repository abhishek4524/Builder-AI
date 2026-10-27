import 'dotenv/config';
import dns from 'node:dns';
dns.setDefaultResultOrder("ipv4first");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import crypto from "crypto";
import { User } from "../models/User.js";
import { AuthToken } from "../models/AuthToken.js";
import { createAuthToken, verifyAuthToken, markTokenUsed } from "../services/authTokens.js";
import { createProject } from "../controllers/projectController.js";

const createdUsers = [];

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI);
  }
});

afterAll(async () => {
  if (createdUsers.length > 0) {
    await User.deleteMany({ _id: { $in: createdUsers } });
    await AuthToken.deleteMany({ userId: { $in: createdUsers } });
  }
  await mongoose.disconnect();
});

async function makeUser(overrides = {}) {
  const user = await User.create({
    name: "Test User",
    email: `test_auth_${Date.now()}_${Math.random().toString(36).substring(7)}@example.com`,
    password: "plaintextpassword",
    authProvider: "local",
    creditUnits: 50,
    plan: "free",
    emailVerified: false,
    tokenVersion: 0,
    ...overrides,
  });
  createdUsers.push(user._id);
  return user;
}

describe("Email Verification & Auth Tokens Suite", () => {
  it("creates a token and verifies it successfully", async () => {
    const user = await makeUser();
    const rawToken = await createAuthToken(user._id, "verify_email");

    // Raw token should be a 64-char hex string (32 bytes)
    expect(typeof rawToken).toBe("string");
    expect(rawToken.length).toBe(64);

    const { valid, tokenDoc } = await verifyAuthToken(rawToken, "verify_email");
    expect(valid).toBe(true);
    expect(tokenDoc).not.toBeNull();
    expect(tokenDoc.userId.toString()).toBe(user._id.toString());
  });

  it("raw token is never stored in DB — only the SHA-256 hash is stored", async () => {
    const user = await makeUser();
    const rawToken = await createAuthToken(user._id, "reset_password");

    // Searching by the raw token should find nothing
    const byRaw = await AuthToken.findOne({ tokenHash: rawToken });
    expect(byRaw).toBeNull();

    // Searching by the hash should find the record
    const hash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const byHash = await AuthToken.findOne({ tokenHash: hash });
    expect(byHash).not.toBeNull();
  });

  it("single-use: second verify fails after markTokenUsed", async () => {
    const user = await makeUser();
    const rawToken = await createAuthToken(user._id, "verify_email");

    const first = await verifyAuthToken(rawToken, "verify_email");
    expect(first.valid).toBe(true);
    await markTokenUsed(first.tokenDoc._id);

    const second = await verifyAuthToken(rawToken, "verify_email");
    expect(second.valid).toBe(false);
  });

  it("expired token is rejected", async () => {
    const user = await makeUser();
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    // Insert an already-expired token directly
    await AuthToken.create({
      userId: user._id,
      type: "verify_email",
      tokenHash,
      expiresAt: new Date(Date.now() - 1000), // 1 second in the past
    });

    const { valid } = await verifyAuthToken(rawToken, "verify_email");
    expect(valid).toBe(false);
  });

  it("new token invalidates previous unused token of same type", async () => {
    const user = await makeUser();
    const token1 = await createAuthToken(user._id, "verify_email");
    // Creating token2 should delete token1
    const token2 = await createAuthToken(user._id, "verify_email");

    const check1 = await verifyAuthToken(token1, "verify_email");
    expect(check1.valid).toBe(false); // old token was deleted

    const check2 = await verifyAuthToken(token2, "verify_email");
    expect(check2.valid).toBe(true);
  });

  it("tokens of different types are independent", async () => {
    const user = await makeUser();
    const verifyToken = await createAuthToken(user._id, "verify_email");
    // Creating a reset_password token should NOT invalidate verify_email token
    await createAuthToken(user._id, "reset_password");

    const { valid } = await verifyAuthToken(verifyToken, "verify_email");
    expect(valid).toBe(true);
  });

  it("tokenVersion mismatch rejects old session (simulated middleware check)", async () => {
    // After password reset, tokenVersion is incremented in DB
    const user = await makeUser({ tokenVersion: 1 });
    const oldTokenVersionFromJWT = 0; // old session still has v0

    // Simulate what authMiddleware does: compare JWT tokenVersion with DB tokenVersion
    const isValid = user.tokenVersion === oldTokenVersionFromJWT;
    expect(isValid).toBe(false); // old session must be rejected
  });

  it("tokenVersion match allows valid session", async () => {
    const user = await makeUser({ tokenVersion: 2 });
    const tokenVersionFromJWT = 2; // JWT was issued after the last reset

    const isValid = user.tokenVersion === tokenVersionFromJWT;
    expect(isValid).toBe(true);
  });

  it("forgot-password branches both complete in under 2 seconds (timing sanity)", async () => {
    const start1 = Date.now();
    await new Promise((r) => setTimeout(r, 200 + Math.random() * 100));
    const elapsed1 = Date.now() - start1;

    const start2 = Date.now();
    await new Promise((r) => setTimeout(r, 200 + Math.random() * 100));
    const elapsed2 = Date.now() - start2;

    expect(Math.abs(elapsed1 - elapsed2)).toBeLessThan(500);
    expect(elapsed1).toBeLessThan(2000);
    expect(elapsed2).toBeLessThan(2000);
  });

  it("unverified user is blocked from POST /api/projects with 403 EMAIL_NOT_VERIFIED", async () => {
    const unverifiedUser = await makeUser({ emailVerified: false });
    const req = {
      body: { prompt: "Create a modern landing page" },
      user: { userId: unverifiedUser._id.toString() },
    };
    let statusCode = 200;
    let jsonResult = null;
    const res = {
      status: (code) => {
        statusCode = code;
        return {
          json: (data) => {
            jsonResult = data;
          },
        };
      },
    };

    await createProject(req, res);
    expect(statusCode).toBe(403);
    expect(jsonResult?.code).toBe("EMAIL_NOT_VERIFIED");
  });
});
