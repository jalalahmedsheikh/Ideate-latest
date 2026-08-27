import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../models/debate_model.dart';
import '../screens/debate_detail_screen.dart';
import '../screens/other_profile.dart';
import '../screens/topic_screen.dart';
import 'reputation_chip.dart';
import 'share_sheet.dart';
import 'verification_badge.dart';

class DebateCard extends StatelessWidget {
  final DebateModel debate;
  final VoidCallback? onRefresh;

  const DebateCard({
    Key? key,
    required this.debate,
    this.onRefresh,
  }) : super(key: key);

  String _getTimeRemaining() {
    if (debate.isClosed) return 'Closed';
    if (debate.deadline == null) return '${debate.durationHours}h';
    final diff = debate.deadline!.difference(DateTime.now());
    if (diff.isNegative) return 'Closed';
    if (diff.inDays > 0) return '${diff.inDays}d left';
    if (diff.inHours > 0) return '${diff.inHours}h left';
    return '${diff.inMinutes}m left';
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surfaceColor = isDark ? const Color(0xFF1E1E2C) : Colors.white;
    final primaryColor = Theme.of(context).primaryColor;

    final sideAPercent = debate.sideAPercentage;
    final sideBPercent = debate.sideBPercentage;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
      decoration: BoxDecoration(
        color: surfaceColor,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: isDark ? Colors.white.withOpacity(0.08) : Colors.black.withOpacity(0.06),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(isDark ? 0.3 : 0.05),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => DebateDetailScreen(debateId: debate.id),
              ),
            ).then((_) => onRefresh?.call());
          },
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // ── Header: Moderator, Reputation, Status Pill ──
                Row(
                  children: [
                    GestureDetector(
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => OtherProfileScreen(userId: debate.author.id),
                          ),
                        );
                      },
                      child: CircleAvatar(
                        radius: 17,
                        backgroundColor: const Color(0xFF9C27B0).withOpacity(0.15),
                        backgroundImage: debate.author.profileImage != null &&
                                debate.author.profileImage!.isNotEmpty
                            ? NetworkImage(debate.author.profileImage!)
                            : null,
                        child: debate.author.profileImage == null ||
                                debate.author.profileImage!.isEmpty
                            ? Text(
                                debate.author.username.isNotEmpty
                                    ? debate.author.username[0].toUpperCase()
                                    : 'D',
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF9C27B0),
                                  fontSize: 13,
                                ),
                              )
                            : null,
                      ),
                    ),
                    const SizedBox(width: 9),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Flexible(
                                child: Text(
                                  debate.author.username,
                                  style: GoogleFonts.plusJakartaSans(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 13.5,
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              if (debate.author.isverified)
                                VerificationBadge(
                                  category: debate.author.verificationCategory,
                                  size: 13,
                                ),
                              const SizedBox(width: 5),
                              ReputationChip(
                                score: debate.author.reputationScore,
                                level: debate.author.reputationLevel,
                                compact: true,
                              ),
                            ],
                          ),
                          Text(
                            DateFormat.yMMMd().format(debate.createdAt),
                            style: TextStyle(
                              fontSize: 11,
                              color: isDark ? Colors.white54 : Colors.black45,
                            ),
                          ),
                        ],
                      ),
                    ),

                    // Status Pill (Live vs Closed)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                      decoration: BoxDecoration(
                        color: debate.isClosed
                            ? Colors.grey.withOpacity(0.15)
                            : const Color(0xFFE91E63).withOpacity(0.12),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: debate.isClosed
                              ? Colors.grey.withOpacity(0.4)
                              : const Color(0xFFE91E63).withOpacity(0.5),
                          width: 1,
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            debate.isClosed ? Icons.lock_clock : Icons.sensors,
                            size: 12,
                            color: debate.isClosed ? Colors.grey : const Color(0xFFE91E63),
                          ),
                          const SizedBox(width: 4),
                          Text(
                            _getTimeRemaining(),
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: debate.isClosed ? Colors.grey : const Color(0xFFE91E63),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 12),

                // ── Debate Tag & Title ──
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      margin: const EdgeInsets.only(top: 2, right: 8),
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFF9C27B0).withOpacity(0.15),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: const Color(0xFF9C27B0).withOpacity(0.5)),
                      ),
                      child: const Text(
                        'DEBATE',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF9C27B0),
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                    Expanded(
                      child: Text(
                        debate.title,
                        style: GoogleFonts.plusJakartaSans(
                          fontWeight: FontWeight.w800,
                          fontSize: 16,
                          height: 1.3,
                        ),
                      ),
                    ),
                  ],
                ),

                // ── Resolution Statement ──
                if (debate.resolution.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: isDark ? Colors.white.withOpacity(0.04) : Colors.grey.shade50,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: isDark ? Colors.white.withOpacity(0.06) : Colors.grey.shade200,
                      ),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(Icons.format_quote_rounded, size: 16, color: Color(0xFF9C27B0)),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            debate.resolution,
                            style: TextStyle(
                              fontSize: 13,
                              fontStyle: FontStyle.italic,
                              color: isDark ? Colors.white70 : Colors.black87,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],

                const SizedBox(height: 14),

                // ── Stances & Percentage Split Bar ──
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            debate.sideA.label,
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF1E88E5), // Blue
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                          Text(
                            '${sideAPercent.toStringAsFixed(1)}% (${debate.sideA.votesCount})',
                            style: TextStyle(
                              fontSize: 11,
                              color: isDark ? Colors.white60 : Colors.black54,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            debate.sideB.label,
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFFE53935), // Red
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                          Text(
                            '${sideBPercent.toStringAsFixed(1)}% (${debate.sideB.votesCount})',
                            style: TextStyle(
                              fontSize: 11,
                              color: isDark ? Colors.white60 : Colors.black54,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 8),

                // Dual-color progress bar
                ClipRRect(
                  borderRadius: BorderRadius.circular(6),
                  child: Container(
                    height: 10,
                    width: double.infinity,
                    color: Colors.grey.withOpacity(0.2),
                    child: Row(
                      children: [
                        Flexible(
                          flex: (sideAPercent * 10).toInt().clamp(1, 1000),
                          child: Container(color: const Color(0xFF1E88E5)),
                        ),
                        if (debate.neutral.enabled && debate.neutralPercentage > 0)
                          Flexible(
                            flex: (debate.neutralPercentage * 10).toInt().clamp(1, 1000),
                            child: Container(color: Colors.amber),
                          ),
                        Flexible(
                          flex: (sideBPercent * 10).toInt().clamp(1, 1000),
                          child: Container(color: const Color(0xFFE53935)),
                        ),
                      ],
                    ),
                  ),
                ),

                // ── Topics ──
                if (debate.topics.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: debate.topics.map((topic) {
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

                // ── Stats Bar: Arguments, Participants, CTA ──
                Row(
                  children: [
                    Icon(Icons.forum_outlined, size: 15, color: isDark ? Colors.white60 : Colors.black54),
                    const SizedBox(width: 4),
                    Text(
                      '${debate.argumentsCount} Arguments',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: isDark ? Colors.white70 : Colors.black87,
                      ),
                    ),
                    const SizedBox(width: 14),
                    Icon(Icons.people_outline, size: 15, color: isDark ? Colors.white60 : Colors.black54),
                    const SizedBox(width: 4),
                    Text(
                      '${debate.participantsCount} Debaters',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: isDark ? Colors.white70 : Colors.black87,
                      ),
                    ),
                    const Spacer(),
                    IconButton(
                      icon: Icon(Icons.share_outlined, size: 18, color: isDark ? Colors.white60 : Colors.black54),
                      onPressed: () {
                        ShareSheet.show(
                          context,
                          title: debate.title,
                          content: debate.resolution,
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
