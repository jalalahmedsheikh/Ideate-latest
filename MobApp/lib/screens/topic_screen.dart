import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../models/topic_model.dart';
import '../models/post_model.dart';
import '../models/poll_model.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../utils/app_colors.dart';
import '../widgets/auth_prompt_sheet.dart';
import '../widgets/post_card.dart';
import '../widgets/poll_card.dart';

class TopicScreen extends StatefulWidget {
  final String slug;
  final TopicModel? initialTopic;

  const TopicScreen({
    super.key,
    required this.slug,
    this.initialTopic,
  });

  @override
  State<TopicScreen> createState() => _TopicScreenState();
}

class _TopicScreenState extends State<TopicScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  TopicModel? _topic;
  bool _isLoadingTopic = true;

  // Feeds
  List<dynamic> _latestItems = [];
  List<dynamic> _topItems = [];
  List<dynamic> _pollItems = [];

  bool _isLoadingLatest = false;
  bool _isLoadingTop = false;
  bool _isLoadingPolls = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _topic = widget.initialTopic;
    _fetchTopicDetails();
  }

  Future<void> _fetchTopicDetails() async {
    try {
      final response = await ApiService.get('/topic/by-slug/${widget.slug}');
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['success'] == true && data['topic'] != null) {
          setState(() {
            _topic = TopicModel.fromJson(data['topic']);
            _isLoadingTopic = false;
          });
          _fetchFeed("latest");
          _fetchFeed("top");
          _fetchFeed("polls");
        }
      }
    } catch (e) {
      debugPrint("Error fetching topic: $e");
      setState(() {
        _isLoadingTopic = false;
      });
    }
  }

  Future<void> _fetchFeed(String tab) async {
    if (_topic == null) return;

    if (tab == "latest") setState(() => _isLoadingLatest = true);
    if (tab == "top") setState(() => _isLoadingTop = true);
    if (tab == "polls") setState(() => _isLoadingPolls = true);

    try {
      final response =
          await ApiService.get('/topic/${_topic!.id}/feed?tab=$tab&limit=30');
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['success'] == true && data['items'] != null) {
          final List rawItems = data['items'];
          final parsed = rawItems.map((item) {
            final type = item['feedType'] ?? (item['options'] != null ? 'poll' : 'post');
            if (type == 'poll') {
              return PollModel.fromJson(item);
            } else {
              return PostModel.fromJson(item);
            }
          }).toList();

          setState(() {
            if (tab == "latest") _latestItems = parsed;
            if (tab == "top") _topItems = parsed;
            if (tab == "polls") _pollItems = parsed;
          });
        }
      }
    } catch (e) {
      debugPrint("Error fetching topic feed ($tab): $e");
    } finally {
      if (mounted) {
        setState(() {
          if (tab == "latest") _isLoadingLatest = false;
          if (tab == "top") _isLoadingTop = false;
          if (tab == "polls") _isLoadingPolls = false;
        });
      }
    }
  }

  Future<void> _toggleFollowTopic() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (!auth.isAuthenticated) {
      AuthPrompt.show(
        context,
        title: 'Follow Topic',
        message: 'Log in to follow topics and customize your feed.',
        icon: Icons.tag_rounded,
      );
      return;
    }

    if (_topic == null) return;

    final prevIsFollowing = _topic!.isFollowing;
    final prevCount = _topic!.followerCount;

    // Optimistic UI
    setState(() {
      _topic = _topic!.copyWith(
        isFollowing: !prevIsFollowing,
        followerCount: prevIsFollowing ? (prevCount - 1).clamp(0, 999999) : prevCount + 1,
      );
    });

    try {
      final response = await ApiService.post('/topic/${_topic!.id}/toggleFollow', {});
      if (response.statusCode != 200) {
        // Rollback
        setState(() {
          _topic = _topic!.copyWith(
            isFollowing: prevIsFollowing,
            followerCount: prevCount,
          );
        });
      }
    } catch (e) {
      debugPrint("Toggle topic follow error: $e");
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoadingTopic && _topic == null) {
      return Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(
          backgroundColor: AppColors.background,
          elevation: 0,
        ),
        body: const Center(
          child: CircularProgressIndicator(color: AppColors.primary),
        ),
      );
    }

    if (_topic == null) {
      return Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(
          backgroundColor: AppColors.background,
          elevation: 0,
        ),
        body: Center(
          child: Text(
            'Topic not found.',
            style: GoogleFonts.inter(color: AppColors.textSecondary),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      body: NestedScrollView(
        headerSliverBuilder: (context, innerBoxIsScrolled) {
          return [
            SliverAppBar(
              expandedHeight: 210,
              pinned: true,
              backgroundColor: AppColors.surface,
              elevation: 0,
              leading: IconButton(
                icon: const Icon(Icons.arrow_back, color: AppColors.textPrimary),
                onPressed: () => Navigator.pop(context),
              ),
              flexibleSpace: FlexibleSpaceBar(
                background: Container(
                  padding: const EdgeInsets.only(top: 80, left: 20, right: 20, bottom: 20),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        AppColors.primary.withOpacity(0.15),
                        AppColors.background,
                      ],
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: AppColors.cardBackground,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: AppColors.border),
                            ),
                            child: Text(
                              _topic!.icon,
                              style: const TextStyle(fontSize: 28),
                            ),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  '#${_topic!.name}',
                                  style: GoogleFonts.outfit(
                                    fontSize: 22,
                                    fontWeight: FontWeight.bold,
                                    color: AppColors.textPrimary,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  '${_topic!.followerCount} followers • ${_topic!.category}',
                                  style: GoogleFonts.inter(
                                    fontSize: 13,
                                    color: AppColors.textSecondary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          ElevatedButton(
                            onPressed: _toggleFollowTopic,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: _topic!.isFollowing
                                  ? AppColors.surface
                                  : AppColors.primary,
                              foregroundColor: _topic!.isFollowing
                                  ? AppColors.textPrimary
                                  : Colors.white,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(20),
                                side: BorderSide(
                                  color: _topic!.isFollowing
                                      ? AppColors.border
                                      : Colors.transparent,
                                ),
                              ),
                            ),
                            child: Text(
                              _topic!.isFollowing ? 'Following' : 'Follow',
                              style: GoogleFonts.inter(
                                fontWeight: FontWeight.w600,
                                fontSize: 13,
                              ),
                            ),
                          ),
                        ],
                      ),
                      if (_topic!.description.isNotEmpty) ...[
                        const SizedBox(height: 12),
                        Text(
                          _topic!.description,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: GoogleFonts.inter(
                            fontSize: 13,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              bottom: TabBar(
                controller: _tabController,
                indicatorColor: AppColors.primary,
                labelColor: AppColors.primary,
                unselectedLabelColor: AppColors.textSecondary,
                labelStyle: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 14),
                tabs: const [
                  Tab(text: 'Latest'),
                  Tab(text: 'Top'),
                  Tab(text: 'Polls'),
                ],
              ),
            ),
          ];
        },
        body: TabBarView(
          controller: _tabController,
          children: [
            _buildFeedList(_latestItems, _isLoadingLatest, 'latest'),
            _buildFeedList(_topItems, _isLoadingTop, 'top'),
            _buildFeedList(_pollItems, _isLoadingPolls, 'polls'),
          ],
        ),
      ),
    );
  }

  Widget _buildFeedList(List<dynamic> items, bool isLoading, String tab) {
    if (isLoading && items.isEmpty) {
      return const Center(child: CircularProgressIndicator(color: AppColors.primary));
    }

    if (items.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.lightbulb_outline_rounded, size: 48, color: AppColors.textSecondary),
            const SizedBox(height: 12),
            Text(
              'No ${tab == "polls" ? "polls" : "posts"} in this topic yet.',
              style: GoogleFonts.outfit(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Be the first to share an idea on #${_topic!.name}!',
              style: GoogleFonts.inter(
                fontSize: 13,
                color: AppColors.textSecondary,
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () => _fetchFeed(tab),
      color: AppColors.primary,
      child: ListView.builder(
        padding: const EdgeInsets.symmetric(vertical: 8),
        itemCount: items.length,
        itemBuilder: (context, index) {
          final item = items[index];
          if (item is PollModel) {
            return PollCard(poll: item);
          } else if (item is PostModel) {
            return PostCard(post: item);
          }
          return const SizedBox();
        },
      ),
    );
  }
}
