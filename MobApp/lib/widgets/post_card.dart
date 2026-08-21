import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../models/post_model.dart';
import '../models/user_model.dart';
import '../providers/auth_provider.dart';
import '../screens/other_profile.dart';
import '../services/api_service.dart';
import '../utils/app_colors.dart';
import 'comment_sheet.dart';

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

  @override
  void initState() {
    super.initState();
    final currentUserId = Provider.of<AuthProvider>(context, listen: false).currentUser?.id;
    _isLiked = widget.post.likes.contains(currentUserId);
    _likeCount = widget.post.likes.length;
    _isBookmarked = Provider.of<AuthProvider>(context, listen: false)
            .currentUser
            ?.bookmarks
            .contains(widget.post.id) ??
        false;
  }

  Future<void> _toggleLike() async {
    final originalLiked = _isLiked;
    final originalCount = _likeCount;

    setState(() {
      _isLiked = !_isLiked;
      _likeCount = _isLiked ? _likeCount + 1 : _likeCount - 1;
    });

    try {
      final action = _isLiked ? 'like' : 'dislike';
      final response = await ApiService.post('/post/${widget.post.id}/$action', {});
      final data = json.decode(response.body);

      if (response.statusCode != 200 || data['success'] != true) {
        // Rollback state
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
    }
  }

  Future<void> _toggleBookmark() async {
    final originalBookmarked = _isBookmarked;

    setState(() {
      _isBookmarked = !_isBookmarked;
    });

    try {
      final action = _isBookmarked ? 'savepost' : 'unsavepost';
      final response = await ApiService.post('/post/${widget.post.id}/$action', {});
      final data = json.decode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        // Update user state inside AuthProvider
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
    }
  }

  void _showComments() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => CommentSheet(
        postId: widget.post.id,
        initialComments: widget.post.comments,
        onCommentAdded: () {
          if (widget.onRefresh != null) {
            widget.onRefresh!();
          }
        },
      ),
    );
  }

  String _formatTime(DateTime dt) {
    try {
      final difference = DateTime.now().difference(dt);
      if (difference.inMinutes < 60) return '${difference.inMinutes}m ago';
      if (difference.inHours < 24) return '${difference.inHours}h ago';
      return DateFormat.yMMMd().format(dt.toLocal());
    } catch (_) {
      return '';
    }
  }

  void _navigateToProfile() {
    final currentUserId = Provider.of<AuthProvider>(context, listen: false).currentUser?.id;
    if (widget.post.author.id == currentUserId) {
      // It is own profile, just rely on navigation or let it fall back
      return;
    }
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => OtherProfileScreen(userId: widget.post.author.id),
      ),
    ).then((_) {
      if (widget.onRefresh != null) {
        widget.onRefresh!();
      }
    });
  }

  Future<void> _deletePost() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1E1E2C),
        title: const Text('Delete Post', style: TextStyle(color: Colors.white)),
        content: const Text('Are you sure you want to delete this post?', style: TextStyle(color: Color(0xFF8D8D99))),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel', style: TextStyle(color: Colors.grey)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    try {
      final response = await ApiService.delete('/post/delete/${widget.post.id}');
      if (response.statusCode == 200) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Post deleted successfully.')),
        );
        if (widget.onRefresh != null) {
          widget.onRefresh!();
        }
      } else {
        final data = json.decode(response.body);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(data['message'] ?? 'Failed to delete post.')),
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Connection error deleting post.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 8),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header Profile Block
            Row(
              children: [
                Expanded(
                  child: GestureDetector(
                    onTap: _navigateToProfile,
                    child: Row(
                      children: [
                        CircleAvatar(
                          radius: 20,
                          backgroundImage: widget.post.author.profileImage != null
                              ? NetworkImage(widget.post.author.profileImage!)
                              : null,
                          child: widget.post.author.profileImage == null
                              ? const Icon(Icons.person, size: 20)
                              : null,
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Text(
                                    widget.post.author.username.isEmpty
                                        ? 'User'
                                        : widget.post.author.username,
                                    style: GoogleFonts.inter(
                                      fontWeight: FontWeight.bold,
                                      color: Colors.white,
                                      fontSize: 15,
                                    ),
                                  ),
                                  if (widget.post.author.isverified) ...[
                                    const SizedBox(width: 4),
                                    const Icon(Icons.verified, color: Colors.blue, size: 16),
                                  ],
                                ],
                              ),
                              Text(
                                _formatTime(widget.post.createdAt),
                                style: GoogleFonts.inter(fontSize: 12, color: Colors.grey),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                PopupMenuButton<String>(
                  icon: const Icon(Icons.more_vert, color: Colors.grey),
                  onSelected: (value) {
                    if (value == 'delete') {
                      _deletePost();
                    } else if (value == 'report') {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Reported successfully.')),
                      );
                    }
                  },
                  itemBuilder: (BuildContext context) {
                    final currentUserId = Provider.of<AuthProvider>(context, listen: false).currentUser?.id;
                    final isOwner = widget.post.author.id == currentUserId;
                    return [
                      if (isOwner)
                        const PopupMenuItem<String>(
                          value: 'delete',
                          child: Row(
                            children: [
                              Icon(Icons.delete, color: Colors.red, size: 20),
                              SizedBox(width: 8),
                              Text('Delete Post', style: TextStyle(color: Colors.red)),
                            ],
                          ),
                        )
                      else
                        const PopupMenuItem<String>(
                          value: 'report',
                          child: Row(
                            children: [
                              Icon(Icons.report, color: Colors.white, size: 20),
                              SizedBox(width: 8),
                              Text('Report Post', style: TextStyle(color: Colors.white)),
                            ],
                          ),
                        ),
                    ];
                  },
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Post Caption
            GestureDetector(
              onDoubleTap: _toggleLike,
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Text(
                  widget.post.caption,
                  style: GoogleFonts.inter(
                    fontSize: 16,
                    height: 1.4,
                    color: const Color(0xFFE1E1E6),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Likes Metainfo
            Text(
              '$_likeCount Likes',
              style: GoogleFonts.inter(
                fontWeight: FontWeight.bold,
                fontSize: 14,
                color: AppColors.textPrimary,
              ),
            ),
            const Divider(color: AppColors.border, height: 24),

            // Actions (Like, Comment, Share, Bookmark)
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                GestureDetector(
                  onTap: _toggleLike,
                  child: Row(
                    children: [
                      Icon(
                        _isLiked ? Icons.favorite : Icons.favorite_border,
                        color: _isLiked ? AppColors.accentPink : AppColors.textSecondary,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        _isLiked ? 'Liked' : 'Like',
                        style: GoogleFonts.inter(
                          color: _isLiked ? AppColors.accentPink : AppColors.textSecondary,
                          fontWeight: _isLiked ? FontWeight.bold : FontWeight.normal,
                        ),
                      ),
                    ],
                  ),
                ),
                GestureDetector(
                  onTap: _showComments,
                  child: Row(
                    children: [
                      const Icon(Icons.comment_outlined, color: AppColors.textSecondary),
                      const SizedBox(width: 6),
                      Text(
                        'Comment',
                        style: GoogleFonts.inter(color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                ),
                GestureDetector(
                  onTap: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Link copied to clipboard!')),
                    );
                  },
                  child: Row(
                    children: [
                      const Icon(Icons.share_outlined, color: AppColors.textSecondary),
                      const SizedBox(width: 6),
                      Text(
                        'Share',
                        style: GoogleFonts.inter(color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                  icon: Icon(
                    _isBookmarked ? Icons.bookmark : Icons.bookmark_border,
                    color: _isBookmarked ? AppColors.primary : AppColors.textSecondary,
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

// Extension to support user data model mutation inside provider
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
