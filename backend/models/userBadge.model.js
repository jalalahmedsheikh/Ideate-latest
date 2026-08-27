import mongoose from "mongoose";

const userBadgeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    badge: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Badge",
      required: true,
    },
    badgeId: {
      type: String,
      required: true,
      index: true,
    },
    awardedAt: {
      type: Date,
      default: Date.now,
    },
    isDisplayed: {
      type: Boolean,
      default: true,
    },
    reason: {
      type: String,
      default: "Earned achievement milestone",
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    revocationReason: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

userBadgeSchema.index({ user: 1, badgeId: 1 }, { unique: true });

export const UserBadge = mongoose.model("UserBadge", userBadgeSchema);
