import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../models/poll_model.dart';
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
import 'post_card.dart'; // import extension CopyWithBookmarks

class PollCard extends StatefulWidget {
  final PollModel poll;
  final VoidCallback? onRefresh;

  const PollCard({
    super.key,
    required this.poll,
    this.onRefresh,
  });

  @override
  State<PollCard> createState() => _PollCardState();
}

class _PollCardState extends State<PollCard> {
  bool _isBookmarked = false;
  bool _isVoting = false;
  int? _selectedOptionIndex;
  late List<int> _votes;
  late int _totalVotes;
  bool _hasVoted = false;

  @override
  void initState() {
    super.initState();
    _initData();
  }

  @override
  void didUpdateWidget(covariant PollCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.poll.id != widget.poll.id || oldWidget.poll.votes != widget.poll.votes) {
      _initData();
    }
  }

  void _initData() {
    final currentUserId = Provider.of<AuthProvider>(context, listen: false).currentUser?.id;
    _isBookmarked = Provider.of<AuthProvider>(context, listen: false)
            .currentUser
            ?.bookmarks
            .contains(widget.poll.id) ??
        false;

    final voteRecord = widget.poll.votesHistory.firstWhere(
      (v) => v.userId == currentUserId && v.userId.isNotEmpty,
      orElse: () => PollVoteHistory(userId: '', optionIndex: -1),
    );

    if (voteRecord.optionIndex != -1) {
      _hasVoted = true;
      _selectedOptionIndex = voteRecord.optionIndex;
    } else {
      _hasVoted = false;
      _selectedOptionIndex = null;
    }

    _votes = List.from(widget.poll.votes);
    while (_votes.length < widget.poll.options.length) {
      _votes.add(0);
    }
    _totalVotes = _votes.fold(0, (sum, count) => sum + count);
  }

  Future<void> _castOrChangeVote(int optionIndex) async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (!auth.isAuthenticated) {
      AuthPrompt.show(
        context,
        title: 'Participate in Poll',
        message: 'Log in to vote and participate in this poll.',
        icon: Icons.how_to_vote_outlined,
      );
      return;
    }

    if (_isVoting) return;
    if (_hasVoted && _selectedOptionIndex == optionIndex) return;

    final prevHasVoted = _hasVoted;
    final prevSelectedIndex = _selectedOptionIndex;
    final prevVotes = List<int>.from(_votes);
    final prevTotalVotes = _totalVotes;

    setState(() {
      if (_hasVoted && _selectedOptionIndex != null) {
        final oldIndex = _selectedOptionIndex!;
        if (_votes[oldIndex] > 0) {
          _votes[oldIndex]--;
        }
      } else {
        _totalVotes++;
      }
      _votes[optionIndex]++;
      _selectedOptionIndex = optionIndex;
      _hasVoted = true;
    });

    _isVoting = true;

    try {
      final response = await ApiService.post('/poll/${widget.poll.id}/vote', {
        'optionIndex': optionIndex,
      });

      final data = json.decode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        if (widget.onRefresh != null) {
          widget.onRefresh!();
        }
      } else {
        setState(() {
          _hasVoted = prevHasVoted;
          _selectedOptionIndex = prevSelectedIndex;
          _votes = prevVotes;
          _totalVotes = prevTotalVotes;
        });
      }
    } catch (e) {
      setState(() {
        _hasVoted = prevHasVoted;
        _selectedOptionIndex = prevSelectedIndex;
        _votes = prevVotes;
        _totalVotes = prevTotalVotes;
      });
    } finally {
      _isVoting = false;
    }
  }

  Future<void> _toggleBookmark() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (!auth.isAuthenticated) {
      AuthPrompt.show(
        context,
        title: 'Save Poll',
        message: 'Log in to bookmark polls to your profile.',
        icon: Icons.bookmark_border_rounded,
      );
      return;
    }

    final prevBookmarked = _isBookmarked;
    setState(() {
      _isBookmarked = !_isBookmarked;
    });

    try {
      final action = _isBookmarked ? 'savepoll' : 'unsavepoll';
      final response = await ApiService.post('/poll/${widget.poll.id}/$action', {});
      final data = json.decode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        final currentUser = auth.currentUser;
        if (currentUser != null) {
          final updatedBookmarks = List<String>.from(currentUser.bookmarks);
          if (_isBookmarked) {
            updatedBookmarks.add(widget.poll.id);
          } else {
            updatedBookmarks.remove(widget.poll.id);
          }
          auth.updateCurrentUser(currentUser.copyWithBookmarks(updatedBookmarks));
        }
      } else {
        setState(() {
          _isBookmarked = prevBookmarked;
        });
      }
    } catch (e) {
      setState(() {
        _isBookmarked = prevBookmarked;
      });
    }
  }

  Future<void> _deletePoll() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.cardBackground,
        title: Text('Delete Poll', style: GoogleFonts.outfit(color: AppColors.textPrimary)),
        content: Text('Are you sure you want to delete this poll?', style: GoogleFonts.inter(color: AppColors.textSecondary)),
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
      final response = await ApiService.delete('/poll/delete/${widget.poll.id}');
      if (response.statusCode == 200) {
        if (widget.onRefresh != null) widget.onRefresh!();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Poll deleted.'), backgroundColor: Colors.green),
          );
        }
      }
    } catch (e) {
      debugPrint("Delete poll error: $e");
    }
  }

  void _showComments() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => CommentSheet(
        pollId: widget.poll.id,
        initialComments: widget.poll.comments,
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
    final isOwner = widget.poll.author.id == currentUserId;
    final showResults = _hasVoted || isOwner;

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
            if (widget.poll.recommendationSignal != null && widget.poll.recommendationSignal!.isNotEmpty) ...[
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
                      widget.poll.recommendationSignal!,
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
            // Author Row
            Row(
              children: [
                CircleAvatar(
                  radius: 20,
                  backgroundImage: widget.poll.author.profileImage != null &&
                          widget.poll.author.profileImage!.isNotEmpty
                      ? NetworkImage(widget.poll.author.profileImage!)
                      : null,
                  child: widget.poll.author.profileImage == null
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
                          builder: (_) => OtherProfileScreen(userId: widget.poll.author.id),
                        ),
                      );
                    },
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(
                              widget.poll.author.username,
                              style: GoogleFonts.inter(
                                fontWeight: FontWeight.bold,
                                fontSize: 15,
                                color: AppColors.textPrimary,
                              ),
                            ),
                            if (widget.poll.author.isverified) ...[
                              const SizedBox(width: 4),
                              const Icon(Icons.verified, color: Colors.blue, size: 14),
                            ],
                          ],
                        ),
                        Text(
                          _formatTime(widget.poll.createdAt),
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
                      _deletePoll();
                    } else if (value == 'report') {
                      ReportDialog.show(context, targetId: widget.poll.id, targetType: 'Poll');
                    } else if (value == 'related') {
                      RelatedIdeasSheet.show(context, targetId: widget.poll.id, isPoll: true);
                    }
                  },
                  itemBuilder: (ctx) => [
                    const PopupMenuItem(
                      value: 'related',
                      child: Row(
                        children: [
                          Icon(Icons.auto_awesome_rounded, color: AppColors.primary, size: 18),
                          SizedBox(width: 8),
                          Text('Related Discussions', style: TextStyle(color: AppColors.textPrimary)),
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
                            Text('Delete Poll', style: TextStyle(color: Colors.red)),
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
                            Text('Report Poll', style: TextStyle(color: AppColors.textPrimary)),
                          ],
                        ),
                      ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Question
            Text(
              widget.poll.question,
              style: GoogleFonts.outfit(
                fontSize: 17,
                fontWeight: FontWeight.bold,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 14),

            // Topic Tags
            if (widget.poll.topics.isNotEmpty) ...[
              Wrap(
                spacing: 6,
                runSpacing: 4,
                children: widget.poll.topics.map((t) {
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
              const SizedBox(height: 12),
            ],

            // Options list
            Column(
              children: List.generate(widget.poll.options.length, (index) {
                final option = widget.poll.options[index];
                final voteCount = _votes[index];
                final percent = _totalVotes > 0 ? (voteCount / _totalVotes) : 0.0;
                final percentText = '${(percent * 100).toStringAsFixed(1)}%';
                final isSelected = _selectedOptionIndex == index;

                if (showResults) {
                  return GestureDetector(
                    onTap: _isVoting ? null : () => _castOrChangeVote(index),
                    child: Container(
                      margin: const EdgeInsets.only(bottom: 10),
                      height: 48,
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: isSelected ? AppColors.primary : AppColors.border,
                          width: isSelected ? 2 : 1,
                        ),
                      ),
                      child: Stack(
                        children: [
                          FractionallySizedBox(
                            widthFactor: percent.clamp(0.0, 1.0),
                            child: Container(
                              decoration: BoxDecoration(
                                gradient: isSelected
                                    ? AppColors.primaryGradient
                                    : LinearGradient(
                                        colors: [
                                          AppColors.primary.withOpacity(0.3),
                                          AppColors.secondary.withOpacity(0.3),
                                        ],
                                      ),
                                borderRadius: BorderRadius.circular(10),
                              ),
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 14),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Row(
                                  children: [
                                    if (isSelected) ...[
                                      const Icon(Icons.check_circle_rounded, color: Colors.white, size: 16),
                                      const SizedBox(width: 6),
                                    ],
                                    Text(
                                      option,
                                      style: GoogleFonts.inter(
                                        fontSize: 14,
                                        fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                                        color: AppColors.textPrimary,
                                      ),
                                    ),
                                  ],
                                ),
                                Text(
                                  '$percentText ($voteCount)',
                                  style: GoogleFonts.inter(
                                    fontSize: 13,
                                    color: isSelected ? Colors.white : AppColors.textSecondary,
                                    fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                } else {
                  return Container(
                    margin: const EdgeInsets.only(bottom: 10),
                    width: double.infinity,
                    height: 48,
                    child: OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        side: const BorderSide(color: AppColors.border),
                        alignment: Alignment.centerLeft,
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                      ),
                      onPressed: _isVoting ? null : () => _castOrChangeVote(index),
                      child: Text(
                        option,
                        style: GoogleFonts.inter(
                          fontSize: 14,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ),
                  );
                }
              }),
            ),

            const SizedBox(height: 6),
            const Divider(color: AppColors.border, height: 1),
            const SizedBox(height: 10),

            // Actions Row (Vote count, Comment, Share, Bookmark)
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Icon(Icons.how_to_vote_outlined, size: 18, color: AppColors.primary),
                    const SizedBox(width: 4),
                    Text(
                      '$_totalVotes votes',
                      style: GoogleFonts.inter(color: AppColors.textSecondary, fontSize: 13),
                    ),
                  ],
                ),

                // Comment
                InkWell(
                  onTap: _showComments,
                  child: Row(
                    children: [
                      const Icon(Icons.chat_bubble_outline_rounded, color: AppColors.textSecondary, size: 19),
                      const SizedBox(width: 6),
                      Text(
                        '${widget.poll.comments.length}',
                        style: GoogleFonts.inter(fontSize: 13, color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                ),

                // Share
                InkWell(
                  onTap: () => ShareSheet.show(context, poll: widget.poll),
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
