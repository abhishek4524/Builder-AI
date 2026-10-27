import 'dotenv/config';
import dns from 'node:dns';
dns.setDefaultResultOrder("ipv4first");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { CreditTransaction } from '../models/CreditTransaction.js';
import { reserveCredits, refundCredits, grantCredits, InsufficientCreditsError } from '../services/credits.js';

describe('Usage Metering & Credits System', () => {
    let testUser;

    beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGODB_URI);
        }
    });

    afterAll(async () => {
        if (testUser) {
            await User.deleteOne({ _id: testUser._id });
            await CreditTransaction.deleteMany({ userId: testUser._id });
        }
        await mongoose.disconnect();
    });

    beforeEach(async () => {
        const uniqueEmail = `test_credit_${Date.now()}_${Math.random().toString(36).substring(7)}@example.com`;
        testUser = await User.create({
            name: 'Test Credit User',
            email: uniqueEmail,
            password: 'hashed_dummy_password',
            creditUnits: 0,
            plan: 'free',
        });
    });

    it('Test 1: Two parallel requests with only enough credits for one -> exactly one succeeds, balance never negative', async () => {
        // Set user balance to 20 units (enough for exactly one 20-unit generation)
        await User.findByIdAndUpdate(testUser._id, { creditUnits: 20 });

        // Fire two simultaneous credit reservations
        const [res1, res2] = await Promise.allSettled([
            reserveCredits(testUser._id, 20, { reason: 'Parallel request 1' }),
            reserveCredits(testUser._id, 20, { reason: 'Parallel request 2' }),
        ]);

        const fulfilled = [res1, res2].filter((r) => r.status === 'fulfilled');
        const rejected = [res1, res2].filter((r) => r.status === 'rejected');

        // Exactly one must succeed and one must be rejected
        expect(fulfilled).toHaveLength(1);
        expect(rejected).toHaveLength(1);

        // Rejected one must have INSUFFICIENT_CREDITS code
        expect(rejected[0].reason.code).toBe('INSUFFICIENT_CREDITS');

        // Balance in DB must be exactly 0 (never negative)
        const updatedUser = await User.findById(testUser._id);
        expect(updatedUser.creditUnits).toBe(0);
    });

    it('Test 2: LLM failure -> full refund, ledger has reserve + refund', async () => {
        // Give user 50 units initially
        await grantCredits(testUser._id, 50, { reason: 'Initial grant' });

        // 1. Reserve 20 units for generation
        await reserveCredits(testUser._id, 20, { reason: 'Project generation reservation' });

        const afterReserve = await User.findById(testUser._id);
        expect(afterReserve.creditUnits).toBe(30);

        // 2. Simulate LLM failure and issue full refund
        await refundCredits(testUser._id, 20, { reason: 'Generation failed: Mock LLM Timeout' });

        const afterRefund = await User.findById(testUser._id);
        expect(afterRefund.creditUnits).toBe(50);

        // Verify ledger entries
        const txs = await CreditTransaction.find({ userId: testUser._id }).sort({ createdAt: 1 });
        const types = txs.map((t) => t.type);

        expect(types).toContain('grant');
        expect(types).toContain('reserve');
        expect(types).toContain('refund');

        const reserveTx = txs.find((t) => t.type === 'reserve');
        const refundTx = txs.find((t) => t.type === 'refund');

        expect(reserveTx.units).toBe(-20);
        expect(reserveTx.balanceAfter).toBe(30);

        expect(refundTx.units).toBe(20);
        expect(refundTx.balanceAfter).toBe(50);
    });

    it('Test 3: 402 response shape on insufficient credits', async () => {
        // User has only 10 units (1.0 credit)
        await User.findByIdAndUpdate(testUser._id, { creditUnits: 10 });

        // Request 20 units (2.0 credits)
        try {
            await reserveCredits(testUser._id, 20, { reason: 'Exceeding balance request' });
            expect.unreachable('Should have thrown InsufficientCreditsError');
        } catch (err) {
            expect(err).toBeInstanceOf(InsufficientCreditsError);
            expect(err.code).toBe('INSUFFICIENT_CREDITS');
            expect(err.status).toBe(402);
            // Verify balance and required are in CREDITS, not raw units
            expect(err.balance).toBe(1); // 10 units = 1.0 credit
            expect(err.required).toBe(2); // 20 units = 2.0 credits
        }
    });

    it('Test 4: Ledger consistency -> initial grant + sum(ledger units) == user.creditUnits', async () => {
        // 1. Initial grant
        await grantCredits(testUser._id, 50, { reason: 'Welcome bonus' });

        // 2. Several operations
        await reserveCredits(testUser._id, 20, { reason: 'Website generate' });
        await reserveCredits(testUser._id, 5, { reason: 'Revision 1' });
        await reserveCredits(testUser._id, 5, { reason: 'Revision 2' });
        await refundCredits(testUser._id, 5, { reason: 'Revision 2 refunded' });
        await reserveCredits(testUser._id, 10, { reason: 'Additional task' });

        // Fetch fresh user
        const finalUser = await User.findById(testUser._id);

        // Fetch all transactions
        const allTransactions = await CreditTransaction.find({ userId: testUser._id });

        // Calculate sum of all transaction units
        const ledgerSum = allTransactions.reduce((sum, tx) => sum + tx.units, 0);

        // Ledger sum MUST strictly match user.creditUnits
        expect(ledgerSum).toBe(finalUser.creditUnits);
        expect(finalUser.creditUnits).toBe(15); // 50 - 20 - 5 - 5 + 5 - 10 = 15
    });
});
