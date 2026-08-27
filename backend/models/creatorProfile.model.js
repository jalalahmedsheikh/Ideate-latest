import mongoose from "mongoose";

const creatorProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    isCreatorEnabled: {
      type: Boolean,
      default: true,
      index: true,
    },
    intro: {
      type: String,
      default: "",
      maxlength: 1000,
    },
    expertise: [{
      type: String,
      trim: true,
      maxlength: 50,
    }],
    topics: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Topic",
    }],
    featuredContent: [{
      contentType: {
        type: String,
        enum: ["post", "question", "debate", "poll"],
        required: true,
      },
      contentId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
      },
      pinnedAt: {
        type: Date,
        default: Date.now,
      },
    }],
    socialLinks: {
      website: { type: String, default: null },
      twitter: { type: String, default: null },
      youtube: { type: String, default: null },
      github: { type: String, default: null },
      linkedin: { type: String, default: null },
    },
    selectedBadges: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Badge",
    }],
    analyticsPreferences: {
      allowAggregatedInsights: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

export const CreatorProfile = mongoose.model("CreatorProfile", creatorProfileSchema);
