import mongoose from "mongoose";

const reputationEventSchema = new mongoose.Schema({
  actionType: {
    type: String,
    enum: [
      "accepted_answer",
      "helpful_answer",
      "quality_post",
      "constructive_debate",
      "poll_participation",
      "community_contribution",
      "upvote_received",
      "badge_earned",
      "spam_violation",
      "moderation_strike",
      "admin_adjustment"
    ],
    required: true,
  },
  delta: {
    type: Number,
    required: true,
  },
  reason: {
    type: String,
    required: true,
  },
  sourceType: {
    type: String,
    enum: ["question", "answer", "debate", "argument", "poll", "post", "community", "moderation", "admin"],
    default: "post",
  },
  sourceId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const reputationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    score: {
      type: Number,
      default: 0,
      index: true,
    },
    level: {
      type: String,
      enum: ["Newcomer", "Contributor", "Trusted Contributor", "Expert Contributor", "Community Leader"],
      default: "Newcomer",
      index: true,
    },
    positiveCount: { type: Number, default: 0 },
    negativeCount: { type: Number, default: 0 },
    history: [reputationEventSchema],
  },
  { timestamps: true }
);

reputationSchema.index({ score: -1 });

export const Reputation = mongoose.model("Reputation", reputationSchema);
