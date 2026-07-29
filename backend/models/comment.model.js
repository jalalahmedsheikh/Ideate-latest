import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
  {
    content: { type: String, required: true }, // Comment content
    post: { type: mongoose.Schema.Types.ObjectId, ref: "Post", required: true }, // The post this comment belongs to
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // The user who posted the comment
    parentComment: { type: mongoose.Schema.Types.ObjectId, ref: "Comment", default: null }, // Parent comment for replies
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Likes for the comment
    status: { type: String, enum: ["active", "deleted"], default: "active" }, // Comment status
    isFlagged: { type: Boolean, default: false }, // Flag for moderation
    flaggedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Users who flagged the comment
    approved: { type: Boolean, default: false }, // Whether the comment is approved by an admin
  },
  { timestamps: true }
);

commentSchema.index({ post: 1 });
commentSchema.index({ author: 1 });

export const Comment = mongoose.model("Comment", commentSchema);
