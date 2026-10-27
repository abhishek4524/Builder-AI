import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.EMAIL_FROM || "i1 <noreply@yourdomain.com>";
const APP_URL = process.env.APP_URL || "http://localhost:5173";

function devLog(label, link) {
  console.log(`\n[Dev Email] ${label}:\n  ${link}\n`);
}

/**
 * Send an email verification link to a new user.
 * @param {string} email
 * @param {string} name
 * @param {string} token - raw token (NOT the hash)
 */
export async function sendVerificationEmail(email, name, token) {
  const link = `${APP_URL}/verify-email?token=${token}`;
  if (!resend || process.env.NODE_ENV !== "production") {
    devLog("Verify email link", link);
    return;
  }
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: "Verify your email – i1",
    text: `Hi ${name},\n\nPlease verify your email address by clicking the link below:\n\n${link}\n\nThis link expires in 24 hours.\n\nIf you didn't sign up for i1, you can safely ignore this email.`,
    html: `<p>Hi ${name},</p><p>Please verify your email address:</p><p><a href="${link}" style="color:#2563eb">${link}</a></p><p>This link expires in <strong>24 hours</strong>.</p><p>If you didn't sign up for i1, you can safely ignore this email.</p>`,
  });
}

/**
 * Send a password reset link.
 * @param {string} email
 * @param {string} name
 * @param {string} token - raw token (NOT the hash)
 */
export async function sendPasswordResetEmail(email, name, token) {
  const link = `${APP_URL}/reset-password?token=${token}`;
  if (!resend || process.env.NODE_ENV !== "production") {
    devLog("Reset password link", link);
    return;
  }
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: "Reset your password – i1",
    text: `Hi ${name},\n\nReset your i1 password:\n\n${link}\n\nThis link expires in 30 minutes.\n\nIf you didn't request a password reset, please ignore this email.`,
    html: `<p>Hi ${name},</p><p>Click below to reset your i1 password:</p><p><a href="${link}" style="color:#2563eb">${link}</a></p><p>This link expires in <strong>30 minutes</strong>.</p><p>If you didn't request this, you can safely ignore this email.</p>`,
  });
}

/**
 * Inform a Google-only account that they cannot reset a password.
 * @param {string} email
 * @param {string} name
 */
export async function sendGoogleAccountEmail(email, name) {
  if (!resend || process.env.NODE_ENV !== "production") {
    devLog("Google account notice (no reset link sent)", email);
    return;
  }
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: "Password reset request – i1",
    text: `Hi ${name},\n\nWe received a password reset request for your i1 account, but your account uses Google Sign-In — no password is needed.\n\nTo sign in, use the "Sign in with Google" button on the login page.\n\nIf this wasn't you, no action is needed.`,
    html: `<p>Hi ${name},</p><p>We received a password reset request, but your account uses <strong>Google Sign-In</strong> — no password is needed.</p><p>Simply use the "Sign in with Google" button on the login page.</p><p>If this wasn't you, no action is needed.</p>`,
  });
}

/**
 * Send a set-password confirmation link to a Google user.
 * @param {string} email
 * @param {string} name
 * @param {string} token - raw token
 */
export async function sendSetPasswordEmail(email, name, token) {
  const link = `${APP_URL}/account/security?set_password_token=${token}`;
  if (!resend || process.env.NODE_ENV !== "production") {
    devLog("Set password confirmation link", link);
    return;
  }
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: "Set a password for your i1 account",
    text: `Hi ${name},\n\nYou requested to add a password to your i1 account.\n\nClick the link below to confirm and set your password:\n\n${link}\n\nThis link expires in 30 minutes.\n\nIf you didn't request this, you can safely ignore this email.`,
    html: `<p>Hi ${name},</p><p>You requested to add a password to your i1 account.</p><p><a href="${link}" style="color:#2563eb">Click here to set your password</a></p><p>This link expires in <strong>30 minutes</strong>.</p><p>If you didn't request this, you can safely ignore this email.</p>`,
  });
}

/**
 * Notify the user that their password was changed successfully.
 * @param {string} email
 * @param {string} name
 */
export async function sendPasswordChangedEmail(email, name) {
  if (!resend || process.env.NODE_ENV !== "production") {
    devLog("Password changed notice", email);
    return;
  }
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: "Your password was changed – i1",
    text: `Hi ${name},\n\nYour i1 account password was successfully changed.\n\nIf you did not make this change, please contact support immediately.`,
    html: `<p>Hi ${name},</p><p>Your i1 account password was successfully changed.</p><p>If you did not make this change, please contact support immediately.</p>`,
  });
}
