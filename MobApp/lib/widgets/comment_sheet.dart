import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../models/post_model.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../utils/app_colors.dart';
import 'auth_prompt_sheet.dart';

class CommentSheet extends StatefulWidget {
  final String? postId;
  final String? pollId;
  final List<CommentModel> initialComments;
  final VoidCallback onCommentAdded;

  const CommentSheet({
    super.key,
    this.postId,
    this.pollId,
    required this.initialComments,
    required this.onCommentAdded,
  });

  @override
  State<CommentSheet> createState() => _CommentSheetState();
}

class _CommentSheetState extends State<CommentSheet> {
  final TextEditingController _commentController = TextEditingController();
  final FocusNode _focusNode = FocusNode();

  List<CommentModel> _comments = [];
  final Map<String, List<CommentModel>> _repliesMap = {};
  final Set<String> _expandedReplies = {};
  final Set<String> _loadingReplies = {};

  bool _isLoadingComments = false;
  bool _isSubmitting = false;
  String _currentSort = "newest"; // "newest" | "top"

  // Reply context state
  CommentModel? _replyingToComment;

  @override
  void initState() {
    super.initState();
    _comments = List.from(widget.initialComments);
    _fetchComments();
  }

  Future<void> _fetchComments() async {
    setState(() {
      _isLoadingComments = true;
    });

    try {
      final queryParam = widget.postId != null
          ? 'postId=${widget.postId}'
          : 'pollId=${widget.pollId}';
      final response = await ApiService.get(
          '/comment/list?$queryParam&sort=$_currentSort&limit=50');
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['success'] == true && data['comments'] != null) {
          final List fetchedList = data['comments'];
          setState(() {
            _comments =
                fetchedList.map((c) => CommentModel.fromJson(c)).toList();
          });
        }
      }
    } catch (e) {
      debugPrint("Error fetching comments: $e");
    } finally {
      if (mounted) {
        setState(() {
          _isLoadingComments = false;
        });
      }
    }
  }

  Future<void> _fetchReplies(String commentId) async {
    if (_loadingReplies.contains(commentId)) return;

    setState(() {
      _loadingReplies.add(commentId);
    });

    try {
      final response = await ApiService.get('/comment/$commentId/replies');
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['success'] == true && data['replies'] != null) {
          final List fetchedList = data['replies'];
          setState(() {
            _repliesMap[commentId] =
                fetchedList.map((c) => CommentModel.fromJson(c)).toList();
            _expandedReplies.add(commentId);
          });
        }
      }
    } catch (e) {
      debugPrint("Error fetching replies: $e");
    } finally {
      if (mounted) {
        setState(() {
          _loadingReplies.remove(commentId);
        });
      }
    }
  }

  Future<void> _submitComment() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (!auth.isAuthenticated) {
      AuthPrompt.show(
        context,
        title: _replyingToComment != null ? 'Reply to Comment' : 'Add a Comment',
        message: 'Log in to join the conversation and participate in discussions.',
        icon: Icons.chat_bubble_outline_rounded,
      );
      return;
    }

    final text = _commentController.text.trim();
    if (text.isEmpty || _isSubmitting) return;

    setState(() {
      _isSubmitting = true;
    });

    try {
      final body = {
        'content': text,
        if (widget.postId != null) 'postId': widget.postId,
        if (widget.pollId != null) 'pollId': widget.pollId,
        if (_replyingToComment != null)
          'parentCommentId': _replyingToComment!.id,
      };

      final response = await ApiService.post('/comment/add', body);
      final data = json.decode(response.body);

      if ((response.statusCode == 200 || response.statusCode == 201) &&
          data['success'] == true) {
        final newComment = CommentModel.fromJson(data['comment']);

        setState(() {
          if (_replyingToComment != null) {
            final parentId = _replyingToComment!.id;
            _repliesMap.putIfAbsent(parentId, () => []).add(newComment);
            _expandedReplies.add(parentId);

            // Update parent replyCount locally
            final parentIndex =
                _comments.indexWhere((c) => c.id == parentId);
            if (parentIndex != -1) {
              final p = _comments[parentIndex];
              _comments[parentIndex] =
                  p.copyWith(replyCount: p.replyCount + 1);
            }
            _replyingToComment = null;
          } else {
            _comments.insert(0, newComment);
          }
          _commentController.clear();
          _focusNode.unfocus();
        });

        widget.onCommentAdded();

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Comment posted!'),
              backgroundColor: Colors.green,
              duration: Duration(seconds: 2),
            ),
          );
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(data['message'] ?? 'Failed to post comment.'),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    } catch (e) {
      debugPrint("Error submitting comment: $e");
    } finally {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
        });
      }
    }
  }

  Future<void> _toggleLike(CommentModel comment, {bool isReply = false}) async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (!auth.isAuthenticated) {
      AuthPrompt.show(
        context,
        title: 'Like Comment',
        message: 'Log in to like and interact with comments.',
        icon: Icons.favorite_border_rounded,
      );
      return;
    }

    final previousIsLiked = comment.isLiked;
    final previousLikeCount = comment.likeCount;

    // Optimistic UI update
    setState(() {
      if (isReply && comment.parentComment != null) {
        final replies = _repliesMap[comment.parentComment!];
        if (replies != null) {
          final idx = replies.indexWhere((r) => r.id == comment.id);
          if (idx != -1) {
            replies[idx] = replies[idx].copyWith(
              isLiked: !previousIsLiked,
              likeCount: previousIsLiked
                  ? (previousLikeCount - 1).clamp(0, 999999)
                  : previousLikeCount + 1,
            );
          }
        }
      } else {
        final idx = _comments.indexWhere((c) => c.id == comment.id);
        if (idx != -1) {
          _comments[idx] = _comments[idx].copyWith(
            isLiked: !previousIsLiked,
            likeCount: previousIsLiked
                ? (previousLikeCount - 1).clamp(0, 999999)
                : previousLikeCount + 1,
          );
        }
      }
    });

    try {
      final response = await ApiService.post('/comment/${comment.id}/like', {});
      if (response.statusCode != 200) {
        // Rollback on server failure
        setState(() {
          if (isReply && comment.parentComment != null) {
            final replies = _repliesMap[comment.parentComment!];
            if (replies != null) {
              final idx = replies.indexWhere((r) => r.id == comment.id);
              if (idx != -1) {
                replies[idx] = replies[idx].copyWith(
                  isLiked: previousIsLiked,
                  likeCount: previousLikeCount,
                );
              }
            }
          } else {
            final idx = _comments.indexWhere((c) => c.id == comment.id);
            if (idx != -1) {
              _comments[idx] = _comments[idx].copyWith(
                isLiked: previousIsLiked,
                likeCount: previousLikeCount,
              );
            }
          }
        });
      }
    } catch (e) {
      debugPrint("Error toggling comment like: $e");
    }
  }

  void _showCommentOptions(CommentModel comment, {bool isReply = false}) {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final isAuthor = auth.currentUser?.id == comment.author.id;

    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.cardBackground,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (isAuthor) ...[
              ListTile(
                leading: const Icon(Icons.edit_outlined, color: AppColors.primary),
                title: Text('Edit Comment', style: GoogleFonts.inter(color: AppColors.textPrimary)),
                onTap: () {
                  Navigator.pop(ctx);
                  _editCommentDialog(comment, isReply: isReply);
                },
              ),
              ListTile(
                leading: const Icon(Icons.delete_outline_rounded, color: Colors.red),
                title: Text('Delete Comment', style: GoogleFonts.inter(color: Colors.red)),
                onTap: () {
                  Navigator.pop(ctx);
                  _deleteComment(comment, isReply: isReply);
                },
              ),
            ],
            ListTile(
              leading: const Icon(Icons.flag_outlined, color: AppColors.textSecondary),
              title: Text('Report Comment', style: GoogleFonts.inter(color: AppColors.textPrimary)),
              onTap: () {
                Navigator.pop(ctx);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Comment reported for moderation.')),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  void _editCommentDialog(CommentModel comment, {bool isReply = false}) {
    final editController = TextEditingController(text: comment.content);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.cardBackground,
        title: Text('Edit Comment', style: GoogleFonts.outfit(color: AppColors.textPrimary)),
        content: TextField(
          controller: editController,
          maxLines: 3,
          style: GoogleFonts.inter(color: AppColors.textPrimary),
          decoration: const InputDecoration(
            hintText: 'Edit your comment...',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () async {
              final newContent = editController.text.trim();
              if (newContent.isEmpty) return;
              Navigator.pop(ctx);

              try {
                final response = await ApiService.put('/comment/${comment.id}/edit', {
                  'content': newContent,
                });
                if (response.statusCode == 200) {
                  setState(() {
                    if (isReply && comment.parentComment != null) {
                      final replies = _repliesMap[comment.parentComment!];
                      if (replies != null) {
                        final idx = replies.indexWhere((r) => r.id == comment.id);
                        if (idx != -1) {
                          replies[idx] = replies[idx].copyWith(content: newContent, isEdited: true);
                        }
                      }
                    } else {
                      final idx = _comments.indexWhere((c) => c.id == comment.id);
                      if (idx != -1) {
                        _comments[idx] = _comments[idx].copyWith(content: newContent, isEdited: true);
                      }
                    }
                  });
                }
              } catch (e) {
                debugPrint("Edit error: $e");
              }
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  Future<void> _deleteComment(CommentModel comment, {bool isReply = false}) async {
    try {
      final response = await ApiService.delete('/comment/${comment.id}');
      if (response.statusCode == 200) {
        setState(() {
          if (isReply && comment.parentComment != null) {
            final replies = _repliesMap[comment.parentComment!];
            if (replies != null) {
              replies.removeWhere((r) => r.id == comment.id);
            }
          } else {
            if (comment.replyCount > 0) {
              // Soft deleted
              final idx = _comments.indexWhere((c) => c.id == comment.id);
              if (idx != -1) {
                _comments[idx] = _comments[idx].copyWith(
                  content: 'This comment was deleted.',
                  status: 'deleted',
                );
              }
            } else {
              _comments.removeWhere((c) => c.id == comment.id);
            }
          }
        });
      }
    } catch (e) {
      debugPrint("Delete error: $e");
    }
  }

  String _formatTime(DateTime dt) {
    return DateFormat.MMMd().add_jm().format(dt.toLocal());
  }

  @override
  void dispose() {
    _commentController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  Widget _buildCommentItem(CommentModel comment, {bool isReply = false}) {
    final isDeleted = comment.status == 'deleted';
    final hasReplies = !isReply && comment.replyCount > 0;
    final isExpanded = _expandedReplies.contains(comment.id);
    final isLoadingReplies = _loadingReplies.contains(comment.id);
    final replies = _repliesMap[comment.id] ?? [];

    return Container(
      margin: EdgeInsets.only(
        left: isReply ? 24 : 0,
        bottom: 12,
      ),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isReply ? AppColors.surface.withOpacity(0.5) : AppColors.cardBackground,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isReply ? AppColors.border.withOpacity(0.5) : AppColors.border,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Author Header
          Row(
            children: [
              CircleAvatar(
                radius: isReply ? 11 : 14,
                backgroundImage: comment.author.profileImage != null &&
                        comment.author.profileImage!.isNotEmpty
                    ? NetworkImage(comment.author.profileImage!)
                    : null,
                child: (comment.author.profileImage == null ||
                        comment.author.profileImage!.isEmpty)
                    ? Icon(Icons.person, size: isReply ? 11 : 14)
                    : null,
              ),
              const SizedBox(width: 8),
              Text(
                comment.author.username,
                style: GoogleFonts.inter(
                  fontWeight: FontWeight.bold,
                  fontSize: isReply ? 12 : 13,
                  color: AppColors.textPrimary,
                ),
              ),
              if (comment.author.isverified) ...[
                const SizedBox(width: 4),
                Icon(Icons.verified, color: Colors.blue, size: isReply ? 12 : 14),
              ],
              const Spacer(),
              Text(
                _formatTime(comment.createdAt),
                style: GoogleFonts.inter(
                  fontSize: 11,
                  color: AppColors.textSecondary,
                ),
              ),
              if (!isDeleted)
                IconButton(
                  icon: const Icon(Icons.more_horiz, size: 16, color: AppColors.textSecondary),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                  onPressed: () => _showCommentOptions(comment, isReply: isReply),
                ),
            ],
          ),
          const SizedBox(height: 6),

          // Content
          Text(
            comment.content,
            style: GoogleFonts.inter(
              fontSize: isReply ? 13 : 14,
              color: isDeleted ? AppColors.textSecondary : AppColors.textPrimary,
              fontStyle: isDeleted ? FontStyle.italic : FontStyle.normal,
            ),
          ),
          if (comment.isEdited && !isDeleted) ...[
            const SizedBox(height: 2),
            Text(
              '(edited)',
              style: GoogleFonts.inter(fontSize: 10, color: AppColors.textSecondary),
            ),
          ],

          const SizedBox(height: 8),

          // Actions: Like, Reply
          if (!isDeleted)
            Row(
              children: [
                InkWell(
                  onTap: () => _toggleLike(comment, isReply: isReply),
                  child: Row(
                    children: [
                      Icon(
                        comment.isLiked ? Icons.favorite : Icons.favorite_border,
                        size: 14,
                        color: comment.isLiked ? Colors.red : AppColors.textSecondary,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        '${comment.likeCount}',
                        style: GoogleFonts.inter(
                          fontSize: 12,
                          color: comment.isLiked ? Colors.red : AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 16),
                if (!isReply)
                  InkWell(
                    onTap: () {
                      setState(() {
                        _replyingToComment = comment;
                      });
                      _focusNode.requestFocus();
                    },
                    child: Text(
                      'Reply',
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: AppColors.primary,
                      ),
                    ),
                  ),
              ],
            ),

          // Expand / Collapse replies
          if (hasReplies) ...[
            const SizedBox(height: 8),
            InkWell(
              onTap: () {
                if (isExpanded) {
                  setState(() {
                    _expandedReplies.remove(comment.id);
                  });
                } else {
                  _fetchReplies(comment.id);
                }
              },
              child: Row(
                children: [
                  Container(
                    width: 20,
                    height: 1,
                    color: AppColors.primary.withOpacity(0.5),
                  ),
                  const SizedBox(width: 6),
                  if (isLoadingReplies)
                    const SizedBox(
                      width: 12,
                      height: 12,
                      child: CircularProgressIndicator(strokeWidth: 1.5, color: AppColors.primary),
                    )
                  else
                    Text(
                      isExpanded
                          ? 'Hide replies'
                          : 'View ${comment.replyCount} ${comment.replyCount == 1 ? 'reply' : 'replies'}',
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: AppColors.primary,
                      ),
                    ),
                ],
              ),
            ),
          ],

          // Render Nested Replies
          if (isExpanded && replies.isNotEmpty) ...[
            const SizedBox(height: 8),
            Column(
              children: replies
                  .map((reply) => _buildCommentItem(reply, isReply: true))
                  .toList(),
            ),
          ],
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Container(
        height: MediaQuery.of(context).size.height * 0.75,
        decoration: const BoxDecoration(
          color: AppColors.background,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          border: Border(
            top: BorderSide(color: AppColors.border, width: 1),
          ),
        ),
        child: Column(
          children: [
            // Top Notch handle
            Container(
              margin: const EdgeInsets.symmetric(vertical: 10),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.borderLight,
                borderRadius: BorderRadius.circular(2),
              ),
            ),

            // Header & Sorting
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Comments (${_comments.length})',
                    style: GoogleFonts.outfit(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  Row(
                    children: [
                      // Sort filter
                      DropdownButton<String>(
                        value: _currentSort,
                        dropdownColor: AppColors.cardBackground,
                        underline: const SizedBox(),
                        icon: const Icon(Icons.sort_rounded, color: AppColors.textSecondary, size: 18),
                        items: [
                          DropdownMenuItem(
                            value: 'newest',
                            child: Text('Newest', style: GoogleFonts.inter(color: AppColors.textPrimary, fontSize: 13)),
                          ),
                          DropdownMenuItem(
                            value: 'top',
                            child: Text('Top', style: GoogleFonts.inter(color: AppColors.textPrimary, fontSize: 13)),
                          ),
                        ],
                        onChanged: (val) {
                          if (val != null && val != _currentSort) {
                            setState(() {
                              _currentSort = val;
                            });
                            _fetchComments();
                          }
                        },
                      ),
                      if (_isLoadingComments) ...[
                        const SizedBox(width: 8),
                        const SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
            const Divider(color: AppColors.border),

            // Comments List
            Expanded(
              child: _isLoadingComments && _comments.isEmpty
                  ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
                  : _comments.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.chat_bubble_outline_rounded,
                                  size: 40, color: AppColors.textSecondary),
                              const SizedBox(height: 8),
                              Text(
                                'No comments yet.',
                                style: GoogleFonts.outfit(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.textPrimary,
                                ),
                              ),
                              Text(
                                'Start the conversation!',
                                style: GoogleFonts.inter(
                                  fontSize: 13,
                                  color: AppColors.textSecondary,
                                ),
                              ),
                            ],
                          ),
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          itemCount: _comments.length,
                          itemBuilder: (context, index) {
                            return _buildCommentItem(_comments[index]);
                          },
                        ),
            ),

            // Replying banner
            if (_replyingToComment != null)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                color: AppColors.primary.withOpacity(0.12),
                child: Row(
                  children: [
                    const Icon(Icons.reply_rounded, color: AppColors.primary, size: 16),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Replying to @${_replyingToComment!.author.username}',
                        style: GoogleFonts.inter(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: AppColors.primary,
                        ),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, size: 16, color: AppColors.textSecondary),
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                      onPressed: () {
                        setState(() {
                          _replyingToComment = null;
                        });
                      },
                    ),
                  ],
                ),
              ),

            // Submit input bar
            Container(
              padding: const EdgeInsets.all(16),
              decoration: const BoxDecoration(
                color: AppColors.surface,
                border: Border(
                  top: BorderSide(color: AppColors.border),
                ),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _commentController,
                      focusNode: _focusNode,
                      style: GoogleFonts.inter(color: AppColors.textPrimary),
                      decoration: InputDecoration(
                        hintText: _replyingToComment != null
                            ? 'Reply to @${_replyingToComment!.author.username}...'
                            : 'Add a comment...',
                        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      ),
                      maxLines: null,
                    ),
                  ),
                  const SizedBox(width: 12),
                  _isSubmitting
                      ? const SizedBox(
                          width: 24,
                          height: 24,
                          child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
                        )
                      : Container(
                          decoration: const BoxDecoration(
                            gradient: AppColors.buttonGradient,
                            shape: BoxShape.circle,
                          ),
                          child: IconButton(
                            onPressed: _submitComment,
                            icon: const Icon(Icons.send_rounded, size: 18),
                            color: Colors.white,
                          ),
                        ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
