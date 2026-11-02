import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import pMap from "p-map";
import { FileCodeSchema, FilePlanSchema, RevisionResultSchema } from './aiSchemas.js';
import { buildFileCodeSystem, FILE_PLAN_SYSTEM, REVISE_SYSTEM } from './prompts.js';
import { normalizeContent } from './contentNormalizer.js';
import { validateAndFixCode, validateRevisionContent } from './codeValidator.js';
import { CREDITS_CONFIG, calculateCostUsd } from '../config/credits.js';

// --- OpenRouter Model Client Setup ---
const MODEL = process.env.OPENROUTER_MODEL || "openrouter/free";
const MAX_CONCURRENCY = parseInt(process.env.AI_MAX_CONCURRENCY || "6", 10);

const openrouter = createOpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
    compatibility: "compatible",
    headers: {
        "HTTP-Referer": "https://i1.app",
        "X-Title": "i1 AI Website Builder",
    },
});

const model = openrouter(MODEL);

// Generate a single file's code
async function generateSingleFile(file, allFiles, prompt, alreadyGeneratedFiles, options = {}) {
    const system = buildFileCodeSystem(allFiles, alreadyGeneratedFiles);

    const userMsg = `Project: ${prompt}\n\nWrite the complete code for: ${file.path}\nPurpose: ${file.description}`;

    console.log(`[AI] Creating file: ${file.path}...`);
    let object, usage;
    try {
        const res = await generateObject({
            model,
            schema: FileCodeSchema,
            system,
            prompt: userMsg,
            maxRetries: 2,
            maxTokens: Math.min(CREDITS_CONFIG.MAX_OUTPUT_TOKENS, 6000),
            abortSignal: options.signal,
        });
        object = res.object;
        usage = res.usage;
    } catch (err) {
        console.error(`[AI File Error: ${file.path}]`, err.message, err.responseBody || err.data || "");
        throw err;
    }

    let code = normalizeContent(object.code);

    if (code.trim().length === 0) {
        throw new Error("Generated code is empty after normalization");
    }

    // Apply post-generation validation and auto-fixing
    const validation = validateAndFixCode(code, file.path, { allPlannedFiles: allFiles });

    code = validation.code;

    if (validation.warnings.length > 0) {
        console.log(`[Validator] Code adjustments for ${file.path}:\n  - ${validation.warnings.join("\n  - ")}`);
    }

    console.log(`[AI] Created file: ${file.path} (${code.length} chars)`);
    return {
        path: file.path,
        code,
        usage: {
            promptTokens: usage?.promptTokens || 0,
            completionTokens: usage?.completionTokens || 0,
            totalTokens: usage?.totalTokens || ((usage?.promptTokens || 0) + (usage?.completionTokens || 0)),
        },
    };
}

