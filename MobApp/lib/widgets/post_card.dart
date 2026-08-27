import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../models/post_model.dart';
import '../models/user_model.dart';
import '../providers/auth_provider.dart';
import '../screens/other_profile.dart';
import '../screens/topic_screen.dart';
import '../services/api_service.dart';
import '../utils/app_colors.dart';
import 'auth_prompt_sheet.dart';
import 'comment_sheet.dart';
import 'share_sheet.dart';
import 'report_dialog.dart';
import 'related_ideas_sheet.dart';

class PostCard extends StatefulWidget {
  final PostModel post;
  final VoidCallback? onRefresh;

  const PostCard({
    super.key,
    required this.post,
    this.onRefresh,
  });

  @override
  State<PostCard> createState() => _PostCardState();
}

class _PostCardState extends State<PostCard> {
  late bool _isLiked;
  late int _likeCount;
  late bool _isBookmarked;
  bool _isLiking = false;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    _initData();
  }

  @override
  void didUpdateWidget(covariant PostCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.post.id != widget.post.id || oldWidget.post.likes != widget.post.likes) {
      _initData();
    }
  }

  void _initData() {
    final currentUserId = Provider.of<AuthProvider>(context, listen: false).currentUser?.id;
    _isLiked = currentUserId != null && widget.post.likes.contains(currentUserId);
    _likeCount = widget.post.likes.length;
    _isBookmarked = Provider.of<AuthProvider>(context, listen: false)
            .currentUser
            ?.bookmarks
            .contains(widget.post.id) ??
        false;
  }

  Future<void> _toggleLike() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (!auth.isAuthenticated) {
      AuthPrompt.show(
        context,
        title: 'Like Post',
        message: 'Log in to like posts and share your appreciation.',
        icon: Icons.favorite_border_rounded,
      );
      return;
    }

    if (_isLiking) return;
    _isLiking = true;

    final originalLiked = _isLiked;
    final originalCount = _likeCount;

    setState(() {
      _isLiked = !_isLiked;
      _likeCount = _isLiked ? _likeCount + 1 : (_likeCount > 0 ? _likeCount - 1 : 0);
    });

    try {
      final action = _isLiked ? 'like' : 'dislike';
      final response = await ApiService.post('/post/${widget.post.id}/$action', {});
      final data = json.decode(response.body);

      if (response.statusCode != 200 || data['success'] != true) {
        setState(() {
          _isLiked = originalLiked;
          _likeCount = originalCount;
        });
      }
    } catch (e) {
      setState(() {
        _isLiked = originalLiked;
        _likeCount = originalCount;
      });
    } finally {
      _isLiking = false;
    }
  }

  Future<void> _toggleBookmark() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (!auth.isAuthenticated) {
      AuthPrompt.show(
        context,
        title: 'Save Post',
        message: 'Log in to bookmark posts to your profile.',
        icon: Icons.bookmark_border_rounded,
      );
      return;
    }

    if (_isSaving) return;
    _isSaving = true;

    final originalBookmarked = _isBookmarked;

    setState(() {
      _isBookmarked = !_isBookmarked;
    });

    try {
      final action = _isBookmarked ? 'savepost' : 'unsavepost';
      final response = await ApiService.post('/post/${widget.post.id}/$action', {});
      final data = json.decode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        final authProvider = Provider.of<AuthProvider>(context, listen: false);
        final currentUser = authProvider.currentUser;
        if (currentUser != null) {
          final updatedBookmarks = List<String>.from(currentUser.bookmarks);
          if (_isBookmarked) {
            updatedBookmarks.add(widget.post.id);
          } else {
            updatedBookmarks.remove(widget.post.id);
          }
          authProvider.updateCurrentUser(
            currentUser.copyWithBookmarks(updatedBookmarks),
          );
        }
      } else {
        setState(() {
          _isBookmarked = originalBookmarked;
        });
      }
    } catch (e) {
      setState(() {
        _isBookmarked = originalBookmarked;
      });
    } finally {
      _isSaving = false;
    }
  }

  Future<void> _deletePost() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.cardBackground,
        title: Text('Delete Post', style: GoogleFonts.outfit(color: AppColors.textPrimary)),
        content: Text('Are you sure you want to delete this post?', style: GoogleFonts.inter(color: AppColors.textSecondary)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      final response = await ApiService.delete('/post/delete/${widget.post.id}');
      if (response.statusCode == 200) {
        if (widget.onRefresh != null) widget.onRefresh!();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Post deleted.'), backgroundColor: Colors.green),
          );
        }
      }
    } catch (e) {
      debugPrint("Delete post error: $e");
    }
  }

  void _showComments() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => CommentSheet(
        postId: widget.post.id,
        initialComments: widget.post.comments,
        onCommentAdded: () {
          if (widget.onRefresh != null) widget.onRefresh!();
        },
      ),
    );
  }

  String _formatTime(DateTime dt) {
    return DateFormat.yMMMd().add_jm().format(dt.toLocal());
  }

  @override
  Widget build(BuildContext context) {
    final currentUserId = Provider.of<AuthProvider>(context, listen: false).currentUser?.id;
    final isOwner = widget.post.author.id == currentUserId;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.cardBackground,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.border),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Recommendation explanation badge (if present)
            if (widget.post.recommendationSignal != null && widget.post.recommendationSignal!.isNotEmpty) ...[
              Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.primary.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppColors.primary.withOpacity(0.3)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.auto_awesome, size: 12, color: AppColors.primary),
                    const SizedBox(width: 6),
                    Text(
                      widget.post.recommendationSignal!,
                      style: GoogleFonts.inter(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: AppColors.primaryLight,
                      ),
                    ),
                  ],
                ),
              ),
            ],
            // Author row
            Row(
              children: [
                CircleAvatar(
                  radius: 20,
                  backgroundImage: widget.post.author.profileImage != null &&
                          widget.post.author.profileImage!.isNotEmpty
                      ? NetworkImage(widget.post.author.profileImage!)
                      : null,
                  child: widget.post.author.profileImage == null
                      ? const Icon(Icons.person, size: 20)
                      : null,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: InkWell(
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => OtherProfileScreen(userId: widget.post.author.id),
                        ),
                      );
                    },
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(
                              widget.post.author.username,
                              style: GoogleFonts.inter(
                                fontWeight: FontWeight.bold,
                                fontSize: 15,
                                color: AppColors.textPrimary,
                              ),
                            ),
                            if (widget.post.author.isverified) ...[
                              const SizedBox(width: 4),
                              const Icon(Icons.verified, color: Colors.blue, size: 14),
                            ],
                          ],
                        ),
                        Text(
                          _formatTime(widget.post.createdAt),
                          style: GoogleFonts.inter(fontSize: 11, color: AppColors.textSecondary),
                        ),
                      ],
                    ),
                  ),
                ),
                PopupMenuButton<String>(
                  icon: const Icon(Icons.more_horiz, color: AppColors.textSecondary),
                  color: AppColors.cardBackground,
                  onSelected: (value) {
                    if (value == 'delete') {
                      _deletePost();
                    } else if (value == 'report') {
                      ReportDialog.show(context, targetId: widget.post.id, targetType: 'Post');
                    } else if (value == 'related') {
                      RelatedIdeasSheet.show(context, targetId: widget.post.id, isPoll: false);
                    }
                  },
                  itemBuilder: (ctx) => [
                    const PopupMenuItem(
                      value: 'related',
                      child: Row(
                        children: [
                          Icon(Icons.auto_awesome_rounded, color: AppColors.primary, size: 18),
                          SizedBox(width: 8),
                          Text('Related Ideas', style: TextStyle(color: AppColors.textPrimary)),
                        ],
                      ),
                    ),
                    if (isOwner)
                      const PopupMenuItem(
                        value: 'delete',
                        child: Row(
                          children: [
                            Icon(Icons.delete_outline_rounded, color: Colors.red, size: 18),
                            SizedBox(width: 8),
                            Text('Delete Post', style: TextStyle(color: Colors.red)),
                          ],
                        ),
                      )
                    else
                      const PopupMenuItem(
                        value: 'report',
                        child: Row(
                          children: [
                            Icon(Icons.flag_outlined, color: AppColors.textPrimary, size: 18),
                            SizedBox(width: 8),
                            Text('Report Post', style: TextStyle(color: AppColors.textPrimary)),
                          ],
                        ),
                      ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Post Caption
            Text(
              widget.post.caption,
              style: GoogleFonts.inter(
                fontSize: 15,
                height: 1.4,
                color: AppColors.textPrimary,
              ),
            ),

            // Topic Tags
            if (widget.post.topics.isNotEmpty) ...[
              const SizedBox(height: 10),
              Wrap(
                spacing: 6,
                runSpacing: 4,
                children: widget.post.topics.map((t) {
                  return InkWell(
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => TopicScreen(slug: t.slug, initialTopic: t),
                        ),
                      );
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withOpacity(0.12),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        '#${t.name}',
                        style: GoogleFonts.inter(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: AppColors.primary,
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ],

            const SizedBox(height: 12),
            const Divider(color: AppColors.border, height: 1),
            const SizedBox(height: 10),

            // Actions Row
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                // Like
                InkWell(
                  onTap: _toggleLike,
                  child: Row(
                    children: [
                      Icon(
                        _isLiked ? Icons.favorite : Icons.favorite_border,
                        color: _isLiked ? Colors.red : AppColors.textSecondary,
                        size: 20,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        '$_likeCount',
                        style: GoogleFonts.inter(
                          fontSize: 13,
                          color: _isLiked ? Colors.red : AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),

                // Comment
                InkWell(
                  onTap: _showComments,
                  child: Row(
                    children: [
                      const Icon(Icons.chat_bubble_outline_rounded, color: AppColors.textSecondary, size: 19),
                      const SizedBox(width: 6),
                      Text(
                        '${widget.post.comments.length}',
                        style: GoogleFonts.inter(fontSize: 13, color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                ),

                // Share
                InkWell(
                  onTap: () => ShareSheet.show(context, post: widget.post),
                  child: Row(
                    children: [
                      const Icon(Icons.share_outlined, color: AppColors.textSecondary, size: 19),
                      const SizedBox(width: 6),
                      Text(
                        'Share',
                        style: GoogleFonts.inter(fontSize: 13, color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                ),

                // Bookmark
                IconButton(
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                  icon: Icon(
                    _isBookmarked ? Icons.bookmark : Icons.bookmark_border,
                    color: _isBookmarked ? AppColors.primary : AppColors.textSecondary,
                    size: 20,
                  ),
                  onPressed: _toggleBookmark,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

extension CopyWithBookmarks on UserModel {
  UserModel copyWithBookmarks(List<String> updatedBookmarks) {
    return UserModel(
      id: id,
      username: username,
      email: email,
      profileImage: profileImage,
      bio: bio,
      category: category,
      followers: followers,
      followings: followings,
      posts: posts,
      bookmarks: updatedBookmarks,
      isverified: isverified,
    );
  }
}
