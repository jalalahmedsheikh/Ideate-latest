import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../models/community_model.dart';
import '../models/post_model.dart';
import '../models/debate_model.dart';
import '../models/question_model.dart';
import '../models/poll_model.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../widgets/auth_prompt_sheet.dart';
import '../widgets/post_card.dart';
import '../widgets/debate_card.dart';
import '../widgets/question_card.dart';
import '../widgets/poll_card.dart';

class CommunityDetailScreen extends StatefulWidget {
  final String communityId;

  const CommunityDetailScreen({Key? key, required this.communityId}) : super(key: key);

  @override
  State<CommunityDetailScreen> createState() => _CommunityDetailScreenState();
}

class _CommunityDetailScreenState extends State<CommunityDetailScreen>
    with SingleTickerProviderStateMixin {
  CommunityModel? _community;
  List<dynamic> _feedItems = [];
  bool _isLoading = true;
  String? _errorMessage;
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _fetchCommunityDetails();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _fetchCommunityDetails() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final res = await ApiService.get('/community/${widget.communityId}');
      final data = json.decode(res.body);

      if (res.statusCode == 200 && data['success'] == true) {
        final comm = CommunityModel.fromJson(data['community']);
        
        // Fetch community feed
        final feedRes = await ApiService.get('/community/${widget.communityId}/feed');
        final feedData = json.decode(feedRes.body);
        final rawFeed = feedData['feed'] as List? ?? [];

        final parsedFeed = rawFeed.map((item) {
          final type = item['type'] ?? item['itemType'] ?? 'post';
          if (type == 'debate') return DebateModel.fromJson(item);
          if (type == 'question') return QuestionModel.fromJson(item);
          if (type == 'poll') return PollModel.fromJson(item);
          return PostModel.fromJson(item);
        }).toList();

        setState(() {
          _community = comm;
          _feedItems = parsedFeed;
          _isLoading = false;
        });
      } else {
        setState(() {
          _errorMessage = data['message'] ?? 'Failed to load community';
          _isLoading = false;
        });
      }
    } catch (_) {
      setState(() {
        _errorMessage = 'Network error loading community';
        _isLoading = false;
      });
    }
  }

  Future<void> _toggleMembership() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (!auth.isAuthenticated) {
      AuthPrompt.show(
        context,
        title: 'Join Community',
        message: 'Log in to join and participate in this community.',
      );
      return;
    }

    if (_community == null) return;

    try {
      if (_community!.isMember) {
        await ApiService.post('/community/${_community!.id}/leave', {});
      } else {
        await ApiService.post('/community/${_community!.id}/join', {});
      }
      _fetchCommunityDetails();
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final primaryColor = Theme.of(context).primaryColor;

    if (_isLoading) {
      return Scaffold(
        appBar: AppBar(title: const Text('Community')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    if (_errorMessage != null || _community == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Community')),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(_errorMessage ?? 'Community not found'),
              const SizedBox(height: 12),
              ElevatedButton(onPressed: _fetchCommunityDetails, child: const Text('Retry')),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'c/${_community!.handle}',
          style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w700),
        ),
      ),
      body: NestedScrollView(
        headerSliverBuilder: (ctx, innerBoxIsScrolled) => [
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      CircleAvatar(
                        radius: 28,
                        backgroundColor: primaryColor.withOpacity(0.15),
                        backgroundImage: _community!.profileImage != null &&
                                _community!.profileImage!.isNotEmpty
                            ? NetworkImage(_community!.profileImage!)
                            : null,
                        child: _community!.profileImage == null ||
                                _community!.profileImage!.isEmpty
                            ? Text(
                                _community!.name.isNotEmpty
                                    ? _community!.name[0].toUpperCase()
                                    : 'C',
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: primaryColor,
                                  fontSize: 22,
                                ),
                              )
                            : null,
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _community!.name,
                              style: GoogleFonts.plusJakartaSans(
                                fontWeight: FontWeight.w800,
                                fontSize: 18,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '${_community!.membersCount} Members • ${_community!.category}',
                              style: TextStyle(
                                fontSize: 12,
                                color: isDark ? Colors.white60 : Colors.black54,
                              ),
                            ),
                          ],
                        ),
                      ),
                      ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: _community!.isMember
                              ? (isDark ? Colors.white12 : Colors.grey.shade200)
                              : primaryColor,
                          foregroundColor: _community!.isMember
                              ? (isDark ? Colors.white : Colors.black87)
                              : Colors.white,
                        ),
                        onPressed: _toggleMembership,
                        child: Text(
                          _community!.isMember
                              ? (_community!.isOwner ? 'Owner' : 'Joined')
                              : (_community!.isPending ? 'Requested' : 'Join'),
                        ),
                      ),
                    ],
                  ),
                  if (_community!.description.isNotEmpty) ...[
                    const SizedBox(height: 14),
                    Text(
                      _community!.description,
                      style: TextStyle(
                        fontSize: 14,
                        height: 1.4,
                        color: isDark ? Colors.white70 : Colors.black87,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
          SliverPersistentHeader(
            pinned: true,
            delegate: _CommunityTabDelegate(
              TabBar(
                controller: _tabController,
                indicatorColor: primaryColor,
                labelColor: primaryColor,
                unselectedLabelColor: isDark ? Colors.white54 : Colors.black45,
                tabs: const [
                  Tab(text: 'Feed'),
                  Tab(text: 'Rules'),
                  Tab(text: 'About'),
                ],
              ),
              isDark ? const Color(0xFF12121A) : Colors.white,
            ),
          ),
        ],
        body: TabBarView(
          controller: _tabController,
          children: [
            _buildCommunityFeed(isDark),
            _buildCommunityRules(isDark),
            _buildCommunityAbout(isDark),
          ],
        ),
      ),
    );
  }

  Widget _buildCommunityFeed(bool isDark) {
    if (_feedItems.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.dynamic_feed_outlined, size: 48, color: Colors.grey),
              const SizedBox(height: 12),
              Text(
                'No content in this community yet.',
                style: TextStyle(color: isDark ? Colors.white54 : Colors.black45),
              ),
            ],
          ),
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.only(top: 8, bottom: 24),
      itemCount: _feedItems.length,
      itemBuilder: (ctx, i) {
        final item = _feedItems[i];
        if (item is DebateModel) return DebateCard(debate: item, onRefresh: _fetchCommunityDetails);
        if (item is QuestionModel) return QuestionCard(question: item, onRefresh: _fetchCommunityDetails);
        if (item is PollModel) return PollCard(poll: item);
        if (item is PostModel) return PostCard(post: item);
        return const SizedBox();
      },
    );
  }

  Widget _buildCommunityRules(bool isDark) {
    if (_community!.rules.isEmpty) {
      return const Center(child: Text('No explicit rules configured. Standard community guidelines apply.'));
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _community!.rules.length,
      itemBuilder: (ctx, i) {
        final rule = _community!.rules[i];
        return Card(
          margin: const EdgeInsets.only(bottom: 12),
          child: Padding(
            padding: const EdgeInsets.all(14.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${i + 1}. ${rule.title}',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                ),
                const SizedBox(height: 6),
                Text(rule.description, style: TextStyle(color: isDark ? Colors.white70 : Colors.black87)),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildCommunityAbout(bool isDark) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        ListTile(
          leading: const Icon(Icons.person_pin_rounded),
          title: const Text('Creator & Lead'),
          subtitle: Text('@${_community!.creator.username}'),
        ),
        ListTile(
          leading: const Icon(Icons.category_outlined),
          title: const Text('Category'),
          subtitle: Text(_community!.category),
        ),
        ListTile(
          leading: const Icon(Icons.lock_outline),
          title: const Text('Visibility'),
          subtitle: Text(_community!.visibility.toUpperCase()),
        ),
        ListTile(
          leading: const Icon(Icons.calendar_today_outlined),
          title: const Text('Established'),
          subtitle: Text(_community!.createdAt.toIso8601String().split('T').first),
        ),
      ],
    );
  }
}

class _CommunityTabDelegate extends SliverPersistentHeaderDelegate {
  final TabBar tabBar;
  final Color backgroundColor;

  _CommunityTabDelegate(this.tabBar, this.backgroundColor);

  @override
  double get minExtent => tabBar.preferredSize.height;
  @override
  double get maxExtent => tabBar.preferredSize.height;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    return Container(
      color: backgroundColor,
      child: tabBar,
    );
  }

  @override
  bool shouldRebuild(_CommunityTabDelegate oldDelegate) => false;
}
