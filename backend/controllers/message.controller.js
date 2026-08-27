import { Message } from "../models/message.model.js";
import { User } from "../models/user.model.js";
import { Post } from "../models/post.model.js";
import { Poll } from "../models/poll.model.js";
import { io, getReceiverSocketId } from "../socket/socket.js";
import { createAndPushNotification } from "./notification.controller.js";

// ─── POST /message/send ───────────────────────────────────────────────────
export const sendMessage = async (req, res) => {
  try {
    const senderId = req.id;
    const { recipientId, text, media, type = "text", sharedPostId, sharedPollId } = req.body;

    if (!recipientId) {
      return res.status(400).json({ success: false, message: "Recipient ID is required." });
    }

    if (!text && !media && !sharedPostId && !sharedPollId) {
      return res.status(400).json({ success: false, message: "Message content cannot be empty." });
    }

    const [recipient, sender] = await Promise.all([
      User.findById(recipientId),
      User.findById(senderId),
    ]);

    if (!recipient) {
      return res.status(404).json({ success: false, message: "Recipient user not found." });
    }

    // Safety checks: blocked users
    if (recipient.blockedUsers && recipient.blockedUsers.includes(senderId)) {
      return res.status(403).json({ success: false, message: "You cannot message this user." });
    }
    if (sender.blockedUsers && sender.blockedUsers.includes(recipientId)) {
      return res.status(403).json({ success: false, message: "Unblock user to send messages." });
    }

    // Privacy checks
    const privacy = recipient.messagePrivacy || "everyone";
    if (privacy === "nobody") {
      return res.status(403).json({ success: false, message: "This user does not accept direct messages." });
    }

    let isRequest = false;
    let requestStatus = "accepted";

    const isRecipientFollowingSender = recipient.followings && recipient.followings.includes(senderId);

    if (privacy === "following" && !isRecipientFollowingSender) {
      // Check if there was an existing accepted conversation
      const existingAccepted = await Message.findOne({
        $or: [
          { sender: senderId, recipient: recipientId, requestStatus: "accepted" },
          { sender: recipientId, recipient: senderId, requestStatus: "accepted" },
        ],
      });

      if (!existingAccepted) {
        isRequest = true;
        requestStatus = "pending";
      }
    }

    let resolvedType = type;
    if (sharedPostId) resolvedType = "shared_post";
    if (sharedPollId) resolvedType = "shared_poll";
    if (media) resolvedType = "image";

    const message = await Message.create({
      sender: senderId,
      recipient: recipientId,
      type: resolvedType,
      text: text ? text.trim() : "",
      media: media || null,
      sharedPost: sharedPostId || null,
      sharedPoll: sharedPollId || null,
      isRead: false,
      isRequest,
      requestStatus,
    });

    const populatedMessage = await message.populate([
      { path: "sender", select: "username profileImage name isverified" },
      { path: "recipient", select: "username profileImage name isverified" },
      {
        path: "sharedPost",
        populate: { path: "author", select: "username profileImage isverified" },
      },
      {
        path: "sharedPoll",
        populate: { path: "author", select: "username profileImage isverified" },
      },
    ]);

    // Push via Socket.io
    const receiverSocketId = getReceiverSocketId(recipientId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", populatedMessage);
    } else {
      io.to(recipientId.toString()).emit("newMessage", populatedMessage);
    }

    // Create notification
    if (!isRequest) {
      await createAndPushNotification({
        io,
        recipientId,
        senderId,
        senderDetails: {
          username: sender?.username || "Someone",
          profileImage: sender?.profileImage || "",
          name: sender?.name || "",
        },
        type: "mention",
        message: `sent you a message: "${text ? text.slice(0, 30) : resolvedType}"`,
      });
    }

    return res.status(201).json({
      success: true,
      message: isRequest ? "Message request sent." : "Message sent successfully.",
      data: populatedMessage,
      isRequest,
    });
  } catch (error) {
    console.error("sendMessage error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to send message." });
  }
};

// ─── GET /message/conversations ─────────────────────────────────────────
export const getConversations = async (req, res) => {
  try {
    const userId = req.id;

    // Find all accepted messages where current user is sender or recipient
    const messages = await Message.find({
      $or: [{ sender: userId }, { recipient: userId }],
      requestStatus: "accepted",
    })
      .sort({ createdAt: -1 })
      .populate("sender", "username profileImage name category isverified")
      .populate("recipient", "username profileImage name category isverified")
      .populate({
        path: "sharedPost",
        populate: { path: "author", select: "username profileImage" },
      })
      .populate({
        path: "sharedPoll",
        populate: { path: "author", select: "username profileImage" },
      })
      .lean();

    const conversationsMap = new Map();

    for (const msg of messages) {
      const isSender = msg.sender._id.toString() === userId.toString();
      const partner = isSender ? msg.recipient : msg.sender;
      if (!partner || !partner._id) continue;

      const partnerId = partner._id.toString();

      if (!conversationsMap.has(partnerId)) {
        const unreadCount = await Message.countDocuments({
          sender: partnerId,
          recipient: userId,
          isRead: false,
          requestStatus: "accepted",
        });

        const isOnline = !!getReceiverSocketId(partnerId);

        conversationsMap.set(partnerId, {
          user: partner,
          lastMessage: {
            id: msg._id,
            type: msg.type,
            text: msg.text,
            media: msg.media,
            sharedPost: msg.sharedPost,
            sharedPoll: msg.sharedPoll,
            sender: msg.sender._id,
            createdAt: msg.createdAt,
            isRead: msg.isRead,
          },
          unreadCount,
          isOnline,
        });
      }
    }

    const conversations = Array.from(conversationsMap.values());

    return res.status(200).json({
      success: true,
      conversations,
    });
  } catch (error) {
    console.error("getConversations error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to fetch conversations." });
  }
};

