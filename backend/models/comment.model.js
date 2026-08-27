import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
  {
    content: { type: String, required: true, trim: true }, // Comment content
    post: { type: mongoose.Schema.Types.ObjectId, ref: "Post", default: null }, // The post this comment belongs to (if any)
    poll: { type: mongoose.Schema.Types.ObjectId, ref: "Poll", default: null }, // The poll this comment belongs to (if any)
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // The user who posted the comment
    parentComment: { type: mongoose.Schema.Types.ObjectId, ref: "Comment", default: null }, // Parent comment for 1st level nested replies
    replyCount: { type: Number, default: 0, min: 0 }, // Cached count of direct replies
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Likes for the comment
    isEdited: { type: Boolean, default: false },
    status: { type: String, enum: ["active", "deleted", "hidden"], default: "active" }, // Comment status
    isFlagged: { type: Boolean, default: false }, // Flag for moderation
    flaggedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Users who flagged the comment
    approved: { type: Boolean, default: true }, // Whether the comment is approved
  },
  { timestamps: true }
);

commentSchema.index({ post: 1, parentComment: 1, createdAt: -1 });
commentSchema.index({ poll: 1, parentComment: 1, createdAt: -1 });
commentSchema.index({ parentComment: 1, createdAt: 1 });
commentSchema.index({ author: 1 });

export const Comment = mongoose.model("Comment", commentSchema);
