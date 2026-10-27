import { User } from "../models/User.js";
import { CreditTransaction } from "../models/CreditTransaction.js";
import { unitsToCredits } from "../config/credits.js";
import { getEffectivePlan } from "./billing.js";

/**
 * Service to manage atomic user credits operations, balance guarantees,
 * and immutable ledger transaction logs.
 */

/**
 * Custom error thrown when a user does not have enough credits for an action.
 */
export class InsufficientCreditsError extends Error {
    constructor(balanceUnits, requiredUnits) {
        super("Insufficient credits to perform this action");
        this.name = "InsufficientCreditsError";
        this.code = "INSUFFICIENT_CREDITS";
        this.status = 402;
        this.balance = unitsToCredits(balanceUnits);
        this.required = unitsToCredits(requiredUnits);
        this.balanceUnits = balanceUnits;
        this.requiredUnits = requiredUnits;
    }
}

/**
 * Atomically reserves credit units from a user balance before performing an LLM action.
 * Guarantees that balance never drops below zero and prevents concurrent race conditions.
 * Writes a 'reserve' entry to the CreditTransaction ledger.
 *
 * @param {string|import('mongoose').Types.ObjectId} userId - ID of the user
 * @param {number} units - Positive integer number of units to reserve
 * @param {Object} [meta={}] - Optional metadata (projectId, reason)
 * @returns {Promise<{ user: import('../models/User.js').User, transaction: import('../models/CreditTransaction.js').CreditTransaction }>}
 * @throws {InsufficientCreditsError} If user balance is less than required units
 * @throws {Error} If user does not exist or units are invalid
 */
export async function reserveCredits(userId, units, meta = {}) {
    if (!Number.isInteger(units) || units <= 0) {
        throw new Error(`Invalid credit units to reserve: ${units}. Must be a positive integer.`);
    }

    // Atomic deduction with balance check in single MongoDB query
    const updatedUser = await User.findOneAndUpdate(
        { _id: userId, creditUnits: { $gte: units } },
        { $inc: { creditUnits: -units } },
        { returnDocument: 'after' }
    );

    if (!updatedUser) {
        // Fetch current user balance to report accurate balance in 402 response
        const currentUser = await User.findById(userId).select("creditUnits");
        if (!currentUser) {
            throw new Error(`User not found: ${userId}`);
        }
        throw new InsufficientCreditsError(currentUser.creditUnits || 0, units);
    }

    const transaction = await CreditTransaction.create({
        userId,
        type: "reserve",
        units: -units, // negative signed integer for deduction
        balanceAfter: updatedUser.creditUnits,
        projectId: meta.projectId || null,
        reason: meta.reason || "Credit reservation for AI task",
    });

    return { user: updatedUser, transaction };
}

/**
 * Atomically refunds credit units back to a user account (e.g. on generation failure, cancellation, or error).
 * Writes a 'refund' entry to the CreditTransaction ledger.
 *
 * @param {string|import('mongoose').Types.ObjectId} userId - ID of the user
 * @param {number} units - Positive integer number of units to refund
 * @param {Object} [meta={}] - Optional metadata (projectId, reason)
 * @returns {Promise<{ user: import('../models/User.js').User, transaction: import('../models/CreditTransaction.js').CreditTransaction }>}
 */
export async function refundCredits(userId, units, meta = {}) {
    if (!Number.isInteger(units) || units <= 0) {
        throw new Error(`Invalid credit units to refund: ${units}. Must be a positive integer.`);
    }

    const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $inc: { creditUnits: units } },
        { returnDocument: 'after' }
    );

    if (!updatedUser) {
        throw new Error(`User not found for credit refund: ${userId}`);
    }

    const transaction = await CreditTransaction.create({
        userId,
        type: "refund",
        units: units, // positive signed integer for addition
        balanceAfter: updatedUser.creditUnits,
        projectId: meta.projectId || null,
        reason: meta.reason || "Credit refund due to failure or error",
    });

    return { user: updatedUser, transaction };
}

/**
 * Grants credits to a user (e.g. signup welcome bonus, promotional grants, or admin top-up).
 * Writes a 'grant' entry to the CreditTransaction ledger.
 *
 * @param {string|import('mongoose').Types.ObjectId} userId - ID of the user
 * @param {number} units - Positive integer number of units to grant
 * @param {Object} [meta={}] - Optional metadata (reason)
 * @returns {Promise<{ user: import('../models/User.js').User, transaction: import('../models/CreditTransaction.js').CreditTransaction }>}
 */
export async function grantCredits(userId, units, meta = {}) {
    if (!Number.isInteger(units) || units <= 0) {
        throw new Error(`Invalid credit units to grant: ${units}. Must be a positive integer.`);
    }

    const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $inc: { creditUnits: units } },
        { returnDocument: 'after' }
    );

    if (!updatedUser) {
        throw new Error(`User not found for credit grant: ${userId}`);
    }

    const transaction = await CreditTransaction.create({
        userId,
        type: meta.type || "grant",
        units: units,
        balanceAfter: updatedUser.creditUnits,
        projectId: meta.projectId || null,
        reason: meta.reason || "Welcome bonus credits",
    });

    return { user: updatedUser, transaction };
}

/**
 * Retrieves the current credit balance and recent ledger history for a user.
 *
 * @param {string|import('mongoose').Types.ObjectId} userId - ID of the user
 * @param {number} [historyLimit=20] - Number of recent transactions to return
 * @returns {Promise<{ balance: number, units: number, plan: string, recentTransactions: Array }>}
 */
export async function getUserCreditSummary(userId, historyLimit = 20) {
    const user = await User.findById(userId).select("creditUnits plan planExpiresAt");
    if (!user) {
        throw new Error(`User not found: ${userId}`);
    }

    const recentTransactions = await CreditTransaction.find({ userId })
        .sort({ createdAt: -1 })
        .limit(historyLimit);

    return {
        balance: unitsToCredits(user.creditUnits || 0),
        units: user.creditUnits || 0,
        plan: getEffectivePlan(user),
        planExpiresAt: user.planExpiresAt || null,
        recentTransactions,
    };
}