// ─── GET /message/requests ───────────────────────────────────────────────
export const getMessageRequests = async (req, res) => {
  try {
    const userId = req.id;

    // Find pending message requests sent to current user
    const pendingMessages = await Message.find({
      recipient: userId,
      isRequest: true,
      requestStatus: "pending",
    })
      .sort({ createdAt: -1 })
      .populate("sender", "username profileImage name category isverified bio")
      .lean();

    const requestsMap = new Map();
    for (const msg of pendingMessages) {
      const senderId = msg.sender._id.toString();
      if (!requestsMap.has(senderId)) {
        requestsMap.set(senderId, {
          user: msg.sender,
          lastMessage: msg,
        });
      }
    }

    return res.status(200).json({
      success: true,
      requests: Array.from(requestsMap.values()),
    });
  } catch (error) {
    console.error("getMessageRequests error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to fetch message requests." });
  }
};

// ─── POST /message/request/respond ───────────────────────────────────────
export const respondToMessageRequest = async (req, res) => {
  try {
    const userId = req.id;
    const { senderId, action } = req.body; // action: 'accept' | 'reject' | 'block'

    if (!senderId || !["accept", "reject", "block"].includes(action)) {
      return res.status(400).json({ success: false, message: "Invalid request payload." });
    }

    if (action === "accept") {
      await Message.updateMany(
        { sender: senderId, recipient: userId, requestStatus: "pending" },
        { requestStatus: "accepted", isRequest: false }
      );
      return res.status(200).json({ success: true, message: "Message request accepted." });
    } else if (action === "reject") {
      await Message.deleteMany({
        sender: senderId,
        recipient: userId,
        requestStatus: "pending",
      });
      return res.status(200).json({ success: true, message: "Message request deleted." });
    } else if (action === "block") {
      await User.findByIdAndUpdate(userId, { $addToSet: { blockedUsers: senderId } });
      await Message.deleteMany({
        sender: senderId,
        recipient: userId,
      });
      return res.status(200).json({ success: true, message: "User blocked and request deleted." });
    }
  } catch (error) {
    console.error("respondToMessageRequest error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to respond to request." });
  }
};

// ─── GET /message/chat/:otherUserId ──────────────────────────────────────
export const getMessages = async (req, res) => {
  try {
    const userId = req.id;
    const { otherUserId } = req.params;

    const messages = await Message.find({
      $or: [
        { sender: userId, recipient: otherUserId },
        { sender: otherUserId, recipient: userId },
      ],
      requestStatus: { $ne: "rejected" },
    })
      .sort({ createdAt: 1 })
      .populate("sender", "username profileImage name isverified")
      .populate("recipient", "username profileImage name isverified")
      .populate({
        path: "sharedPost",
        populate: { path: "author", select: "username profileImage isverified" },
      })
      .populate({
        path: "sharedPoll",
        populate: { path: "author", select: "username profileImage isverified" },
      })
      .lean();

    // Mark messages from otherUserId as read
    await Message.updateMany(
      { sender: otherUserId, recipient: userId, isRead: false },
      { isRead: true }
    );

    return res.status(200).json({
      success: true,
      messages,
    });
  } catch (error) {
    console.error("getMessages error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to fetch chat history." });
  }
};

// ─── PUT /message/read/:otherUserId ─────────────────────────────────────
export const markMessagesAsRead = async (req, res) => {
  try {
    const userId = req.id;
    const { otherUserId } = req.params;

    await Message.updateMany(
      { sender: otherUserId, recipient: userId, isRead: false },
      { isRead: true }
    );

    return res.status(200).json({ success: true, message: "Messages marked as read." });
  } catch (error) {
    console.error("markMessagesAsRead error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to mark messages as read." });
  }
};

// ─── DELETE /message/:id ─────────────────────────────────────────────────
export const deleteMessage = async (req, res) => {
  try {
    const userId = req.id;
    const messageId = req.params.id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, message: "Message not found." });
    }

    if (message.sender.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized to delete this message." });
    }

    await Message.findByIdAndDelete(messageId);

    return res.status(200).json({ success: true, message: "Message deleted." });
  } catch (error) {
    console.error("deleteMessage error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to delete message." });
  }
};
