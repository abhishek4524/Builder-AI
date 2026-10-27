import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import {
  profileUpdateLimiter,
  changePasswordLimiter,
  accountDeleteLimiter,
} from "../middleware/rateLimiters.js";
import {
  updateProfile,
  changePassword,
  setPassword,
  logoutAll,
  getSummary,
  deleteAccount,
  restoreAccount,
} from "../controllers/accountController.js";

const accountRouter = Router();

// Account summary & profile
accountRouter.get("/summary", authMiddleware, getSummary);
accountRouter.patch("/profile", authMiddleware, profileUpdateLimiter, updateProfile);

// Security & credentials
accountRouter.post("/change-password", authMiddleware, changePasswordLimiter, changePassword);
accountRouter.post("/set-password", authMiddleware, changePasswordLimiter, setPassword);
accountRouter.post("/logout-all", authMiddleware, logoutAll);

// Deletion & restoration
accountRouter.post("/delete", authMiddleware, accountDeleteLimiter, deleteAccount);
accountRouter.post("/restore", restoreAccount);

export default accountRouter;
