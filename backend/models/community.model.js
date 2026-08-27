import mongoose from "mongoose";

const communitySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 80,
    },
    handle: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 30,
      match: /^[a-z0-9_]+$/,
    },
    description: {
      type: String,
      default: "",
      maxlength: 2000,
    },
    profileImage: {
      type: String,
      default: null,
    },
    coverImage: {
      type: String,
      default: null,
    },
    category: {
      type: String,
      default: "General",
      index: true,
    },
    rules: [{
      title: { type: String, required: true },
      description: { type: String, default: "" },
    }],
    visibility: {
      type: String,
      enum: ["public", "restricted", "private"],
      default: "public",
      index: true,
    },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    tags: [{ type: String }],
    membersCount: { type: Number, default: 1 },
    postsCount: { type: Number, default: 0 },
    questionsCount: { type: Number, default: 0 },
    debatesCount: { type: Number, default: 0 },
    pollsCount: { type: Number, default: 0 },
    pinnedItems: [{
      itemType: { type: String, enum: ["post", "question", "debate", "poll"] },
      itemId: { type: mongoose.Schema.Types.ObjectId },
      pinnedAt: { type: Date, default: Date.now },
    }],
    isSuspended: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

communitySchema.index({ name: "text", description: "text", tags: "text" });
communitySchema.index({ visibility: 1, membersCount: -1 });

export const Community = mongoose.model("Community", communitySchema);
