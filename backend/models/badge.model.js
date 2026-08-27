import mongoose from "mongoose";

const badgeSchema = new mongoose.Schema(
  {
    badgeId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    icon: {
      type: String,
      default: "military_tech", // Material icon identifier
    },
    category: {
      type: String,
      enum: ["contribution", "quality", "community", "creator", "milestone"],
      default: "milestone",
      index: true,
    },
    rarity: {
      type: String,
      enum: ["common", "rare", "epic", "legendary"],
      default: "common",
    },
    criteria: {
      action: { type: String, required: true },
      threshold: { type: Number, required: true },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export const Badge = mongoose.model("Badge", badgeSchema);
