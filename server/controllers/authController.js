import { User } from "../models/User.js";
import jwt from "jsonwebtoken";
import { CREDITS_CONFIG, unitsToCredits } from "../config/credits.js";
import { grantCredits } from "../services/credits.js";
import { getEffectivePlan } from "../services/billing.js";
import { OAuth2Client } from "google-auth-library";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendGoogleAccountEmail,
  sendPasswordChangedEmail,
} from "../services/email.js";
import { createAuthToken, verifyAuthToken, markTokenUsed } from "../services/authTokens.js";

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Helper to set cookie with hardened security
export const setSessionCookie = (res, payload) => {
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
  const sameSite = process.env.COOKIE_SAME_SITE || "none";
  res.cookie("token", token, {
    httpOnly: true,
    secure: sameSite === "none" ? true : process.env.NODE_ENV === "production",
    sameSite: sameSite,
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: "/",
  });
  return token;
};

export async function register(req, res) {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    res.status(400).json({ error: "Name, email, and password are required" });
    return;
  }

  const trimmedEmail = email.toLowerCase().trim();
  const existing = await User.findOne({ email: trimmedEmail });
  if (existing) {
    res.status(400).json({ error: "An account with this email already exists" });
    return;
  }

  const user = await User.create({
    name,
    email: trimmedEmail,
    password,
    authProvider: "local",
    creditUnits: CREDITS_CONFIG.FREE_CREDIT_UNITS,
    plan: "free",
    emailVerified: false,
  });

  // Write initial grant ledger entry via credits service
  await grantCredits(user._id, CREDITS_CONFIG.FREE_CREDIT_UNITS, {
    reason: "Initial signup free credits",
  });

  // Send verification email (non-blocking — don't fail registration if email fails)
  createAuthToken(user._id, "verify_email")
    .then((token) => sendVerificationEmail(user.email, user.name, token))
    .catch((err) => console.error("[register] Failed to send verification email:", err.message));

  const token = setSessionCookie(res, {
    userId: user._id.toString(),
    email: user.email,
    tokenVersion: user.tokenVersion ?? 0,
  });

  const userObj = user.toObject();
  delete userObj.password;
  res.status(201).json({
    token,
    user: {
      ...userObj,
      balance: unitsToCredits(userObj.creditUnits),
    },
  });
}

export async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  // Google-only user attempting password login
  if (!user.password && user.authProvider === "google") {
    res.status(400).json({
      error: "This account uses Google sign-in. Please sign in with Google.",
    });
    return;
  }

  const isValid = await user.comparePassword(password);
  if (!isValid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  // Intercept pending deletion account during login
  if (user.deletedAt || user.status === "pending_deletion") {
    res.status(403).json({
      code: "ACCOUNT_PENDING_DELETION",
      error: "This account is scheduled for deletion. You can restore it.",
      email: user.email,
    });
    return;
  }

  const token = setSessionCookie(res, {
    userId: user._id.toString(),
    email: user.email,
    tokenVersion: user.tokenVersion ?? 0,
  });

  const userObj = user.toObject();
  delete userObj.password;
  res.status(200).json({
    token,
    user: {
      ...userObj,
      balance: unitsToCredits(userObj.creditUnits ?? CREDITS_CONFIG.FREE_CREDIT_UNITS),
    },
  });
}

export async function googleLogin(req, res) {
  const { credential } = req.body;

  if (!credential) {
    res.status(400).json({ error: "Google credential ID token is required" });
    return;
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      res.status(400).json({ error: "Invalid Google token payload" });
      return;
    }

    if (!payload.email_verified) {
      res.status(400).json({ error: "Google account email is not verified" });
      return;
    }

    const email = payload.email.toLowerCase().trim();
    const googleId = payload.sub;
    const name = payload.name || email.split("@")[0] || "User";
    const avatar = payload.picture || "";

    let user = await User.findOne({ googleId });

    if (!user) {
      // Check if user already exists with this email
      user = await User.findOne({ email });

      if (user) {
        // Link googleId to existing account and mark email as verified
        user.googleId = googleId;
        user.emailVerified = true;
        user.emailVerifiedAt = user.emailVerifiedAt || new Date();
        if (!user.avatar && avatar) {
          user.avatar = avatar;
        }
        await user.save();
      } else {
        // Create new user for Google login — Google already verified the email
        user = await User.create({
          name,
          email,
          googleId,
          avatar,
          authProvider: "google",
          creditUnits: CREDITS_CONFIG.FREE_CREDIT_UNITS,
          plan: "free",
          emailVerified: true,
          emailVerifiedAt: new Date(),
        });

        // Grant free credits through existing credits service
        await grantCredits(user._id, CREDITS_CONFIG.FREE_CREDIT_UNITS, {
          reason: "Initial signup free credits (Google)",
        });
      }
    } else if (avatar && !user.avatar) {
      user.avatar = avatar;
      await user.save();
    }

    // Intercept pending deletion account during Google login
    if (user.deletedAt || user.status === "pending_deletion") {
      res.status(403).json({
        code: "ACCOUNT_PENDING_DELETION",
        error: "This account is scheduled for deletion. You can restore it.",
        email: user.email,
        credential,
      });
      return;
    }

    const token = setSessionCookie(res, {
      userId: user._id.toString(),
      email: user.email,
      tokenVersion: user.tokenVersion ?? 0,
    });

    const userObj = user.toObject();
    delete userObj.password;
    res.status(200).json({
      token,
      user: {
        ...userObj,
        balance: unitsToCredits(userObj.creditUnits ?? CREDITS_CONFIG.FREE_CREDIT_UNITS),
      },
    });
  } catch (err) {
    console.error("[Google OAuth Error]", err.message);
    res.status(401).json({ error: "Invalid or expired Google authentication token" });
  }
}

