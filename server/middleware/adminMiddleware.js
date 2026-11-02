import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { User } from "../models/User.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getAdminEmails() {
    let raw = process.env.ADMIN_EMAILS;

    // Fallback: check server/.env directly in case server was started before .env was edited
    const candidatePaths = [
        path.resolve(__dirname, "..", ".env"),
        path.resolve(process.cwd(), "server", ".env"),
        path.resolve(process.cwd(), ".env"),
    ];

    for (const p of candidatePaths) {
        try {
            if (fs.existsSync(p)) {
                const content = fs.readFileSync(p, "utf-8");
                const match = content.match(/^ADMIN_EMAILS=(.*)$/m);
                if (match && match[1]) {
                    raw = match[1].trim();
                    break;
                }
            }
        } catch {
            // ignore
        }
    }

    return (raw || "")
        .split(",")
        .map((e) => e.replace(/['"]/g, "").trim().toLowerCase())
        .filter(Boolean);
}

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
        return res.status(401).json({ error: "Access denied. Please log in." });
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

    const adminEmails = getAdminEmails();
    const userEmail = (user.email || "").trim().toLowerCase();

    if (!adminEmails.includes(userEmail)) {
        console.warn(`[adminMiddleware] Denied access to "${userEmail}". Configured admins:`, adminEmails);
        return res.status(403).json({
            error: "Admin access denied.",
            userEmail: user.email,
            configuredAdmins: adminEmails,
            hint: adminEmails.length === 0
                ? "No ADMIN_EMAILS found in server/.env. Please restart your server or add your email to server/.env."
                : `Your email (${user.email}) is not in ADMIN_EMAILS list.`
        });
    }

    req.user = decoded;
    req.adminUser = user;
    return next();
}
