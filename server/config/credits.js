// Configuration and pricing for credits and usage metering
import 'dotenv/config';

export const CREDITS_CONFIG = {
    // 1 credit = 10 units. 50 units = 5 credits.
    FREE_CREDIT_UNITS: parseInt(process.env.FREE_CREDIT_UNITS || "50", 10),
    // 20 units = 2 credits to generate a website
    COST_GENERATE_UNITS: parseInt(process.env.COST_GENERATE_UNITS || "20", 10),
    // 5 units = 0.5 credit to revise website
    COST_REVISE_UNITS: parseInt(process.env.COST_REVISE_UNITS || "5", 10),
    // Maximum tokens allowed per LLM output call
    MAX_OUTPUT_TOKENS: parseInt(process.env.MAX_OUTPUT_TOKENS || "16000", 10),
};

export const UNITS_PER_CREDIT = 10;

/**
 * Converts integer units to display credits.
 * e.g. 50 units -> 5 credits, 5 units -> 0.5 credits.
 * @param {number} units 
 * @returns {number}
 */
export function unitsToCredits(units) {
    if (typeof units !== "number" || isNaN(units)) return 0;
    return units / UNITS_PER_CREDIT;
}

/**
 * Converts display credits to integer units.
 * e.g. 5 credits -> 50 units, 0.5 credits -> 5 units.
 * @param {number} credits 
 * @returns {number}
 */
export function creditsToUnits(credits) {
    if (typeof credits !== "number" || isNaN(credits)) return 0;
    return Math.round(credits * UNITS_PER_CREDIT);
}

/**
 * Pricing map per 1,000,000 tokens (USD).
 * Unknown or free models default to $0.
 */
export const MODEL_PRICING = {
    "google/gemini-2.0-flash-001": { inputPer1M: 0.10, outputPer1M: 0.40 },
    "qwen/qwen-2.5-coder-32b-instruct": { inputPer1M: 0.06, outputPer1M: 0.15 },
    "deepseek/deepseek-v4.1-flash": { inputPer1M: 0.14, outputPer1M: 0.28 },
    "deepseek/deepseek-chat": { inputPer1M: 0.14, outputPer1M: 0.28 },
    "openai/gpt-4o-mini": { inputPer1M: 0.15, outputPer1M: 0.60 },
    "openai/gpt-4o": { inputPer1M: 2.50, outputPer1M: 10.00 },
    "anthropic/claude-3.5-sonnet": { inputPer1M: 3.00, outputPer1M: 15.00 },
};

/**
 * Calculates cost in USD based on model pricing and token counts.
 * @param {string} modelId 
 * @param {number} promptTokens 
 * @param {number} completionTokens 
 * @returns {number}
 */
export function calculateCostUsd(modelId, promptTokens = 0, completionTokens = 0) {
    if (!modelId || modelId.includes(":free")) return 0;
    const pricing = MODEL_PRICING[modelId];
    if (!pricing) return 0;
    const inputCost = (promptTokens / 1_000_000) * pricing.inputPer1M;
    const outputCost = (completionTokens / 1_000_000) * pricing.outputPer1M;
    return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000;
}