export async function logout(_req, res) {
  const sameSite = process.env.COOKIE_SAME_SITE || "none";
  res.cookie("token", "", {
    httpOnly: true,
    secure: sameSite === "none" ? true : process.env.NODE_ENV === "production",
    sameSite: sameSite,
    maxAge: 0,
    path: "/",
  });
  res.json({ success: true });
}

export async function me(req, res) {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const user = await User.findById(req.user.userId).select("-password");
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const userObj = user.toObject();
  res.json({
    user: {
      ...userObj,
      name: userObj.name || "",
      status: userObj.status || "active",
      plan: getEffectivePlan(user),
      balance: unitsToCredits(userObj.creditUnits ?? 0),
    },
  });
}

export async function verifyEmail(req, res) {
  const { token } = req.body;
  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "Token is required" });
    return;
  }

  const { valid, tokenDoc } = await verifyAuthToken(token, "verify_email");
  if (!valid) {
    res
      .status(400)
      .json({ error: "Invalid or expired verification link. Please request a new one." });
    return;
  }

  await User.findByIdAndUpdate(tokenDoc.userId, {
    emailVerified: true,
    emailVerifiedAt: new Date(),
  });
  await markTokenUsed(tokenDoc._id);

  res.json({ success: true, message: "Email verified successfully." });
}

export async function resendVerification(req, res) {
  const user = await User.findById(req.user.userId).select("email name emailVerified");
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (user.emailVerified) {
    res.status(400).json({ error: "Your email is already verified." });
    return;
  }

  const token = await createAuthToken(user._id, "verify_email");
  await sendVerificationEmail(user.email, user.name, token);

  res.json({ success: true, message: "Verification email sent. Check your inbox." });
}

export async function forgotPassword(req, res) {
  const { email } = req.body;
  // Always return same generic response — prevents user enumeration
  const GENERIC = {
    success: true,
    message: "If that email is registered, a reset link has been sent.",
  };

  if (!email || typeof email !== "string") {
    res.json(GENERIC);
    return;
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() }).select(
    "name email authProvider password tokenVersion"
  );

  if (!user) {
    // Artificial delay parity so timing doesn't reveal user existence
    await new Promise((r) => setTimeout(r, 200 + Math.random() * 100));
    res.json(GENERIC);
    return;
  }

  // Google-only account — no password to reset, send helpful notice instead
  if (!user.password && user.authProvider === "google") {
    await sendGoogleAccountEmail(user.email, user.name).catch((err) =>
      console.error("[forgotPassword] Google notice email failed:", err.message)
    );
    res.json(GENERIC);
    return;
  }

  try {
    const token = await createAuthToken(user._id, "reset_password");
    await sendPasswordResetEmail(user.email, user.name, token);
  } catch (err) {
    console.error("[forgotPassword] Failed to send reset email:", err.message);
  }

  res.json(GENERIC);
}

export async function resetPassword(req, res) {
  const { token, password } = req.body;
  if (!token || !password) {
    res.status(400).json({ error: "Token and password are required" });
    return;
  }
  if (typeof password !== "string" || password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  const { valid, tokenDoc } = await verifyAuthToken(token, "reset_password");
  if (!valid) {
    res
      .status(400)
      .json({ error: "Invalid or expired reset link. Please request a new one." });
    return;
  }

  const user = await User.findById(tokenDoc.userId);
  if (!user) {
    res.status(400).json({ error: "User not found" });
    return;
  }

  user.password = password; // pre-save hook will bcrypt-hash it
  user.tokenVersion = (user.tokenVersion ?? 0) + 1; // invalidate all existing JWT sessions
  await user.save();

  await markTokenUsed(tokenDoc._id);

  // Send change-notification email (non-blocking)
  sendPasswordChangedEmail(user.email, user.name).catch((err) =>
    console.error("[resetPassword] Notification email failed:", err.message)
  );

  res.json({
    success: true,
    message: "Password reset successfully. Please sign in with your new password.",
  });
}
