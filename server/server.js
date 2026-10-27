import dns from "dns";
dns.setDefaultResultOrder("ipv4first");

import express from "express";
import "dotenv/config";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { connectToDatabase } from "./config/db.js";
import authRouter from "./routes/authRoutes.js";
import projectRouter from "./routes/projectRoutes.js";
import creditRouter from "./routes/creditRoutes.js";
import billingRouter from "./routes/billingRoutes.js";
import accountRouter from "./routes/accountRoutes.js";
import { handleWebhook } from "./controllers/billingController.js";
import { globalLimiter, webhookLimiter } from "./middleware/rateLimiters.js";
import { csrfProtection } from "./middleware/csrfMiddleware.js";

import { isRedisHealthy } from "./config/redis.js";
import mongoose from "mongoose";

const app = express();

await connectToDatabase();

// Trust proxy (0 locally, 1 in prod behind a load balancer)
app.set("trust proxy", parseInt(process.env.TRUST_PROXY || "0", 10));

// Security headers
app.use(
    helmet({
        crossOriginResourcePolicy: { policy: "cross-origin" },
    })
);
app.disable("x-powered-by");

// Strict CORS — only allow origins listed in env
const allowedOrigins = process.env.ORIGINS
    ? process.env.ORIGINS.split(",").map((o) => o.trim())
    : ["http://localhost:5173", "http://localhost:3000"];

app.use(
    cors({
        origin: (origin, callback) => {
            // Allow requests with no origin (e.g. curl, mobile apps, webhooks) only in dev
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error(`CORS: origin ${origin} not allowed`));
            }
        },
        credentials: true,
    })
);

// Razorpay Webhook endpoint mounted BEFORE express.json() with raw body parser
// Exempt from CSRF and user rate limiters; protected by webhookLimiter and signature verification
app.post(
    "/api/billing/webhook",
    webhookLimiter,
    express.raw({ type: "application/json" }),
    handleWebhook
);

app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));

// Global IP-based rate limiter on all /api routes
app.use("/api", globalLimiter);

// Lightweight CSRF protection for state-changing requests
app.use("/api", csrfProtection);

app.get("/", (req, res) => res.send("Server is Live!"));

// Health check endpoint for hosting platforms (checks MongoDB + Redis)
app.get("/healthz", async (_req, res) => {
    const mongoStatus = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
    const redisOk = await isRedisHealthy();
    const isHealthy = mongoStatus === "connected" && redisOk;

    res.status(isHealthy ? 200 : 503).json({
        status: isHealthy ? "ok" : "degraded",
        mongo: mongoStatus,
        redis: redisOk ? "connected" : "disconnected",
        timestamp: new Date().toISOString(),
    });
});
app.use("/api/auth", authRouter);
app.use("/api/account", accountRouter);
app.use("/api/projects", projectRouter);
app.use("/api", creditRouter);
app.use("/api/billing", billingRouter);

// Centralized error handler
app.use((err, _req, res, _next) => {
    console.error(`[Error] ${err.message}`);
    if (err.code === "INSUFFICIENT_CREDITS" || err.status === 402) {
        return res.status(402).json({
            code: "INSUFFICIENT_CREDITS",
            balance: err.balance,
            required: err.required,
        });
    }
    res.status(err.status || err.statusCode || 500).json({ error: err.message });
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