// Generate project files: plan first, then build files in order with fallback retries
export async function generateProject(prompt, callbacks, options = {}) {
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalTokens = 0;

    const recordUsage = (u) => {
        if (!u) return;
        totalPromptTokens += u.promptTokens || 0;
        totalCompletionTokens += u.completionTokens || 0;
        totalTokens += u.totalTokens || ((u.promptTokens || 0) + (u.completionTokens || 0));
    };

    // Phase 1: Plan
    console.log(`[AI] Phase 1: Planning file structure for: "${prompt.slice(0, 80)}..."`);
    let plan, planUsage;
    try {
        const res = await generateObject({
            model,
            schema: FilePlanSchema,
            system: FILE_PLAN_SYSTEM,
            prompt: `Plan a React website for: ${prompt}`,
            maxRetries: 2,
            maxTokens: Math.min(CREDITS_CONFIG.MAX_OUTPUT_TOKENS, 4000),
            abortSignal: options.signal,
        });
        plan = res.object;
        planUsage = res.usage;

        // Clean, normalize and deduplicate file paths from LLM plan
        const seenPaths = new Set();
        const cleanedFiles = [];
        for (const f of (plan.files || [])) {
            let cleanPath = (f.path || "").trim().replace(/[,;]+$/, "").trim();
            if (!cleanPath.startsWith("/")) cleanPath = "/" + cleanPath;
            if (cleanPath && !seenPaths.has(cleanPath)) {
                seenPaths.add(cleanPath);
                cleanedFiles.push({ ...f, path: cleanPath });
            }
        }
        plan.files = cleanedFiles;
    } catch (err) {
        console.error("[AI Phase 1 Error]", err.message, err.responseBody || err.data || "");
        throw err;
    }

    recordUsage(planUsage);

    if (!plan.files.find((f) => f.path === "/App.js")) {
        plan.files.unshift({
            path: "/App.js",
            description: "Main application entry point",
            exports: "default App",
            imports: ["./styles.css"],
        });
    }

    if (!plan.files.find((f) => f.path === "/styles.css")) {
        plan.files.push({
            path: "/styles.css",
            description: "Global CSS: Google Font import, keyframe animations, utility classes",
            exports: "none",
            imports: [],
        });
    }

    if (callbacks?.onPlan) {
        await callbacks.onPlan(plan);
    }

    console.log(
        `[AI] Phase 2: Generating ${plan.files.length} files in parallel (concurrency=${MAX_CONCURRENCY}): ${plan.files.map((f) => f.path).join(", ")}`
    );

    const files = {};
    let pendingFiles = plan.files.map((f) => ({ ...f }));

    const maxRetryRounds = 2;

    for (let round = 0; round <= maxRetryRounds; round++) {
        if (pendingFiles.length === 0) break;

        if (round > 0) {
            console.log(
                `[AI] Retry round ${round}/${maxRetryRounds} for ${pendingFiles.length} failed files: ${pendingFiles.map((f) => f.path).join(", ")}`
            );
        }

        const results = await pMap(
            pendingFiles,
            async (file) => {
                try {
                    if (options.signal?.aborted) {
                        throw new Error("Generation was cancelled");
                    }
                    if (callbacks?.onFileStart) {
                        await callbacks.onFileStart(file.path);
                    }

                    const singleResult = await generateSingleFile(file, plan.files, prompt, files, options);

                    if (callbacks?.onFileComplete) {
                        await callbacks.onFileComplete(file.path, singleResult.code);
                    }
                    return { success: true, file, result: singleResult };
                } catch (err) {
                    return { success: false, file, error: err };
                }
            },
            { concurrency: MAX_CONCURRENCY, signal: options.signal }
        );

        const failedFiles = [];
        for (const entry of results) {
            if (entry.success) {
                const { path, code, usage } = entry.result;
                files[path.startsWith("/") ? path : "/" + path] = code;
                recordUsage(usage);
            } else {
                console.warn(`[AI] File ${entry.file.path} failed in round ${round}: ${entry.error?.message || entry.error}`);
                failedFiles.push(entry.file);
            }
        }
        pendingFiles = failedFiles;
    }

    if (pendingFiles.length > 0) {
        const failedPaths = pendingFiles.map((f) => f.path).join(", ");
        console.error(`[AI] Failed to generate ${pendingFiles.length} files after all retry rounds: ${failedPaths}`);

        for (const failedFile of pendingFiles) {
            const filePath = failedFile.path.startsWith("/") ? failedFile.path : "/" + failedFile.path;
            if (files[filePath]) continue;

            const ext = filePath.split(".").pop()?.toLowerCase();
            if (ext === "css") {
                files[filePath] = `/* ${failedFile.description || "Styles"} */\n`;
            } else {
                const compName = filePath.split("/").pop().replace(/\.(js|jsx)$/, "") || "Component";
                files[filePath] =
                    "import React from 'react';\n\n" +
                    `export default function ${compName}() {\n` +
                    "  return (\n" +
                    "    <div className='p-6 text-center text-zinc-400'>\n" +
                    `      <p>${failedFile.description || compName}</p>\n` +
                    "    </div>\n" +
                    "  );\n" +
                    "}\n";
            }
        }
    }

    if (!files["/App.js"]) {
        throw new Error("AI did not generate /App.js entry point");
    }

    const costUsd = calculateCostUsd(MODEL, totalPromptTokens, totalCompletionTokens);

    return {
        files,
        description: plan.projectDescription,
        usage: {
            promptTokens: totalPromptTokens,
            completionTokens: totalCompletionTokens,
            totalTokens: totalTokens,
        },
        costUsd,
        model: MODEL,
    };
}

