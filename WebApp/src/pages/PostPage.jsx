import React, { useEffect, useState, useRef, useContext, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  FaUserCircle,
  FaRegHeart,
  FaHeart,
  FaEllipsisV,
  FaReply,
  FaThumbtack,
  FaEdit,
  FaTrash,
  FaChevronDown,
  FaChevronUp,
} from 'react-icons/fa';
import verifiedBadge from '../assets/images/verified.png';
import LoadingSpinner from '../components/Loading';
import { UserContext } from '../contexts/UserContext';
import { useSocket } from '../contexts/SocketContext';
import axiosInstance from './axiosInstance';

const theme = {
  primary: '#0d6efd',
  secondary: '#fd1d1d',
  cardBg: '#18191a',
  border: '#2f3336',
  textSecondary: '#8e8e8e',
};

const PostPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { socket } = useSocket();
  const { user } = useContext(UserContext);
  const currentUserId = user?.user?._id || user?._id || null;

  // Post & comments state
  const [post, setPost] = useState(null);
  const [likedPosts, setLikedPosts] = useState({});
  const [comments, setComments] = useState([]);
  const [repliesMap, setRepliesMap] = useState({});
  const [expandedReplies, setExpandedReplies] = useState(new Set());
  const [loadingReplies, setLoadingReplies] = useState(new Set());

  // Input & reply state
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState(null); // comment object
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editText, setEditText] = useState('');

  // Sorting & pagination state
  const [sort, setSort] = useState('newest'); // 'newest' | 'top' | 'oldest'
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [newCommentsCount, setNewCommentsCount] = useState(0);

  // Typing indicator state
  const [typers, setTypers] = useState([]);
  const typingTimerRef = useRef(null);

  // UI helpers
  const [activeDropdown, setActiveDropdown] = useState(null);
  const menuRef = useRef(null);
  const commentsTopRef = useRef(null);

  // ── 1. Close dropdown on outside click ───────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── 2. Fetch Post Details ───────────────────────────────────────────────
  const fetchPost = useCallback(async () => {
    try {
      const res = await axiosInstance.get(`/post/${id}`);
      if (res.data?.post) {
        setPost(res.data.post);
        if (res.data.post.likes?.includes(currentUserId)) {
          setLikedPosts((prev) => ({ ...prev, [id]: true }));
        }
      }
    } catch (error) {
      console.error('Error fetching post:', error);
    }
  }, [id, currentUserId]);

  // ── 3. Fetch Top-Level Comments ──────────────────────────────────────────
  const fetchComments = useCallback(
    async (pageNum = 1, append = false, currentSort = sort) => {
      try {
        if (pageNum > 1) setIsLoadingMore(true);
        const res = await axiosInstance.get(
          `/comment/list?postId=${id}&sort=${currentSort}&page=${pageNum}&limit=20`
        );
        if (res.data?.success) {
          const fetched = res.data.comments || [];
          setComments((prev) => (append ? [...prev, ...fetched] : fetched));
          setHasMore(res.data.pagination?.hasMore || res.data.pagination?.page < res.data.pagination?.totalPages);
          setPage(pageNum);
        }
      } catch (error) {
        console.error('Error fetching comments:', error);
      } finally {
        setIsLoadingMore(false);
      }
    },
    [id, sort]
  );

  useEffect(() => {
    fetchPost();
    fetchComments(1, false, sort);
  }, [fetchPost, fetchComments, sort]);

  // ── 4. Fetch Replies for a Comment ──────────────────────────────────────
  const toggleReplies = async (commentId) => {
    if (expandedReplies.has(commentId)) {
      setExpandedReplies((prev) => {
        const next = new Set(prev);
        next.delete(commentId);
        return next;
      });
      return;
    }

    if (!repliesMap[commentId]) {
      setLoadingReplies((prev) => new Set(prev).add(commentId));
      try {
        const res = await axiosInstance.get(`/comment/${commentId}/replies?limit=50`);
        if (res.data?.success) {
          setRepliesMap((prev) => ({ ...prev, [commentId]: res.data.replies || [] }));
        }
      } catch (err) {
        console.error('Error fetching replies:', err);
      } finally {
        setLoadingReplies((prev) => {
          const next = new Set(prev);
          next.delete(commentId);
          return next;
        });
      }
    }

    setExpandedReplies((prev) => new Set(prev).add(commentId));
  };

  // ── 5. Real-Time Socket Connection & Event Handlers ──────────────────────
  useEffect(() => {
    if (!socket || !id) return;

    // Join room safely
    socket.emit('join_discussion', { targetId: id, targetType: 'post' });
    socket.emit('join_post_room', id); // backward compatibility

    // ── Incoming New Comment / Reply ─────────────────────────
    const handleNewComment = (payload) => {
      const { comment, isReply, parentCommentId } = payload;
      if (!comment) return;

      if (isReply && parentCommentId) {
        // Append to replies map if loaded
        setRepliesMap((prev) => {
          const existing = prev[parentCommentId] || [];
          if (existing.some((r) => r._id === comment._id)) return prev;
          return { ...prev, [parentCommentId]: [...existing, comment] };
        });
        // Increment replyCount on parent comment in state
        setComments((prev) =>
          prev.map((c) =>
            c._id === parentCommentId ? { ...c, replyCount: (c.replyCount || 0) + 1 } : c
          )
        );
        // Auto-expand thread
        setExpandedReplies((prev) => new Set(prev).add(parentCommentId));
      } else {
        // Top-level comment: check if already in list (avoid duplicate from HTTP response)
        setComments((prev) => {
          if (prev.some((c) => c._id === comment._id)) return prev;
          return [comment, ...prev];
        });
      }
    };

    // ── Comment Edited ───────────────────────────────────────
    const handleEditComment = (payload) => {
      const { commentId, content, isEdited, editedAt } = payload;
      setComments((prev) =>
        prev.map((c) => (c._id === commentId ? { ...c, content, isEdited, editedAt } : c))
      );
      setRepliesMap((prev) => {
        const updated = { ...prev };
        for (const pId in updated) {
          updated[pId] = updated[pId].map((r) =>
            r._id === commentId ? { ...r, content, isEdited, editedAt } : r
          );
        }
        return updated;
      });
    };

    // ── Comment Deleted ──────────────────────────────────────
    const handleDeleteComment = (payload) => {
      const { commentId, parentCommentId, status } = payload;
      if (status === 'deleted') {
        // Soft delete: display tombstone
        const updateTombstone = (item) =>
          item._id === commentId
            ? { ...item, status: 'deleted', content: 'This comment was deleted.' }
            : item;
        setComments((prev) => prev.map(updateTombstone));
        setRepliesMap((prev) => {
          const updated = { ...prev };
          if (parentCommentId && updated[parentCommentId]) {
            updated[parentCommentId] = updated[parentCommentId].map(updateTombstone);
          }
          return updated;
        });
      } else {
        // Hard remove
        setComments((prev) => prev.filter((c) => c._id !== commentId));
        if (parentCommentId) {
          setRepliesMap((prev) => ({
            ...prev,
            [parentCommentId]: (prev[parentCommentId] || []).filter((r) => r._id !== commentId),
          }));
          setComments((prev) =>
            prev.map((c) =>
              c._id === parentCommentId ? { ...c, replyCount: Math.max((c.replyCount || 1) - 1, 0) } : c
            )
          );
        }
      }
    };

    // ── Comment Reaction / Like ──────────────────────────────
    const handleReaction = (payload) => {
      const { commentId, reactionType, likeCount, reactionCounts } = payload;
      const updateReaction = (c) => {
        if (c._id !== commentId) return c;
        return {
          ...c,
          likeCount: likeCount !== undefined ? likeCount : c.likeCount,
          reactionCounts: reactionCounts || c.reactionCounts,
        };
      };
      setComments((prev) => prev.map(updateReaction));
      setRepliesMap((prev) => {
        const updated = { ...prev };
        for (const pId in updated) {
          updated[pId] = updated[pId].map(updateReaction);
        }
        return updated;
      });
    };

    // ── Comment Pin / Unpin ──────────────────────────────────
    const handlePin = (payload) => {
      const { commentId, isPinned, pinnedAt } = payload;
      setComments((prev) => {
        const updated = prev.map((c) => {
          if (c._id === commentId) {
            return { ...c, isPinned, pinnedAt };
          }
          // If a new comment was pinned, unpin others
          return isPinned ? { ...c, isPinned: false, pinnedAt: null } : c;
        });
        // Re-sort so pinned comments stay on top
        return [...updated].sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
      });
    };

    // ── Typing Indicator ─────────────────────────────────────
    const handleTyping = (payload) => {
      if (payload.targetId === id) {
        // Exclude current user from typing indicators
        const activeTypers = (payload.typers || []).filter((t) => t.userId !== currentUserId);
        setTypers(activeTypers);
      }
    };

    // Attach listeners
    socket.on('comment:new', handleNewComment);
    socket.on('new_comment', handleNewComment);
    socket.on('comment:edit', handleEditComment);
    socket.on('comment:delete', handleDeleteComment);
    socket.on('comment:reaction', handleReaction);
    socket.on('comment:pin', handlePin);
    socket.on('comment:typing', handleTyping);

    // Cleanup on unmount
    return () => {
      socket.emit('leave_discussion', { targetId: id, targetType: 'post' });
      socket.emit('leave_post_room', id);
      socket.off('comment:new', handleNewComment);
      socket.off('new_comment', handleNewComment);
      socket.off('comment:edit', handleEditComment);
      socket.off('comment:delete', handleDeleteComment);
      socket.off('comment:reaction', handleReaction);
      socket.off('comment:pin', handlePin);
      socket.off('comment:typing', handleTyping);
    };
  }, [socket, id, currentUserId]);

  // ── 6. Typing Event Emission with Debounce ───────────────────────────────
  const handleCommentChange = (e) => {
    const text = e.target.value;
    setCommentText(text);

    if (socket && id) {
      socket.emit('comment:typing_start', {
        targetId: id,
        targetType: 'post',
        parentCommentId: replyingTo ? replyingTo._id : null,
      });

      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        socket.emit('comment:typing_stop', {
          targetId: id,
          targetType: 'post',
          parentCommentId: replyingTo ? replyingTo._id : null,
        });
      }, 3000);
    }
  };

  // ── 7. Submit Comment or Reply ───────────────────────────────────────────
  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    const text = commentText.trim();
    if (!text) return;

    if (socket && id) {
      socket.emit('comment:typing_stop', {
        targetId: id,
        targetType: 'post',
        parentCommentId: replyingTo ? replyingTo._id : null,
      });
    }

    const idempotencyKey = `web_${currentUserId || 'guest'}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    try {
      const payload = {
        content: text,
        postId: id,
        parentCommentId: replyingTo ? replyingTo._id : null,
        idempotencyKey,
      };

      const res = await axiosInstance.post('/comment/add', payload);

      if (res.data?.success && res.data?.comment) {
        const newC = res.data.comment;

        if (replyingTo) {
          const parentId = replyingTo._id;
          setRepliesMap((prev) => {
            const list = prev[parentId] || [];
            if (list.some((r) => r._id === newC._id)) return prev;
            return { ...prev, [parentId]: [...list, newC] };
          });
          setComments((prev) =>
            prev.map((c) =>
              c._id === parentId ? { ...c, replyCount: (c.replyCount || 0) + 1 } : c
            )
          );
          setExpandedReplies((prev) => new Set(prev).add(parentId));
          setReplyingTo(null);
        } else {
          setComments((prev) => {
            if (prev.some((c) => c._id === newC._id)) return prev;
            return [newC, ...prev];
          });
        }
        setCommentText('');
      }
    } catch (error) {
      console.error('Error posting comment:', error);
      alert(error.response?.data?.message || 'Failed to post comment.');
    }
  };

  // ── 8. Edit Comment Submission ───────────────────────────────────────────
  const submitEdit = async (commentId) => {
    if (!editText.trim()) return;
    try {
      const res = await axiosInstance.put(`/comment/${commentId}/edit`, { content: editText });
      if (res.data?.success) {
        setComments((prev) =>
          prev.map((c) => (c._id === commentId ? { ...c, content: editText, isEdited: true } : c))
        );
        setEditingCommentId(null);
        setEditText('');
      }
    } catch (err) {
      console.error('Failed to edit comment:', err);
      alert(err.response?.data?.message || 'Failed to edit comment');
    }
  };

  // ── 9. Delete Comment ────────────────────────────────────────────────────
  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) return;
    try {
      await axiosInstance.delete(`/comment/${commentId}`);
      // Real-time socket will also broadcast, but optimistically update UI
      setComments((prev) => prev.filter((c) => c._id !== commentId));
    } catch (err) {
      console.error('Failed to delete comment:', err);
      alert(err.response?.data?.message || 'Failed to delete comment');
    }
  };

  // ── 10. Toggle Pin Comment ───────────────────────────────────────────────
  const handleTogglePin = async (commentId) => {
    try {
      const res = await axiosInstance.post(`/comment/${commentId}/pin`);
      if (res.data?.success) {
        const isPinned = res.data.isPinned;
        setComments((prev) => {
          const updated = prev.map((c) =>
            c._id === commentId ? { ...c, isPinned } : isPinned ? { ...c, isPinned: false } : c
          );
          return [...updated].sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
        });
      }
    } catch (err) {
      console.error('Failed to toggle pin:', err);
      alert(err.response?.data?.message || 'Failed to pin comment');
    }
  };

  // ── 11. Toggle Comment Reaction ──────────────────────────────────────────
  const handleToggleLike = async (commentId) => {
    try {
      // Optimistic UI update
      setComments((prev) =>
        prev.map((c) => {
          if (c._id !== commentId) return c;
          const isLiked = !c.isLiked;
          const likeCount = isLiked ? (c.likeCount || 0) + 1 : Math.max((c.likeCount || 1) - 1, 0);
          return { ...c, isLiked, likeCount };
        })
      );

      const res = await axiosInstance.post(`/comment/${commentId}/like`, { reactionType: 'like' });
      if (res.data?.success) {
        setComments((prev) =>
          prev.map((c) =>
            c._id === commentId
              ? { ...c, isLiked: res.data.isLiked, likeCount: res.data.likeCount }
              : c
          )
        );
      }
    } catch (err) {
      console.error('Failed to toggle like on comment:', err);
    }
  };

  // ── 12. Post Actions (Like, Delete, Report) ──────────────────────────────
  const togglePostLike = async () => {
    try {
      await axiosInstance.post(`/post/${id}/like`);
      setLikedPosts((prev) => ({ ...prev, [id]: !prev[id] }));
      setPost((prev) => {
        if (!prev) return prev;
        const wasLiked = likedPosts[id];
        const newLikes = wasLiked
          ? prev.likes.filter((uid) => uid !== currentUserId)
          : [...(prev.likes || []), currentUserId];
        return { ...prev, likes: newLikes };
      });
    } catch (err) {
      console.error('Error liking post:', err);
    }
  };

  const deletePost = async () => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;
    try {
      await axiosInstance.delete(`/post/delete/${id}`);
      navigate('/');
    } catch (err) {
      console.error('Error deleting post', err);
    }
  };

  const reportPost = async () => {
    try {
      await axiosInstance.post('/report/create', {
        targetId: id,
        targetType: 'Post',
        reason: 'other',
        description: 'User reported post from post view.',
      });
      setActiveDropdown(null);
      alert('Report submitted successfully.');
    } catch (err) {
      console.error('Error reporting post', err);
    }
  };

  const formatTimeAgo = (date) => {
    if (!date) return '';
    const diff = Date.now() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  if (!post) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <LoadingSpinner />
      </div>
    );
  }

  const isPostAuthor = post.author?._id === currentUserId || post.author?.username === user?.user?.username;

  return (
    <div style={styles.cardContainer} className="border">
      {/* ── Post Header ──────────────────────────────────────────────── */}
      <div style={styles.cardHeader}>
        <Link className="text-decoration-none text-white d-flex align-items-center" to={`/user/${post.author?._id}`}>
          {post.author?.profileImage ? (
            <img src={post.author.profileImage} alt={post.author.username} style={styles.profileIcon} />
          ) : (
            <FaUserCircle className="fs-1 me-2" />
          )}
          <div>
            <div className="fw-bold">
              {post.author?.username || 'User'}
              {post.author?.isverified && (
                <img src={verifiedBadge} alt="Verified" style={styles.verifiedBadge} />
              )}
            </div>
            <small style={styles.timeText}>{formatTimeAgo(post.createdAt)}</small>
          </div>
        </Link>

        <div style={{ position: 'relative' }}>
          <FaEllipsisV style={styles.menuIcon} onClick={() => setActiveDropdown(activeDropdown === 'post' ? null : 'post')} />
          {activeDropdown === 'post' && (
            <div ref={menuRef} style={styles.menu}>
              <ul className="list-unstyled m-0 p-1">
                {isPostAuthor && (
                  <li className="dropdown-item text-danger py-1 px-2" style={styles.menuItem} onClick={deletePost}>
                    Delete
                  </li>
                )}
                <li className="dropdown-item text-dark py-1 px-2" style={styles.menuItem} onClick={reportPost}>
                  Report
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* ── Post Content ─────────────────────────────────────────────── */}
      <div style={styles.cardContent}>
        <h5 className="mb-2 text-white">{post.caption}</h5>
      </div>

      {/* ── Post Actions ─────────────────────────────────────────────── */}
      <div style={styles.cardActions} className="border-top border-bottom border-secondary">
        <div onClick={togglePostLike} style={styles.actionButton}>
          <span style={{ ...styles.icon, color: likedPosts[id] ? theme.secondary : '#fff' }}>
            {likedPosts[id] ? <FaHeart /> : <FaRegHeart />}
          </span>
          <span className="text-white ms-1">{post.likes?.length || 0} Likes</span>
        </div>
        <div style={styles.actionButton}>
          <span className="text-white">{comments.length} Discussion items</span>
        </div>
      </div>

      {/* ── Discussion Controls (Sorting & Live Notice) ──────────────── */}
      <div className="d-flex justify-content-between align-items-center px-3 py-2 border-bottom border-secondary">
        <span className="text-white fw-bold">Live Comments</span>
        <div className="d-flex align-items-center">
          <small className="text-secondary me-2">Sort by:</small>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="form-select form-select-sm bg-dark text-white border-secondary"
            style={{ width: '110px' }}
          >
            <option value="newest">Newest</option>
            <option value="top">Top (Likes)</option>
            <option value="oldest">Oldest</option>
          </select>
        </div>
      </div>

      {/* ── Live Typers Indicator ────────────────────────────────────── */}
      {typers.length > 0 && (
        <div className="px-3 py-1 bg-dark text-info fst-italic border-bottom border-secondary">
          <small>
            {typers.length === 1
              ? `${typers[0].name || typers[0].username} is typing…`
              : `${typers.length} people are typing…`}
          </small>
        </div>
      )}

      {/* ── Comments List ────────────────────────────────────────────── */}
      <div ref={commentsTopRef} style={styles.commentsList}>
        {comments.length === 0 ? (
          <div className="text-center text-secondary py-4">No comments yet. Start the conversation!</div>
        ) : (
          comments.map((comment) => {
            const isCommentOwner = comment.author?._id === currentUserId;
            const replies = repliesMap[comment._id] || [];
            const isExpanded = expandedReplies.has(comment._id);

            return (
              <div key={comment._id} style={styles.commentItem}>
                <div style={{ ...styles.commentBubble, ...(comment.isPinned ? styles.pinnedBubble : {}) }}>
                  {/* Pinned Badge */}
                  {comment.isPinned && (
                    <div className="d-flex align-items-center text-warning mb-1">
                      <FaThumbtack className="me-1" size={11} />
                      <small className="fw-bold" style={{ fontSize: '11px' }}>Pinned Discussion</small>
                    </div>
                  )}

                  {/* Comment Author Header */}
                  <div className="d-flex justify-content-between align-items-start">
                    <div className="d-flex align-items-center">
                      <Link to={`/user/${comment.author?._id}`} className="text-decoration-none text-white d-flex align-items-center">
                        {comment.author?.profileImage ? (
                          <img src={comment.author.profileImage} alt="" style={styles.commentAvatar} />
                        ) : (
                          <FaUserCircle className="fs-5 me-1 text-secondary" />
                        )}
                        <span className="fw-bold text-white me-1">{comment.author?.username || 'User'}</span>
                        {comment.author?.isverified && (
                          <img src={verifiedBadge} alt="V" style={styles.verifiedBadge} />
                        )}
                      </Link>
                      <small style={styles.commentTime} className="ms-2">
                        {formatTimeAgo(comment.createdAt)}
                        {comment.isEdited && <span className="ms-1 fst-italic">(edited)</span>}
                      </small>
                    </div>

                    {/* Comment Dropdown Menu */}
                    <div style={{ position: 'relative' }}>
                      <FaEllipsisV
                        style={styles.menuIcon}
                        onClick={() => setActiveDropdown(activeDropdown === comment._id ? null : comment._id)}
                      />
                      {activeDropdown === comment._id && (
                        <div ref={menuRef} style={styles.menu}>
                          <ul className="list-unstyled m-0 p-1">
                            {isPostAuthor && (
                              <li
                                className="dropdown-item py-1 px-2 text-warning"
                                style={styles.menuItem}
                                onClick={() => {
                                  setActiveDropdown(null);
                                  handleTogglePin(comment._id);
                                }}
                              >
                                {comment.isPinned ? 'Unpin comment' : 'Pin to top'}
                              </li>
                            )}
                            {isCommentOwner && comment.status !== 'deleted' && (
                              <li
                                className="dropdown-item py-1 px-2 text-dark"
                                style={styles.menuItem}
                                onClick={() => {
                                  setActiveDropdown(null);
                                  setEditingCommentId(comment._id);
                                  setEditText(comment.content);
                                }}
                              >
                                Edit
                              </li>
                            )}
                            {(isCommentOwner || isPostAuthor) && (
                              <li
                                className="dropdown-item py-1 px-2 text-danger"
                                style={styles.menuItem}
                                onClick={() => {
                                  setActiveDropdown(null);
                                  handleDeleteComment(comment._id);
                                }}
                              >
                                Delete
                              </li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Comment Body / Edit Form */}
                  {editingCommentId === comment._id ? (
                    <div className="mt-2">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="form-control bg-dark text-white border-secondary mb-2"
                        rows={2}
                      />
                      <div className="d-flex justify-content-end gap-2">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => setEditingCommentId(null)}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={() => submitEdit(comment._id)}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-white mt-1" style={{ wordBreak: 'break-word' }}>
                      {comment.content}
                    </div>
                  )}

                  {/* Comment Footer: Like & Reply buttons */}
                  {comment.status !== 'deleted' && (
                    <div className="d-flex align-items-center gap-3 mt-2">
                      <button
                        type="button"
                        className="btn btn-link p-0 text-decoration-none d-flex align-items-center"
                        style={{ color: comment.isLiked ? theme.secondary : '#888', fontSize: '13px' }}
                        onClick={() => handleToggleLike(comment._id)}
                      >
                        {comment.isLiked ? <FaHeart className="me-1" /> : <FaRegHeart className="me-1" />}
                        <span>{comment.likeCount || 0}</span>
                      </button>

                      <button
                        type="button"
                        className="btn btn-link p-0 text-decoration-none text-secondary d-flex align-items-center"
                        style={{ fontSize: '13px' }}
                        onClick={() => {
                          setReplyingTo(comment);
                          setCommentText(`@${comment.author?.username} `);
                        }}
                      >
                        <FaReply className="me-1" size={11} /> Reply
                      </button>
                    </div>
                  )}

                  {/* Thread Collapsible Toggle */}
                  {(comment.replyCount > 0 || replies.length > 0) && (
                    <div className="mt-2">
                      <button
                        type="button"
                        className="btn btn-link p-0 text-decoration-none text-info d-flex align-items-center"
                        style={{ fontSize: '12px' }}
                        onClick={() => toggleReplies(comment._id)}
                      >
                        {isExpanded ? <FaChevronUp className="me-1" size={10} /> : <FaChevronDown className="me-1" size={10} />}
                        {isExpanded
                          ? 'Hide replies'
                          : `View ${comment.replyCount || replies.length} ${
                              comment.replyCount === 1 ? 'reply' : 'replies'
                            }`}
                      </button>
                    </div>
                  )}

                  {/* Nested Replies List */}
                  {isExpanded && (
                    <div className="ps-3 mt-2 border-start border-secondary">
                      {loadingReplies.has(comment._id) ? (
                        <div className="py-2 text-secondary">
                          <small>Loading replies...</small>
                        </div>
                      ) : (
                        replies.map((reply) => (
                          <div key={reply._id} className="mb-2 py-1">
                            <div className="d-flex align-items-center">
                              <Link to={`/user/${reply.author?._id}`} className="text-decoration-none text-white fw-bold me-1">
                                <small>{reply.author?.username || 'User'}</small>
                              </Link>
                              {reply.author?.isverified && (
                                <img src={verifiedBadge} alt="V" style={styles.verifiedBadge} />
                              )}
                              <small style={styles.commentTime} className="ms-2">
                                {formatTimeAgo(reply.createdAt)}
                              </small>
                            </div>
                            <div className="text-white mt-1" style={{ fontSize: '13px' }}>
                              {reply.content}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Load More Comments */}
        {hasMore && (
          <div className="text-center py-2">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => fetchComments(page + 1, true, sort)}
              disabled={isLoadingMore}
            >
              {isLoadingMore ? 'Loading more...' : 'Load older comments'}
            </button>
          </div>
        )}
      </div>

      {/* ── Fixed Bottom Comment / Reply Form ────────────────────────── */}
      <div style={styles.commentSection}>
        {replyingTo && (
          <div className="d-flex justify-content-between align-items-center px-2 py-1 mb-1 bg-dark border border-secondary rounded">
            <small className="text-info">
              Replying to <strong>@{replyingTo.author?.username}</strong>
            </small>
            <button
              type="button"
              className="btn btn-link btn-sm text-secondary p-0"
              onClick={() => setReplyingTo(null)}
            >
              Cancel
            </button>
          </div>
        )}

        <form onSubmit={handleCommentSubmit} className="d-flex align-items-center gap-2">
          <textarea
            value={commentText}
            onChange={handleCommentChange}
            placeholder={replyingTo ? `Reply to @${replyingTo.author?.username}...` : 'Add to discussion...'}
            style={styles.commentInput}
            rows={1}
          />
          <button type="submit" style={styles.commentButton} disabled={!commentText.trim()}>
            Post
          </button>
        </form>
      </div>
    </div>
  );
};

const styles = {
  cardContainer: {
    width: '100%',
    maxWidth: '650px',
    margin: '20px auto',
    backgroundColor: theme.cardBg,
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.4)',
    color: '#fff',
    borderColor: theme.border,
    paddingBottom: '80px',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px',
    borderBottom: `1px solid ${theme.border}`,
  },
  profileIcon: {
    width: '42px',
    height: '42px',
    borderRadius: '50%',
    marginRight: '12px',
    objectFit: 'cover',
  },
  verifiedBadge: {
    width: '14px',
    height: '14px',
    marginLeft: '5px',
    verticalAlign: 'middle',
  },
  menuIcon: {
    cursor: 'pointer',
    color: '#888',
    padding: '4px',
  },
  menu: {
    position: 'absolute',
    top: '25px',
    right: '0',
    zIndex: 1000,
    backgroundColor: '#fff',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
    borderRadius: '6px',
    minWidth: '130px',
  },
  menuItem: {
    cursor: 'pointer',
    fontSize: '13px',
    borderRadius: '4px',
  },
  cardContent: {
    padding: '16px',
  },
  cardActions: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '10px 16px',
  },
  actionButton: {
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    userSelect: 'none',
  },
  icon: {
    fontSize: '18px',
  },
  timeText: {
    fontSize: '12px',
    color: theme.textSecondary,
  },
  commentsList: {
    padding: '12px 16px',
  },
  commentItem: {
    marginBottom: '12px',
  },
  commentBubble: {
    backgroundColor: '#242526',
    border: `1px solid ${theme.border}`,
    borderRadius: '10px',
    padding: '12px',
    transition: 'all 0.2s ease',
  },
  pinnedBubble: {
    borderLeft: '4px solid #ffc107',
    backgroundColor: '#26241b',
  },
  commentAvatar: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    marginRight: '8px',
    objectFit: 'cover',
  },
  commentTime: {
    fontSize: '11px',
    color: theme.textSecondary,
  },
  commentSection: {
    position: 'fixed',
    bottom: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    width: '100%',
    maxWidth: '650px',
    padding: '10px 16px',
    backgroundColor: theme.cardBg,
    borderTop: `1px solid ${theme.border}`,
    zIndex: 999,
  },
  commentInput: {
    flex: 1,
    padding: '10px 14px',
    backgroundColor: '#242526',
    color: '#fff',
    border: `1px solid ${theme.border}`,
    borderRadius: '20px',
    fontSize: '14px',
    resize: 'none',
    outline: 'none',
  },
  commentButton: {
    padding: '8px 18px',
    backgroundColor: theme.primary,
    color: '#fff',
    border: 'none',
    borderRadius: '20px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
};

export default PostPage;
