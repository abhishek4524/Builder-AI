import { rateLimit, ipKeyGenerator } from "express-rate-limit";

// Helper to format consistent 429 error responses
const createRateLimitHandler = (customMessage) => (req, res, _next, options) => {
    const retryAfter = Math.ceil(
        (req.rateLimit?.resetTime ? req.rateLimit.resetTime.getTime() - Date.now() : options.windowMs) / 1000
    );
    res.status(429).json({
        code: "RATE_LIMITED",
        message: customMessage || "Too many requests. Please try again later.",
        retryAfter: Math.max(1, retryAfter),
    });
};

// Global rate limiter across all /api routes (per IP)
export const globalLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_GLOBAL_WINDOW_MS || `${15 * 60 * 1000}`, 10), // 15 mins
    limit: parseInt(process.env.RATE_LIMIT_GLOBAL_MAX || "300", 10),
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: createRateLimitHandler("Too many requests from this IP. Please try again later."),
});

// Auth endpoints limiter for /api/auth/login and /api/auth/register (per IP)
export const authLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_AUTH_WINDOW_MS || `${15 * 60 * 1000}`, 10), // 15 mins
    limit: parseInt(process.env.RATE_LIMIT_AUTH_MAX || "10", 10),
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: createRateLimitHandler("Too many authentication attempts. Please try again in 15 minutes."),
});

// Google OAuth limiter for /api/auth/google (per IP)
export const googleAuthLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_GOOGLE_WINDOW_MS || `${15 * 60 * 1000}`, 10), // 15 mins
    limit: parseInt(process.env.RATE_LIMIT_GOOGLE_MAX || "20", 10),
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: createRateLimitHandler("Too many Google sign-in attempts. Please try again in 15 minutes."),
});

// Generation limiter for POST /api/projects (per USER, fallback to IPv6-safe ipKeyGenerator)
export const generateLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_GENERATE_WINDOW_MS || `${60 * 60 * 1000}`, 10), // 1 hour
    limit: parseInt(process.env.RATE_LIMIT_GENERATE_MAX || "10", 10),
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: (req) => {
        return req.user?.userId ? `user_${req.user.userId}` : ipKeyGenerator(req);
    },
    handler: createRateLimitHandler("Generation limit reached. You can generate up to 10 websites per hour."),
});

// Revision limiter for POST /api/projects/:id/chat (per USER, fallback to IPv6-safe ipKeyGenerator)
export const reviseLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_REVISE_WINDOW_MS || `${60 * 60 * 1000}`, 10), // 1 hour
    limit: parseInt(process.env.RATE_LIMIT_REVISE_MAX || "40", 10),
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: (req) => {
        return req.user?.userId ? `user_${req.user.userId}` : ipKeyGenerator(req);
    },
    handler: createRateLimitHandler("Revision limit reached. You can request up to 40 revisions per hour."),
});

// Dedicated generous rate limiter for Razorpay server-to-server webhooks
export const webhookLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    limit: 120,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: createRateLimitHandler("Too many webhook requests."),
});

// Billing operations limiter (order creation / verify per user)
export const billingLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 mins
    limit: 30,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: (req) => {
        return req.user?.userId ? `user_${req.user.userId}` : ipKeyGenerator(req);
    },
    handler: createRateLimitHandler("Too many billing requests. Please wait a moment."),
});

// Email verification resend limiter (per user, 3/hour)
export const resendVerificationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    limit: 3,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: (req) => {
        return req.user?.userId ? `user_${req.user.userId}` : ipKeyGenerator(req);
    },
    handler: createRateLimitHandler("Too many resend requests. You can resend up to 3 times per hour."),
});

// Forgot password limiter (per IP, 5 per 15 min — strict to prevent enumeration abuse)
export const forgotPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 mins
    limit: 5,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: createRateLimitHandler("Too many password reset attempts. Please try again in 15 minutes."),
});

// Reset password limiter (per IP, 5 per 15 min)
export const resetPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 mins
    limit: 5,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: createRateLimitHandler("Too many password reset attempts. Please try again in 15 minutes."),
});

// Profile update limiter (per user, 30 per 15 min)
export const profileUpdateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 mins
    limit: 30,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: (req) => {
        return req.user?.userId ? `user_${req.user.userId}` : ipKeyGenerator(req);
    },
    handler: createRateLimitHandler("Too many profile update requests. Please wait a moment."),
});

// Change password limiter (per user, 5 per hour)
export const changePasswordLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    limit: 5,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: (req) => {
        return req.user?.userId ? `user_${req.user.userId}` : ipKeyGenerator(req);
    },
    handler: createRateLimitHandler("Too many password change attempts. Please try again in an hour."),
});

// Account deletion limiter (strict 3 per 15 min per user/IP)
export const accountDeleteLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 mins
    limit: 3,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: (req) => {
        return req.user?.userId ? `user_${req.user.userId}` : ipKeyGenerator(req);
    },
    handler: createRateLimitHandler("Too many account deletion attempts. Please wait a moment."),
});
