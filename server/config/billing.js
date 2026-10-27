import "dotenv/config";

export const BILLING_CONFIG = {
    RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || "",
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || "",
    RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || "",
};

export const PRODUCTS = {
    pro_monthly: {
        id: "pro_monthly",
        name: "Pro",
        amountInr: parseInt(process.env.PRICE_PRO_MONTHLY_INR || "999", 10),
        creditUnits: 1000, // 100 credits
        durationDays: 30,
        grantsPlan: "pro",
        description: "30 days Pro access + 100 credits (1000 units)",
    },
    topup_small: {
        id: "topup_small",
        name: "25 credits",
        amountInr: parseInt(process.env.PRICE_TOPUP_SMALL_INR || "299", 10),
        creditUnits: 250, // 25 credits
        grantsPlan: null,
        description: "25 credits (250 units) top-up",
    },
    topup_large: {
        id: "topup_large",
        name: "100 credits",
        amountInr: parseInt(process.env.PRICE_TOPUP_LARGE_INR || "999", 10),
        creditUnits: 1000, // 100 credits
        grantsPlan: null,
        description: "100 credits (1000 units) top-up",
    },
};

/**
 * Validates that Razorpay credentials are configured.
 * @throws {Error} If any required environment variable is missing
 */
export function validateRazorpayConfig() {
    const missing = [];
    if (!BILLING_CONFIG.RAZORPAY_KEY_ID) missing.push("RAZORPAY_KEY_ID");
    if (!BILLING_CONFIG.RAZORPAY_KEY_SECRET) missing.push("RAZORPAY_KEY_SECRET");
    if (!BILLING_CONFIG.RAZORPAY_WEBHOOK_SECRET) missing.push("RAZORPAY_WEBHOOK_SECRET");

    if (missing.length > 0) {
        throw new Error(
            `[Razorpay Billing] Missing required environment variables: ${missing.join(", ")}. Please configure them in server/.env.`
        );
    }
}
