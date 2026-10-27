import crypto from "crypto";
import { AuthToken } from "../models/AuthToken.js";

const EXPIRY_MS = {
  verify_email: 24 * 60 * 60 * 1000,  // 24 hours
  reset_password: 30 * 60 * 1000,      // 30 minutes
  set_password: 30 * 60 * 1000,        // 30 minutes
};

/**
 * Hash a raw token with SHA-256. Only hashes are stored in the DB.
 * @param {string} rawToken
 * @returns {string}
 */
function sha256(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Create a new auth token for a user, invalidating any older unused tokens of the same type.
 * Only the SHA-256 hash of the token is stored — the raw token is returned and must be
 * sent to the user immediately (it cannot be recovered later).
 *
 * @param {import("mongoose").Types.ObjectId|string} userId
 * @param {"verify_email"|"reset_password"} type
 * @returns {Promise<string>} raw token (64-char hex)
 */
export async function createAuthToken(userId, type) {
  // Invalidate older unused tokens of the same type for this user
  await AuthToken.deleteMany({ userId, type, usedAt: null });

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256(rawToken);
  const expiresAt = new Date(Date.now() + EXPIRY_MS[type]);

  await AuthToken.create({ userId, type, tokenHash, expiresAt });
  return rawToken;
}

/**
 * Verify a raw token. Returns the token document if valid.
 *
 * @param {string} rawToken
 * @param {"verify_email"|"reset_password"} type
 * @returns {Promise<{ valid: boolean, tokenDoc: import("../models/AuthToken.js").AuthToken|null }>}
 */
export async function verifyAuthToken(rawToken, type) {
  if (!rawToken || typeof rawToken !== "string") {
    return { valid: false, tokenDoc: null };
  }
  const tokenHash = sha256(rawToken);
  const tokenDoc = await AuthToken.findOne({ tokenHash, type, usedAt: null });
  if (!tokenDoc) return { valid: false, tokenDoc: null };
  if (tokenDoc.expiresAt < new Date()) return { valid: false, tokenDoc: null };
  return { valid: true, tokenDoc };
}

/**
 * Mark a token as used (single-use enforcement).
 *
 * @param {import("mongoose").Types.ObjectId|string} tokenId
 */
export async function markTokenUsed(tokenId) {
  await AuthToken.findByIdAndUpdate(tokenId, { usedAt: new Date() });
}
