import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, default: null },
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, match: /\S+@\S+\.\S+/ },
    password: { 
      type: String, 
      required: function() { return !this.authProvider || this.authProvider === 'local'; } 
    },
    authProvider: { 
      type: String, 
      enum: ["local", "google", "facebook"], 
      default: "local" 
    },
    firebaseUid: { type: String, default: null, sparse: true, index: true },
    googleId: { type: String, default: null },
    facebookId: { type: String, default: null },
    isverified: { type: Boolean, default: false }, // Verified badge status
    verificationCategory: { 
      type: String, 
      enum: ["identity", "organization", "creator", "notable", null], 
      default: null 
    },
    profileImage: { type: String, default: null },
    bio: { type: String, default: null },
    gender: { type: String, default: null },
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    followings: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    posts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Post" }],
    polls: [{ type: mongoose.Schema.Types.ObjectId, ref: "Poll" }],
    questions: [{ type: mongoose.Schema.Types.ObjectId, ref: "Question" }],
    debates: [{ type: mongoose.Schema.Types.ObjectId, ref: "Debate" }],
    communities: [{ type: mongoose.Schema.Types.ObjectId, ref: "Community" }],
    role: { type: String, enum: ["user", "admin"], default: "user" },
    bookmarks: [{ type: mongoose.Schema.Types.ObjectId, ref: "Post" }],
    isBanned: { type: Boolean, default: false },
    isShadowBanned: { type: Boolean, default: false },
    isPrivate: { type: Boolean, default: false },
    isCreator: { type: Boolean, default: false },
    reputationScore: { type: Number, default: 0, index: true },
    reputationLevel: { 
      type: String, 
      enum: ["Newcomer", "Contributor", "Trusted Contributor", "Expert Contributor", "Community Leader"], 
      default: "Newcomer" 
    },
    badgesCount: { type: Number, default: 0 },
    followRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    mutedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    socialLinks: {
      twitter: { type: String, default: null },
      facebook: { type: String, default: null },
      instagram: { type: String, default: null },
      website: { type: String, default: null },
    },
    category: {
      type: String,
      default: "Ideate-User",
    },
    followedTopics: [{ type: mongoose.Schema.Types.ObjectId, ref: "Topic" }],
    messagePrivacy: {
      type: String,
      enum: ["everyone", "following", "nobody"],
      default: "everyone",
    },
    personalizationSettings: {
      enablePersonalizedFeed: { type: Boolean, default: true },
      enableTopicRecommendations: { type: Boolean, default: true },
      enableUserRecommendations: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

userSchema.index({ followers: 1 });
userSchema.index({ followings: 1 });
userSchema.index({ followedTopics: 1 });
userSchema.index({ reputationScore: -1 });

export const User = mongoose.model("User", userSchema);
