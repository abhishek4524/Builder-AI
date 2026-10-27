import { User } from "../models/User.js";
import { Project } from "../models/Project.js";
import { CREDITS_CONFIG, unitsToCredits } from "../config/credits.js";
import { refundCredits } from "../services/credits.js";
import { getEffectivePlan } from "../services/billing.js";
import { setSessionCookie } from "./authController.js";
import {
  sendPasswordChangedEmail,
  sendSetPasswordEmail,
} from "../services/email.js";
import {
  createAuthToken,
  verifyAuthToken,
  markTokenUsed,
} from "../services/authTokens.js";
import { OAuth2Client } from "google-auth-library";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * PATCH /api/account/profile
 * Update user profile details (name).
 */
export async function updateProfile(req, res) {
  const { name } = req.body;

  if (!name || typeof name !== "string") {
    return res.status(400).json({ error: "Name is required" });
  }

  const trimmedName = name.trim();
  if (trimmedName.length < 1 || trimmedName.length > 60) {
    return res.status(400).json({ error: "Name must be between 1 and 60 characters" });
  }

  const user = await User.findById(req.user.userId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  user.name = trimmedName;
  await user.save();

  return res.json({
    success: true,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar || "",
      authProvider: user.authProvider,
      emailVerified: !!user.emailVerified,
      plan: getEffectivePlan(user),
      balance: unitsToCredits(user.creditUnits ?? 0),
    },
  });
}

/**
 * POST /api/account/change-password
 * Change password for local users. Invalidates all other sessions.
 */
export async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Current and new passwords are required" });
  }

  const user = await User.findById(req.user.userId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  // Google-only users without a local password cannot use change-password
  if (!user.password && user.authProvider === "google") {
    return res.status(400).json({
      error: "Google accounts without a password cannot change password directly. Please use 'Set a password' instead.",
    });
  }

  const isValid = await user.comparePassword(currentPassword);
  if (!isValid) {
    return res.status(400).json({ error: "Incorrect current password" });
  }

  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return res.status(400).json({ error: "New password must be at least 8 characters" });
  }

  user.password = newPassword;
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  await user.save();

  // Issue new session cookie for THIS device so the user remains logged in
  setSessionCookie(res, {
    userId: user._id.toString(),
    email: user.email,
    tokenVersion: user.tokenVersion,
  });

  // Send security notification email
  sendPasswordChangedEmail(user.email, user.name).catch((err) =>
    console.error("[changePassword] Notification email failed:", err.message)
  );

  return res.json({
    success: true,
    message: "Password updated successfully. Other device sessions have been logged out.",
  });
}

/**
 * POST /api/account/set-password
 * For Google-only users to establish a local password via email confirmation token.
 */
export async function setPassword(req, res) {
  const { token, newPassword } = req.body;
  const user = await User.findById(req.user.userId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  // If token is provided, finalize setting the password
  if (token) {
    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
      return res.status(400).json({ error: "New password must be at least 8 characters" });
    }

    const { valid, tokenDoc } = await verifyAuthToken(token, "set_password");
    if (!valid || tokenDoc.userId.toString() !== user._id.toString()) {
      return res.status(400).json({ error: "Invalid or expired set-password link. Please request a new one." });
    }

    user.password = newPassword;
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await user.save();
    await markTokenUsed(tokenDoc._id);

    setSessionCookie(res, {
      userId: user._id.toString(),
      email: user.email,
      tokenVersion: user.tokenVersion,
    });

    sendPasswordChangedEmail(user.email, user.name).catch((err) =>
      console.error("[setPassword] Notification email failed:", err.message)
    );

    return res.json({
      success: true,
      message: "Password set successfully. You can now also sign in with your email and password.",
    });
  }

  // If no token is passed, generate an AuthToken and email the link to the user
  const rawToken = await createAuthToken(user._id, "set_password");
  await sendSetPasswordEmail(user.email, user.name, rawToken);

  return res.json({
    success: true,
    message: "A confirmation link has been sent to your email. Check your inbox to set your password.",
  });
}

/**
 * POST /api/account/logout-all
 * Invalidate all sessions across devices by incrementing tokenVersion.
 */
export async function logoutAll(req, res) {
  const user = await User.findById(req.user.userId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  await user.save();

  // Clear current session cookie
  const sameSite = process.env.COOKIE_SAME_SITE || "lax";
  res.cookie("token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: sameSite,
    maxAge: 0,
    path: "/",
  });

  return res.json({
    success: true,
    message: "Logged out from all devices successfully.",
  });
}

/**
 * GET /api/account/summary
 * Returns consolidated account info without exposing sensitive fields.
 */
