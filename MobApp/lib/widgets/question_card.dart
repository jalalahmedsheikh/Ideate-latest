import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../models/question_model.dart';
import '../providers/auth_provider.dart';
import '../screens/other_profile.dart';
import '../screens/question_detail_screen.dart';
import '../screens/topic_screen.dart';
import '../services/api_service.dart';
import 'auth_prompt_sheet.dart';
import 'reputation_chip.dart';
import 'share_sheet.dart';
import 'verification_badge.dart';

class QuestionCard extends StatefulWidget {
  final QuestionModel question;
  final VoidCallback? onRefresh;

  const QuestionCard({
    Key? key,
    required this.question,
    this.onRefresh,
  }) : super(key: key);

  @override
  State<QuestionCard> createState() => _QuestionCardState();
}

class _QuestionCardState extends State<QuestionCard> {
  late int _score;
  late bool _isUpvoted;
  late bool _isDownvoted;
  late bool _isFollowing;
  bool _isActionLoading = false;

  @override
  void initState() {
    super.initState();
    _initData();
  }

  @override
  void didUpdateWidget(covariant QuestionCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.question.id != widget.question.id ||
        oldWidget.question.upvotes != widget.question.upvotes ||
        oldWidget.question.downvotes != widget.question.downvotes) {
      _initData();
    }
  }

  void _initData() {
    final currentUserId =
        Provider.of<AuthProvider>(context, listen: false).currentUser?.id;
    _isUpvoted = currentUserId != null &&
        widget.question.upvotes.contains(currentUserId);
    _isDownvoted = currentUserId != null &&
        widget.question.downvotes.contains(currentUserId);
    _isFollowing = currentUserId != null &&
        widget.question.followers.contains(currentUserId);
    _score = widget.question.score;
  }

  Future<void> _handleVote(String type) async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (!auth.isAuthenticated) {
      AuthPrompt.show(
        context,
        title: 'Vote on Question',
        message: 'Log in to upvote or downvote questions and shape discussion quality.',
        icon: Icons.thumbs_up_down_outlined,
      );
      return;
    }

    if (_isActionLoading) return;
    _isActionLoading = true;

    final origScore = _score;
    final origUp = _isUpvoted;
    final origDown = _isDownvoted;

    setState(() {
      if (type == 'upvote') {
        if (_isUpvoted) {
          _isUpvoted = false;
          _score -= 1;
        } else {
          _isUpvoted = true;
          _score += _isDownvoted ? 2 : 1;
          _isDownvoted = false;
        }
      } else {
        if (_isDownvoted) {
          _isDownvoted = false;
          _score += 1;
        } else {
          _isDownvoted = true;
          _score -= _isUpvoted ? 2 : 1;
          _isUpvoted = false;
        }
      }
    });

    try {
      final response = await ApiService.post('/question/${widget.question.id}/vote', {
        'voteType': type,
      });
      final data = json.decode(response.body);
      if (response.statusCode != 200 || data['success'] != true) {
        setState(() {
          _score = origScore;
          _isUpvoted = origUp;
          _isDownvoted = origDown;
        });
      }
    } catch (_) {
      setState(() {
        _score = origScore;
        _isUpvoted = origUp;
        _isDownvoted = origDown;
      });
    } finally {
      _isActionLoading = false;
    }
  }

  Future<void> _toggleFollow() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (!auth.isAuthenticated) {
      AuthPrompt.show(
        context,
        title: 'Follow Question',
        message: 'Log in to follow questions and get notified when new answers arrive.',
        icon: Icons.notifications_active_outlined,
      );
      return;
    }

    setState(() {
      _isFollowing = !_isFollowing;
    });

    try {
      await ApiService.post('/question/${widget.question.id}/follow', {});
    } catch (_) {
      setState(() {
        _isFollowing = !_isFollowing;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surfaceColor = isDark ? const Color(0xFF1E1E2C) : Colors.white;
    final primaryColor = Theme.of(context).primaryColor;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
      decoration: BoxDecoration(
        color: surfaceColor,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: widget.question.hasAcceptedAnswer
              ? const Color(0xFF4CAF50).withOpacity(0.35)
              : (isDark ? Colors.white.withOpacity(0.08) : Colors.black.withOpacity(0.06)),
          width: widget.question.hasAcceptedAnswer ? 1.5 : 1.0,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(isDark ? 0.25 : 0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => QuestionDetailScreen(questionId: widget.question.id),
              ),
            ).then((_) => widget.onRefresh?.call());
          },
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // ── Header: Author, Verification, Reputation, Time ──
                Row(
                  children: [
                    GestureDetector(
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => OtherProfileScreen(userId: widget.question.author.id),
                          ),
                        );
                      },
                      child: CircleAvatar(
                        radius: 18,
                        backgroundColor: primaryColor.withOpacity(0.15),
                        backgroundImage: widget.question.author.profileImage != null &&
                                widget.question.author.profileImage!.isNotEmpty
                            ? NetworkImage(widget.question.author.profileImage!)
                            : null,
                        child: widget.question.author.profileImage == null ||
                                widget.question.author.profileImage!.isEmpty
                            ? Text(
                                widget.question.author.username.isNotEmpty
                                    ? widget.question.author.username[0].toUpperCase()
                                    : '?',
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: primaryColor,
                                  fontSize: 14,
                                ),
                              )
                            : null,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Flexible(
                                child: Text(
                                  widget.question.author.username,
                                  style: GoogleFonts.plusJakartaSans(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 14,
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              if (widget.question.author.isverified)
                                VerificationBadge(
                                  category: widget.question.author.verificationCategory,
                                  size: 14,
                                ),
                              const SizedBox(width: 6),
                              ReputationChip(
                                score: widget.question.author.reputationScore,
                                level: widget.question.author.reputationLevel,
                                compact: true,
                              ),
                            ],
                          ),
                          Text(
                            DateFormat.yMMMd().format(widget.question.createdAt),
                            style: TextStyle(
                              fontSize: 11,
                              color: isDark ? Colors.white54 : Colors.black45,
                            ),
                          ),
                        ],
                      ),
                    ),
                    // Question Status / Accepted Badge
                    if (widget.question.hasAcceptedAnswer)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: const Color(0xFF4CAF50).withOpacity(0.15),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFF4CAF50), width: 1),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.check_circle, color: Color(0xFF4CAF50), size: 13),
                            SizedBox(width: 4),
                            Text(
                              'Resolved',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF4CAF50),
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),

                const SizedBox(height: 12),

                // ── Question Title ──
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      margin: const EdgeInsets.only(top: 2, right: 8),
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.amber.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: Colors.amber.withOpacity(0.5)),
                      ),
                      child: const Text(
                        'Q',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                          color: Colors.amber,
                        ),
                      ),
                    ),
                    Expanded(
                      child: Text(
                        widget.question.title,
                        style: GoogleFonts.plusJakartaSans(
                          fontWeight: FontWeight.w800,
                          fontSize: 16,
                          height: 1.3,
                        ),
                      ),
                    ),
                  ],
                ),

                // ── Description Preview ──
                if (widget.question.description.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(
                    widget.question.description,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 13.5,
                      height: 1.4,
                      color: isDark ? Colors.white70 : Colors.black87,
                    ),
                  ),
                ],

                // ── Topics ──
                if (widget.question.topics.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: widget.question.topics.map((topic) {
                      return GestureDetector(
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => TopicScreen(
                                slug: topic.slug.isNotEmpty ? topic.slug : topic.name.toLowerCase(),
                                initialTopic: topic,
                              ),
                            ),
                          );
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: primaryColor.withOpacity(0.08),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            '#${topic.name}',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: primaryColor,
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                ],

                const SizedBox(height: 14),

                // ── Action Bar: Votes, Answers, Follow, Share ──
                Row(
                  children: [
                    // Upvote / Downvote Score Pill
                    Container(
                      decoration: BoxDecoration(
                        color: isDark ? Colors.white.withOpacity(0.06) : Colors.grey.shade100,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            icon: Icon(
                              Icons.arrow_upward_rounded,
                              size: 18,
                              color: _isUpvoted ? primaryColor : (isDark ? Colors.white60 : Colors.black54),
                            ),
                            visualDensity: VisualDensity.compact,
                            padding: const EdgeInsets.symmetric(horizontal: 6),
                            constraints: const BoxConstraints(),
                            onPressed: () => _handleVote('upvote'),
                          ),
                          Text(
                            '$_score',
                            style: TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 13,
                              color: _isUpvoted
                                  ? primaryColor
                                  : (_isDownvoted ? Colors.redAccent : null),
                            ),
                          ),
                          IconButton(
                            icon: Icon(
                              Icons.arrow_downward_rounded,
                              size: 18,
                              color: _isDownvoted ? Colors.redAccent : (isDark ? Colors.white60 : Colors.black54),
                            ),
                            visualDensity: VisualDensity.compact,
                            padding: const EdgeInsets.symmetric(horizontal: 6),
                            constraints: const BoxConstraints(),
                            onPressed: () => _handleVote('downvote'),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(width: 12),

                    // Answers count
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: isDark ? Colors.white.withOpacity(0.06) : Colors.grey.shade100,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.chat_bubble_outline_rounded,
                            size: 15,
                            color: isDark ? Colors.white60 : Colors.black54,
                          ),
                          const SizedBox(width: 5),
                          Text(
                            '${widget.question.answersCount} Answers',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: isDark ? Colors.white70 : Colors.black87,
                            ),
                          ),
                        ],
                      ),
                    ),

                    const Spacer(),

                    // Follow question
                    IconButton(
                      icon: Icon(
                        _isFollowing ? Icons.notifications_active : Icons.notifications_none,
                        size: 20,
                        color: _isFollowing ? primaryColor : (isDark ? Colors.white60 : Colors.black54),
                      ),
                      tooltip: _isFollowing ? 'Unfollow Question' : 'Follow Question',
                      onPressed: _toggleFollow,
                    ),

                    // Share
                    IconButton(
                      icon: Icon(
                        Icons.share_outlined,
                        size: 19,
                        color: isDark ? Colors.white60 : Colors.black54,
                      ),
                      onPressed: () {
                        ShareSheet.show(
                          context,
                          title: widget.question.title,
                          content: widget.question.description,
                        );
                      },
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
