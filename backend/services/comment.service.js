import mongoose from "mongoose";
import { Comment } from "../models/comment.model.js";
import { Post } from "../models/post.model.js";
import { Poll } from "../models/poll.model.js";
import { User } from "../models/user.model.js";
import { io } from "../socket/socket.js";
import { queueNotification } from "../queues/queue.js";
import redis, { invalidateCached } from "../config/redis.js";

// Helper to safely invalidate all comment-related Redis caches
export const invalidateCommentCaches = async (targetId, targetType = "post") => {
  try {
    if (!redis) return;
    if (targetType === "post") {
      await invalidateCached(`post:comments:${targetId}`);
      await invalidateCached(`post:${targetId}`);
    } else if (targetType === "poll") {
      await invalidateCached(`poll:comments:${targetId}`);
      await invalidateCached(`poll:${targetId}`);
    }
  } catch (err) {
    console.warn("⚠️ Comment cache invalidation warning:", err.message);
  }
};

// Format comment for client output (strip sensitive/internal data, format reactions & counts)
export const formatCommentForClient = (comment, currentUserId = null) => {
  const currentUserIdStr = currentUserId ? currentUserId.toString() : null;
  const isDeleted = comment.status === "deleted";

  // Calculate like counts and whether current user liked
  const likesArray = Array.isArray(comment.likes) ? comment.likes : [];
  const isLiked = currentUserIdStr ? likesArray.some((id) => id.toString() === currentUserIdStr) : false;
  const likeCount = likesArray.length;

  // Process multi-reactions if available
  const reactionCounts = { like: likeCount, love: 0, insightful: 0, laugh: 0, sad: 0 };
  let userReactions = [];

  if (comment.reactions) {
    const rawReactions = comment.reactions instanceof Map ? Object.fromEntries(comment.reactions) : comment.reactions;
    for (const [rType, uList] of Object.entries(rawReactions)) {
      if (Array.isArray(uList)) {
        reactionCounts[rType] = uList.length;
        if (currentUserIdStr && uList.some((id) => id.toString() === currentUserIdStr)) {
          userReactions.push(rType);
        }
      }
    }
  }

  return {
    _id: comment._id,
    content: isDeleted ? "This comment was deleted." : comment.content,
    post: comment.post,
    poll: comment.poll,
    author: comment.author,
    parentComment: comment.parentComment,
    replyToUser: comment.replyToUser,
    depth: comment.depth || 0,
    replyCount: comment.replyCount || 0,
    isEdited: !!comment.isEdited,
    editedAt: comment.editedAt,
    isPinned: !!comment.isPinned,
    pinnedAt: comment.pinnedAt,
    pinnedBy: comment.pinnedBy,
    status: comment.status || "active",
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    isLiked,
    likeCount,
    reactionCounts,
    userReactions,
    mentions: comment.mentions || [],
  };
};

/**
 * AUTHORITATIVE COMMENT SERVICE
 */
