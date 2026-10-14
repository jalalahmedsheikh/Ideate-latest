import { CommentService } from "../services/comment.service.js";

// ─── POST /comment/add ───────────────────────────────────────────────────
export const createComment = async (req, res) => {
  try {
    const authorId = req.id;
    const { content, text, postId, pollId, parentCommentId, replyToUserId, idempotencyKey } = req.body;

    const result = await CommentService.createComment({
      authorId,
      content: content || text,
      postId: postId || null,
      pollId: pollId || null,
      parentCommentId: parentCommentId || null,
      replyToUserId: replyToUserId || null,
      idempotencyKey: idempotencyKey || null,
    });

    return res.status(201).json({
      success: true,
      message: parentCommentId ? "Reply added." : "Comment added.",
      comment: result.comment,
      isDuplicate: result.isDuplicate,
    });
  } catch (error) {
    console.error("Error in createComment:", error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message || "Failed to post comment." });
  }
};

// ─── GET /comment/list ────────────────────────────────────────────────────
export const getComments = async (req, res) => {
  try {
    const { postId, pollId, sort = "newest", page = 1, limit = 20, cursor = null } = req.query;
    const currentUserId = req.id || null;

    const result = await CommentService.getComments({
      postId,
      pollId,
      sort,
      page,
      limit,
      cursor,
      currentUserId,
    });

    return res.status(200).json({
      success: true,
      comments: result.comments,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Error in getComments:", error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message || "Failed to retrieve comments." });
  }
};

// ─── GET /comment/:id/replies ─────────────────────────────────────────────
export const getCommentReplies = async (req, res) => {
  try {
    const parentId = req.params.id;
    const { page = 1, limit = 20, cursor = null } = req.query;
    const currentUserId = req.id || null;

    const result = await CommentService.getCommentReplies({
      parentId,
      page,
      limit,
      cursor,
      currentUserId,
    });

    return res.status(200).json({
      success: true,
      replies: result.replies,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Error in getCommentReplies:", error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message || "Failed to retrieve replies." });
  }
};

// ─── POST /comment/:id/toggleLike or /comment/:id/like ─────────────────────
export const toggleCommentLike = async (req, res) => {
  try {
    const commentId = req.params.id;
    const userId = req.id;
    const reactionType = req.body?.reactionType || "like";

    const result = await CommentService.toggleReaction({
      commentId,
      userId,
      reactionType,
    });

    return res.status(200).json({
      success: true,
      isLiked: result.isLiked,
      likeCount: result.likeCount,
      reactionCounts: result.reactionCounts,
      reactionType: result.reactionType,
      isAdded: result.isAdded,
      message: result.isAdded ? "Reaction added." : "Reaction removed.",
    });
  } catch (error) {
    console.error("Error in toggleCommentLike:", error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message || "Failed to toggle reaction." });
  }
};

// ─── PUT /comment/:id/edit ────────────────────────────────────────────────
export const editComment = async (req, res) => {
  try {
    const commentId = req.params.id;
    const userId = req.id;
    const { content } = req.body;

    const updatedComment = await CommentService.editComment({
      commentId,
      userId,
      content,
    });

    return res.status(200).json({
      success: true,
      message: "Comment updated.",
      comment: updatedComment,
    });
  } catch (error) {
    console.error("Error in editComment:", error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message || "Failed to edit comment." });
  }
};

// ─── DELETE /comment/:id ──────────────────────────────────────────────────
export const deleteComment = async (req, res) => {
  try {
    const commentId = req.params.id;
    const userId = req.id;

    const result = await CommentService.deleteComment({
      commentId,
      userId,
    });

    return res.status(200).json({
      success: true,
      message: "Comment deleted successfully.",
      status: result.status,
    });
  } catch (error) {
    console.error("Error in deleteComment:", error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message || "Failed to delete comment." });
  }
};

// ─── POST /comment/:id/pin ────────────────────────────────────────────────
export const togglePinComment = async (req, res) => {
  try {
    const commentId = req.params.id;
    const userId = req.id;

    const result = await CommentService.togglePinComment({
      commentId,
      userId,
    });

    return res.status(200).json({
      success: true,
      message: result.isPinned ? "Comment pinned to top." : "Comment unpinned.",
      ...result,
    });
  } catch (error) {
    console.error("Error in togglePinComment:", error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message || "Failed to toggle pin." });
  }
};
