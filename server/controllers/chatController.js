import { Project } from "../models/Project.js";
import { CREDITS_CONFIG } from "../config/credits.js";
import { reserveCredits, refundCredits, InsufficientCreditsError } from "../services/credits.js";
import { addRevisionJob } from "../queues/generationQueue.js";
import { publishEvent } from "../services/events.js";

export function buildManifest(files) {
    const manifest = [];
    for (const [path, entry] of Object.entries(files || {})) {
        manifest.push({ path, hash: entry.hash, size: entry.content?.length || 0 });
    }
    return manifest;
}

// POST /api/projects/:id/chat
// Enqueue a revision prompt and return immediately.
export async function chat(req, res) {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== "string") {
        res.status(400).json({ error: "prompt is required" });
        return;
    }

    if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }

    const project = await Project.findOne({ _id: req.params.id, owner: req.user.userId });
    if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
    }

    // Guard: Block if already generating or revising
    if (["queued", "pending", "generating", "revising"].includes(project.status)) {
        return res.status(409).json({
            code: "GENERATION_IN_PROGRESS",
            message: "A website generation or revision is already in progress. Please wait.",
        });
    }

    // 1. Reserve credits atomically before enqueuing revision
    const unitsToCharge = CREDITS_CONFIG.COST_REVISE_UNITS;
    try {
        await reserveCredits(req.user.userId, unitsToCharge, {
            projectId: project._id,
            reason: "Revision chat request",
        });
    } catch (err) {
        if (err.code === "INSUFFICIENT_CREDITS" || err instanceof InsufficientCreditsError) {
            return res.status(402).json({
                code: "INSUFFICIENT_CREDITS",
                balance: err.balance,
                required: err.required,
            });
        }
        throw err;
    }

    project.status = "queued";
    project.creditsRefunded = false;
    project.messages.push({ role: "user", content: prompt, timestamp: new Date() });
    await project.save();

    await publishEvent(project._id.toString(), {
        type: "queued",
        data: { message: "Revision request queued..." },
    });

    // 2. Enqueue in BullMQ
    try {
        await addRevisionJob({
            projectId: project._id.toString(),
            prompt,
            userId: req.user.userId,
            unitsReserved: unitsToCharge,
            version: project.version,
        });
    } catch (queueErr) {
        console.error(`[Queue Error] Failed to enqueue revision for project ${project._id}:`, queueErr);
        project.status = "completed";
        await project.save();

        await refundCredits(req.user.userId, unitsToCharge, {
            projectId: project._id,
            reason: "Queue unavailable; revision aborted",
        });

        return res.status(503).json({
            error: "Revision service temporarily unavailable. Credits have been refunded.",
        });
    }

    const filesObj = {};
    for (const [path, entry] of Object.entries(project.files || {})) {
        filesObj[path] = entry.content;
    }

    res.json({
        _id: project._id,
        name: project.name,
        description: project.description,
        files: filesObj,
        messages: project.messages,
        version: project.version,
        status: project.status,
    });
}
