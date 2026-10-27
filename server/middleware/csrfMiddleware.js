// Lightweight CSRF Protection Middleware for state-changing requests
export function csrfProtection(req, res, next) {
    // Safe read-only HTTP methods are exempt from CSRF checks
    const safeMethods = ["GET", "HEAD", "OPTIONS"];
    if (safeMethods.includes(req.method.toUpperCase())) {
        return next();
    }

    // Exempt server-to-server webhooks (which authenticate cryptographically via signature headers)
    if (req.originalUrl?.startsWith("/api/billing/webhook") || req.baseUrl === "/api/billing" && req.path === "/webhook") {
        return next();
    }

    // Skip CSRF check if request authenticates with an explicit Bearer token instead of browser cookie
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
        return next();
    }

    const rawOrigins = process.env.ORIGINS || "http://localhost:5173,http://localhost:3000";
    const allowedOrigins = rawOrigins
        .split(",")
        .map((o) => o.trim().toLowerCase())
        .filter(Boolean);

    let requestOrigin = req.headers.origin;

    // Fall back to Referer header if Origin header is not explicitly present
    if (!requestOrigin && req.headers.referer) {
        try {
            const parsed = new URL(req.headers.referer);
            requestOrigin = parsed.origin;
        } catch {
            requestOrigin = null;
        }
    }

    if (!requestOrigin) {
        return res.status(403).json({
            code: "CSRF_BLOCKED",
            message: "Missing Origin or Referer header on state-changing request.",
        });
    }

    const normalizedOrigin = requestOrigin.toLowerCase();
    const isAllowed = allowedOrigins.includes(normalizedOrigin);

    if (!isAllowed) {
        return res.status(403).json({
            code: "CSRF_BLOCKED",
            message: "Cross-site request forgery protection blocked this request.",
        });
    }

    return next();
}
