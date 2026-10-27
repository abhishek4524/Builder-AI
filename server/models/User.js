import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt";
import { CREDITS_CONFIG } from "../config/credits.js";

const UserSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: function () {
        return this.authProvider === "local";
      },
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    avatar: {
      type: String,
      default: "",
    },
    authProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },
    creditUnits: {
      type: Number,
      required: true,
      default: () => CREDITS_CONFIG.FREE_CREDIT_UNITS,
      min: [0, "Credit units cannot be negative"],
      validate: {
        validator: Number.isInteger,
        message: "{VALUE} is not an integer",
      },
    },
    plan: {
      type: String,
      default: "free",
      enum: ["free", "pro", "enterprise"],
    },
    planExpiresAt: {
      type: Date,
      default: null,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerifiedAt: {
      type: Date,
      default: null,
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["active", "pending_deletion", "deleted"],
      default: "active",
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

// Hash password before saving (only if password is provided/modified)
UserSchema.pre("save", async function () {
  if (!this.isModified("password") || !this.password) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
UserSchema.methods.comparePassword = async function (password) {
  if (!this.password) return false;
  return bcrypt.compare(password, this.password);
};

export const User = mongoose.models.User || mongoose.model("User", UserSchema);
