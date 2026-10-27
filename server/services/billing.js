import crypto from "crypto";
import Razorpay from "razorpay";
import { BILLING_CONFIG, PRODUCTS, validateRazorpayConfig } from "../config/billing.js";
import { Payment } from "../models/Payment.js";
import { User } from "../models/User.js";
import { grantCredits } from "./credits.js";

/**
 * Singleton instance of Razorpay client.
 */
let razorpayInstance = null;

/**
 * Returns an initialized Razorpay client instance.
 * @returns {Razorpay}
 */
export function getRazorpayClient() {
    if (!razorpayInstance) {
        validateRazorpayConfig();
        razorpayInstance = new Razorpay({
            key_id: BILLING_CONFIG.RAZORPAY_KEY_ID,
            key_secret: BILLING_CONFIG.RAZORPAY_KEY_SECRET,
        });
    }
    return razorpayInstance;
}

/**
 * Computes the user's effective plan based on expiration timestamp.
 * Returns "free" if plan is "pro" but planExpiresAt is in the past.
 * Credits already granted are retained and never clawed back.
 *
 * @param {Object|import('../models/User.js').User} user
 * @returns {"free"|"pro"|"enterprise"}
 */
export function getEffectivePlan(user) {
    if (!user) return "free";
    const currentPlan = user.plan || "free";
    if (currentPlan === "pro") {
        if (!user.planExpiresAt) return "pro";
        const expiresTime = new Date(user.planExpiresAt).getTime();
        if (expiresTime < Date.now()) {
            return "free";
        }
        return "pro";
    }
    return currentPlan;
}

/**
 * Creates a Razorpay Order and saves an initial Payment record with status "created".
 *
 * @param {string|import('mongoose').Types.ObjectId} userId - Authenticated user ID
 * @param {string} productId - Key from PRODUCTS (e.g. "pro_monthly", "topup_small")
 * @returns {Promise<{ orderId: string, amount: number, currency: string, keyId: string, productName: string }>}
 */
export async function createBillingOrder(userId, productId) {
    const product = PRODUCTS[productId];
    if (!product) {
        const err = new Error(`Unknown product: ${productId}`);
        err.statusCode = 400;
        throw err;
    }

    const razorpay = getRazorpayClient();
    const amountPaise = product.amountInr * 100;
    const receipt = `rcpt_${Date.now().toString(36)}_${crypto.randomBytes(3).toString("hex")}`;

    const order = await razorpay.orders.create({
        amount: amountPaise,
        currency: "INR",
        receipt,
        notes: {
            userId: userId.toString(),
            productId: product.id,
        },
    });

    await Payment.create({
        userId,
        productId: product.id,
        razorpayOrderId: order.id,
        amountPaise,
        currency: "INR",
        status: "created",
        unitsGranted: product.creditUnits,
    });

    console.log(`[Billing] Created order: id=${order.id}, user=${userId}, product=${product.id}`);

    return {
        orderId: order.id,
        amount: amountPaise,
        currency: "INR",
        keyId: BILLING_CONFIG.RAZORPAY_KEY_ID,
        productName: product.name,
    };
}

/**
 * Verifies Razorpay payment signature using timing-safe comparison.
 *
 * @param {string} orderId - Razorpay order ID
 * @param {string} paymentId - Razorpay payment ID
 * @param {string} signature - Hex signature provided by Razorpay checkout
 * @returns {boolean}
 */
export function verifyPaymentSignature(orderId, paymentId, signature) {
    if (!orderId || !paymentId || !signature) return false;
    const secret = BILLING_CONFIG.RAZORPAY_KEY_SECRET;
    if (!secret) return false;

    const body = `${orderId}|${paymentId}`;
    const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");

    const expectedBuf = Buffer.from(expected, "utf-8");
    const sigBuf = Buffer.from(signature, "utf-8");

    if (expectedBuf.length !== sigBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, sigBuf);
}

