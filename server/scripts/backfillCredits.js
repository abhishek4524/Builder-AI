/**
 * Migration Script: backfillCredits.js
 *
 * Idempotently grants FREE_CREDIT_UNITS to any existing users who do not have
 * a creditUnits field defined yet.
 *
 * Usage:
 *   node scripts/backfillCredits.js
 */

import 'dotenv/config';
import dns from 'node:dns';
dns.setDefaultResultOrder("ipv4first");

import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { CreditTransaction } from '../models/CreditTransaction.js';
import { CREDITS_CONFIG } from '../config/credits.js';

async function runBackfill() {
    console.log('[Migration] Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('[Migration] Connected.');

    const targetUsers = await User.find({
        $or: [
            { creditUnits: { $exists: false } },
            { creditUnits: null },
        ],
    });

    console.log(`[Migration] Found ${targetUsers.length} user(s) requiring credit backfill.`);

    let updatedCount = 0;
    for (const user of targetUsers) {
        user.creditUnits = CREDITS_CONFIG.FREE_CREDIT_UNITS;
        if (!user.plan) {
            user.plan = 'free';
        }
        await user.save();

        await CreditTransaction.create({
            userId: user._id,
            type: 'grant',
            units: CREDITS_CONFIG.FREE_CREDIT_UNITS,
            balanceAfter: CREDITS_CONFIG.FREE_CREDIT_UNITS,
            reason: 'Migration: Free initial credits backfill',
        });

        updatedCount++;
        console.log(`[Migration] Backfilled ${user.email} (${user._id}) with ${CREDITS_CONFIG.FREE_CREDIT_UNITS} units.`);
    }

    console.log(`[Migration] Completed successfully. Backfilled ${updatedCount} users.`);
    await mongoose.disconnect();
    console.log('[Migration] Disconnected from database.');
}

runBackfill().catch((err) => {
    console.error('[Migration Error]', err);
    process.exit(1);
});