export const CommentService = {
  /**
   * 1. CREATE COMMENT OR REPLY (with Idempotency & Threading)
   */
  async createComment({
    authorId,
    content,
    postId = null,
    pollId = null,
    parentCommentId = null,
    replyToUserId = null,
    idempotencyKey = null,
  }) {
    const commentText = (content || "").trim();
    if (!commentText) {
      const err = new Error("Comment content cannot be empty.");
      err.statusCode = 400;
      throw err;
    }

    if (commentText.length > 3000) {
      const err = new Error("Comment content exceeds maximum limit of 3000 characters.");
      err.statusCode = 400;
      throw err;
    }

    if (!postId && !pollId) {
      const err = new Error("Must provide a postId or pollId.");
      err.statusCode = 400;
      throw err;
    }

    // ── Idempotency Check: if key provided, verify if already created ────
    if (idempotencyKey) {
      const existing = await Comment.findOne({ idempotencyKey, author: authorId })
        .populate("author", "username profileImage name isverified")
        .populate("replyToUser", "username name");
      if (existing) {
        const existingTargetId = existing.post ? existing.post.toString() : existing.poll?.toString();
        const incomingTargetId = (postId || pollId).toString();
        if (existingTargetId !== incomingTargetId || existing.content !== commentText) {
          const conflictErr = new Error("Idempotency conflict: key already used with different payload.");
          conflictErr.statusCode = 409;
          throw conflictErr;
        }
        return { comment: formatCommentForClient(existing, authorId), isDuplicate: true };
      }
    }

    // ── Target Post or Poll validation ──────────────────────────────────
    let targetDoc = null;
    let targetType = "post";
    let targetId = postId || pollId;

    if (postId) {
      targetDoc = await Post.findById(postId);
      targetType = "post";
    } else {
      targetDoc = await Poll.findById(pollId);
      targetType = "poll";
    }

    if (!targetDoc || targetDoc.status === "deleted") {
      const err = new Error(`${targetType === "post" ? "Post" : "Poll"} not found or has been deleted.`);
      err.statusCode = 404;
      throw err;
    }

    // ── Thread / Parent Validation ──────────────────────────────────────
    let parentComment = null;
    let computedDepth = 0;

    if (parentCommentId) {
      parentComment = await Comment.findById(parentCommentId);
      if (!parentComment || parentComment.status === "deleted") {
        const err = new Error("Parent comment not found or has been deleted.");
        err.statusCode = 404;
        throw err;
      }

      // Check depth limit (cap at 5 to maintain clean discussion trees)
      computedDepth = Math.min((parentComment.depth || 0) + 1, 5);

      if (!replyToUserId && parentComment.author) {
        replyToUserId = parentComment.author;
      }
    }

    // ── Extract @mentions ───────────────────────────────────────────────
    const mentionMatches = commentText.match(/@([a-zA-Z0-9_]+)/g) || [];
    let mentionUserIds = [];
    if (mentionMatches.length > 0) {
      const usernames = mentionMatches.map((m) => m.slice(1).toLowerCase());
      const mentionedUsers = await User.find({ username: { $in: usernames } }).select("_id username");
      mentionUserIds = mentionedUsers.map((u) => u._id);
    }

    // ── DB Persistence (atomic with concurrency duplicate key handling) ──
    let comment;
    try {
      comment = await Comment.create({
        content: commentText,
        post: postId || null,
        poll: pollId || null,
        author: authorId,
        parentComment: parentCommentId || null,
        replyToUser: replyToUserId || null,
        depth: computedDepth,
        mentions: mentionUserIds,
        idempotencyKey: idempotencyKey || null,
      });
    } catch (createErr) {
      if ((createErr.code === 11000 || createErr.name === "MongoServerError") && idempotencyKey) {
        const existing = await Comment.findOne({ idempotencyKey, author: authorId })
          .populate("author", "username profileImage name isverified")
          .populate("replyToUser", "username name");
        if (existing) {
          const existingTargetId = existing.post ? existing.post.toString() : existing.poll?.toString();
          const incomingTargetId = (postId || pollId).toString();
          if (existingTargetId !== incomingTargetId || existing.content !== commentText) {
            const conflictErr = new Error("Idempotency conflict: key already used with different payload.");
            conflictErr.statusCode = 409;
            throw conflictErr;
          }
          return { comment: formatCommentForClient(existing, authorId), isDuplicate: true };
        }
      }
      throw createErr;
    }

    // Update target document top-level comment array
    if (!parentCommentId) {
      if (!targetDoc.comments) targetDoc.comments = [];
      targetDoc.comments.push(comment._id);
      await targetDoc.save();
    } else {
      // Increment parent's replyCount atomically
      await Comment.findByIdAndUpdate(parentCommentId, { $inc: { replyCount: 1 } });
    }

    // Populate relations for response & socket broadcast
    await comment.populate([
      { path: "author", select: "username profileImage name isverified" },
      { path: "replyToUser", select: "username name" },
    ]);

    // Invalidate Redis caches
    await invalidateCommentCaches(targetId, targetType);

    const formattedComment = formatCommentForClient(comment, authorId);
    const roomKey = `${targetType}:${targetId}`;

    // ── Real-Time Socket Broadcast (ONLY after DB write succeeded) ───────
    if (io) {
      const eventPayload = {
        targetId: targetId.toString(),
        targetType,
        comment: formattedComment,
        isReply: !!parentCommentId,
        parentCommentId: parentCommentId ? parentCommentId.toString() : null,
      };

      // 1. Standard event
      io.to(roomKey).emit("comment:new", eventPayload);
      // 2. Backward compatibility event for Flutter mobile app
      io.to(roomKey).emit("new_comment", {
        comment,
        isReply: !!parentCommentId,
        parentCommentId,
      });
      // 3. Backward compatibility event for legacy web listeners
      if (postId) {
        io.to(roomKey).emit("post:comment_update", {
          postId: targetId.toString(),
          comment,
          commentCount: targetDoc.comments?.length || 0,
        });
      }
    }

    // ── Notifications (queued asynchronously) ───────────────────────────
    try {
      const commenter = comment.author;
      const commenterName = commenter?.name || commenter?.username || "User";
      const snippet = commentText.slice(0, 30);

      // Notification to parent comment author (if reply and not self)
      if (parentComment && parentComment.author?.toString() !== authorId.toString()) {
        await queueNotification({
          type: "comment",
          userId: authorId,
          userDetails: {
            username: commenter?.username || "User",
            profileImage: commenter?.profileImage || null,
            name: commenterName,
          },
          postId: postId || null,
          pollId: pollId || null,
          message: `${commenterName} replied to your comment: "${snippet}..."`,
          targetOwnerId: parentComment.author.toString(),
        });
      }

      // Notification to post/poll owner (if top-level and not self)
      const targetOwnerId = targetDoc.author?.toString();
      if (!parentComment && targetOwnerId && targetOwnerId !== authorId.toString()) {
        await queueNotification({
          type: "comment",
          userId: authorId,
          userDetails: {
            username: commenter?.username || "User",
            profileImage: commenter?.profileImage || null,
            name: commenterName,
          },
          postId: postId || null,
          pollId: pollId || null,
          message: `${commenterName} commented on your ${targetType}: "${snippet}..."`,
          targetOwnerId,
        });
      }

      // Notifications to @mentioned users
      for (const mId of mentionUserIds) {
        if (mId.toString() !== authorId.toString() && mId.toString() !== targetOwnerId) {
          await queueNotification({
            type: "mention",
            userId: authorId,
            userDetails: {
              username: commenter?.username || "User",
              profileImage: commenter?.profileImage || null,
              name: commenterName,
            },
            postId: postId || null,
            pollId: pollId || null,
            message: `${commenterName} mentioned you in a comment: "${snippet}..."`,
            targetOwnerId: mId.toString(),
          });
        }
      }
    } catch (notifErr) {
      console.warn("⚠️ Notification dispatch warning in createComment:", notifErr.message);
    }

    return { comment: formattedComment, isDuplicate: false };
  },

  /**
   * 2. RETRIEVE TOP-LEVEL COMMENTS (Cursor & Offset Pagination + Pinned First)
   */
  async getComments({
    postId = null,
    pollId = null,
    sort = "newest", // 'newest' | 'oldest' | 'top'
    page = 1,
    limit = 20,
    cursor = null, // timestamp cursor for cursor pagination
    currentUserId = null,
  }) {
    if (!postId && !pollId) {
      const err = new Error("Must specify postId or pollId.");
      err.statusCode = 400;
      throw err;
    }

    const limitNum = Math.min(Math.max(parseInt(limit) || 20, 1), 50);
    const filter = {
      parentComment: null,
      status: { $in: ["active", "deleted"] },
      ...(postId ? { post: postId } : { poll: pollId }),
    };

    // If cursor pagination is requested
    if (cursor) {
      const cursorDate = new Date(cursor);
      if (!isNaN(cursorDate.getTime())) {
        if (sort === "oldest") {
          filter.createdAt = { $gt: cursorDate };
        } else {
          filter.createdAt = { $lt: cursorDate };
        }
      }
    }

    // Sort definition: Pinned comments ALWAYS come first
    let sortOption = { isPinned: -1, createdAt: -1 };
    if (sort === "top") {
      sortOption = { isPinned: -1, "likes.length": -1, createdAt: -1 };
    } else if (sort === "oldest") {
      sortOption = { isPinned: -1, createdAt: 1 };
    }

    const pageNum = Math.max(parseInt(page) || 1, 1);
    const skip = cursor ? 0 : (pageNum - 1) * limitNum;

    const [comments, totalItems] = await Promise.all([
      Comment.find(filter)
        .sort(sortOption)
        .skip(skip)
        .limit(limitNum)
        .populate("author", "username profileImage isverified name")
        .populate("replyToUser", "username name")
        .lean(),
      Comment.countDocuments({
        parentComment: null,
        status: { $in: ["active", "deleted"] },
        ...(postId ? { post: postId } : { poll: pollId }),
      }),
    ]);

    const formattedComments = comments.map((c) => formatCommentForClient(c, currentUserId));
    const nextCursor = comments.length === limitNum ? comments[comments.length - 1].createdAt : null;

    return {
      comments: formattedComments,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalItems,
        totalPages: Math.ceil(totalItems / limitNum),
        nextCursor,
        hasMore: !!nextCursor,
      },
    };
  },

  /**
   * 3. RETRIEVE REPLIES FOR A PARENT COMMENT
   */
  async getCommentReplies({ parentId, page = 1, limit = 20, cursor = null, currentUserId = null }) {
    if (!parentId || !mongoose.Types.ObjectId.isValid(parentId)) {
      const err = new Error("Valid parentId required.");
      err.statusCode = 400;
      throw err;
    }

    const limitNum = Math.min(Math.max(parseInt(limit) || 20, 1), 50);
    const filter = {
      parentComment: parentId,
      status: { $in: ["active", "deleted"] },
    };

    if (cursor) {
      const cursorDate = new Date(cursor);
      if (!isNaN(cursorDate.getTime())) {
        filter.createdAt = { $gt: cursorDate };
      }
    }

    const pageNum = Math.max(parseInt(page) || 1, 1);
    const skip = cursor ? 0 : (pageNum - 1) * limitNum;

    const [replies, totalItems] = await Promise.all([
      Comment.find(filter)
        .sort({ createdAt: 1 }) // Chronological order for conversational replies
        .skip(skip)
        .limit(limitNum)
        .populate("author", "username profileImage isverified name")
        .populate("replyToUser", "username name")
        .lean(),
      Comment.countDocuments(filter),
    ]);

    const formattedReplies = replies.map((r) => formatCommentForClient(r, currentUserId));
    const nextCursor = replies.length === limitNum ? replies[replies.length - 1].createdAt : null;

    return {
      replies: formattedReplies,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalItems,
        totalPages: Math.ceil(totalItems / limitNum),
        nextCursor,
        hasMore: !!nextCursor,
      },
    };
  },

  /**
   * 4. EDIT COMMENT
   */
  async editComment({ commentId, userId, content }) {
    const commentText = (content || "").trim();
    if (!commentText) {
      const err = new Error("Comment content cannot be empty.");
      err.statusCode = 400;
      throw err;
    }

    if (commentText.length > 3000) {
      const err = new Error("Comment content exceeds maximum limit of 3000 characters.");
      err.statusCode = 400;
      throw err;
    }

    const comment = await Comment.findById(commentId);
    if (!comment || comment.status === "deleted") {
      const err = new Error("Comment not found or has been deleted.");
      err.statusCode = 404;
      throw err;
    }

    if (comment.author.toString() !== userId.toString()) {
      const err = new Error("Unauthorized: Only the comment author can edit.");
      err.statusCode = 403;
      throw err;
    }

    comment.content = commentText;
    comment.isEdited = true;
    comment.editedAt = new Date();
    await comment.save();

    await comment.populate([
      { path: "author", select: "username profileImage name isverified" },
      { path: "replyToUser", select: "username name" },
    ]);

    const targetType = comment.post ? "post" : "poll";
    const targetId = comment.post ? comment.post.toString() : comment.poll.toString();
    await invalidateCommentCaches(targetId, targetType);

    const formatted = formatCommentForClient(comment, userId);

    // Broadcast edit event
    if (io) {
      const roomKey = `${targetType}:${targetId}`;
      io.to(roomKey).emit("comment:edit", {
        targetId,
        targetType,
        commentId: comment._id.toString(),
        content: comment.content,
        isEdited: true,
        editedAt: comment.editedAt,
        parentCommentId: comment.parentComment ? comment.parentComment.toString() : null,
      });
    }

    return formatted;
  },

  /**
   * 5. DELETE COMMENT (Preserves Thread Integrity with Soft-Delete if replies exist)
   */
  async deleteComment({ commentId, userId, userRole = "user" }) {
    const comment = await Comment.findById(commentId);
    if (!comment || comment.status === "deleted") {
      const err = new Error("Comment not found or already deleted.");
      err.statusCode = 404;
      throw err;
    }

    // Check if user is comment author, or post/poll owner, or administrator
    let isAuthorized = comment.author.toString() === userId.toString() || userRole === "admin";

    const targetType = comment.post ? "post" : "poll";
    const targetId = comment.post ? comment.post.toString() : comment.poll.toString();

    if (!isAuthorized) {
      // Check if user is owner of the post or poll
      let parentDoc = null;
      if (comment.post) parentDoc = await Post.findById(comment.post).select("author");
      else if (comment.poll) parentDoc = await Poll.findById(comment.poll).select("author");

      if (parentDoc && parentDoc.author?.toString() === userId.toString()) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      const err = new Error("Unauthorized: You do not have permission to delete this comment.");
      err.statusCode = 403;
      throw err;
    }

    // Check if comment has replies
    const childRepliesCount = await Comment.countDocuments({
      parentComment: commentId,
      status: { $ne: "deleted" },
    });

    let deleteStatus = "removed";

    if (childRepliesCount > 0) {
      // Soft-delete: retain tombstone so thread replies don't break
      comment.status = "deleted";
      comment.content = "This comment was deleted.";
      await comment.save();
      deleteStatus = "deleted";
    } else {
      // Hard delete
      await Comment.findByIdAndDelete(commentId);
      // Decrement parent replyCount if reply
      if (comment.parentComment) {
        await Comment.findByIdAndUpdate(comment.parentComment, { $inc: { replyCount: -1 } });
      }
      // Pull from post/poll comments array if top-level
      if (!comment.parentComment) {
        if (comment.post) {
          await Post.findByIdAndUpdate(comment.post, { $pull: { comments: commentId } });
        } else if (comment.poll) {
          await Poll.findByIdAndUpdate(comment.poll, { $pull: { comments: commentId } });
        }
      }
    }

    await invalidateCommentCaches(targetId, targetType);

    // Broadcast delete event
    if (io) {
      const roomKey = `${targetType}:${targetId}`;
      io.to(roomKey).emit("comment:delete", {
        targetId,
        targetType,
        commentId: comment._id.toString(),
        parentCommentId: comment.parentComment ? comment.parentComment.toString() : null,
        status: deleteStatus,
      });
    }

    return { success: true, status: deleteStatus };
  },

  /**
   * 6. TOGGLE REACTION OR LIKE (Supports Multi-Reactions with Like synchronization)
   */
  async toggleReaction({ commentId, userId, reactionType = "like" }) {
    const validReactions = ["like", "love", "insightful", "laugh", "sad"];
    const reactionKey = validReactions.includes(reactionType) ? reactionType : "like";

    const comment = await Comment.findById(commentId);
    if (!comment || comment.status === "deleted") {
      const err = new Error("Comment not found.");
      err.statusCode = 404;
      throw err;
    }

    // Initialize reactions Map if absent
    if (!comment.reactions) {
      comment.reactions = new Map();
    }

    const currentReactions = comment.reactions.get(reactionKey) || [];
    const userIndex = currentReactions.findIndex((id) => id.toString() === userId.toString());
    const isAdding = userIndex === -1;

    if (isAdding) {
      currentReactions.push(userId);
    } else {
      currentReactions.splice(userIndex, 1);
    }
    comment.reactions.set(reactionKey, currentReactions);

    // If reaction is "like", sync with backward-compatible likes array
    if (reactionKey === "like") {
      const likeIdx = (comment.likes || []).findIndex((id) => id.toString() === userId.toString());
      if (isAdding && likeIdx === -1) {
        comment.likes.push(userId);
      } else if (!isAdding && likeIdx !== -1) {
        comment.likes.splice(likeIdx, 1);
      }
    }

    await comment.save();

    const targetType = comment.post ? "post" : "poll";
    const targetId = comment.post ? comment.post.toString() : comment.poll.toString();
    await invalidateCommentCaches(targetId, targetType);

    // Prepare updated reaction counts
    const reactionCounts = {};
    for (const type of validReactions) {
      const list = comment.reactions.get(type) || [];
      reactionCounts[type] = list.length;
    }
    const likeCount = comment.likes ? comment.likes.length : 0;

    // Real-Time Reaction Broadcast
    if (io) {
      const roomKey = `${targetType}:${targetId}`;
      io.to(roomKey).emit("comment:reaction", {
        targetId,
        targetType,
        commentId: comment._id.toString(),
        userId: userId.toString(),
        reactionType: reactionKey,
        isAdded: isAdding,
        likeCount,
        reactionCounts,
      });
    }

    return {
      success: true,
      reactionType: reactionKey,
      isAdded: isAdding,
      likeCount,
      reactionCounts,
      isLiked: isAdding && reactionKey === "like",
    };
  },

  /**
   * 7. TOGGLE PIN COMMENT (Author/Moderator Only)
   */
  async togglePinComment({ commentId, userId }) {
    const comment = await Comment.findById(commentId);
    if (!comment || comment.status === "deleted") {
      const err = new Error("Comment not found.");
      err.statusCode = 404;
      throw err;
    }

    if (comment.parentComment) {
      const err = new Error("Only top-level comments can be pinned.");
      err.statusCode = 400;
      throw err;
    }

    // Verify user owns the target post or poll
    let targetDoc = null;
    const targetType = comment.post ? "post" : "poll";
    const targetId = comment.post ? comment.post.toString() : comment.poll.toString();

    if (comment.post) {
      targetDoc = await Post.findById(comment.post).select("author");
    } else {
      targetDoc = await Poll.findById(comment.poll).select("author");
    }

    if (!targetDoc || targetDoc.author?.toString() !== userId.toString()) {
      const err = new Error("Unauthorized: Only the discussion owner can pin comments.");
      err.statusCode = 403;
      throw err;
    }

    const nextPinState = !comment.isPinned;

    if (nextPinState) {
      // Unpin any previously pinned comment in this discussion
      await Comment.updateMany(
        { ...(comment.post ? { post: comment.post } : { poll: comment.poll }), isPinned: true },
        { isPinned: false, pinnedAt: null, pinnedBy: null }
      );
      comment.isPinned = true;
      comment.pinnedAt = new Date();
      comment.pinnedBy = userId;
    } else {
      comment.isPinned = false;
      comment.pinnedAt = null;
      comment.pinnedBy = null;
    }

    await comment.save();
    await invalidateCommentCaches(targetId, targetType);

    // Real-Time Pin Broadcast
    if (io) {
      const roomKey = `${targetType}:${targetId}`;
      io.to(roomKey).emit("comment:pin", {
        targetId,
        targetType,
        commentId: comment._id.toString(),
        isPinned: comment.isPinned,
        pinnedAt: comment.pinnedAt,
      });
    }

    return {
      success: true,
      commentId: comment._id.toString(),
      isPinned: comment.isPinned,
      pinnedAt: comment.pinnedAt,
    };
  },
};
