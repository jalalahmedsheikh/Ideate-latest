import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../models/topic_model.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../utils/app_colors.dart';
import '../widgets/auth_prompt_sheet.dart';
import 'topic_screen.dart';

class DiscoverTopicsScreen extends StatefulWidget {
  const DiscoverTopicsScreen({super.key});

  @override
  State<DiscoverTopicsScreen> createState() => _DiscoverTopicsScreenState();
}

class _DiscoverTopicsScreenState extends State<DiscoverTopicsScreen> {
  final TextEditingController _searchController = TextEditingController();
  List<TopicModel> _topics = [];
  bool _isLoading = true;
  String _selectedCategory = "All";

  final List<String> _categories = [
    "All",
    "Technology",
    "Artificial Intelligence",
    "Programming",
    "Business",
    "Science",
    "Education",
    "Entertainment",
    "General",
  ];

  @override
  void initState() {
    super.initState();
    _fetchTopics();
  }

  Future<void> _fetchTopics() async {
    setState(() => _isLoading = true);

    try {
      final categoryParam = _selectedCategory != "All" ? '&category=$_selectedCategory' : '';
      final searchParam = _searchController.text.trim().isNotEmpty
          ? '&search=${Uri.encodeComponent(_searchController.text.trim())}'
          : '';
      final response = await ApiService.get('/topic/all?limit=50$categoryParam$searchParam');

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['success'] == true && data['topics'] != null) {
          final List fetched = data['topics'];
          setState(() {
            _topics = fetched.map((t) => TopicModel.fromJson(t)).toList();
          });
        }
      }
    } catch (e) {
      debugPrint("Error fetching topics: $e");
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _toggleFollow(TopicModel topic) async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (!auth.isAuthenticated) {
      AuthPrompt.show(
        context,
        title: 'Follow Topic',
        message: 'Log in to follow topics and discover related ideas.',
        icon: Icons.tag_rounded,
      );
      return;
    }

    final prevIsFollowing = topic.isFollowing;
    final prevCount = topic.followerCount;

    setState(() {
      final idx = _topics.indexWhere((t) => t.id == topic.id);
      if (idx != -1) {
        _topics[idx] = topic.copyWith(
          isFollowing: !prevIsFollowing,
          followerCount: prevIsFollowing ? (prevCount - 1).clamp(0, 999999) : prevCount + 1,
        );
      }
    });

    try {
      final response = await ApiService.post('/topic/${topic.id}/toggleFollow', {});
      if (response.statusCode != 200) {
        setState(() {
          final idx = _topics.indexWhere((t) => t.id == topic.id);
          if (idx != -1) {
            _topics[idx] = topic.copyWith(
              isFollowing: prevIsFollowing,
              followerCount: prevCount,
            );
          }
        });
      }
    } catch (e) {
      debugPrint("Error toggling follow: $e");
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'Explore Topics',
          style: GoogleFonts.outfit(
            fontSize: 20,
            fontWeight: FontWeight.bold,
            color: AppColors.textPrimary,
          ),
        ),
      ),
      body: Column(
        children: [
          // Search input
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: TextField(
              controller: _searchController,
              onChanged: (_) => _fetchTopics(),
              style: GoogleFonts.inter(color: AppColors.textPrimary),
              decoration: InputDecoration(
                hintText: 'Search topics by name...',
                prefixIcon: const Icon(Icons.search_rounded, color: AppColors.textSecondary),
                suffixIcon: _searchController.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear, color: AppColors.textSecondary),
                        onPressed: () {
                          _searchController.clear();
                          _fetchTopics();
                        },
                      )
                    : null,
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              ),
            ),
          ),

          // Category Chips Row
          SizedBox(
            height: 48,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              itemCount: _categories.length,
              itemBuilder: (context, index) {
                final cat = _categories[index];
                final isSelected = _selectedCategory == cat;

                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: FilterChip(
                    label: Text(cat),
                    selected: isSelected,
                    onSelected: (selected) {
                      setState(() {
                        _selectedCategory = cat;
                      });
                      _fetchTopics();
                    },
                    backgroundColor: AppColors.surface,
                    selectedColor: AppColors.primary.withOpacity(0.2),
                    checkmarkColor: AppColors.primary,
                    labelStyle: GoogleFonts.inter(
                      fontSize: 12,
                      fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                      color: isSelected ? AppColors.primary : AppColors.textSecondary,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                      side: BorderSide(
                        color: isSelected ? AppColors.primary : AppColors.border,
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 8),

          // Topics Grid / List
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
                : _topics.isEmpty
                    ? Center(
                        child: Text(
                          'No topics found.',
                          style: GoogleFonts.inter(color: AppColors.textSecondary),
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: _fetchTopics,
                        color: AppColors.primary,
                        child: ListView.builder(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          itemCount: _topics.length,
                          itemBuilder: (context, index) {
                            final topic = _topics[index];

                            return Container(
                              margin: const EdgeInsets.only(bottom: 12),
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: AppColors.cardBackground,
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(color: AppColors.border),
                              ),
                              child: Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.all(10),
                                    decoration: BoxDecoration(
                                      color: AppColors.surface,
                                      borderRadius: BorderRadius.circular(12),
                                      border: Border.all(color: AppColors.border),
                                    ),
                                    child: Text(topic.icon, style: const TextStyle(fontSize: 22)),
                                  ),
                                  const SizedBox(width: 14),
                                  Expanded(
                                    child: InkWell(
                                      onTap: () {
                                        Navigator.push(
                                          context,
                                          MaterialPageRoute(
                                            builder: (_) => TopicScreen(
                                              slug: topic.slug,
                                              initialTopic: topic,
                                            ),
                                          ),
                                        );
                                      },
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            '#${topic.name}',
                                            style: GoogleFonts.outfit(
                                              fontSize: 16,
                                              fontWeight: FontWeight.bold,
                                              color: AppColors.textPrimary,
                                            ),
                                          ),
                                          const SizedBox(height: 2),
                                          Text(
                                            '${topic.followerCount} followers • ${topic.category}',
                                            style: GoogleFonts.inter(
                                              fontSize: 12,
                                              color: AppColors.textSecondary,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                  ElevatedButton(
                                    onPressed: () => _toggleFollow(topic),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: topic.isFollowing
                                          ? AppColors.surface
                                          : AppColors.primary,
                                      foregroundColor: topic.isFollowing
                                          ? AppColors.textPrimary
                                          : Colors.white,
                                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(16),
                                        side: BorderSide(
                                          color: topic.isFollowing ? AppColors.border : Colors.transparent,
                                        ),
                                      ),
                                    ),
                                    child: Text(
                                      topic.isFollowing ? 'Following' : 'Follow',
                                      style: GoogleFonts.inter(
                                        fontWeight: FontWeight.w600,
                                        fontSize: 12,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                      ),
          ),
        ],
      ),
    );
  }
}
