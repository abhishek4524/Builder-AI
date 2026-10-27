import "dotenv/config";
import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { Project } from "../models/Project.js";
import { Payment } from "../models/Payment.js";
import { CreditTransaction } from "../models/CreditTransaction.js";
import {
  updateProfile,
  changePassword,
  setPassword,
  logoutAll,
  getSummary,
  deleteAccount,
  restoreAccount,
} from "../controllers/accountController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { purgeAccounts } from "../scripts/purgeDeletedAccounts.js";

const createdUsers = [];
const createdProjects = [];
const createdPayments = [];
const createdTransactions = [];

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI);
  }
});

afterAll(async () => {
  if (createdUsers.length > 0) {
    await User.deleteMany({ _id: { $in: createdUsers } });
  }
  if (createdProjects.length > 0) {
    await Project.deleteMany({ _id: { $in: createdProjects } });
  }
  if (createdPayments.length > 0) {
    await Payment.deleteMany({ _id: { $in: createdPayments } });
  }
  if (createdTransactions.length > 0) {
    await CreditTransaction.deleteMany({ _id: { $in: createdTransactions } });
  }
  await mongoose.disconnect();
});

async function makeUser(overrides = {}) {
  const user = await User.create({
    name: "Account Tester",
    email: `test_acc_${Date.now()}_${Math.random().toString(36).substring(7)}@example.com`,
    password: "Password123!",
    authProvider: "local",
    creditUnits: 50,
    plan: "free",
    emailVerified: true,
    tokenVersion: 0,
    status: "active",
    ...overrides,
  });
  createdUsers.push(user._id);
  return user;
}

function mockResponse() {
  const res = {
    statusCode: 200,
    jsonData: null,
    cookies: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.jsonData = data;
      return this;
    },
    cookie(name, val, options) {
      this.cookies[name] = { val, options };
      return this;
    },
  };
  return res;
}

