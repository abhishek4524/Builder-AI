/**
 * Standalone purge script for anonymizing accounts whose grace period has expired.
 * Run manually or via scheduled cron job:
 *   node server/scripts/purgeDeletedAccounts.js
 *
 * Rules:
 * - Selects users where status="pending_deletion" and deletedAt <= (now - ACCOUNT_DELETION_GRACE_DAYS).
 * - Deletes projects, tokens, and active sessions.
 * - Anonymizes the user document (email -> deleted+<id>@invalid, name/avatar/googleId removed).
 * - Keeps Payment and CreditTransaction records untouched for accounting/audit requirements.
 * - Idempotent.
 */

import "dotenv/config";
import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import mongoose from "mongoose";
import { User } from "../models/User.js";
import { Project } from "../models/Project.js";
import { AuthToken } from "../models/AuthToken.js";

const GRACE_DAYS = parseInt(process.env.ACCOUNT_DELETION_GRACE_DAYS || "30", 10);

async function purgeAccounts() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI);
  }

  const cutoff = new Date(Date.now() - GRACE_DAYS * 24 * 60 * 60 * 1000);
  console.log(`[Purge] Looking for accounts pending deletion before ${cutoff.toISOString()} (${GRACE_DAYS} days grace period)`);

  const usersToPurge = await User.find({
    status: "pending_deletion",
    deletedAt: { $lte: cutoff },
  });

  console.log(`[Purge] Found ${usersToPurge.length} account(s) ready for purge.`);

  let purgedCount = 0;
  for (const user of usersToPurge) {
    const userId = user._id;

    // 1. Delete all projects owned by the user
    const deletedProjects = await Project.deleteMany({ owner: userId });

    // 2. Delete all AuthTokens for this user
    const deletedTokens = await AuthToken.deleteMany({ userId });

    // 3. Anonymize user document (keep _id intact so Payment and CreditTransaction references remain valid)
    user.email = `deleted+${userId.toString()}@invalid`;
    user.name = "Deleted User";
    user.avatar = "";
    user.googleId = undefined;
    user.password = "DISABLED_PURGED_" + Math.random().toString(36).substring(2);
    user.status = "deleted";
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await user.save();

    console.log(
      `[Purge] Anonymized user ${userId} (deleted ${deletedProjects.deletedCount} projects, ${deletedTokens.deletedCount} tokens)`
    );
    purgedCount++;
  }

  console.log(`[Purge] Successfully purged and anonymized ${purgedCount} account(s).`);
}

if (process.argv[1]?.endsWith("purgeDeletedAccounts.js")) {
  purgeAccounts()
    .then(async () => {
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error("[Purge Error]", err);
      await mongoose.disconnect();
      process.exit(1);
    });
}

export { purgeAccounts };
