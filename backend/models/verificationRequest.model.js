import mongoose from "mongoose";

const verificationRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: ["identity", "organization", "creator", "notable"],
      required: true,
      default: "creator",
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    officialLinks: [{
      type: String,
      trim: true,
    }],
    evidenceText: {
      type: String,
      required: true,
      maxlength: 3000,
    },
    status: {
      type: String,
      enum: ["pending", "under_review", "approved", "rejected", "revoked"],
      default: "pending",
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewNotes: {
      type: String,
      default: "",
    },
    appliedAt: {
      type: Date,
      default: Date.now,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

verificationRequestSchema.index({ user: 1, createdAt: -1 });

export const VerificationRequest = mongoose.model("VerificationRequest", verificationRequestSchema);