export async function getSummary(req, res) {
  const user = await User.findById(req.user.userId).select("-password");
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const [totalProjects, publishedProjects] = await Promise.all([
    Project.countDocuments({ owner: user._id }),
    Project.countDocuments({ owner: user._id, published: true }),
  ]);

  return res.json({
    user: {
      name: user.name,
      email: user.email,
      emailVerified: !!user.emailVerified,
      authProvider: user.authProvider,
      avatar: user.avatar || "",
      status: user.status || "active",
      createdAt: user.createdAt,
    },
    plan: getEffectivePlan(user),
    planExpiresAt: user.planExpiresAt,
    balance: unitsToCredits(user.creditUnits ?? 0),
    creditUnits: user.creditUnits ?? 0,
    projects: {
      total: totalProjects,
      published: publishedProjects,
    },
  });
}

/**
 * POST /api/account/delete
 * Request account deletion. Sets status="pending_deletion", unpublishes projects,
 * cancels active generations, and logs user out.
 */
export async function deleteAccount(req, res) {
  const { confirmation, password } = req.body;

  if (confirmation !== "DELETE") {
    return res.status(400).json({ error: 'Please type "DELETE" to confirm account deletion.' });
  }

  const user = await User.findById(req.user.userId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  // Password users must provide their password
  if (user.password || user.authProvider === "local") {
    if (!password) {
      return res.status(400).json({ error: "Password is required to delete your account." });
    }
    const isValid = await user.comparePassword(password);
    if (!isValid) {
      return res.status(401).json({ error: "Incorrect password." });
    }
  } else if (user.authProvider === "google") {
    // Google users must have logged in within the last 10 minutes
    const nowSec = Math.floor(Date.now() / 1000);
    if (!req.user.iat || nowSec - req.user.iat > 10 * 60) {
      return res.status(403).json({
        code: "REAUTH_REQUIRED",
        error: "Recent sign-in required. Please re-authenticate with Google before deleting your account.",
      });
    }
  }

  // Mark pending deletion and invalidate all active sessions
  user.deletedAt = new Date();
  user.status = "pending_deletion";
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  await user.save();

  // Unpublish all published projects
  await Project.updateMany({ owner: user._id, published: true }, { $set: { published: false } });

  // Cancel and refund any active generations
  const activeProjects = await Project.find({
    owner: user._id,
    status: { $in: ["queued", "pending", "generating", "revising"] },
  });

  for (const project of activeProjects) {
    const refundUnits =
      project.version === 0
        ? CREDITS_CONFIG.COST_GENERATE_UNITS
        : CREDITS_CONFIG.COST_REVISE_UNITS;

    await Project.updateOne(
      { _id: project._id },
      {
        $set: {
          status: "cancelled",
          error: "Cancelled due to account deletion",
          completedAt: new Date(),
          creditsRefunded: true,
        },
      }
    );

    try {
      await refundCredits(user._id, refundUnits, {
        projectId: project._id,
        reason: "Account deletion refund",
      });
    } catch (err) {
      console.error(`[Account Delete] Refund error for project ${project._id}:`, err.message);
    }
  }

  // Clear session cookie
  const sameSite = process.env.COOKIE_SAME_SITE || "lax";
  res.cookie("token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: sameSite,
    maxAge: 0,
    path: "/",
  });

  return res.json({
    success: true,
    message: "Your account is scheduled for deletion. You may restore it within the grace period by logging in.",
  });
}

/**
 * POST /api/account/restore
 * Restore an account that is currently pending deletion during its grace period.
 */
export async function restoreAccount(req, res) {
  const { email, password, credential } = req.body;

  let user = null;

  if (credential) {
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (!payload?.email) {
        return res.status(400).json({ error: "Invalid Google credential" });
      }
      user = await User.findOne({ email: payload.email.toLowerCase().trim() });
    } catch (err) {
      return res.status(401).json({ error: "Google authentication failed" });
    }
  } else if (email && password) {
    user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const isValid = await user.comparePassword(password);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
  } else if (req.user?.userId) {
    user = await User.findById(req.user.userId);
  } else {
    return res.status(400).json({ error: "Credentials are required to restore account" });
  }

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  if (user.status !== "pending_deletion" && !user.deletedAt) {
    return res.status(400).json({ error: "Account is not pending deletion" });
  }

  user.deletedAt = null;
  user.status = "active";
  await user.save();

  setSessionCookie(res, {
    userId: user._id.toString(),
    email: user.email,
    tokenVersion: user.tokenVersion ?? 0,
  });

  const userObj = user.toObject();
  delete userObj.password;

  return res.json({
    success: true,
    message: "Account restored successfully! Welcome back.",
    user: {
      ...userObj,
      plan: getEffectivePlan(user),
      balance: unitsToCredits(userObj.creditUnits ?? 0),
    },
  });
}
