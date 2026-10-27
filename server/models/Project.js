import mongoose, { Schema } from "mongoose";

const MessageSchema = new Schema(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const PlannedFileSchema = new Schema(
  {
    path: { type: String, required: true },
    description: { type: String, required: true },
  },
  { _id: false }
);

const ProjectSchema = new Schema(
  {
    name: { type: String, required: true, default: "Untitled Project" },
    description: { type: String, default: "" },
    files: { type: Schema.Types.Mixed, default: {} },
    messages: { type: [MessageSchema], default: [] },
    version: { type: Number, default: 0 },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    published: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["pending", "queued", "generating", "revising", "completed", "failed", "cancelled"],
      default: "queued",
    },
    filesPlanned: { type: [PlannedFileSchema], default: [] },
    filesGenerated: { type: [String], default: [] },
    currentFile: { type: String, default: null },
    error: { type: String, default: null },
    generationStartedAt: { type: Date, default: Date.now },
    generationDuration: { type: Number, default: null },
    completedAt: { type: Date, default: null },
    creditsRefunded: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Project = mongoose.models.Project || mongoose.model("Project", ProjectSchema);
