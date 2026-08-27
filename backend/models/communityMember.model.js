import mongoose from "mongoose";

const communityMemberSchema = new mongoose.Schema(
  {
    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["owner", "admin", "moderator", "member"],
      default: "member",
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "banned", "muted"],
      default: "active",
      index: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

communityMemberSchema.index({ community: 1, user: 1 }, { unique: true });
communityMemberSchema.index({ user: 1, status: 1 });

export const CommunityMember = mongoose.model("CommunityMember", communityMemberSchema);