describe("Account & Profile Management Suite", () => {
  it("GET /api/account/summary returns profile and project stats without password/tokens", async () => {
    const user = await makeUser();
    const proj = await Project.create({
      name: "Summary Project",
      owner: user._id,
      published: true,
      files: {},
      version: 0,
    });
    createdProjects.push(proj._id);

    const req = { user: { userId: user._id.toString() } };
    const res = mockResponse();

    await getSummary(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.jsonData.user.name).toBe("Account Tester");
    expect(res.jsonData.user.email).toBe(user.email);
    expect(res.jsonData.user.password).toBeUndefined();
    expect(res.jsonData.user.tokenVersion).toBeUndefined();
    expect(res.jsonData.projects.total).toBeGreaterThanOrEqual(1);
    expect(res.jsonData.projects.published).toBeGreaterThanOrEqual(1);
    expect(res.jsonData.balance).toBe(5);
  });

  it("PATCH /api/account/profile validates and updates user name", async () => {
    const user = await makeUser();

    // 1. Rejects empty name
    const reqInvalid = { user: { userId: user._id.toString() }, body: { name: "   " } };
    const resInvalid = mockResponse();
    await updateProfile(reqInvalid, resInvalid);
    expect(resInvalid.statusCode).toBe(400);

    // 2. Rejects name > 60 chars
    const reqTooLong = { user: { userId: user._id.toString() }, body: { name: "A".repeat(61) } };
    const resTooLong = mockResponse();
    await updateProfile(reqTooLong, resTooLong);
    expect(resTooLong.statusCode).toBe(400);

    // 3. Successfully updates
    const reqValid = { user: { userId: user._id.toString() }, body: { name: "Jane Developer" } };
    const resValid = mockResponse();
    await updateProfile(reqValid, resValid);
    expect(resValid.statusCode).toBe(200);
    expect(resValid.jsonData.user.name).toBe("Jane Developer");

    const updatedUser = await User.findById(user._id);
    expect(updatedUser.name).toBe("Jane Developer");
  });

  it("change-password rejects wrong current password", async () => {
    const user = await makeUser({ password: "CorrectPassword123!" });
    const req = {
      user: { userId: user._id.toString() },
      body: { currentPassword: "WrongPassword999!", newPassword: "BrandNewPassword123!" },
    };
    const res = mockResponse();

    await changePassword(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.jsonData.error).toContain("Incorrect current password");
  });

  it("Google-only user cannot call change-password directly", async () => {
    const googleUser = await makeUser({ authProvider: "google", password: "" });
    const req = {
      user: { userId: googleUser._id.toString() },
      body: { currentPassword: "AnyPassword", newPassword: "NewPassword123!" },
    };
    const res = mockResponse();

    await changePassword(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.jsonData.error).toContain("Google accounts without a password");
  });

  it("change-password updates password and invalidates other sessions via tokenVersion", async () => {
    const user = await makeUser({ password: "OldPassword123!", tokenVersion: 0 });
    const oldTokenVersion = user.tokenVersion;

    const req = {
      user: { userId: user._id.toString() },
      body: { currentPassword: "OldPassword123!", newPassword: "SuperSecureNewPassword456!" },
    };
    const res = mockResponse();

    await changePassword(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.cookies.token).toBeDefined();

    const refreshedUser = await User.findById(user._id);
    expect(refreshedUser.tokenVersion).toBe(oldTokenVersion + 1);

    // Old JWT with tokenVersion: 0 should now be rejected by authMiddleware
    const oldJwt = jwt.sign(
      { userId: user._id.toString(), email: user.email, tokenVersion: oldTokenVersion },
      process.env.JWT_SECRET || "fallback_secret"
    );

    const mwReq = { cookies: { token: oldJwt }, headers: {} };
    const mwRes = mockResponse();
    let nextCalled = false;

    await authMiddleware(mwReq, mwRes, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(false);
    expect(mwRes.statusCode).toBe(401);
    expect(mwRes.jsonData.error).toContain("Session expired");
  });

  it("logout-all invalidates old JWT session across devices", async () => {
    const user = await makeUser({ tokenVersion: 5 });
    const initialTokenVersion = user.tokenVersion;

    const oldJwt = jwt.sign(
      { userId: user._id.toString(), email: user.email, tokenVersion: initialTokenVersion },
      process.env.JWT_SECRET || "fallback_secret"
    );

    const req = { user: { userId: user._id.toString() } };
    const res = mockResponse();

    await logoutAll(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.cookies.token.val).toBe(""); // cleared cookie

    const refreshedUser = await User.findById(user._id);
    expect(refreshedUser.tokenVersion).toBe(initialTokenVersion + 1);

    // The old JWT must now be rejected
    const mwReq = { cookies: { token: oldJwt }, headers: {} };
    const mwRes = mockResponse();
    let nextCalled = false;

    await authMiddleware(mwReq, mwRes, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(false);
    expect(mwRes.statusCode).toBe(401);
  });

  it("delete account requires exact 'DELETE' confirmation and password", async () => {
    const user = await makeUser({ password: "MySecretPassword123!" });

    // Missing confirmation
    const req1 = {
      user: { userId: user._id.toString() },
      body: { confirmation: "delete", password: "MySecretPassword123!" },
    };
    const res1 = mockResponse();
    await deleteAccount(req1, res1);
    expect(res1.statusCode).toBe(400);

    // Wrong password
    const req2 = {
      user: { userId: user._id.toString() },
      body: { confirmation: "DELETE", password: "IncorrectPassword" },
    };
    const res2 = mockResponse();
    await deleteAccount(req2, res2);
    expect(res2.statusCode).toBe(401);

    // Valid deletion
    const req3 = {
      user: { userId: user._id.toString() },
      body: { confirmation: "DELETE", password: "MySecretPassword123!" },
    };
    const res3 = mockResponse();
    await deleteAccount(req3, res3);
    expect(res3.statusCode).toBe(200);

    const deletedUser = await User.findById(user._id);
    expect(deletedUser.status).toBe("pending_deletion");
    expect(deletedUser.deletedAt).not.toBeNull();
  });

  it("deleted user (pending_deletion) cannot use the API", async () => {
    const user = await makeUser({ status: "pending_deletion", deletedAt: new Date() });
    const token = jwt.sign(
      { userId: user._id.toString(), email: user.email, tokenVersion: user.tokenVersion },
      process.env.JWT_SECRET || "fallback_secret"
    );

    const req = { cookies: { token }, headers: {} };
    const res = mockResponse();
    let nextCalled = false;

    await authMiddleware(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(403);
    expect(res.jsonData.code).toBe("ACCOUNT_DELETED");
  });

  it("restore account clears deletedAt and reactivates user during grace period", async () => {
    const user = await makeUser({
      password: "RestoreMe123!",
      status: "pending_deletion",
      deletedAt: new Date(),
    });

    const req = {
      body: { email: user.email, password: "RestoreMe123!" },
    };
    const res = mockResponse();

    await restoreAccount(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.jsonData.success).toBe(true);
    expect(res.cookies.token).toBeDefined();

    const restoredUser = await User.findById(user._id);
    expect(restoredUser.status).toBe("active");
    expect(restoredUser.deletedAt).toBeNull();
  });

  it("purge script anonymizes expired account but keeps Payment and CreditTransaction records", async () => {
    const oldCutoff = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000); // 35 days ago (grace is 30)
    const user = await makeUser({
      name: "Old Person",
      status: "pending_deletion",
      deletedAt: oldCutoff,
    });

    // Create an associated Payment and CreditTransaction
    const payment = await Payment.create({
      userId: user._id,
      productId: "topup_small",
      razorpayOrderId: `order_${Date.now()}_purge`,
      razorpayPaymentId: `pay_${Date.now()}_purge`,
      amountPaise: 29900,
      currency: "INR",
      status: "paid",
      unitsGranted: 250,
      paidAt: new Date(),
    });
    createdPayments.push(payment._id);

    const tx = await CreditTransaction.create({
      userId: user._id,
      type: "purchase",
      units: 250,
      balanceAfter: 300,
      reason: "Purge test transaction",
    });
    createdTransactions.push(tx._id);

    // Run purge
    await purgeAccounts();

    // Verify user is anonymized
    const anonymizedUser = await User.findById(user._id);
    expect(anonymizedUser.email).toBe(`deleted+${user._id.toString()}@invalid`);
    expect(anonymizedUser.name).toBe("Deleted User");
    expect(anonymizedUser.status).toBe("deleted");

    // Verify Payment and CreditTransaction are UNTOUCHED
    const paymentCheck = await Payment.findById(payment._id);
    expect(paymentCheck).not.toBeNull();
    expect(paymentCheck.userId.toString()).toBe(user._id.toString());

    const txCheck = await CreditTransaction.findById(tx._id);
    expect(txCheck).not.toBeNull();
    expect(txCheck.userId.toString()).toBe(user._id.toString());
  });
});
