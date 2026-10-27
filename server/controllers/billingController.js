import { Payment } from "../models/Payment.js";
import {
    createBillingOrder,
    verifyPaymentSignature,
    verifyWebhookSignature,
    fulfillPayment,
} from "../services/billing.js";

/**
 * POST /api/billing/create-order
 * Creates a Razorpay order for purchasing Pro or credit top-ups.
 */
export async function createOrder(req, res, next) {
    try {
        const { productId } = req.body;
        if (!productId) {
            return res.status(400).json({ error: "productId is required" });
        }

        const orderData = await createBillingOrder(req.user.userId, productId);
        res.status(200).json(orderData);
    } catch (err) {
        if (err.statusCode === 400) {
            return res.status(400).json({ error: err.message });
        }
        next(err);
    }
}

/**
 * POST /api/billing/verify
 * Validates checkout signature and fulfills payment.
 */
export async function verifyPayment(req, res, next) {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({
                error: "razorpay_order_id, razorpay_payment_id, and razorpay_signature are required",
            });
        }

        const isValid = verifyPaymentSignature(
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        );

        if (!isValid) {
            return res.status(400).json({
                code: "INVALID_SIGNATURE",
                error: "Invalid Razorpay payment signature.",
            });
        }

        // Find payment record and ensure ownership
        const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id });
        if (!payment) {
            return res.status(404).json({ error: "Payment order not found" });
        }

        if (payment.userId.toString() !== req.user.userId.toString()) {
            return res.status(403).json({ error: "Unauthorized access to this payment order" });
        }

        const result = await fulfillPayment(payment, razorpay_payment_id);
        res.status(200).json({
            success: true,
            fulfilled: result.fulfilled,
            payment: result.payment,
        });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/billing/webhook
 * Handles incoming Razorpay webhook events (unauthenticated, signature-verified).
 */
export async function handleWebhook(req, res) {
    const signature = req.headers["x-razorpay-signature"];

    if (!signature) {
        return res.status(400).json({ error: "Missing X-Razorpay-Signature header" });
    }

    const rawBody = req.body; // Buffer or raw string
    const isValid = verifyWebhookSignature(rawBody, signature);

    if (!isValid) {
        console.warn("[Billing Webhook] Invalid webhook signature received.");
        return res.status(400).json({ error: "Invalid webhook signature" });
    }

    let event;
    try {
        const bodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString("utf-8") : rawBody;
        event = typeof bodyStr === "string" ? JSON.parse(bodyStr) : bodyStr;
    } catch (parseErr) {
        console.error("[Billing Webhook] Malformed JSON in webhook payload:", parseErr.message);
        return res.status(400).json({ error: "Malformed webhook payload" });
    }

    const eventType = event.event;
    console.log(`[Billing Webhook] Received event: ${eventType}`);

    try {
        if (eventType === "payment.captured" || eventType === "order.paid") {
            const paymentEntity = event.payload?.payment?.entity;
            const orderId = paymentEntity?.order_id || event.payload?.order?.entity?.id;
            const paymentId = paymentEntity?.id;

            if (orderId) {
                const existingPayment = await Payment.findOne({ razorpayOrderId: orderId });
                if (existingPayment) {
                    await fulfillPayment(existingPayment, paymentId);
                } else {
                    console.warn(`[Billing Webhook] Unknown order ${orderId} in ${eventType} event.`);
                }
            }
        } else if (eventType === "payment.failed") {
            const paymentEntity = event.payload?.payment?.entity;
            const orderId = paymentEntity?.order_id;
            const paymentId = paymentEntity?.id;

            if (orderId) {
                await Payment.findOneAndUpdate(
                    { razorpayOrderId: orderId, status: "created" },
                    {
                        $set: {
                            status: "failed",
                            razorpayPaymentId: paymentId || undefined,
                        },
                    }
                );
                console.log(`[Billing Webhook] Payment failed for order ${orderId}`);
            }
        } else if (eventType === "refund.processed") {
            const refundEntity = event.payload?.refund?.entity;
            const paymentId = refundEntity?.payment_id;

            if (paymentId) {
                await Payment.findOneAndUpdate(
                    { razorpayPaymentId: paymentId },
                    { $set: { status: "refunded" } }
                );
                console.warn(
                    `[Billing Webhook] Refund processed for payment ${paymentId}. Flagged for manual review.`
                );
            }
        }
    } catch (handlerErr) {
        console.error(`[Billing Webhook Error] Error processing ${eventType}:`, handlerErr.message);
    }

    // Always return 200 quickly for validly signed events
    return res.status(200).json({ status: "ok" });
}

/**
 * GET /api/billing/history
 * Returns the authenticated user's recent payment history.
 */
export async function getPaymentHistory(req, res, next) {
    try {
        const payments = await Payment.find({ userId: req.user.userId })
            .sort({ createdAt: -1 })
            .limit(20)
            .select("-__v");

        res.status(200).json({ payments });
    } catch (err) {
        next(err);
    }
}
