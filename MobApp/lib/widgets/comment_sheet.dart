import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../models/post_model.dart';
import '../services/api_service.dart';

class CommentSheet extends StatefulWidget {
  final String postId;
  final List<CommentModel> initialComments;
  final VoidCallback onCommentAdded;

  const CommentSheet({
    super.key,
    required this.postId,
    required this.initialComments,
    required this.onCommentAdded,
  });

  @override
  State<CommentSheet> createState() => _CommentSheetState();
}

class _CommentSheetState extends State<CommentSheet> {
  final TextEditingController _commentController = TextEditingController();
  late List<CommentModel> _comments;
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _comments = List.from(widget.initialComments);
  }

  Future<void> _submitComment() async {
    final text = _commentController.text.trim();
    if (text.isEmpty) return;

    setState(() {
      _isSubmitting = true;
    });

    try {
      final response = await ApiService.post('/post/${widget.postId}/comment', {
        'text': text,
      });

      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = json.decode(response.body);
        if (data['success'] == true) {
          final newComment = CommentModel.fromJson(data['comment']);
          setState(() {
            _comments.add(newComment);
            _commentController.clear();
          });
          widget.onCommentAdded();
        }
      }
    } catch (e) {
      debugPrint("Error submitting comment: $e");
    } finally {
      setState(() {
        _isSubmitting = false;
      });
    }
  }

  String _formatTime(DateTime dt) {
    return DateFormat.yMMMd().add_jm().format(dt.toLocal());
  }

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Container(
        height: MediaQuery.of(context).size.height * 0.6,
        decoration: const BoxDecoration(
          color: Color(0xFF0B0B0F),
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          border: Border(
            top: BorderSide(color: Color(0xFF2C2C3E), width: 1),
          ),
        ),
        child: Column(
          children: [
            // Top Notch handle
            Container(
              margin: const EdgeInsets.symmetric(vertical: 12),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFF4C4C5E),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            
            // Header
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Text(
                'Comments (${_comments.length})',
                style: GoogleFonts.outfit(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
            ),
            const Divider(color: Color(0xFF2C2C3E)),

            // Comments List
            Expanded(
              child: _comments.isEmpty
                  ? Center(
                      child: Text(
                        'No comments yet. Start the conversation!',
                        style: GoogleFonts.inter(color: Colors.grey),
                      ),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      itemCount: _comments.length,
                      itemBuilder: (context, index) {
                        final comment = _comments[index];
                        return Container(
                          margin: const EdgeInsets.only(bottom: 12),
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: const Color(0xFF181824),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: const Color(0xFF2C2C3E)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  CircleAvatar(
                                    radius: 14,
                                    backgroundImage: comment.author.profileImage != null
                                        ? NetworkImage(comment.author.profileImage!)
                                        : null,
                                    child: comment.author.profileImage == null
                                        ? const Icon(Icons.person, size: 14)
                                        : null,
                                  ),
                                  const SizedBox(width: 8),
                                  Text(
                                    comment.author.username,
                                    style: GoogleFonts.inter(
                                      fontWeight: FontWeight.bold,
                                      color: Colors.white,
                                    ),
                                  ),
                                  if (comment.author.isverified) ...[
                                    const SizedBox(width: 4),
                                    const Icon(Icons.verified, color: Colors.blue, size: 14),
                                  ],
                                  const Spacer(),
                                  Text(
                                    _formatTime(comment.createdAt),
                                    style: GoogleFonts.inter(
                                      fontSize: 11,
                                      color: Colors.grey,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text(
                                comment.content,
                                style: GoogleFonts.inter(
                                  fontSize: 14,
                                  color: const Color(0xFFE1E1E6),
                                ),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
            ),

            // Submit input bar
            Container(
              padding: const EdgeInsets.all(16),
              decoration: const BoxDecoration(
                color: Color(0xFF12121E),
                border: Border(
                  top: BorderSide(color: Color(0xFF2C2C3E)),
                ),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _commentController,
                      style: GoogleFonts.inter(color: Colors.white),
                      decoration: const InputDecoration(
                        hintText: 'Add a comment...',
                        contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      ),
                      maxLines: null,
                    ),
                  ),
                  const SizedBox(width: 12),
                  _isSubmitting
                      ? const CircularProgressIndicator(color: Color(0xFF7828B4))
                      : IconButton(
                          onPressed: _submitComment,
                          icon: const Icon(Icons.send),
                          color: const Color(0xFF7828B4),
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
