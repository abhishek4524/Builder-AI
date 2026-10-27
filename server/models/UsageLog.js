import mongoose, { Schema } from "mongoose";

const UsageLogSchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        projectId: {
            type: Schema.Types.ObjectId,
            ref: "Project",
            default: null,
        },
        action: {
            type: String,
            enum: ["generate", "revise"],
            required: true,
        },
        model: {
            type: String,
            required: true,
            default: "unknown",
        },
        promptTokens: {
            type: Number,
            default: 0,
        },
        completionTokens: {
            type: Number,
            default: 0,
        },
        totalTokens: {
            type: Number,
            default: 0,
        },
        costUsd: {
            type: Number,
            default: 0,
        },
        unitsCharged: {
            type: Number,
            required: true,
            default: 0,
        },
        status: {
            type: String,
            enum: ["success", "failed"],
            required: true,
        },
    },
    {
        timestamps: { createdAt: true, updatedAt: false },
    }
);

UsageLogSchema.index({ userId: 1, createdAt: -1 });

export const UsageLog = mongoose.models.UsageLog || mongoose.model("UsageLog", UsageLogSchema);
