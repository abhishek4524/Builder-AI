import "dotenv/config";
import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import express from "express";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import jwt from "jsonwebtoken";

import { User } from "../models/User.js";
import { Payment } from "../models/Payment.js";
import { CreditTransaction } from "../models/CreditTransaction.js";
import { BILLING_CONFIG, PRODUCTS } from "../config/billing.js";
import {
    getEffectivePlan,
    verifyPaymentSignature,
    verifyWebhookSignature,
    fulfillPayment,
    getRazorpayClient,
} from "../services/billing.js";
import billingRouter from "../routes/billingRoutes.js";
import { handleWebhook } from "../controllers/billingController.js";

describe("Razorpay Billing & Orders System", () => {
    let testUsers = [];
    let app, server, port;
    let ordersCreateSpy;

    beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGODB_URI);
        }

        // Mock Razorpay orders.create to avoid external network calls during tests
        const client = getRazorpayClient();
        ordersCreateSpy = vi.spyOn(client.orders, "create").mockImplementation(async (options) => {
            return {
                id: `order_test_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                entity: "order",
                amount: options.amount,
                amount_paid: 0,
                amount_due: options.amount,
                currency: options.currency,
                receipt: options.receipt,
                status: "created",
                notes: options.notes,
            };
        });

        // Setup test express server matching server.js mounting
        app = express();

        // Webhook with raw body mounted before express.json
        app.post(
            "/api/billing/webhook",
            express.raw({ type: "application/json" }),
            handleWebhook
        );

        app.use(cookieParser());
        app.use(express.json());

        app.use("/api/billing", billingRouter);

        app.use((err, _req, res, _next) => {
            res.status(err.status || err.statusCode || 500).json({ error: err.message });
        });

        server = app.listen(0);
        port = server.address().port;
    });

    afterAll(async () => {
        server.close();
        ordersCreateSpy.mockRestore();

        if (testUsers.length > 0) {
            const ids = testUsers.map((u) => u._id);
            await User.deleteMany({ _id: { $in: ids } });
            await Payment.deleteMany({ userId: { $in: ids } });
            await CreditTransaction.deleteMany({ userId: { $in: ids } });
        }
        await mongoose.disconnect();
    });

    const createTestUser = async (overrides = {}) => {
        const uniqueEmail = `billing_test_${Date.now()}_${Math.random().toString(36).substring(7)}@example.com`;
        const user = await User.create({
            name: "Billing Tester",
            email: uniqueEmail,
            password: "password123",
            creditUnits: 0,
            plan: "free",
            ...overrides,
        });
        testUsers.push(user);
        return user;
    };

    const getUserAuthHeader = (user) => {
        const token = jwt.sign(
            { userId: user._id.toString(), email: user.email },
            process.env.JWT_SECRET || "fallback_secret",
            { expiresIn: "1h" }
        );
        return {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        };
    };

    const generateSignature = (orderId, paymentId) => {
        const secret = BILLING_CONFIG.RAZORPAY_KEY_SECRET;
        return crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
    };

    const generateWebhookSignature = (rawBody) => {
        const secret = BILLING_CONFIG.RAZORPAY_WEBHOOK_SECRET;
        return crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    };

    // -------------------------------------------------------------
    // Test 1: Signature Verification & Credit Granting
    // -------------------------------------------------------------
    it("Test 1: Valid signature grants credits; invalid signature returns 400 and grants nothing", async () => {
        const user = await createTestUser();
        const authHeaders = getUserAuthHeader(user);

        // Step 1: Create an order for topup_small (250 units / 25 credits)
        const orderRes = await fetch(`http://localhost:${port}/api/billing/create-order`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({ productId: "topup_small" }),
        });

        expect(orderRes.status).toBe(200);
        const orderData = await orderRes.json();
        expect(orderData.orderId).toBeDefined();
        expect(orderData.amount).toBe(29900); // 299 INR * 100

        // Step 2: Verify with invalid signature -> 400
        const badVerifyRes = await fetch(`http://localhost:${port}/api/billing/verify`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({
                razorpay_order_id: orderData.orderId,
                razorpay_payment_id: "pay_test_bad_123",
                razorpay_signature: "invalid_tampered_signature_hex",
            }),
        });

        expect(badVerifyRes.status).toBe(400);
        const badJson = await badVerifyRes.json();
        expect(badJson.code).toBe("INVALID_SIGNATURE");

        // Confirm balance is still 0
        const checkUser1 = await User.findById(user._id);
        expect(checkUser1.creditUnits).toBe(0);

        // Step 3: Verify with valid signature -> 200 and credits granted
        const paymentId = "pay_test_good_456";
        const validSig = generateSignature(orderData.orderId, paymentId);

        const goodVerifyRes = await fetch(`http://localhost:${port}/api/billing/verify`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({
                razorpay_order_id: orderData.orderId,
                razorpay_payment_id: paymentId,
                razorpay_signature: validSig,
            }),
        });

        expect(goodVerifyRes.status).toBe(200);
        const goodJson = await goodVerifyRes.json();
        expect(goodJson.success).toBe(true);
        expect(goodJson.fulfilled).toBe(true);

        // User should now have 250 units (25 credits)
        const checkUser2 = await User.findById(user._id);
        expect(checkUser2.creditUnits).toBe(250);

        // Check ledger entry
        const tx = await CreditTransaction.findOne({ userId: user._id, type: "purchase" });
        expect(tx).not.toBeNull();
        expect(tx.units).toBe(250);
        expect(tx.reason).toBe("topup_small");
    });

    // -------------------------------------------------------------
    // Test 2: Concurrency & Idempotency
    // -------------------------------------------------------------
    it("Test 2: Concurrent /verify and webhook calls for the same payment fulfill EXACTLY once", async () => {
        const user = await createTestUser();
        const authHeaders = getUserAuthHeader(user);

        // Create order for pro_monthly (1000 units)
        const orderRes = await fetch(`http://localhost:${port}/api/billing/create-order`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({ productId: "pro_monthly" }),
        });
        const orderData = await orderRes.json();
        const orderId = orderData.orderId;
        const paymentId = `pay_concurrent_${Date.now()}`;
        const validSig = generateSignature(orderId, paymentId);

        // Build webhook payload
        const webhookPayload = JSON.stringify({
            event: "payment.captured",
            payload: {
                payment: {
                    entity: {
                        id: paymentId,
                        order_id: orderId,
                        amount: 99900,
                    },
                },
            },
        });
        const webhookSig = generateWebhookSignature(webhookPayload);

        // Fire /verify and /webhook simultaneously
        const [verifyRes, webhookRes] = await Promise.all([
            fetch(`http://localhost:${port}/api/billing/verify`, {
                method: "POST",
                headers: authHeaders,
                body: JSON.stringify({
                    razorpay_order_id: orderId,
                    razorpay_payment_id: paymentId,
                    razorpay_signature: validSig,
                }),
            }),
            fetch(`http://localhost:${port}/api/billing/webhook`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Razorpay-Signature": webhookSig,
                },
                body: webhookPayload,
            }),
        ]);

        expect(verifyRes.status).toBe(200);
        expect(webhookRes.status).toBe(200);

        // Crucial: balance must be exactly 1000 units (not 2000!)
        const updatedUser = await User.findById(user._id);
        expect(updatedUser.creditUnits).toBe(1000);
        expect(updatedUser.plan).toBe("pro");

        // Ledger must contain exactly ONE purchase transaction
        const purchases = await CreditTransaction.find({ userId: user._id, type: "purchase" });
        expect(purchases.length).toBe(1);
        expect(purchases[0].units).toBe(1000);
    });

    // -------------------------------------------------------------
    // Test 3: Security - Client amounts ignored & Unknown product validation
    // -------------------------------------------------------------
    it("Test 3: Client-supplied amount is ignored; unknown productId returns 400", async () => {
        const user = await createTestUser();
        const authHeaders = getUserAuthHeader(user);

        // Client attempts to tamper with amount
        const res = await fetch(`http://localhost:${port}/api/billing/create-order`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({
                productId: "topup_small",
                amount: 1, // Attempting to pay 1 rupee
                amountPaise: 100,
            }),
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        // Server MUST enforce product price (29900 paise), ignoring client amount
        expect(data.amount).toBe(29900);

        // Unknown product
        const badProdRes = await fetch(`http://localhost:${port}/api/billing/create-order`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({ productId: "unknown_hack_product" }),
        });

        expect(badProdRes.status).toBe(400);
        const badProdJson = await badProdRes.json();
        expect(badProdJson.error).toMatch(/unknown product/i);
    });

    // -------------------------------------------------------------
    // Test 4: Pro Renewal while active extends planExpiresAt
    // -------------------------------------------------------------
    it("Test 4: Pro renewal while still active extends planExpiresAt instead of resetting it", async () => {
        const now = Date.now();
        const existingExpiry = new Date(now + 15 * 24 * 60 * 60 * 1000); // 15 days remaining

        const user = await createTestUser({
            plan: "pro",
            planExpiresAt: existingExpiry,
            creditUnits: 100,
        });
        const authHeaders = getUserAuthHeader(user);

        // Create order for pro_monthly (30 days)
        const orderRes = await fetch(`http://localhost:${port}/api/billing/create-order`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({ productId: "pro_monthly" }),
        });
        const orderData = await orderRes.json();
        const paymentId = `pay_renew_${Date.now()}`;
        const sig = generateSignature(orderData.orderId, paymentId);

        await fetch(`http://localhost:${port}/api/billing/verify`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({
                razorpay_order_id: orderData.orderId,
                razorpay_payment_id: paymentId,
                razorpay_signature: sig,
            }),
        });

        const renewedUser = await User.findById(user._id);
        expect(renewedUser.plan).toBe("pro");

        // Expiry must be approximately 15 + 30 = 45 days from now
        const expectedExpiryTime = existingExpiry.getTime() + 30 * 24 * 60 * 60 * 1000;
        const actualExpiryTime = new Date(renewedUser.planExpiresAt).getTime();
        expect(Math.abs(actualExpiryTime - expectedExpiryTime)).toBeLessThan(5000); // within 5 seconds
    });

    // -------------------------------------------------------------
    // Test 5: Webhook Signature & Raw Body Verification
    // -------------------------------------------------------------
    it("Test 5: Webhook with bad signature returns 400; webhook uses raw body", async () => {
        const payload = JSON.stringify({ event: "dummy.test" });

        // Missing signature -> 400
        const resMissing = await fetch(`http://localhost:${port}/api/billing/webhook`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
        });
        expect(resMissing.status).toBe(400);

        // Tampered signature -> 400
        const resBad = await fetch(`http://localhost:${port}/api/billing/webhook`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Razorpay-Signature": "tampered_signature_hex",
            },
            body: payload,
        });
        expect(resBad.status).toBe(400);

        // Valid signature -> 200
        const validSig = generateWebhookSignature(payload);
        const resGood = await fetch(`http://localhost:${port}/api/billing/webhook`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Razorpay-Signature": validSig,
            },
            body: payload,
        });
        expect(resGood.status).toBe(200);
    });

    // -------------------------------------------------------------
    // Test 6: getEffectivePlan returns "free" after expiry
    // -------------------------------------------------------------
    it("Test 6: getEffectivePlan returns 'free' after expiry without clawing back credits", () => {
        const expiredUser = {
            plan: "pro",
            planExpiresAt: new Date(Date.now() - 1000 * 60), // expired 1 minute ago
            creditUnits: 500,
        };
        expect(getEffectivePlan(expiredUser)).toBe("free");

        const activeUser = {
            plan: "pro",
            planExpiresAt: new Date(Date.now() + 1000 * 60 * 60), // expires in 1 hour
            creditUnits: 500,
        };
        expect(getEffectivePlan(activeUser)).toBe("pro");

        const freeUser = {
            plan: "free",
            planExpiresAt: null,
            creditUnits: 200,
        };
        expect(getEffectivePlan(freeUser)).toBe("free");
    });
});
