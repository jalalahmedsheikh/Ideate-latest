import mongoose from "mongoose";

const reportSchema = new mongoose.Schema(
  {
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    targetType: { type: String, enum: ["Post", "Poll", "User"], required: true },
    reason: { type: String, required: true },
    status: { type: String, enum: ["pending", "resolved"], default: "pending" }
  },
  { timestamps: true }
);

export const Report = mongoose.model("Report", reportSchema);
