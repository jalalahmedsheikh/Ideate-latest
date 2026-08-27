import mongoose from "mongoose";

const reportSchema = new mongoose.Schema(
  {
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    targetType: {
      type: String,
      enum: ["Post", "Poll", "Comment", "User", "Message", "Topic"],
      required: true,
    },
    reason: {
      type: String,
      enum: [
        "spam",
        "harassment",
        "hate_speech",
        "impersonation",
        "misinformation",
        "sexual_content",
        "violence",
        "scam",
        "copyright",
        "other",
      ],
      required: true,
    },
    description: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: ["pending", "in_review", "resolved", "dismissed"],
      default: "pending",
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

reportSchema.index({ reportedBy: 1, targetId: 1, targetType: 1 });
reportSchema.index({ status: 1, createdAt: -1 });

export const Report = mongoose.model("Report", reportSchema);
