import jwt from "jsonwebtoken";
import { User } from "../models/User.js";

/**
 * Admin-only middleware.
 * Checks JWT session AND verifies the user's email is in the ADMIN_EMAILS env list.
 * Usage: add ADMIN_EMAILS=you@example.com,other@example.com to server .env
 */
export async function adminMiddleware(req, res, next) {
    const bearer = req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.slice(7).trim()
        : null;
    const token = req.cookies?.token || bearer;

    if (!token) {
        return res.status(401).json({ error: "Access denied." });
    }

    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET || "fallback_secret");
    } catch {
        return res.status(401).json({ error: "Session expired or invalid." });
    }

    const user = await User.findById(decoded.userId).select("email tokenVersion status");
    if (!user || user.status === "deleted" || user.status === "pending_deletion") {
        return res.status(403).json({ error: "Account not active." });
    }

    if (decoded.tokenVersion !== undefined && user.tokenVersion !== decoded.tokenVersion) {
        return res.status(401).json({ error: "Session expired. Please sign in again." });
    }

    const adminEmails = (process.env.ADMIN_EMAILS || "")
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);

    if (!adminEmails.includes(user.email.toLowerCase())) {
        return res.status(403).json({ error: "Admin access only." });
    }

    req.user = decoded;
    req.adminUser = user;
    return next();
}
