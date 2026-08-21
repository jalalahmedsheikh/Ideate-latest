import { User } from "../models/user.model.js";
import { Post } from "../models/post.model.js";
import { Poll } from "../models/poll.model.js";
import { Report } from "../models/report.model.js";
import { Comment } from "../models/comment.model.js";
import { Notification } from "../models/notification.model.js";
import { io } from "../socket/socket.js";

// Get Admin Dashboard Analytics
export const getDashboardAnalytics = async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalPosts = await Post.countDocuments();
        const totalPolls = await Poll.countDocuments();
        const pendingReportsCount = await Report.countDocuments({ status: "pending" });

        // Daily Active Users (DAU) estimation based on users updated in the last 24 hours
        const activeUsersCount = await User.countDocuments({
            updatedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        });

        // Engagement calculation
        const posts = await Post.find().select("likes comments");
        const polls = await Poll.find().select("votesHistory");

        let totalLikes = 0;
        let totalComments = 0;
        let totalVotes = 0;

        posts.forEach(p => {
            totalLikes += p.likes ? p.likes.length : 0;
            totalComments += p.comments ? p.comments.length : 0;
        });

        polls.forEach(p => {
            totalVotes += p.votesHistory ? p.votesHistory.length : 0;
        });

        const totalEngagements = totalLikes + totalComments + totalVotes;
        const totalContent = totalPosts + totalPolls;
        const engagementRate = totalContent > 0 ? ((totalEngagements / totalContent) * 100).toFixed(1) : 0;

        return res.status(200).json({
            success: true,
            analytics: {
                totalUsers,
                totalPosts,
                totalPolls,
                pendingReportsCount,
                activeUsersCount: activeUsersCount || 1, // Fallback to 1 for dev
                engagementRate: parseFloat(engagementRate)
            }
        });
    } catch (error) {
        console.error("Admin Analytics Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
};

// List all users for management
export const listAllUsers = async (req, res) => {
    try {
        const { search, role, status } = req.query;
        let query = {};

        if (search) {
            query.$or = [
                { username: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } }
            ];
        }

        if (role) {
            query.role = role;
        }

        if (status) {
            if (status === "banned") query.isBanned = true;
            if (status === "verified") query.isverified = true;
        }

        const users = await User.find(query).select("-password").sort({ createdAt: -1 });
        return res.status(200).json({ success: true, users });
    } catch (error) {
        console.error("Admin List Users Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
};

// Toggle Ban/Unban user
export const toggleBanUser = async (req, res) => {
    try {
        const { targetUserId } = req.body;
        const user = await User.findById(targetUserId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        user.isBanned = !user.isBanned;
        await user.save();

        return res.status(200).json({
            success: true,
            isBanned: user.isBanned,
            message: `User ${user.username} has been ${user.isBanned ? "banned" : "unbanned"}.`
        });
    } catch (error) {
        console.error("Admin Toggle Ban Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
};

// Toggle verification badge
export const toggleVerifyUser = async (req, res) => {
    try {
        const { targetUserId } = req.body;
        const user = await User.findById(targetUserId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        user.isverified = !user.isverified;
        await user.save();

        return res.status(200).json({
            success: true,
            isVerified: user.isverified,
            message: `User ${user.username} verification badge ${user.isverified ? "granted" : "revoked"}.`
        });
    } catch (error) {
        console.error("Admin Toggle Verify Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
};

// List all reports with detailed targets
export const listAllReports = async (req, res) => {
    try {
        const reports = await Report.find()
            .populate("reportedBy", "username email profileImage")
            .sort({ createdAt: -1 });

        const detailedReports = [];

        for (const report of reports) {
            let targetContent = null;
            try {
                if (report.targetType === "Post") {
                    targetContent = await Post.findById(report.targetId).populate("author", "username profileImage");
                } else if (report.targetType === "Poll") {
                    targetContent = await Poll.findById(report.targetId).populate("author", "username profileImage");
                } else if (report.targetType === "User") {
                    targetContent = await User.findById(report.targetId).select("username email profileImage isBanned");
                }
            } catch (err) {
                console.error("Error fetching report target:", err);
            }

            detailedReports.push({
                _id: report._id,
                reportedBy: report.reportedBy,
                targetId: report.targetId,
                targetType: report.targetType,
                reason: report.reason,
                status: report.status,
                createdAt: report.createdAt,
                targetContent: targetContent
            });
        }

        return res.status(200).json({ success: true, reports: detailedReports });
    } catch (error) {
        console.error("Admin List Reports Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
};

// Resolve a report (and optionally delete content / ban user)
export const resolveReport = async (req, res) => {
    try {
        const { reportId, action } = req.body; // action: 'dismiss' or 'delete_content'

        const report = await Report.findById(reportId);
        if (!report) {
            return res.status(404).json({ success: false, message: "Report not found." });
        }

        report.status = "resolved";
        await report.save();

        if (action === "delete_content") {
            if (report.targetType === "Post") {
                await Post.findByIdAndDelete(report.targetId);
                await Comment.deleteMany({ post: report.targetId });
            } else if (report.targetType === "Poll") {
                await Poll.findByIdAndDelete(report.targetId);
            } else if (report.targetType === "User") {
                // If resolving User report by banning, we ban them
                const user = await User.findById(report.targetId);
                if (user) {
                    user.isBanned = true;
                    await user.save();
                }
            }
        }

        return res.status(200).json({
            success: true,
            message: `Report resolved successfully. Action: ${action || 'dismissed'}`
        });
    } catch (error) {
        console.error("Admin Resolve Report Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
};

// Send Admin Custom/Broadcast Notification
export const sendAdminNotification = async (req, res) => {
    try {
        const { message, targetType, targetUserId } = req.body;
        const senderId = req.id;
        const sender = await User.findById(senderId).select("username profileImage name");

        if (!message) {
            return res.status(400).json({ success: false, message: "Notification message is required." });
        }

        const senderDetails = {
            username: sender?.username || "Admin",
            profileImage: sender?.profileImage || "",
            name: sender?.name || "System Admin",
        };

        if (targetType === "single" && targetUserId) {
            const notif = await Notification.create({
                recipient: targetUserId,
                sender: senderId,
                type: "mention",
                message,
                senderDetails,
            });
            io.to(targetUserId.toString()).emit("notification", notif);
        } else {
            const users = await User.find({ _id: { $ne: senderId } }).select("_id");
            const notifs = users.map(u => ({
                recipient: u._id,
                sender: senderId,
                type: "mention",
                message,
                senderDetails,
            }));

            if (notifs.length > 0) {
                await Notification.insertMany(notifs);
            }

            io.emit("notification", {
                type: "mention",
                message,
                senderDetails,
                createdAt: new Date(),
            });
        }

        return res.status(200).json({ success: true, message: "Notification sent successfully." });
    } catch (error) {
        console.error("Admin Send Notification Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
};

// List all Posts and Polls
export const listAllContent = async (req, res) => {
    try {
        const { search } = req.query;
        let postQuery = {};
        let pollQuery = {};

        if (search) {
            postQuery.caption = { $regex: search, $options: "i" };
            pollQuery.question = { $regex: search, $options: "i" };
        }

        const posts = await Post.find(postQuery).populate("author", "username profileImage").sort({ createdAt: -1 }).lean();
        const polls = await Poll.find(pollQuery).populate("author", "username profileImage").sort({ createdAt: -1 }).lean();

        const formattedPosts = posts.map(p => ({ ...p, type: "Post" }));
        const formattedPolls = polls.map(p => ({ ...p, type: "Poll" }));

        const allContent = [...formattedPosts, ...formattedPolls].sort(
            (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );

        return res.status(200).json({ success: true, content: allContent });
    } catch (error) {
        console.error("Admin List Content Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
};

import { cascadeDeleteUser } from "../utills/cascadeDeleteUser.js";

// Delete Post or Poll from Admin
export const deleteContent = async (req, res) => {
    try {
        const { id, type } = req.body;
        if (type === "Post") {
            await Post.findByIdAndDelete(id);
            await Comment.deleteMany({ post: id });
        } else if (type === "Poll") {
            await Poll.findByIdAndDelete(id);
        } else {
            return res.status(400).json({ success: false, message: "Invalid content type." });
        }
        return res.status(200).json({ success: true, message: "Content deleted successfully." });
    } catch (error) {
        console.error("Admin Delete Content Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
};

// Admin Cascade Delete User Account
export const deleteUserByAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ success: false, message: "User ID is required." });
        }

        const result = await cascadeDeleteUser(id);
        return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
        console.error("Admin Delete User Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
};
