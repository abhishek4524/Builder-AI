import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { billingLimiter } from "../middleware/rateLimiters.js";
import { createOrder, verifyPayment, getPaymentHistory } from "../controllers/billingController.js";

const billingRouter = Router();

// Authenticated billing routes (protected by authMiddleware and per-user billingLimiter)
billingRouter.post("/create-order", authMiddleware, billingLimiter, createOrder);
billingRouter.post("/verify", authMiddleware, billingLimiter, verifyPayment);
billingRouter.get("/history", authMiddleware, getPaymentHistory);

export default billingRouter;
