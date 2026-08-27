import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../models/question_model.dart';
import '../models/answer_model.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../widgets/auth_prompt_sheet.dart';
import '../widgets/reputation_chip.dart';
import '../widgets/verification_badge.dart';
import '../widgets/share_sheet.dart';
import 'other_profile.dart';
import 'topic_screen.dart';

class QuestionDetailScreen extends StatefulWidget {
  final String questionId;

  const QuestionDetailScreen({Key? key, required this.questionId}) : super(key: key);

  @override
  State<QuestionDetailScreen> createState() => _QuestionDetailScreenState();
}

class _QuestionDetailScreenState extends State<QuestionDetailScreen> {
  QuestionModel? _question;
  List<AnswerModel> _answers = [];
  bool _isLoading = true;
  String? _errorMessage;
  final TextEditingController _answerController = TextEditingController();
  bool _isSubmittingAnswer = false;

  @override
  void initState() {
    super.initState();
    _fetchQuestionAndAnswers();
  }

  @override
  void dispose() {
    _answerController.dispose();
    super.dispose();
  }

  Future<void> _fetchQuestionAndAnswers() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final res = await ApiService.get('/question/${widget.questionId}');
      final data = json.decode(res.body);

      if (res.statusCode == 200 && data['success'] == true) {
        setState(() {
          _question = QuestionModel.fromJson(data['question']);
          _answers = (data['answers'] as List? ?? [])
              .map((item) => AnswerModel.fromJson(item))
              .toList();
          _isLoading = false;
        });
      } else {
        setState(() {
          _errorMessage = data['message'] ?? 'Failed to load question';
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Network error loading question details';
        _isLoading = false;
      });
    }
  }

  Future<void> _submitAnswer() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (!auth.isAuthenticated) {
      AuthPrompt.show(
        context,
        title: 'Answer Question',
        message: 'Log in to contribute your knowledge and earn reputation.',
        icon: Icons.lightbulb_outline,
      );
      return;
    }

    final content = _answerController.text.trim();
    if (content.length < 10) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Answer must be at least 10 characters long.')),
      );
      return;
    }

    setState(() => _isSubmittingAnswer = true);

    try {
      final res = await ApiService.post('/question/${widget.questionId}/answer', {
        'content': content,
      });
      final data = json.decode(res.body);

      if (res.statusCode == 201 && data['success'] == true) {
        _answerController.clear();
        FocusScope.of(context).unfocus();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Answer posted successfully! (+5 Reputation)')),
        );
        _fetchQuestionAndAnswers();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(data['message'] ?? 'Failed to post answer')),
        );
      }
    } catch (_) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Network error posting answer.')),
      );
    } finally {
      setState(() => _isSubmittingAnswer = false);
    }
  }

  Future<void> _acceptAnswer(String answerId) async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (!auth.isAuthenticated) return;

    try {
      final res = await ApiService.post('/question/${widget.questionId}/accept/$answerId', {});
      final data = json.decode(res.body);
      if (res.statusCode == 200 && data['success'] == true) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Answer accepted as best solution!')),
        );
        _fetchQuestionAndAnswers();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(data['message'] ?? 'Failed to accept answer')),
        );
      }
    } catch (_) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Error accepting answer')),
      );
    }
  }

  Future<void> _voteAnswer(String answerId, String voteType) async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (!auth.isAuthenticated) {
      AuthPrompt.show(
        context,
        title: 'Vote on Answer',
        message: 'Log in to rate answers and help good content rise to the top.',
      );
      return;
    }

    try {
      final res = await ApiService.post('/question/answer/$answerId/vote', {
        'voteType': voteType,
      });
      if (res.statusCode == 200) {
        _fetchQuestionAndAnswers();
      }
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final primaryColor = Theme.of(context).primaryColor;
    final currentUserId = Provider.of<AuthProvider>(context).currentUser?.id;

    if (_isLoading) {
      return Scaffold(
        appBar: AppBar(title: const Text('Question')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    if (_errorMessage != null || _question == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Question')),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(_errorMessage ?? 'Question not found'),
              const SizedBox(height: 12),
              ElevatedButton(
                onPressed: _fetchQuestionAndAnswers,
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    final isAuthor = currentUserId != null && currentUserId == _question!.author.id;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Question',
          style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w700),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.share_outlined),
            onPressed: () {
              ShareSheet.show(
                context,
                title: _question!.title,
                content: _question!.description,
              );
            },
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: RefreshIndicator(
              onRefresh: _fetchQuestionAndAnswers,
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Author info
                    Row(
                      children: [
                        GestureDetector(
                          onTap: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => OtherProfileScreen(userId: _question!.author.id),
                              ),
                            );
                          },
                          child: CircleAvatar(
                            radius: 20,
                            backgroundImage: _question!.author.profileImage != null &&
                                    _question!.author.profileImage!.isNotEmpty
                                ? NetworkImage(_question!.author.profileImage!)
                                : null,
                            child: _question!.author.profileImage == null ||
                                    _question!.author.profileImage!.isEmpty
                                ? Text(_question!.author.username[0].toUpperCase())
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
                                  Text(
                                    _question!.author.username,
                                    style: GoogleFonts.plusJakartaSans(
                                      fontWeight: FontWeight.w700,
                                      fontSize: 14,
                                    ),
                                  ),
                                  if (_question!.author.isverified)
                                    VerificationBadge(
                                      category: _question!.author.verificationCategory,
                                      size: 14,
                                    ),
                                  const SizedBox(width: 6),
                                  ReputationChip(
                                    score: _question!.author.reputationScore,
                                    level: _question!.author.reputationLevel,
                                    compact: true,
                                  ),
                                ],
                              ),
                              Text(
                                'Asked on ${DateFormat.yMMMd().format(_question!.createdAt)}',
                                style: TextStyle(
                                  fontSize: 11,
                                  color: isDark ? Colors.white54 : Colors.black45,
                                ),
                              ),
                            ],
                          ),
                        ),
                        if (_question!.hasAcceptedAnswer)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: const Color(0xFF4CAF50).withOpacity(0.15),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: const Color(0xFF4CAF50)),
                            ),
                            child: const Row(
                              children: [
                                Icon(Icons.check_circle, size: 13, color: Color(0xFF4CAF50)),
                                SizedBox(width: 4),
                                Text(
                                  'Solved',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                    color: Color(0xFF4CAF50),
                                  ),
                                ),
                              ],
                            ),
                          ),
                      ],
                    ),

                    const SizedBox(height: 16),

                    // Title
                    Text(
                      _question!.title,
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                        height: 1.3,
                      ),
                    ),

                    const SizedBox(height: 12),

                    // Description
                    if (_question!.description.isNotEmpty)
                      Text(
                        _question!.description,
                        style: TextStyle(
                          fontSize: 15,
                          height: 1.5,
                          color: isDark ? Colors.white70 : Colors.black87,
                        ),
                      ),

                    const SizedBox(height: 14),

                    // Topics
                    if (_question!.topics.isNotEmpty)
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: _question!.topics.map((t) {
                          return GestureDetector(
                            onTap: () {
                              Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => TopicScreen(
                                    slug: t.slug.isNotEmpty ? t.slug : t.name.toLowerCase(),
                                    initialTopic: t,
                                  ),
                                ),
                              );
                            },
                            child: Chip(
                              label: Text('#${t.name}'),
                              backgroundColor: primaryColor.withOpacity(0.08),
                              labelStyle: TextStyle(fontSize: 12, color: primaryColor),
                              padding: EdgeInsets.zero,
                            ),
                          );
                        }).toList(),
                      ),

                    const Divider(height: 32),

                    // Answers Section Header
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          '${_answers.length} Answers',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 17,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 12),

                    // Answers List
                    if (_answers.isEmpty)
                      Center(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 24.0),
                          child: Text(
                            'No answers yet. Be the first to answer!',
                            style: TextStyle(color: isDark ? Colors.white54 : Colors.black45),
                          ),
                        ),
                      )
                    else
                      ..._answers.map((ans) {
                        final isAnsAccepted = ans.isAccepted;
                        return Container(
                          margin: const EdgeInsets.only(bottom: 14),
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: isDark ? const Color(0xFF1E1E2C) : Colors.white,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(
                              color: isAnsAccepted
                                  ? const Color(0xFF4CAF50)
                                  : (isDark ? Colors.white10 : Colors.black12),
                              width: isAnsAccepted ? 1.5 : 1,
                            ),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  CircleAvatar(
                                    radius: 14,
                                    backgroundImage: ans.author.profileImage != null &&
                                            ans.author.profileImage!.isNotEmpty
                                        ? NetworkImage(ans.author.profileImage!)
                                        : null,
                                    child: ans.author.profileImage == null ||
                                            ans.author.profileImage!.isEmpty
                                        ? Text(ans.author.username[0].toUpperCase(), style: const TextStyle(fontSize: 10))
                                        : null,
                                  ),
                                  const SizedBox(width: 8),
                                  Text(
                                    ans.author.username,
                                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                                  ),
                                  if (ans.author.isverified)
                                    VerificationBadge(category: ans.author.verificationCategory, size: 12),
                                  const SizedBox(width: 4),
                                  ReputationChip(
                                    score: ans.author.reputationScore,
                                    level: ans.author.reputationLevel,
                                    compact: true,
                                  ),
                                  const Spacer(),
                                  if (isAnsAccepted)
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFF4CAF50).withOpacity(0.15),
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: const Row(
                                        children: [
                                          Icon(Icons.check, color: Color(0xFF4CAF50), size: 12),
                                          SizedBox(width: 3),
                                          Text(
                                            'Accepted',
                                            style: TextStyle(
                                              fontSize: 10,
                                              fontWeight: FontWeight.bold,
                                              color: Color(0xFF4CAF50),
                                            ),
                                          ),
                                        ],
                                      ),
                                    )
                                  else if (isAuthor && !_question!.hasAcceptedAnswer)
                                    TextButton.icon(
                                      onPressed: () => _acceptAnswer(ans.id),
                                      icon: const Icon(Icons.check_circle_outline, size: 14),
                                      label: const Text('Accept', style: TextStyle(fontSize: 11)),
                                    ),
                                ],
                              ),
                              const SizedBox(height: 10),
                              Text(
                                ans.content,
                                style: const TextStyle(fontSize: 14, height: 1.45),
                              ),
                              const SizedBox(height: 10),
                              Row(
                                children: [
                                  IconButton(
                                    icon: const Icon(Icons.arrow_upward, size: 16),
                                    visualDensity: VisualDensity.compact,
                                    onPressed: () => _voteAnswer(ans.id, 'upvote'),
                                  ),
                                  Text(
                                    '${ans.score}',
                                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                                  ),
                                  IconButton(
                                    icon: const Icon(Icons.arrow_downward, size: 16),
                                    visualDensity: VisualDensity.compact,
                                    onPressed: () => _voteAnswer(ans.id, 'downvote'),
                                  ),
                                  const Spacer(),
                                  Text(
                                    DateFormat.yMMMd().format(ans.createdAt),
                                    style: TextStyle(fontSize: 11, color: isDark ? Colors.white54 : Colors.black45),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        );
                      }),
                  ],
                ),
              ),
            ),
          ),

          // Bottom Answer Input Bar
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF1E1E2C) : Colors.white,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.05),
                  blurRadius: 8,
                  offset: const Offset(0, -2),
                ),
              ],
            ),
            child: SafeArea(
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _answerController,
                      maxLines: 3,
                      minLines: 1,
                      decoration: InputDecoration(
                        hintText: 'Write your answer...',
                        filled: true,
                        fillColor: isDark ? Colors.white.withOpacity(0.06) : Colors.grey.shade100,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(20),
                          borderSide: BorderSide.none,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton(
                    icon: _isSubmittingAnswer
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : Icon(Icons.send_rounded, color: primaryColor),
                    onPressed: _isSubmittingAnswer ? null : _submitAnswer,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
