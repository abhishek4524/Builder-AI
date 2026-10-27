import { Router } from "express";
import {
  login,
  logout,
  me,
  register,
  googleLogin,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
} from "../controllers/authController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import {
  authLimiter,
  googleAuthLimiter,
  resendVerificationLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
} from "../middleware/rateLimiters.js";

const authRouter = Router();

authRouter.post("/register", authLimiter, register);
authRouter.post("/login", authLimiter, login);
authRouter.post("/google", googleAuthLimiter, googleLogin);
authRouter.post("/logout", logout);
authRouter.get("/me", authMiddleware, me);

// Email verification
authRouter.post("/verify-email", verifyEmail);
authRouter.post("/resend-verification", authMiddleware, resendVerificationLimiter, resendVerification);

// Password reset
authRouter.post("/forgot-password", forgotPasswordLimiter, forgotPassword);
authRouter.post("/reset-password", resetPasswordLimiter, resetPassword);

export default authRouter;
