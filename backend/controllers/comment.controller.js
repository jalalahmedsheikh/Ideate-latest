import { Comment } from "../models/comment.model.js";
import { Post } from "../models/post.model.js";
import { Poll } from "../models/poll.model.js";
import { User } from "../models/user.model.js";
import { io } from "../socket/socket.js";
import { queueNotification } from "../queues/queue.js";

// ─── POST /comment/add ───────────────────────────────────────────────────
export const createComment = async (req, res) => {
  try {
    const authorId = req.id;
    const { content, text, postId, pollId, parentCommentId } = req.body;

    const commentText = (content || text || "").trim();
    if (!commentText) {
      return res.status(400).json({ success: false, message: "Comment content cannot be empty." });
    }

    if (!postId && !pollId) {
      return res.status(400).json({ success: false, message: "Must provide a postId or pollId." });
    }

    let targetDoc = null;
    let targetType = "post";

    if (postId) {
      targetDoc = await Post.findById(postId);
      targetType = "post";
    } else if (pollId) {
      targetDoc = await Poll.findById(pollId);
      targetType = "poll";
    }

    if (!targetDoc) {
      return res.status(404).json({ success: false, message: `${targetType} not found.` });
    }

    let parentComment = null;
    if (parentCommentId) {
      parentComment = await Comment.findById(parentCommentId);
      if (!parentComment) {
        return res.status(404).json({ success: false, message: "Parent comment not found." });
      }
    }

    const comment = await Comment.create({
      content: commentText,
      post: postId || null,
      poll: pollId || null,
      author: authorId,
      parentComment: parentCommentId || null,
    });

    // If top-level comment, push to targetDoc comments array
    if (!parentCommentId) {
      if (postId) {
        targetDoc.comments.push(comment._id);
        await targetDoc.save();
      } else if (pollId) {
        if (!targetDoc.comments) targetDoc.comments = [];
        targetDoc.comments.push(comment._id);
        await targetDoc.save();
      }
    } else {
      // If reply, increment parent comment replyCount
      await Comment.findByIdAndUpdate(parentCommentId, { $inc: { replyCount: 1 } });
    }

    await comment.populate({
      path: "author",
      select: "username profileImage name isverified",
    });

    const commenter = await User.findById(authorId).select("username profileImage name");

    // Real-time socket emit
    const roomKey = postId ? `post:${postId}` : `poll:${pollId}`;
    if (io) {
      io.to(roomKey).emit("new_comment", {
        comment,
        isReply: !!parentCommentId,
        parentCommentId,
      });
    }

    // Queue notification
    try {
      const targetOwnerId = targetDoc.author ? targetDoc.author.toString() : null;
      if (parentCommentId && parentComment.author.toString() !== authorId) {
        // Notification for reply
        await queueNotification({
          type: "comment",
          userId: authorId,
          userDetails: {
            username: commenter?.username || "User",
            profileImage: commenter?.profileImage || null,
            name: commenter?.name || commenter?.username || "User",
          },
          postId: postId || null,
          pollId: pollId || null,
          message: `${commenter?.name || commenter?.username} replied to your comment: "${commentText.slice(0, 20)}..."`,
          targetOwnerId: parentComment.author.toString(),
        });
      } else if (targetOwnerId && targetOwnerId !== authorId) {
        // Notification for top-level comment
        await queueNotification({
          type: "comment",
          userId: authorId,
          userDetails: {
            username: commenter?.username || "User",
            profileImage: commenter?.profileImage || null,
            name: commenter?.name || commenter?.username || "User",
          },
          postId: postId || null,
          pollId: pollId || null,
          message: `${commenter?.name || commenter?.username} commented on your ${targetType}: "${commentText.slice(0, 20)}..."`,
          targetOwnerId,
        });
      }
    } catch (notifErr) {
      console.warn("Notification error in createComment:", notifErr.message);
    }

    return res.status(201).json({
      success: true,
      message: parentCommentId ? "Reply added." : "Comment added.",
      comment,
    });
  } catch (error) {
    console.error("Error in createComment:", error);
    return res.status(500).json({ success: false, message: "Failed to post comment." });
  }
};

// ─── GET /comment/list ────────────────────────────────────────────────────
export const getComments = async (req, res) => {
  try {
    const { postId, pollId, sort = "newest", page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(parseInt(page) || 1, 1);
    const limitNum = Math.min(parseInt(limit) || 20, 50);
    const skip = (pageNum - 1) * limitNum;

    if (!postId && !pollId) {
      return res.status(400).json({ success: false, message: "Must specify postId or pollId." });
    }

    const filter = {
      parentComment: null, // Only fetch top-level comments
      status: { $in: ["active", "deleted"] },
      ...(postId ? { post: postId } : { poll: pollId }),
    };

    let sortOption = { createdAt: -1 };
    if (sort === "top") {
      sortOption = { "likes.length": -1, createdAt: -1 };
    } else if (sort === "oldest") {
      sortOption = { createdAt: 1 };
    }

    const [comments, totalItems] = await Promise.all([
      Comment.find(filter)
        .sort(sortOption)
        .skip(skip)
        .limit(limitNum)
        .populate("author", "username profileImage isverified name")
        .lean(),
      Comment.countDocuments(filter),
    ]);

    const currentUserId = req.id ? req.id.toString() : null;

    const formattedComments = comments.map((c) => {
      const isLiked = currentUserId && c.likes ? c.likes.some((id) => id.toString() === currentUserId) : false;
      const likeCount = c.likes ? c.likes.length : 0;
      return {
        ...c,
        content: c.status === "deleted" ? "This comment was deleted." : c.content,
        isLiked,
        likeCount,
        likes: undefined, // Don't leak full user list in response
      };
    });

    return res.status(200).json({
      success: true,
      comments: formattedComments,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalItems,
        totalPages: Math.ceil(totalItems / limitNum),
      },
    });
  } catch (error) {
    console.error("Error in getComments:", error);
    return res.status(500).json({ success: false, message: "Failed to retrieve comments." });
  }
};

