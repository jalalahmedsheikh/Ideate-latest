import { Notification } from "../models/notification.model.js";

// ─── GET /notifications — fetch for logged-in user ──────────────────────
export const getNotifications = async (req, res) => {
  try {
    const userId = req.id;
    const page  = Math.max(parseInt(req.query.page)  || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 30, 50);
    const skip  = (page - 1) * limit;
    const category = req.query.category; // 'followers' | 'activity' | 'system'

    let queryFilter = { recipient: userId };
    if (category === 'followers') {
      queryFilter.type = { $in: ["follow", "follow_request", "follow_accept"] };
    } else if (category === 'activity') {
      queryFilter.type = { $in: ["like", "dislike", "comment", "vote"] };
    } else if (category === 'system') {
      queryFilter.type = { $in: ["mention"] };
    }

    const notifications = await Notification.find(queryFilter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const unreadCount = await Notification.countDocuments({ recipient: userId, isRead: false });

    // Category breakdown counts
    const followerTypes = ["follow", "follow_request", "follow_accept"];
    const activityTypes = ["like", "dislike", "comment", "vote"];
    const systemTypes = ["mention"];

    const followersUnread = await Notification.countDocuments({ recipient: userId, isRead: false, type: { $in: followerTypes } });
    const activityUnread = await Notification.countDocuments({ recipient: userId, isRead: false, type: { $in: activityTypes } });
    const systemUnread = await Notification.countDocuments({ recipient: userId, isRead: false, type: { $in: systemTypes } });

    // Latest notification snippet per category
    const latestFollower = await Notification.findOne({ recipient: userId, type: { $in: followerTypes } }).sort({ createdAt: -1 }).lean();
    const latestActivity = await Notification.findOne({ recipient: userId, type: { $in: activityTypes } }).sort({ createdAt: -1 }).lean();
    const latestSystem = await Notification.findOne({ recipient: userId, type: { $in: systemTypes } }).sort({ createdAt: -1 }).lean();

    return res.status(200).json({
      success: true,
      notifications,
      unreadCount,
      categories: {
        followersUnread,
        activityUnread,
        systemUnread,
        latestFollower,
        latestActivity,
        latestSystem,
      },
      page,
    });
  } catch (error) {
    console.error("getNotifications error:", error.message);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ─── PUT /notifications/mark-read — mark all as read ──────────────────────
export const markAllRead = async (req, res) => {
  try {
    const userId = req.id;
    await Notification.updateMany({ recipient: userId, isRead: false }, { isRead: true });
    return res.status(200).json({ success: true, message: "All notifications marked as read." });
  } catch (error) {
    console.error("markAllRead error:", error.message);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ─── PUT /notifications/:id/read — mark single as read ────────────────────
export const markOneRead = async (req, res) => {
  try {
    const userId = req.id;
    await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: userId },
      { isRead: true }
    );
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ─── DELETE /notifications — clear all ─────────────────────────────────────
export const clearAllNotifications = async (req, res) => {
  try {
    const userId = req.id;
    await Notification.deleteMany({ recipient: userId });
    return res.status(200).json({ success: true, message: "All notifications cleared." });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ─── Internal helper: create + persist + push via socket ───────────────────
export const createAndPushNotification = async ({ io, recipientId, senderId, senderDetails, type, message, postId = null, pollId = null }) => {
  try {
    // Don't notify yourself
    if (recipientId.toString() === senderId.toString()) return;

    const notif = await Notification.create({
      recipient: recipientId,
      sender:    senderId,
      type,
      message,
      postId,
      pollId,
      senderDetails,
    });

    // Push via WebSocket immediately
    io.to(recipientId.toString()).emit("notification", {
      ...notif.toObject(),
      senderDetails,
    });
  } catch (err) {
    console.error("createAndPushNotification error:", err.message);
  }
};
