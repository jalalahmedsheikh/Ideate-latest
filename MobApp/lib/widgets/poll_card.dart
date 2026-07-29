import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../models/poll_model.dart';
import '../providers/auth_provider.dart';
import '../screens/other_profile.dart';
import '../services/api_service.dart';
import '../widgets/post_card.dart'; // import extension CopyWithBookmarks

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
    final currentUserId = Provider.of<AuthProvider>(context, listen: false).currentUser?.id;
    _isBookmarked = Provider.of<AuthProvider>(context, listen: false)
            .currentUser
            ?.bookmarks
            .contains(widget.poll.id) ??
        false;

    // Check if user voted in history
    final voteRecord = widget.poll.votesHistory.firstWhere(
      (v) => v.userId == currentUserId,
      orElse: () => PollVoteHistory(userId: '', optionIndex: -1),
    );

    if (voteRecord.optionIndex != -1) {
      _hasVoted = true;
      _selectedOptionIndex = voteRecord.optionIndex;
    }

    _votes = List.from(widget.poll.votes);
    _totalVotes = _votes.fold(0, (sum, count) => sum + count);
  }

  Future<void> _castVote(int optionIndex) async {
    if (_hasVoted || _isVoting) return;

    setState(() {
      _isVoting = true;
    });

    try {
      final response = await ApiService.post('/poll/${widget.poll.id}/vote', {
        'optionIndex': optionIndex,
      });

      final data = json.decode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        setState(() {
          _hasVoted = true;
          _selectedOptionIndex = optionIndex;
          _votes[optionIndex] = _votes[optionIndex] + 1;
          _totalVotes = _totalVotes + 1;
        });

        if (widget.onRefresh != null) {
          widget.onRefresh!();
        }
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(data['message'] ?? 'Failed to cast vote.')),
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Connection error casting vote.')),
      );
    } finally {
      setState(() {
        _isVoting = false;
      });
    }
  }

  Future<void> _toggleBookmark() async {
    final originalBookmarked = _isBookmarked;

    setState(() {
      _isBookmarked = !_isBookmarked;
    });

    try {
      final response = await ApiService.post('/poll/${widget.poll.id}/savepoll', {});
      final data = json.decode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        final authProvider = Provider.of<AuthProvider>(context, listen: false);
        final currentUser = authProvider.currentUser;
        if (currentUser != null) {
          final updatedBookmarks = List<String>.from(currentUser.bookmarks);
          if (_isBookmarked) {
            updatedBookmarks.add(widget.poll.id);
          } else {
            updatedBookmarks.remove(widget.poll.id);
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
    if (widget.poll.author.id == currentUserId) return;
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => OtherProfileScreen(userId: widget.poll.author.id),
      ),
    ).then((_) {
      if (widget.onRefresh != null) {
        widget.onRefresh!();
      }
    });
  }

  Future<void> _deletePoll() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1E1E2C),
        title: const Text('Delete Poll', style: TextStyle(color: Colors.white)),
        content: const Text('Are you sure you want to delete this poll?', style: TextStyle(color: Color(0xFF8D8D99))),
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
      final response = await ApiService.delete('/poll/${widget.poll.id}');
      if (response.statusCode == 200) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Poll deleted successfully.')),
        );
        if (widget.onRefresh != null) {
          widget.onRefresh!();
        }
      } else {
        final data = json.decode(response.body);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(data['message'] ?? 'Failed to delete poll.')),
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Connection error deleting poll.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final currentUserId = Provider.of<AuthProvider>(context).currentUser?.id;
    final showResults = _hasVoted || widget.poll.author.id == currentUserId;

    return Card(
      margin: const EdgeInsets.symmetric(vertical: 8),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header Profile Info
            Row(
              children: [
                Expanded(
                  child: GestureDetector(
                    onTap: _navigateToProfile,
                    child: Row(
                      children: [
                        CircleAvatar(
                          radius: 20,
                          backgroundImage: widget.poll.author.profileImage != null
                              ? NetworkImage(widget.poll.author.profileImage!)
                              : null,
                          child: widget.poll.author.profileImage == null
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
                                    widget.poll.author.username.isEmpty
                                        ? 'User'
                                        : widget.poll.author.username,
                                    style: GoogleFonts.inter(
                                      fontWeight: FontWeight.bold,
                                      color: Colors.white,
                                      fontSize: 15,
                                    ),
                                  ),
                                  if (widget.poll.author.isverified) ...[
                                    const SizedBox(width: 4),
                                    const Icon(Icons.verified, color: Colors.blue, size: 16),
                                  ],
                                ],
                              ),
                              Text(
                                _formatTime(widget.poll.createdAt),
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
                      _deletePoll();
                    } else if (value == 'report') {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Reported successfully.')),
                      );
                    }
                  },
                  itemBuilder: (BuildContext context) {
                    final currentUserId = Provider.of<AuthProvider>(context, listen: false).currentUser?.id;
                    final isOwner = widget.poll.author.id == currentUserId;
                    return [
                      if (isOwner)
                        const PopupMenuItem<String>(
                          value: 'delete',
                          child: Row(
                            children: [
                              Icon(Icons.delete, color: Colors.red, size: 20),
                              SizedBox(width: 8),
                              Text('Delete Poll', style: TextStyle(color: Colors.red)),
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
                              Text('Report Poll', style: TextStyle(color: Colors.white)),
                            ],
                          ),
                        ),
                    ];
                  },
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Question
            Text(
              widget.poll.question,
              style: GoogleFonts.outfit(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 16),

            // Options list
            Column(
              children: List.generate(widget.poll.options.length, (index) {
                final option = widget.poll.options[index];
                final voteCount = _votes[index];
                final percent = _totalVotes > 0 ? (voteCount / _totalVotes) : 0.0;
                final percentText = '${(percent * 100).toStringAsFixed(1)}%';
                final isSelected = _selectedOptionIndex == index;

                if (showResults) {
                  // Show animated result progress bar
                  return Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    height: 52,
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E1E2C),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: isSelected ? const Color(0xFF7828B4) : const Color(0xFF2C2C3E),
                        width: isSelected ? 2 : 1,
                      ),
                    ),
                    child: Stack(
                      children: [
                        // Percent bar
                        FractionallySizedBox(
                          widthFactor: percent,
                          child: Container(
                            decoration: BoxDecoration(
                              color: const Color(0xFF7828B4).withOpacity(0.2),
                              borderRadius: BorderRadius.circular(10),
                            ),
                          ),
                        ),
                        // Label and percent text
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                option,
                                style: GoogleFonts.inter(
                                  fontSize: 15,
                                  fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                                  color: Colors.white,
                                ),
                              ),
                              Text(
                                '$percentText ($voteCount)',
                                style: GoogleFonts.inter(
                                  fontSize: 14,
                                  color: isSelected ? const Color(0xFF7828B4) : Colors.grey,
                                  fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  );
                } else {
                  // Interactive select option
                  return Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    width: double.infinity,
                    height: 52,
                    child: OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        side: const BorderSide(color: Color(0xFF2C2C3E)),
                        alignment: Alignment.centerLeft,
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                      ),
                      onPressed: () => _castVote(index),
                      child: Text(
                        option,
                        style: GoogleFonts.inter(
                          fontSize: 15,
                          color: const Color(0xFFE1E1E6),
                        ),
                      ),
                    ),
                  );
                }
              }),
            ),

            const SizedBox(height: 8),

            // Footer statistics & bookmark button
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '$_totalVotes Votes',
                  style: GoogleFonts.inter(color: Colors.grey, fontSize: 13),
                ),
                IconButton(
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                  icon: Icon(
                    _isBookmarked ? Icons.bookmark : Icons.bookmark_border,
                    color: _isBookmarked ? const Color(0xFF7828B4) : Colors.white,
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
