import mongoose, { Schema } from "mongoose";

const AuthTokenSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  type: {
    type: String,
    enum: ["verify_email", "reset_password", "set_password"],
    required: true,
  },
  tokenHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  usedAt: { type: Date, default: null },
});

// TTL index — MongoDB will auto-delete expired documents
AuthTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// Efficient lookup for invalidating old tokens of same type per user
AuthTokenSchema.index({ userId: 1, type: 1 });

export const AuthToken = mongoose.models.AuthToken || mongoose.model("AuthToken", AuthTokenSchema);
