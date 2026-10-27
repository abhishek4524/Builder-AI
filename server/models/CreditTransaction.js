import mongoose, { Schema } from "mongoose";

const CreditTransactionSchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        type: {
            type: String,
            enum: ["grant", "reserve", "refund", "purchase", "adjust"],
            required: true,
        },
        units: {
            type: Number,
            required: true,
            validate: {
                validator: Number.isInteger,
                message: "{VALUE} is not an integer value",
            },
        },
        balanceAfter: {
            type: Number,
            required: true,
            validate: {
                validator: Number.isInteger,
                message: "{VALUE} is not an integer value",
            },
        },
        projectId: {
            type: Schema.Types.ObjectId,
            ref: "Project",
            default: null,
        },
        reason: {
            type: String,
            required: true,
            trim: true,
        },
    },
    {
        timestamps: { createdAt: true, updatedAt: false },
    }
);

CreditTransactionSchema.index({ userId: 1, createdAt: -1 });

export const CreditTransaction =
  mongoose.models.CreditTransaction || mongoose.model("CreditTransaction", CreditTransactionSchema);
