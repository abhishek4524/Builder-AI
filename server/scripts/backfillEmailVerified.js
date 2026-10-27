/**
 * Idempotent backfill: set emailVerified=true and tokenVersion=0 on all
 * existing users who predate the email verification feature.
 *
 * Run manually ONCE after deployment:
 *   node server/scripts/backfillEmailVerified.js
 *
 * It is safe to run multiple times (only updates docs missing the field).
 */
import mongoose from "mongoose";
import { User } from "../models/User.js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

if (!process.env.MONGODB_URI) {
  console.error("MONGODB_URI is not set. Aborting.");
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI);
console.log("Connected to MongoDB.");

const result = await User.updateMany(
  { emailVerified: { $exists: false } },
  { $set: { emailVerified: true, tokenVersion: 0 } }
);

console.log(`Backfill complete. Modified ${result.modifiedCount} user(s).`);
await mongoose.disconnect();
