import mongoose from "mongoose";

const debateSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 300,
    },
    topic: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Topic",
    },
    topics: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Topic",
    }],
    context: {
      type: String,
      default: "",
      maxlength: 5000,
    },
    resolution: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    debateType: {
      type: String,
      enum: ["two_sided", "three_position", "open"],
      default: "two_sided",
    },
    sideA: {
      label: { type: String, required: true, default: "Side A" },
      description: { type: String, default: "" },
      votesCount: { type: Number, default: 0 },
      participantsCount: { type: Number, default: 0 },
    },
    sideB: {
      label: { type: String, required: true, default: "Side B" },
      description: { type: String, default: "" },
      votesCount: { type: Number, default: 0 },
      participantsCount: { type: Number, default: 0 },
    },
    neutral: {
      enabled: { type: Boolean, default: true },
      label: { type: String, default: "Neutral / Undecided" },
      votesCount: { type: Number, default: 0 },
      participantsCount: { type: Number, default: 0 },
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    PostType: {
      type: String,
      default: "Debate",
    },
    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
      default: null,
      index: true,
    },
    durationHours: {
      type: Number,
      default: 72, // 3 days default, 0 for no deadline
    },
    deadline: {
      type: Date,
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "closed", "locked"],
      default: "active",
      index: true,
    },
    rules: {
      maxArgumentLength: { type: Number, default: 3000 },
      allowSideSwitch: { type: Boolean, default: true },
      maxSwitches: { type: Number, default: 2 },
      requireEvidence: { type: Boolean, default: false },
    },
    participants: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      side: { type: String, enum: ["sideA", "sideB", "neutral"] },
      switchesCount: { type: Number, default: 0 },
      hasVoted: { type: Boolean, default: false },
      votedSide: { type: String, enum: ["sideA", "sideB", "neutral", null], default: null },
      joinedAt: { type: Date, default: Date.now },
    }],
    participantsCount: { type: Number, default: 0 },
    argumentsCount: { type: Number, default: 0 },
    totalVotes: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    saves: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    shareCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

debateSchema.index({ author: 1, createdAt: -1 });
debateSchema.index({ status: 1, createdAt: -1 });
debateSchema.index({ status: 1, deadline: 1 });
debateSchema.index({ topics: 1 });
debateSchema.index({ title: "text", resolution: "text", context: "text" });

export const Debate = mongoose.model("Debate", debateSchema);
