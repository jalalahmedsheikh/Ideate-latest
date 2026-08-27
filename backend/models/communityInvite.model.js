import mongoose from "mongoose";

const communityInviteSchema = new mongoose.Schema(
  {
    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
      required: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    maxUses: {
      type: Number,
      default: 50,
    },
    usedCount: {
      type: Number,
      default: 0,
    },
    expiresAt: {
      type: Date,
      index: true,
    },
  },
  { timestamps: true }
);

export const CommunityInvite = mongoose.model("CommunityInvite", communityInviteSchema);