/**
 * Verifies Razorpay webhook signature against the raw body buffer.
 *
 * @param {Buffer|string} rawBody - Raw request body
 * @param {string} signature - Header X-Razorpay-Signature
 * @returns {boolean}
 */
export function verifyWebhookSignature(rawBody, signature) {
    if (!rawBody || !signature) return false;
    const secret = BILLING_CONFIG.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) return false;

    const expected = crypto
        .createHmac("sha256", secret)
        .update(typeof rawBody === "string" ? Buffer.from(rawBody, "utf-8") : rawBody)
        .digest("hex");

    const expectedBuf = Buffer.from(expected, "utf-8");
    const sigBuf = Buffer.from(signature, "utf-8");

    if (expectedBuf.length !== sigBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, sigBuf);
}

/**
 * Idempotently fulfills a payment by flipping status from "created" to "paid".
 * Guarantees that even if /verify and webhook race concurrently, credits and
 * plan upgrades are awarded exactly once.
 *
 * @param {import('../models/Payment.js').Payment|string} paymentOrOrderId - Payment doc, _id, or orderId
 * @param {string} razorpayPaymentId - Captured payment ID from Razorpay
 * @returns {Promise<{ fulfilled: boolean, payment: import('../models/Payment.js').Payment }>}
 */
export async function fulfillPayment(paymentOrOrderId, razorpayPaymentId) {
    let query;
    if (typeof paymentOrOrderId === "string") {
        query = paymentOrOrderId.startsWith("order_")
            ? { razorpayOrderId: paymentOrOrderId, status: "created" }
            : { _id: paymentOrOrderId, status: "created" };
    } else if (paymentOrOrderId?._id) {
        query = { _id: paymentOrOrderId._id, status: "created" };
    } else {
        throw new Error("Invalid payment identifier provided to fulfillPayment");
    }

    // Step 1: Atomic state transition (created -> paid)
    // Only the first caller to execute this wins; subsequent calls receive null.
    const payment = await Payment.findOneAndUpdate(
        query,
        {
            $set: {
                status: "paid",
                razorpayPaymentId: razorpayPaymentId || undefined,
                paidAt: new Date(),
            },
        },
        { returnDocument: "after" }
    );

    if (!payment) {
        // Payment was already fulfilled by concurrent verify or webhook
        const existing = typeof paymentOrOrderId === "string" && paymentOrOrderId.startsWith("order_")
            ? await Payment.findOne({ razorpayOrderId: paymentOrOrderId })
            : await Payment.findById(paymentOrOrderId?._id || paymentOrOrderId);
        return { fulfilled: false, payment: existing };
    }

    const product = PRODUCTS[payment.productId];
    const unitsToGrant = product ? product.creditUnits : (payment.unitsGranted || 0);

    // Step 2: Grant credits through existing ledger service
    try {
        if (unitsToGrant > 0) {
            await grantCredits(payment.userId, unitsToGrant, {
                type: "purchase",
                reason: payment.productId,
                projectId: null,
            });
        }

        // Step 3: If product includes a Pro plan, extend or grant it
        if (product && product.grantsPlan === "pro") {
            const user = await User.findById(payment.userId);
            if (user) {
                const currentExpiry = user.planExpiresAt ? new Date(user.planExpiresAt).getTime() : 0;
                // Early renewal extends from existing expiry rather than overwriting
                const baseTime = Math.max(Date.now(), currentExpiry);
                const durationDays = product.durationDays || 30;
                const newExpiry = new Date(baseTime + durationDays * 24 * 60 * 60 * 1000);

                user.plan = "pro";
                user.planExpiresAt = newExpiry;
                await user.save();
            }
        }

        console.log(`[Billing] Fulfilled payment: order=${payment.razorpayOrderId}, payment=${razorpayPaymentId}, user=${payment.userId}`);
        return { fulfilled: true, payment };
    } catch (err) {
        console.error(
            `[Billing CRITICAL] Credits/plan grant failed for payment id=${payment._id}, order=${payment.razorpayOrderId}: ${err.message}`
        );
        throw err;
    }
}