// ─── GET /comment/:id/replies ─────────────────────────────────────────────
export const getCommentReplies = async (req, res) => {
  try {
    const parentId = req.params.id;
    const { page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(parseInt(page) || 1, 1);
    const limitNum = Math.min(parseInt(limit) || 20, 50);
    const skip = (pageNum - 1) * limitNum;

    const filter = {
      parentComment: parentId,
      status: { $in: ["active", "deleted"] },
    };

    const [replies, totalItems] = await Promise.all([
      Comment.find(filter)
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limitNum)
        .populate("author", "username profileImage isverified name")
        .lean(),
      Comment.countDocuments(filter),
    ]);

    const currentUserId = req.id ? req.id.toString() : null;

    const formattedReplies = replies.map((r) => {
      const isLiked = currentUserId && r.likes ? r.likes.some((id) => id.toString() === currentUserId) : false;
      const likeCount = r.likes ? r.likes.length : 0;
      return {
        ...r,
        content: r.status === "deleted" ? "This comment was deleted." : r.content,
        isLiked,
        likeCount,
        likes: undefined,
      };
    });

    return res.status(200).json({
      success: true,
      replies: formattedReplies,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalItems,
        totalPages: Math.ceil(totalItems / limitNum),
      },
    });
  } catch (error) {
    console.error("Error in getCommentReplies:", error);
    return res.status(500).json({ success: false, message: "Failed to retrieve replies." });
  }
};

// ─── POST /comment/:id/toggleLike ─────────────────────────────────────────
export const toggleCommentLike = async (req, res) => {
  try {
    const commentId = req.params.id;
    const userId = req.id;

    const comment = await Comment.findById(commentId);
    if (!comment || comment.status === "deleted") {
      return res.status(404).json({ success: false, message: "Comment not found." });
    }

    const isLiked = comment.likes && comment.likes.some((id) => id.toString() === userId.toString());

    if (isLiked) {
      await Comment.findByIdAndUpdate(commentId, { $pull: { likes: userId } });
    } else {
      await Comment.findByIdAndUpdate(commentId, { $addToSet: { likes: userId } });
    }

    const updated = await Comment.findById(commentId).select("likes").lean();
    const newLikeCount = updated.likes ? updated.likes.length : 0;

    return res.status(200).json({
      success: true,
      isLiked: !isLiked,
      likeCount: newLikeCount,
      message: isLiked ? "Comment unliked." : "Comment liked.",
    });
  } catch (error) {
    console.error("Error in toggleCommentLike:", error);
    return res.status(500).json({ success: false, message: "Failed to toggle comment like." });
  }
};

// ─── PUT /comment/:id/edit ────────────────────────────────────────────────
export const editComment = async (req, res) => {
  try {
    const commentId = req.params.id;
    const userId = req.id;
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ success: false, message: "Content cannot be empty." });
    }

    const comment = await Comment.findById(commentId);
    if (!comment || comment.status === "deleted") {
      return res.status(404).json({ success: false, message: "Comment not found." });
    }

    if (comment.author.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized to edit this comment." });
    }

    comment.content = content.trim();
    comment.isEdited = true;
    await comment.save();

    return res.status(200).json({
      success: true,
      message: "Comment updated.",
      comment,
    });
  } catch (error) {
    console.error("Error in editComment:", error);
    return res.status(500).json({ success: false, message: "Failed to edit comment." });
  }
};

// ─── DELETE /comment/:id ──────────────────────────────────────────────────
export const deleteComment = async (req, res) => {
  try {
    const commentId = req.params.id;
    const userId = req.id;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ success: false, message: "Comment not found." });
    }

    if (comment.author.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized to delete this comment." });
    }

    // Check if it has replies
    const childRepliesCount = await Comment.countDocuments({ parentComment: commentId });

    if (childRepliesCount > 0) {
      // Soft delete so replies tree is preserved
      comment.status = "deleted";
      comment.content = "This comment was deleted.";
      await comment.save();
    } else {
      // Hard delete
      await Comment.findByIdAndDelete(commentId);
      // If was a reply, decrement parent's replyCount
      if (comment.parentComment) {
        await Comment.findByIdAndUpdate(comment.parentComment, { $inc: { replyCount: -1 } });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Comment deleted successfully.",
    });
  } catch (error) {
    console.error("Error in deleteComment:", error);
    return res.status(500).json({ success: false, message: "Failed to delete comment." });
  }
};
