import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
  {
    content: { type: String, required: true, trim: true }, // Comment content
    post: { type: mongoose.Schema.Types.ObjectId, ref: "Post", default: null }, // The post this comment belongs to (if any)
    poll: { type: mongoose.Schema.Types.ObjectId, ref: "Poll", default: null }, // The poll this comment belongs to (if any)
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // The user who posted the comment
    parentComment: { type: mongoose.Schema.Types.ObjectId, ref: "Comment", default: null }, // Parent comment for nested replies
    replyToUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, // Specific user being replied to
    depth: { type: Number, default: 0, min: 0, max: 10 }, // Depth level for threaded rendering
    replyCount: { type: Number, default: 0, min: 0 }, // Cached count of direct replies
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Backward-compatible Likes array
    reactions: {
      type: Map,
      of: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      default: () => new Map([["like", []]]),
    },
    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date, default: null },
    isPinned: { type: Boolean, default: false }, // Pin comment to top of discussion
    pinnedAt: { type: Date, default: null },
    pinnedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    status: { type: String, enum: ["active", "deleted", "hidden"], default: "active" }, // Comment status
    isFlagged: { type: Boolean, default: false }, // Flag for moderation
    flaggedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Users who flagged the comment
    approved: { type: Boolean, default: true }, // Whether the comment is approved
    mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // @mentioned users
    idempotencyKey: { type: String, default: null, trim: true }, // Submission deduplication key
  },
  { timestamps: true }
);

commentSchema.index({ post: 1, parentComment: 1, isPinned: -1, createdAt: -1 });
commentSchema.index({ poll: 1, parentComment: 1, isPinned: -1, createdAt: -1 });
commentSchema.index({ parentComment: 1, createdAt: 1 });
commentSchema.index(
  { author: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } }
);

export const Comment = mongoose.model("Comment", commentSchema);
