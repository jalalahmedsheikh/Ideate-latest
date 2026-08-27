import mongoose from "mongoose";

const topicSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    icon: {
      type: String,
      default: "💡",
    },
    category: {
      type: String,
      default: "General",
      trim: true,
    },
    followerCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    postCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    pollCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ["active", "hidden", "disabled"],
      default: "active",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

// Performance indexes for search, ranking, and category filtering
topicSchema.index({ followerCount: -1 });
topicSchema.index({ category: 1 });
topicSchema.index({ name: "text", description: "text" });

export const Topic = mongoose.model("Topic", topicSchema);
