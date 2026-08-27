import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../services/api_service.dart';
import 'creator_analytics_screen.dart';

class CreatorHubScreen extends StatefulWidget {
  const CreatorHubScreen({Key? key}) : super(key: key);

  @override
  State<CreatorHubScreen> createState() => _CreatorHubScreenState();
}

class _CreatorHubScreenState extends State<CreatorHubScreen> {
  bool _isCreatorEnabled = false;
  bool _isLoading = true;
  bool _isSaving = false;

  final TextEditingController _introController = TextEditingController();
  final TextEditingController _expertiseInputController = TextEditingController();
  final TextEditingController _twitterController = TextEditingController();
  final TextEditingController _githubController = TextEditingController();
  final TextEditingController _linkedinController = TextEditingController();
  final TextEditingController _websiteController = TextEditingController();

  List<String> _expertise = [];

  @override
  void initState() {
    super.initState();
    _fetchCreatorProfile();
  }

  @override
  void dispose() {
    _introController.dispose();
    _expertiseInputController.dispose();
    _twitterController.dispose();
    _githubController.dispose();
    _linkedinController.dispose();
    _websiteController.dispose();
    super.dispose();
  }

  Future<void> _fetchCreatorProfile() async {
    setState(() => _isLoading = true);

    try {
      final res = await ApiService.get('/creator/profile/me');
      final data = json.decode(res.body);

      if (res.statusCode == 200 && data['success'] == true) {
        final profile = data['creatorProfile'] ?? {};
        setState(() {
          _isCreatorEnabled = profile['isCreatorEnabled'] ?? false;
          _introController.text = profile['intro'] ?? '';
          _expertise = List<String>.from(profile['expertise'] ?? []);
          final socials = profile['socialLinks'] ?? {};
          _twitterController.text = socials['twitter'] ?? '';
          _githubController.text = socials['github'] ?? '';
          _linkedinController.text = socials['linkedin'] ?? '';
          _websiteController.text = socials['website'] ?? '';
          _isLoading = false;
        });
      } else {
        setState(() => _isLoading = false);
      }
    } catch (_) {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _saveProfile() async {
    setState(() => _isSaving = true);

    try {
      final res = await ApiService.put('/creator/profile', {
        'isCreatorEnabled': _isCreatorEnabled,
        'intro': _introController.text.trim(),
        'expertise': _expertise,
        'socialLinks': {
          'twitter': _twitterController.text.trim(),
          'github': _githubController.text.trim(),
          'linkedin': _linkedinController.text.trim(),
          'website': _websiteController.text.trim(),
        },
      });

      final data = json.decode(res.body);
      if (res.statusCode == 200 && data['success'] == true) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Creator profile updated successfully!')),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(data['message'] ?? 'Failed to update profile')),
        );
      }
    } catch (_) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Network error saving creator profile')),
      );
    } finally {
      setState(() => _isSaving = false);
    }
  }

  void _addExpertiseTag() {
    final tag = _expertiseInputController.text.trim();
    if (tag.isNotEmpty && !_expertise.contains(tag)) {
      setState(() {
        _expertise.add(tag);
        _expertiseInputController.clear();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final primaryColor = Theme.of(context).primaryColor;

    if (_isLoading) {
      return Scaffold(
        appBar: AppBar(title: const Text('Creator Studio')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Creator Studio',
          style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w800),
        ),
        actions: [
          TextButton(
            onPressed: _isSaving ? null : _saveProfile,
            child: _isSaving
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Save', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Analytics Dashboard Entry Card
            Container(
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF6200EA), Color(0xFF9C27B0)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(18),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF6200EA).withOpacity(0.35),
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
                      MaterialPageRoute(builder: (_) => const CreatorAnalyticsScreen()),
                    );
                  },
                  child: const Padding(
                    padding: EdgeInsets.all(20.0),
                    child: Row(
                      children: [
                        Icon(Icons.auto_graph_rounded, color: Colors.white, size: 36),
                        SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'View Creator Analytics',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w800,
                                  fontSize: 17,
                                ),
                              ),
                              SizedBox(height: 4),
                              Text(
                                'Track reach, engagement rate, top content & deterministic growth insights.',
                                style: TextStyle(color: Colors.white70, fontSize: 12),
                              ),
                            ],
                          ),
                        ),
                        Icon(Icons.arrow_forward_ios_rounded, color: Colors.white, size: 16),
                      ],
                    ),
                  ),
                ),
              ),
            ),

            const SizedBox(height: 24),

            // Creator Mode Toggle Switch
            Card(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              child: SwitchListTile(
                title: const Text('Enable Creator Mode', style: TextStyle(fontWeight: FontWeight.bold)),
                subtitle: const Text('Showcase your expertise, featured ideas, and external links on your profile.'),
                value: _isCreatorEnabled,
                activeColor: primaryColor,
                onChanged: (val) {
                  setState(() => _isCreatorEnabled = val);
                },
              ),
            ),

            const SizedBox(height: 20),

            // Intro Bio
            Text(
              'Creator Bio & Thesis',
              style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w700, fontSize: 15),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _introController,
              maxLines: 3,
              decoration: InputDecoration(
                hintText: 'Share your background, research focus, or creative domain...',
                filled: true,
                fillColor: isDark ? Colors.white10 : Colors.grey.shade100,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
              ),
            ),

            const SizedBox(height: 20),

            // Expertise Tags
            Text(
              'Domain Expertise',
              style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w700, fontSize: 15),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _expertiseInputController,
                    decoration: InputDecoration(
                      hintText: 'Add domain (e.g. Distributed Systems)',
                      filled: true,
                      fillColor: isDark ? Colors.white10 : Colors.grey.shade100,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                    ),
                    onSubmitted: (_) => _addExpertiseTag(),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(
                  icon: Icon(Icons.add_circle, color: primaryColor, size: 28),
                  onPressed: _addExpertiseTag,
                ),
              ],
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _expertise.map((tag) {
                return Chip(
                  label: Text(tag),
                  deleteIcon: const Icon(Icons.close, size: 14),
                  onDeleted: () {
                    setState(() => _expertise.remove(tag));
                  },
                );
              }).toList(),
            ),

            const SizedBox(height: 20),

            // Social & Professional Links
            Text(
              'Social & Publication Links',
              style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w700, fontSize: 15),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _twitterController,
              decoration: InputDecoration(
                prefixIcon: const Icon(Icons.alternate_email, size: 18),
                labelText: 'Twitter / X Profile',
                hintText: 'https://x.com/yourhandle',
                filled: true,
                fillColor: isDark ? Colors.white10 : Colors.grey.shade100,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _githubController,
              decoration: InputDecoration(
                prefixIcon: const Icon(Icons.code, size: 18),
                labelText: 'GitHub Profile',
                hintText: 'https://github.com/yourhandle',
                filled: true,
                fillColor: isDark ? Colors.white10 : Colors.grey.shade100,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _linkedinController,
              decoration: InputDecoration(
                prefixIcon: const Icon(Icons.work_outline, size: 18),
                labelText: 'LinkedIn Profile',
                hintText: 'https://linkedin.com/in/yourhandle',
                filled: true,
                fillColor: isDark ? Colors.white10 : Colors.grey.shade100,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _websiteController,
              decoration: InputDecoration(
                prefixIcon: const Icon(Icons.language, size: 18),
                labelText: 'Personal Website or Substack',
                hintText: 'https://yourwebsite.com',
                filled: true,
                fillColor: isDark ? Colors.white10 : Colors.grey.shade100,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
              ),
            ),

            const SizedBox(height: 30),
          ],
        ),
      ),
    );
  }
}
