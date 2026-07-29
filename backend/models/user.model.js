import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, default: null },
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true, match: /\S+@\S+\.\S+/ },
    password: { type: String, required: true },
    isverified: { type: Boolean, default: false }, // Verified badge status
    profileImage: { type: String, default: null },
    bio: { type: String, default: null },
    gender: { type: String, default: null },
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    followings: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    posts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Post" }],
    polls: [{ type: mongoose.Schema.Types.ObjectId, ref: "Poll" }],
    role: { type: String, enum: ["user", "admin"], default: "user" },
    bookmarks: [{ type: mongoose.Schema.Types.ObjectId, ref: "Post" }],
    isBanned: { type: Boolean, default: false },
    isShadowBanned: { type: Boolean, default: false },
    isPrivate: { type: Boolean, default: false },
    followRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    mutedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    socialLinks: {
      twitter: { type: String, default: null },
      facebook: { type: String, default: null },
      instagram: { type: String, default: null },
    },
    category: {
      type: String,
      default: "Ideate-User", // Default to "Ideate-User" if not specified
    },
  },
  { timestamps: true }
);

// Create a geospatial index on the `location` field to allow geospatial queries
userSchema.index({ location: "2dsphere" });
userSchema.index({ username: 1 }, { unique: true });
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ followers: 1 });
userSchema.index({ followings: 1 });

export const User = mongoose.model("User", userSchema);