export async function reviseProject(prompt, manifest, relevantFiles, recentMessages, options = {}) {
    const contextParts = [];

    contextParts.push("## Current Project Files (manifest)");
    contextParts.push("```");
    for (const f of manifest) {
        contextParts.push(`${f.path} (${f.hash}, ${f.size}B)`);
    }
    contextParts.push("```");

    if (Object.keys(relevantFiles).length > 0) {
        contextParts.push("\n## File Contents (for reference)");
        for (const [path, content] of Object.entries(relevantFiles)) {
            contextParts.push(`\n### ${path}\n\`\`\`\n${content}\n\`\`\``);
        }
    }

    if (recentMessages.length > 0) {
        contextParts.push("\n## Recent Conversation");
        for (const msg of recentMessages.slice(-3)) {
            contextParts.push(`${msg.role}: ${msg.content}`);
        }
    }

    contextParts.push(`\n## Revision Request\n${prompt}`);

    console.log("[AI] Revising project...");

    const { object: rawParsed, usage: reviseUsage } = await generateObject({
        model,
        schema: RevisionResultSchema,
        system: REVISE_SYSTEM,
        prompt: contextParts.join("\n"),
        maxRetries: 2,
        maxTokens: Math.min(CREDITS_CONFIG.MAX_OUTPUT_TOKENS, 6000),
        abortSignal: options.signal,
    });

    const promptTokens = reviseUsage?.promptTokens || 0;
    const completionTokens = reviseUsage?.completionTokens || 0;
    const totalTokens = reviseUsage?.totalTokens || (promptTokens + completionTokens);
    const costUsd = calculateCostUsd(MODEL, promptTokens, completionTokens);

    if (rawParsed && Array.isArray(rawParsed.operations)) {
        rawParsed.operations = rawParsed.operations.map((op) => {
            if (!op || typeof op !== "object") return op;

            let opStr = String(op.op || "").trim().toLowerCase();

            if (["create", "add", "new"].includes(opStr)) op.op = "create";
            else if (["update", "edit", "modify", "patch"].includes(opStr)) op.op = "update";
            else if (["delete", "remove", "del", "rm"].includes(opStr)) op.op = "delete";

            if (op.path && typeof op.path === "string" && !op.path.startsWith("/")) {
                op.path = "/" + op.path;
            }

            if (op.content) op.content = normalizeContent(op.content);
            if (op.search) op.search = normalizeContent(op.search);
            if (op.replace) op.replace = normalizeContent(op.replace);

            if (op.op === "create" && op.content) {
                const validation = validateRevisionContent(op.content, op.path, "create");
                op.content = validation.content;
                if (validation.warnings.length > 0) {
                    console.log(`[Validator] Revision Create adjustments for ${op.path}:\n  - ${validation.warnings.join("\n  - ")}`);
                }
            } else if (op.op === "update" && op.replace) {
                const validation = validateRevisionContent(op.replace, op.path, "update");
                op.replace = validation.content;
                if (validation.warnings.length > 0) {
                    console.log(`[Validator] Revision Update adjustments for ${op.path}:\n  - ${validation.warnings.join("\n  - ")}`);
                }
            }
            return op;
        });
    }

    return {
        ...rawParsed,
        usage: { promptTokens, completionTokens, totalTokens },
        costUsd,
        model: MODEL,
    };
}
