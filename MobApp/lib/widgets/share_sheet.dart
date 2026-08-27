import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../models/post_model.dart';
import '../models/poll_model.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../utils/app_colors.dart';
import 'auth_prompt_sheet.dart';

class ShareSheet extends StatefulWidget {
  final PostModel? post;
  final PollModel? poll;
  final String? title;
  final String? content;

  const ShareSheet({
    super.key,
    this.post,
    this.poll,
    this.title,
    this.content,
  });

  static void show(
    BuildContext context, {
    PostModel? post,
    PollModel? poll,
    String? title,
    String? content,
  }) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.cardBackground,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => ShareSheet(post: post, poll: poll, title: title, content: content),
    );
  }

  @override
  State<ShareSheet> createState() => _ShareSheetState();
}

class _ShareSheetState extends State<ShareSheet> {
  List<dynamic> _recentConversations = [];
  bool _isLoadingConversations = false;
  String? _sendingToUserId;

  @override
  void initState() {
    super.initState();
    _fetchRecentChats();
  }

  Future<void> _fetchRecentChats() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (!auth.isAuthenticated) return;

    setState(() {
      _isLoadingConversations = true;
    });

    try {
      final response = await ApiService.get('/message/conversations');
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['success'] == true && data['conversations'] != null) {
          setState(() {
            _recentConversations = data['conversations'];
          });
        }
      }
    } catch (e) {
      debugPrint("Error fetching recent chats for share: $e");
    } finally {
      if (mounted) {
        setState(() {
          _isLoadingConversations = false;
        });
      }
    }
  }

  Future<void> _sendInChat(String recipientId, String username) async {
    setState(() {
      _sendingToUserId = recipientId;
    });

    try {
      final body = {
        'recipientId': recipientId,
        'type': widget.post != null ? 'shared_post' : 'shared_poll',
        if (widget.post != null) 'sharedPostId': widget.post!.id,
        if (widget.poll != null) 'sharedPollId': widget.poll!.id,
        'text': widget.post != null
            ? 'Check out this idea: ${widget.post!.caption}'
            : 'Vote in this poll: ${widget.poll!.question}',
      };

      final response = await ApiService.post('/message/send', body);
      if (response.statusCode == 200 || response.statusCode == 201) {
        if (mounted) {
          Navigator.pop(context);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Shared with @$username!'),
              backgroundColor: Colors.green,
            ),
          );
        }
      } else {
        final data = json.decode(response.body);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(data['message'] ?? 'Failed to send message.'),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    } catch (e) {
      debugPrint("Share in chat error: $e");
    } finally {
      if (mounted) {
        setState(() {
          _sendingToUserId = null;
        });
      }
    }
  }

  void _copyLink() {
    final String link = widget.post != null
        ? 'https://ideate.app/post/${widget.post!.id}'
        : 'https://ideate.app/poll/${widget.poll!.id}';

    Clipboard.setData(ClipboardData(text: link));
    Navigator.pop(context);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Link copied to clipboard!'),
        backgroundColor: AppColors.primary,
        duration: Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Handle bar
            Center(
              child: Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.borderLight,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),

            Text(
              'Share',
              style: GoogleFonts.outfit(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 16),

            // Share options row
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _buildActionItem(
                  icon: Icons.link_rounded,
                  label: 'Copy Link',
                  onTap: _copyLink,
                ),
                _buildActionItem(
                  icon: Icons.send_rounded,
                  label: 'Send in Chat',
                  onTap: () {
                    if (!auth.isAuthenticated) {
                      Navigator.pop(context);
                      AuthPrompt.show(
                        context,
                        title: 'Share in Chat',
                        message: 'Log in to send ideas and polls directly to friends.',
                        icon: Icons.send_rounded,
                      );
                    }
                  },
                ),
                _buildActionItem(
                  icon: Icons.share_rounded,
                  label: 'More',
                  onTap: _copyLink,
                ),
              ],
            ),

            if (auth.isAuthenticated && _recentConversations.isNotEmpty) ...[
              const SizedBox(height: 20),
              Text(
                'Send to Recent Conversations',
                style: GoogleFonts.inter(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 12),
              SizedBox(
                height: 85,
                child: _isLoadingConversations
                    ? const Center(child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary))
                    : ListView.builder(
                        scrollDirection: Axis.horizontal,
                        itemCount: _recentConversations.length,
                        itemBuilder: (ctx, idx) {
                          final conv = _recentConversations[idx];
                          final user = conv['user'];
                          if (user == null) return const SizedBox();

                          final username = user['username'] ?? 'User';
                          final userId = user['_id'] ?? user['id'] ?? '';
                          final isSending = _sendingToUserId == userId;

                          return Padding(
                            padding: const EdgeInsets.only(right: 16),
                            child: InkWell(
                              onTap: isSending ? null : () => _sendInChat(userId, username),
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Stack(
                                    children: [
                                      CircleAvatar(
                                        radius: 24,
                                        backgroundImage: user['profileImage'] != null &&
                                                user['profileImage'].isNotEmpty
                                            ? NetworkImage(user['profileImage'])
                                            : null,
                                        child: user['profileImage'] == null
                                            ? const Icon(Icons.person, size: 24)
                                            : null,
                                      ),
                                      if (isSending)
                                        Container(
                                          width: 48,
                                          height: 48,
                                          decoration: BoxDecoration(
                                            color: Colors.black.withOpacity(0.5),
                                            shape: BoxShape.circle,
                                          ),
                                          child: const Center(
                                            child: SizedBox(
                                              width: 18,
                                              height: 18,
                                              child: CircularProgressIndicator(
                                                strokeWidth: 2,
                                                color: Colors.white,
                                              ),
                                            ),
                                          ),
                                        ),
                                    ],
                                  ),
                                  const SizedBox(height: 6),
                                  SizedBox(
                                    width: 60,
                                    child: Text(
                                      username,
                                      overflow: TextOverflow.ellipsis,
                                      textAlign: TextAlign.center,
                                      style: GoogleFonts.inter(
                                        fontSize: 11,
                                        color: AppColors.textPrimary,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
              ),
            ],
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
  }

  Widget _buildActionItem({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: AppColors.primary, size: 24),
            const SizedBox(height: 6),
            Text(
              label,
              style: GoogleFonts.inter(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: AppColors.textPrimary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
