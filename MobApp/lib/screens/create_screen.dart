import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../services/api_service.dart';

import '../utils/app_colors.dart';
import '../widgets/custom_button.dart';

class CreateScreen extends StatefulWidget {
  const CreateScreen({super.key});

  @override
  State<CreateScreen> createState() => _CreateScreenState();
}

class _CreateScreenState extends State<CreateScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final _postFormKey = GlobalKey<FormState>();
  final _pollFormKey = GlobalKey<FormState>();

  // Post fields
  final _captionController = TextEditingController();
  bool _isPublishingPost = false;

  // Poll fields
  final _questionController = TextEditingController();
  final List<TextEditingController> _optionControllers = [
    TextEditingController(text: 'Option 1'),
    TextEditingController(text: 'Option 2'),
  ];
  bool _isPublishingPoll = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _captionController.dispose();
    _questionController.dispose();
    for (var controller in _optionControllers) {
      controller.dispose();
    }
    super.dispose();
  }

  void _addOption() {
    if (_optionControllers.length >= 5) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Maximum 5 options allowed.')),
      );
      return;
    }
    setState(() {
      _optionControllers.add(TextEditingController());
    });
  }

  void _removeOption(int index) {
    if (_optionControllers.length <= 2) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Minimum 2 options required.')),
      );
      return;
    }
    setState(() {
      final controller = _optionControllers.removeAt(index);
      controller.dispose();
    });
  }

  Future<void> _publishPost() async {
    if (!_postFormKey.currentState!.validate()) return;

    setState(() {
      _isPublishingPost = true;
    });

    try {
      final response = await ApiService.post('/post/addNewPost', {
        'caption': _captionController.text.trim(),
      });

      final data = json.decode(response.body);

      if (response.statusCode == 200 || response.statusCode == 201) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Post published successfully!'), backgroundColor: Colors.green),
        );
        _captionController.clear();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(data['message'] ?? 'Failed to publish post.')),
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Error connecting to server.')),
      );
    } finally {
      setState(() {
        _isPublishingPost = false;
      });
    }
  }

  Future<void> _publishPoll() async {
    if (!_pollFormKey.currentState!.validate()) return;

    // Filter out blank options
    final options = _optionControllers
        .map((c) => c.text.trim())
        .where((text) => text.isNotEmpty)
        .toList();

    if (options.length < 2) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please fill out at least 2 options.')),
      );
      return;
    }

    setState(() {
      _isPublishingPoll = true;
    });

    try {
      final response = await ApiService.post('/poll/createPoll', {
        'question': _questionController.text.trim(),
        'options': options,
      });

      final data = json.decode(response.body);

      if (response.statusCode == 200 || response.statusCode == 201) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Poll published successfully!'), backgroundColor: Colors.green),
        );
        _questionController.clear();
        setState(() {
          for (var controller in _optionControllers) {
            controller.dispose();
          }
          _optionControllers.clear();
          _optionControllers.add(TextEditingController(text: 'Option 1'));
          _optionControllers.add(TextEditingController(text: 'Option 2'));
        });
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(data['message'] ?? 'Failed to publish poll.')),
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Error connecting to server.')),
      );
    } finally {
      setState(() {
        _isPublishingPoll = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Create Idea',
          style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 22),
        ),
        backgroundColor: AppColors.background,
        elevation: 0,
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppColors.primary,
          indicatorWeight: 3,
          labelColor: Colors.white,
          unselectedLabelColor: AppColors.textMuted,
          dividerColor: AppColors.border,
          tabs: const [
            Tab(icon: Icon(Icons.edit_note), text: 'Write Post'),
            Tab(icon: Icon(Icons.poll_outlined), text: 'Create Poll'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          // Publish Post Form
          Form(
            key: _postFormKey,
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  TextFormField(
                    controller: _captionController,
                    maxLines: 8,
                    style: GoogleFonts.inter(color: Colors.white),
                    decoration: const InputDecoration(
                      hintText: "What is your idea? Explain in detail...",
                      alignLabelWithHint: true,
                    ),
                    validator: (v) => (v == null || v.isEmpty) ? 'Caption cannot be empty' : null,
                  ),
                  const SizedBox(height: 24),
                  AppButton(
                    text: 'Publish Post',
                    icon: Icons.send,
                    style: AppButtonStyle.gradient,
                    isLoading: _isPublishingPost,
                    onPressed: _publishPost,
                    height: 52,
                  ),
                ],
              ),
            ),
          ),

          // Publish Poll Form
          Form(
            key: _pollFormKey,
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  TextFormField(
                    controller: _questionController,
                    maxLines: 3,
                    style: GoogleFonts.inter(color: Colors.white),
                    decoration: const InputDecoration(
                      hintText: "Ask a question...",
                    ),
                    validator: (v) => (v == null || v.isEmpty) ? 'Question cannot be empty' : null,
                  ),
                  const SizedBox(height: 24),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Options (${_optionControllers.length}/5)',
                        style: GoogleFonts.outfit(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                      TextButton.icon(
                        onPressed: _addOption,
                        icon: const Icon(Icons.add, size: 18, color: AppColors.primary),
                        label: Text(
                          'Add Option',
                          style: GoogleFonts.inter(color: AppColors.primary, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Column(
                    children: List.generate(_optionControllers.length, (index) {
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Row(
                          children: [
                            Expanded(
                              child: TextFormField(
                                controller: _optionControllers[index],
                                style: GoogleFonts.inter(color: Colors.white),
                                decoration: InputDecoration(
                                  hintText: 'Option ${index + 1}',
                                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                                ),
                                validator: (v) => (v == null || v.isEmpty) ? 'Option cannot be empty' : null,
                              ),
                            ),
                            const SizedBox(width: 8),
                            IconButton(
                              onPressed: () => _removeOption(index),
                              icon: const Icon(Icons.delete_outline, color: AppColors.textMuted),
                            ),
                          ],
                        ),
                      );
                    }),
                  ),
                  const SizedBox(height: 24),
                  AppButton(
                    text: 'Publish Poll',
                    icon: Icons.send,
                    style: AppButtonStyle.gradient,
                    isLoading: _isPublishingPoll,
                    onPressed: _publishPoll,
                    height: 52,
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
