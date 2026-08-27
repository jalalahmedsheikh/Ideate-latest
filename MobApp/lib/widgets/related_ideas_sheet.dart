import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../models/post_model.dart';
import '../models/poll_model.dart';
import '../models/topic_model.dart';
import '../services/api_service.dart';
import '../utils/app_colors.dart';
import '../screens/topic_screen.dart';

class RelatedIdeasSheet extends StatefulWidget {
  final String targetId;
  final bool isPoll;

  const RelatedIdeasSheet({
    super.key,
    required this.targetId,
    this.isPoll = false,
  });

  static void show(BuildContext context, {required String targetId, bool isPoll = false}) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => RelatedIdeasSheet(targetId: targetId, isPoll: isPoll),
    );
  }

  @override
  State<RelatedIdeasSheet> createState() => _RelatedIdeasSheetState();
}

class _RelatedIdeasSheetState extends State<RelatedIdeasSheet> {
  bool _isLoading = true;
  List<PostModel> _relatedPosts = [];
  List<PollModel> _relatedPolls = [];
  List<TopicModel> _relatedTopics = [];

  @override
  void initState() {
    super.initState();
    _fetchRelatedContent();
  }

  Future<void> _fetchRelatedContent() async {
    try {
      final endpoint = widget.isPoll
          ? '/feed/related-polls/${widget.targetId}'
          : '/feed/related-ideas/${widget.targetId}';

      final response = await ApiService.get(endpoint);
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['success'] == true) {
          setState(() {
            if (data['relatedPosts'] != null) {
              _relatedPosts = (data['relatedPosts'] as List)
                  .map((p) => PostModel.fromJson(p))
                  .toList();
            }
            if (data['relatedPolls'] != null) {
              _relatedPolls = (data['relatedPolls'] as List)
                  .map((p) => PollModel.fromJson(p))
                  .toList();
            }
            if (data['relatedTopics'] != null) {
              _relatedTopics = (data['relatedTopics'] as List)
                  .map((t) => TopicModel.fromJson(t))
                  .toList();
            }
          });
        }
      }
    } catch (e) {
      debugPrint("Error fetching related ideas: $e");
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.75,
      ),
      margin: EdgeInsets.only(bottom: bottomInset),
      decoration: const BoxDecoration(
        color: AppColors.cardBackground,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag Handle
          const SizedBox(height: 12),
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: AppColors.border,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 16),

          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              children: [
                const Icon(Icons.auto_awesome_rounded, color: AppColors.primary, size: 20),
                const SizedBox(width: 8),
                Text(
                  'Related Ideas & Discussions',
                  style: GoogleFonts.outfit(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: AppColors.textPrimary,
                  ),
                ),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.close, color: AppColors.textSecondary),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),
          const Divider(color: AppColors.border, height: 1),

          // Content Body
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
                : (_relatedPosts.isEmpty && _relatedPolls.isEmpty && _relatedTopics.isEmpty)
                    ? Center(
                        child: Text(
                          'No related content found yet.',
                          style: GoogleFonts.inter(color: AppColors.textSecondary),
                        ),
                      )
                    : ListView(
                        padding: const EdgeInsets.all(16),
                        children: [
                          // 1. Related Topics
                          if (_relatedTopics.isNotEmpty) ...[
                            Text(
                              'RELATED TOPICS',
                              style: GoogleFonts.inter(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: AppColors.textSecondary,
                                letterSpacing: 0.5,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: _relatedTopics.map((topic) {
                                return ActionChip(
                                  backgroundColor: AppColors.surface,
                                  side: const BorderSide(color: AppColors.border),
                                  avatar: Text(topic.icon, style: const TextStyle(fontSize: 12)),
                                  label: Text(
                                    '#${topic.name}',
                                    style: GoogleFonts.inter(
                                      color: AppColors.textPrimary,
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  onPressed: () {
                                    Navigator.pop(context);
                                    Navigator.push(
                                      context,
                                      MaterialPageRoute(
                                        builder: (_) => TopicScreen(slug: topic.slug, initialTopic: topic),
                                      ),
                                    );
                                  },
                                );
                              }).toList(),
                            ),
                            const SizedBox(height: 20),
                          ],

                          // 2. Related Posts
                          if (_relatedPosts.isNotEmpty) ...[
                            Text(
                              'SIMILAR IDEAS',
                              style: GoogleFonts.inter(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: AppColors.textSecondary,
                                letterSpacing: 0.5,
                              ),
                            ),
                            const SizedBox(height: 8),
                            ..._relatedPosts.map((post) {
                              return Container(
                                margin: const EdgeInsets.only(bottom: 8),
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: AppColors.surface,
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: AppColors.border),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        CircleAvatar(
                                          radius: 12,
                                          backgroundImage: post.author.profileImage != null &&
                                                  post.author.profileImage!.isNotEmpty
                                              ? NetworkImage(post.author.profileImage!)
                                              : null,
                                          child: post.author.profileImage == null
                                              ? const Icon(Icons.person, size: 12)
                                              : null,
                                        ),
                                        const SizedBox(width: 8),
                                        Text(
                                          '@${post.author.username}',
                                          style: GoogleFonts.inter(
                                            fontSize: 12,
                                            fontWeight: FontWeight.bold,
                                            color: AppColors.textPrimary,
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 6),
                                    Text(
                                      post.caption,
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                      style: GoogleFonts.inter(
                                        fontSize: 13,
                                        color: AppColors.textPrimary,
                                      ),
                                    ),
                                  ],
                                ),
                              );
                            }),
                            const SizedBox(height: 20),
                          ],

                          // 3. Related Polls
                          if (_relatedPolls.isNotEmpty) ...[
                            Text(
                              'RELATED DISCUSSIONS & POLLS',
                              style: GoogleFonts.inter(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: AppColors.textSecondary,
                                letterSpacing: 0.5,
                              ),
                            ),
                            const SizedBox(height: 8),
                            ..._relatedPolls.map((poll) {
                              return Container(
                                margin: const EdgeInsets.only(bottom: 8),
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: AppColors.surface,
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: AppColors.border),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      poll.question,
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                      style: GoogleFonts.inter(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w600,
                                        color: AppColors.textPrimary,
                                      ),
                                    ),
                                    const SizedBox(height: 6),
                                    Text(
                                      '${poll.options.length} options · ${poll.votes.reduce((a, b) => a + b)} votes',
                                      style: GoogleFonts.inter(
                                        fontSize: 11,
                                        color: AppColors.textSecondary,
                                      ),
                                    ),
                                  ],
                                ),
                              );
                            }),
                          ],
                        ],
                      ),
          ),
        ],
      ),
    );
  }
}
