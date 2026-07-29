import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
  {
    caption: { type: String, required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    PostType: {
      type: String,
      default: "Post", // Default value is "Post"
    },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    comments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment'}],
    shareCount: { type: Number, default: 0 }, // Track shares
    status: {
      type: String,
      enum: ["active", "deleted", "archived", "private"],
      default: "active", // Manage post status
    },
    tags: [{ type: String }],       // General tags for categorization
    hashtags: [{ type: String }],   // Social hashtags (e.g. #flutter, #ideate)
    location: {
      type: { type: String, default: "Point" },
      coordinates: { type: [Number], index: "2dsphere" }, // Geospatial indexing
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Track who updated
    views: { type: Number, default: 0 }, // Track views
    reactions: {
      like: { type: [mongoose.Schema.Types.ObjectId], ref: 'User' },
      love: { type: [mongoose.Schema.Types.ObjectId], ref: 'User' },
      wow: { type: [mongoose.Schema.Types.ObjectId], ref: 'User' },
      sad: { type: [mongoose.Schema.Types.ObjectId], ref: 'User' }
      // Add more reactions as needed
    },
  },
  { timestamps: true }
);

postSchema.index({ author: 1 });
postSchema.index({ createdAt: -1 });
postSchema.index({ tags: 1 });
postSchema.index({ hashtags: 1 });
// Compound index for fast feed ranking queries
postSchema.index({ status: 1, createdAt: -1 });

export const Post = mongoose.model("Post", postSchema);
