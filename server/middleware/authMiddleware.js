import jwt from "jsonwebtoken";
import { User } from "../models/User.js";

/**
 * Auth middleware — verifies JWT session cookie or Authorization Bearer token.
 * If the JWT contains tokenVersion, validates it against the DB to enforce
 * session invalidation after a password reset.
 */
export async function authMiddleware(req, res, next) {
  const bearer = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7).trim()
    : null;
  const token = req.cookies?.token || bearer;

  if (!token) {
    return res.status(401).json({ error: "Access denied. No session token provided." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "fallback_secret");

    // Validate tokenVersion and ensure account is active and not pending deletion
    const user = await User.findById(decoded.userId).select("tokenVersion status deletedAt");
    if (!user || (decoded.tokenVersion !== undefined && user.tokenVersion !== decoded.tokenVersion)) {
      return res
        .status(401)
        .json({ error: "Session expired. Please sign in again." });
    }

    if (user.deletedAt || user.status === "pending_deletion" || user.status === "deleted") {
      return res.status(403).json({
        code: "ACCOUNT_DELETED",
        error: "Your account is scheduled for deletion.",
      });
    }

    req.user = decoded;
    return next();
  } catch (err) {
    return res
      .status(401)
      .json({ error: "Session expired or invalid. Please sign in again." });
  }
}
