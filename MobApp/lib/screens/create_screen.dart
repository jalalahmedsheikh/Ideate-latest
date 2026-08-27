import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../models/topic_model.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../utils/app_colors.dart';
import '../widgets/custom_button.dart';
import '../widgets/guest_state_card.dart';

class CreateScreen extends StatefulWidget {
  const CreateScreen({super.key});

  @override
  State<CreateScreen> createState() => _CreateScreenState();
}

class _CreateScreenState extends State<CreateScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  // Topics
  List<TopicModel> _availableTopics = [];
  final List<String> _selectedTopicIds = [];

  // Post fields
  final _postFormKey = GlobalKey<FormState>();
  final _captionController = TextEditingController();
  bool _isPublishingPost = false;

  // Question fields
  final _questionFormKey = GlobalKey<FormState>();
  final _qTitleController = TextEditingController();
  final _qDescController = TextEditingController();
  bool _isPublishingQuestion = false;

  // Debate fields
  final _debateFormKey = GlobalKey<FormState>();
  final _debateTitleController = TextEditingController();
  final _debateResolutionController = TextEditingController();
  final _sideAController = TextEditingController(text: 'Supporting Side');
  final _sideBController = TextEditingController(text: 'Opposing Side');
  bool _enableNeutral = true;
  int _debateDurationHours = 48;
  bool _isPublishingDebate = false;

  // Poll fields
  final _pollFormKey = GlobalKey<FormState>();
  final _pollQuestionController = TextEditingController();
  final List<TextEditingController> _optionControllers = [
    TextEditingController(text: 'Option 1'),
    TextEditingController(text: 'Option 2'),
  ];
  String _pollType = 'single_choice';
  bool _allowVoteChange = true;
  bool _isPublishingPoll = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    _fetchTopics();
  }

  Future<void> _fetchTopics() async {
    try {
      final response = await ApiService.get('/topic/all?limit=20');
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['success'] == true && data['topics'] != null) {
          final List fetched = data['topics'];
          setState(() {
            _availableTopics = fetched.map((t) => TopicModel.fromJson(t)).toList();
          });
        }
      }
    } catch (_) {}
  }

  @override
  void dispose() {
    _tabController.dispose();
    _captionController.dispose();
    _qTitleController.dispose();
    _qDescController.dispose();
    _debateTitleController.dispose();
    _debateResolutionController.dispose();
    _sideAController.dispose();
    _sideBController.dispose();
    _pollQuestionController.dispose();
    for (var c in _optionControllers) {
      c.dispose();
    }
    super.dispose();
  }

  // ── Publish Post / Idea ──
  Future<void> _publishPost() async {
    if (!_postFormKey.currentState!.validate()) return;
    setState(() => _isPublishingPost = true);

    try {
      final res = await ApiService.post('/post/create', {
        'caption': _captionController.text.trim(),
        'topics': _selectedTopicIds,
      });
      final data = json.decode(res.body);

      if (res.statusCode == 201 && data['success'] == true) {
        _captionController.clear();
        setState(() => _selectedTopicIds.clear());
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Idea published to the stream! (+5 Rep)')),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(data['message'] ?? 'Failed to create post')),
        );
      }
    } catch (_) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Network error publishing idea')),
      );
    } finally {
      setState(() => _isPublishingPost = false);
    }
  }

  // ── Publish Question ──
  Future<void> _publishQuestion() async {
    if (!_questionFormKey.currentState!.validate()) return;
    setState(() => _isPublishingQuestion = true);

    try {
      final res = await ApiService.post('/question', {
        'title': _qTitleController.text.trim(),
        'description': _qDescController.text.trim(),
        'topics': _selectedTopicIds,
      });
      final data = json.decode(res.body);

      if (res.statusCode == 201 && data['success'] == true) {
        _qTitleController.clear();
        _qDescController.clear();
        setState(() => _selectedTopicIds.clear());
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Question published successfully! (+5 Rep)')),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(data['message'] ?? 'Failed to post question')),
        );
      }
    } catch (_) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Network error publishing question')),
      );
    } finally {
      setState(() => _isPublishingQuestion = false);
    }
  }

  // ── Publish Debate ──
  Future<void> _publishDebate() async {
    if (!_debateFormKey.currentState!.validate()) return;
    setState(() => _isPublishingDebate = true);

    try {
      final res = await ApiService.post('/debate', {
        'title': _debateTitleController.text.trim(),
        'resolution': _debateResolutionController.text.trim(),
        'sideA': {'label': _sideAController.text.trim()},
        'sideB': {'label': _sideBController.text.trim()},
        'neutral': {'enabled': _enableNeutral, 'label': 'Nuanced / Neutral'},
        'durationHours': _debateDurationHours,
        'topics': _selectedTopicIds,
      });
      final data = json.decode(res.body);

      if (res.statusCode == 201 && data['success'] == true) {
        _debateTitleController.clear();
        _debateResolutionController.clear();
        setState(() => _selectedTopicIds.clear());
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Structured Debate opened! (+10 Rep)')),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(data['message'] ?? 'Failed to open debate')),
        );
      }
    } catch (_) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Network error creating debate')),
      );
    } finally {
      setState(() => _isPublishingDebate = false);
    }
  }

  // ── Publish Poll ──
  Future<void> _publishPoll() async {
    if (!_pollFormKey.currentState!.validate()) return;
    final options = _optionControllers.map((c) => c.text.trim()).where((t) => t.isNotEmpty).toList();
    if (options.length < 2) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please add at least 2 poll options.')),
      );
      return;
    }

    setState(() => _isPublishingPoll = true);

    try {
      final res = await ApiService.post('/poll/create', {
        'question': _pollQuestionController.text.trim(),
        'options': options,
        'pollType': _pollType,
        'settings': {
          'allowVoteChange': _allowVoteChange,
          'minSelections': 1,
          'maxSelections': _pollType == 'multiple_choice' ? options.length : 1,
        },
        'topics': _selectedTopicIds,
      });
      final data = json.decode(res.body);

      if (res.statusCode == 201 && data['success'] == true) {
        _pollQuestionController.clear();
        setState(() => _selectedTopicIds.clear());
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Poll launched successfully! (+5 Rep)')),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(data['message'] ?? 'Failed to launch poll')),
        );
      }
    } catch (_) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Network error creating poll')),
      );
    } finally {
      setState(() => _isPublishingPoll = false);
    }
  }

  Widget _buildTopicSelector(bool isDark) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Tag Topics',
          style: GoogleFonts.plusJakartaSans(
            fontSize: 14,
            fontWeight: FontWeight.w700,
            color: isDark ? Colors.white70 : Colors.black87,
          ),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: _availableTopics.map((topic) {
            final isSelected = _selectedTopicIds.contains(topic.id);
            return FilterChip(
              label: Text('#${topic.name}'),
              selected: isSelected,
              selectedColor: Theme.of(context).primaryColor.withOpacity(0.2),
              onSelected: (selected) {
                setState(() {
                  if (selected) {
                    _selectedTopicIds.add(topic.id);
                  } else {
                    _selectedTopicIds.remove(topic.id);
                  }
                });
              },
            );
          }).toList(),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final primaryColor = Theme.of(context).primaryColor;

    if (!auth.isAuthenticated) {
      return Scaffold(
        appBar: AppBar(
          title: Text('Ideate Studio', style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w800)),
        ),
        body: const Center(
          child: GuestStateCard(
            title: 'Join the Ideate Ecosystem',
            description: 'Create accounts to publish ideas, open structured debates, ask deep questions, and build your reputation.',
            icon: Icons.create_rounded,
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Ideate Studio',
          style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w800),
        ),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: primaryColor,
          labelColor: primaryColor,
          unselectedLabelColor: isDark ? Colors.white54 : Colors.black45,
          tabs: const [
            Tab(text: 'Idea'),
            Tab(text: 'Question'),
            Tab(text: 'Debate'),
            Tab(text: 'Poll'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          // ── 1. Idea Tab ──
          SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Form(
              key: _postFormKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  TextFormField(
                    controller: _captionController,
                    maxLines: 6,
                    decoration: InputDecoration(
                      hintText: 'Share a thesis, insight, or observation...',
                      filled: true,
                      fillColor: isDark ? Colors.white10 : Colors.grey.shade100,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
                    ),
                    validator: (v) => (v == null || v.trim().length < 5) ? 'Idea must be at least 5 characters.' : null,
                  ),
                  const SizedBox(height: 16),
                  _buildTopicSelector(isDark),
                  const SizedBox(height: 24),
                  AppButton(
                    text: 'Publish Idea',
                    isLoading: _isPublishingPost,
                    onPressed: _publishPost,
                  ),
                ],
              ),
            ),
          ),

          // ── 2. Question Tab ──
          SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Form(
              key: _questionFormKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  TextFormField(
                    controller: _qTitleController,
                    decoration: InputDecoration(
                      labelText: 'Question Title',
                      hintText: 'What is the core question?',
                      filled: true,
                      fillColor: isDark ? Colors.white10 : Colors.grey.shade100,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                    ),
                    validator: (v) => (v == null || v.trim().length < 8) ? 'Title must be at least 8 characters.' : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _qDescController,
                    maxLines: 4,
                    decoration: InputDecoration(
                      labelText: 'Context & Background (Optional)',
                      hintText: 'Provide details, references, or constraints...',
                      filled: true,
                      fillColor: isDark ? Colors.white10 : Colors.grey.shade100,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                    ),
                  ),
                  const SizedBox(height: 16),
                  _buildTopicSelector(isDark),
                  const SizedBox(height: 24),
                  AppButton(
                    text: 'Ask Question',
                    isLoading: _isPublishingQuestion,
                    onPressed: _publishQuestion,
                  ),
                ],
              ),
            ),
          ),

          // ── 3. Debate Tab ──
          SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Form(
              key: _debateFormKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  TextFormField(
                    controller: _debateTitleController,
                    decoration: InputDecoration(
                      labelText: 'Debate Topic / Proposition',
                      hintText: 'e.g. Monolith vs Microservices for Startups',
                      filled: true,
                      fillColor: isDark ? Colors.white10 : Colors.grey.shade100,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                    ),
                    validator: (v) => (v == null || v.trim().length < 6) ? 'Topic title required.' : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _debateResolutionController,
                    maxLines: 2,
                    decoration: InputDecoration(
                      labelText: 'Formal Resolution Statement',
                      hintText: 'e.g. Startups should always launch with a modular monolith.',
                      filled: true,
                      fillColor: isDark ? Colors.white10 : Colors.grey.shade100,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                    ),
                    validator: (v) => (v == null || v.trim().length < 10) ? 'Resolution statement required.' : null,
                  ),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Expanded(
                        child: TextFormField(
                          controller: _sideAController,
                          decoration: InputDecoration(
                            labelText: 'Side A Label',
                            filled: true,
                            fillColor: isDark ? Colors.white10 : Colors.grey.shade100,
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                          ),
                          validator: (v) => (v == null || v.trim().isEmpty) ? 'Side A required' : null,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextFormField(
                          controller: _sideBController,
                          decoration: InputDecoration(
                            labelText: 'Side B Label',
                            filled: true,
                            fillColor: isDark ? Colors.white10 : Colors.grey.shade100,
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                          ),
                          validator: (v) => (v == null || v.trim().isEmpty) ? 'Side B required' : null,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  SwitchListTile(
                    title: const Text('Include Neutral / Nuanced Position'),
                    value: _enableNeutral,
                    onChanged: (v) => setState(() => _enableNeutral = v),
                  ),
                  const SizedBox(height: 14),
                  _buildTopicSelector(isDark),
                  const SizedBox(height: 24),
                  AppButton(
                    text: 'Open Structured Debate',
                    isLoading: _isPublishingDebate,
                    onPressed: _publishDebate,
                  ),
                ],
              ),
            ),
          ),

          // ── 4. Poll Tab ──
          SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Form(
              key: _pollFormKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  TextFormField(
                    controller: _pollQuestionController,
                    decoration: InputDecoration(
                      labelText: 'Poll Question',
                      hintText: 'What would you like to poll the community on?',
                      filled: true,
                      fillColor: isDark ? Colors.white10 : Colors.grey.shade100,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                    ),
                    validator: (v) => (v == null || v.trim().length < 5) ? 'Question required.' : null,
                  ),
                  const SizedBox(height: 14),
                  Text('Poll Options', style: TextStyle(fontWeight: FontWeight.bold, color: isDark ? Colors.white70 : Colors.black87)),
                  const SizedBox(height: 8),
                  ...List.generate(_optionControllers.length, (index) {
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8.0),
                      child: Row(
                        children: [
                          Expanded(
                            child: TextFormField(
                              controller: _optionControllers[index],
                              decoration: InputDecoration(
                                hintText: 'Option ${index + 1}',
                                filled: true,
                                fillColor: isDark ? Colors.white10 : Colors.grey.shade100,
                                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                              ),
                            ),
                          ),
                          if (_optionControllers.length > 2)
                            IconButton(
                              icon: const Icon(Icons.remove_circle_outline, color: Colors.red),
                              onPressed: () {
                                setState(() {
                                  _optionControllers.removeAt(index);
                                });
                              },
                            ),
                        ],
                      ),
                    );
                  }),
                  if (_optionControllers.length < 6)
                    TextButton.icon(
                      icon: const Icon(Icons.add),
                      label: const Text('Add Option'),
                      onPressed: () {
                        setState(() {
                          _optionControllers.add(TextEditingController());
                        });
                      },
                    ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    value: _pollType,
                    decoration: InputDecoration(
                      labelText: 'Poll Type',
                      filled: true,
                      fillColor: isDark ? Colors.white10 : Colors.grey.shade100,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                    ),
                    items: const [
                      DropdownMenuItem(value: 'single_choice', child: Text('Single Choice')),
                      DropdownMenuItem(value: 'multiple_choice', child: Text('Multiple Choice')),
                      DropdownMenuItem(value: 'yes_no', child: Text('Yes / No')),
                      DropdownMenuItem(value: 'rating', child: Text('Rating (1 to 5)')),
                    ],
                    onChanged: (val) => setState(() => _pollType = val ?? 'single_choice'),
                  ),
                  const SizedBox(height: 14),
                  _buildTopicSelector(isDark),
                  const SizedBox(height: 24),
                  AppButton(
                    text: 'Launch Poll',
                    isLoading: _isPublishingPoll,
                    onPressed: _publishPoll,
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
