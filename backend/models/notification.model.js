import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    // Who receives this notification
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Who triggered the action
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Notification type
    type: {
      type: String,
      enum: ["like", "dislike", "comment", "follow", "follow_request", "follow_accept", "vote", "mention"],
      required: true,
    },
    // Optional reference to the related content
    postId: { type: mongoose.Schema.Types.ObjectId, ref: "Post", default: null },
    pollId: { type: mongoose.Schema.Types.ObjectId, ref: "Poll", default: null },
    // Human-readable message
    message: { type: String, required: true },
    // Sender snapshot (so we don't need to populate on every read)
    senderDetails: {
      username: String,
      profileImage: String,
      name: String,
    },
    // Read state
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// TTL: auto-delete notifications older than 30 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 3600 });

export const Notification = mongoose.model("Notification", notificationSchema);
