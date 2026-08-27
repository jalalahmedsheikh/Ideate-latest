import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["text", "shared_post", "shared_poll", "image"],
      default: "text",
    },
    text: {
      type: String,
      trim: true,
      default: "",
    },
    media: {
      type: String,
      default: null,
    },
    sharedPost: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      default: null,
    },
    sharedPoll: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Poll",
      default: null,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    isRequest: {
      type: Boolean,
      default: false,
    },
    requestStatus: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "accepted",
    },
  },
  { timestamps: true }
);

// Compound index to fast query conversation history between two users
messageSchema.index({ sender: 1, recipient: 1, createdAt: -1 });
messageSchema.index({ recipient: 1, isRequest: 1, requestStatus: 1 });

export const Message = mongoose.model("Message", messageSchema);
