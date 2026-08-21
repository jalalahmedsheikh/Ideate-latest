import { Message } from "../models/message.model.js";
import { User } from "../models/user.model.js";
import { io, getReceiverSocketId } from "../socket/socket.js";
import { createAndPushNotification } from "./notification.controller.js";

// ─── POST /message/send ───────────────────────────────────────────────────
export const sendMessage = async (req, res) => {
  try {
    const senderId = req.id;
    const { recipientId, text, media } = req.body;

    if (!recipientId) {
      return res.status(400).json({ success: false, message: "Recipient ID is required." });
    }

    if (!text && !media) {
      return res.status(400).json({ success: false, message: "Message content cannot be empty." });
    }

    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ success: false, message: "Recipient user not found." });
    }

    const message = await Message.create({
      sender: senderId,
      recipient: recipientId,
      text: text ? text.trim() : "",
      media: media || null,
      isRead: false,
    });

    const populatedMessage = await message.populate([
      { path: "sender", select: "username profileImage name" },
      { path: "recipient", select: "username profileImage name" },
    ]);

    // Push via Socket.io if recipient is online
    const receiverSocketId = getReceiverSocketId(recipientId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", populatedMessage);
    } else {
      // Emit to recipient's room
      io.to(recipientId.toString()).emit("newMessage", populatedMessage);
    }

    // Create a notification for the message
    const senderUser = await User.findById(senderId).select("username profileImage name");
    await createAndPushNotification({
      io,
      recipientId,
      senderId,
      senderDetails: {
        username: senderUser?.username || "Someone",
        profileImage: senderUser?.profileImage || "",
        name: senderUser?.name || "",
      },
      type: "mention", // message notification
      message: `sent you a message: "${text ? text.slice(0, 30) : "Media message"}"`,
    });

    return res.status(201).json({
      success: true,
      message: "Message sent successfully.",
      data: populatedMessage,
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

    // Find all distinct users the current user has exchanged messages with
    const messages = await Message.find({
      $or: [{ sender: userId }, { recipient: userId }],
    })
      .sort({ createdAt: -1 })
      .populate("sender", "username profileImage name category isverified")
      .populate("recipient", "username profileImage name category isverified")
      .lean();

    const conversationsMap = new Map();

    for (const msg of messages) {
      const isSender = msg.sender._id.toString() === userId.toString();
      const partner = isSender ? msg.recipient : msg.sender;
      if (!partner || !partner._id) continue;

      const partnerId = partner._id.toString();

      if (!conversationsMap.has(partnerId)) {
        // Calculate unread messages from this partner to current user
        const unreadCount = await Message.countDocuments({
          sender: partnerId,
          recipient: userId,
          isRead: false,
        });

        const isOnline = !!getReceiverSocketId(partnerId);

        conversationsMap.set(partnerId, {
          user: partner,
          lastMessage: {
            id: msg._id,
            text: msg.text,
            media: msg.media,
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
    })
      .sort({ createdAt: 1 })
      .populate("sender", "username profileImage name")
      .populate("recipient", "username profileImage name")
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
