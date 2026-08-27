import mongoose from "mongoose";

const answerSchema = new mongoose.Schema(
  {
    question: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
      required: true,
      index: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 10000,
    },
    isAccepted: {
      type: Boolean,
      default: false,
      index: true,
    },
    upvotes: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    }],
    downvotes: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    }],
    saves: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    }],
    shareCount: {
      type: Number,
      default: 0,
    },
    replies: [{
      author: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      content: { type: String, required: true, maxlength: 2000 },
      likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      createdAt: { type: Date, default: Date.now },
    }],
    status: {
      type: String,
      enum: ["active", "deleted", "flagged"],
      default: "active",
    },
  },
  { timestamps: true }
);

answerSchema.index({ question: 1, createdAt: -1 });
answerSchema.index({ question: 1, isAccepted: -1 });
answerSchema.index({ author: 1, createdAt: -1 });

export const Answer = mongoose.model("Answer", answerSchema);
