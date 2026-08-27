import mongoose from "mongoose";

const debateArgumentSchema = new mongoose.Schema(
  {
    debate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Debate",
      required: true,
      index: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    side: {
      type: String,
      enum: ["sideA", "sideB", "neutral"],
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 5000,
    },
    evidenceLinks: [{
      title: { type: String, default: "" },
      url: { type: String, required: true },
    }],
    upvotes: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    }],
    reactions: {
      compelling: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      factual: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      wellReasoned: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    },
    replies: [{
      author: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      content: { type: String, required: true, maxlength: 2000 },
      likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      createdAt: { type: Date, default: Date.now },
    }],
    status: {
      type: String,
      enum: ["active", "hidden", "flagged"],
      default: "active",
    },
  },
  { timestamps: true }
);

debateArgumentSchema.index({ debate: 1, createdAt: -1 });
debateArgumentSchema.index({ debate: 1, side: 1 });
debateArgumentSchema.index({ author: 1, createdAt: -1 });

export const DebateArgument = mongoose.model("DebateArgument", debateArgumentSchema);
