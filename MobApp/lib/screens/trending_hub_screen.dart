import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../models/post_model.dart';
import '../models/question_model.dart';
import '../models/debate_model.dart';
import '../models/poll_model.dart';
import '../models/community_model.dart';
import '../services/api_service.dart';
import '../widgets/post_card.dart';
import '../widgets/question_card.dart';
import '../widgets/debate_card.dart';
import '../widgets/poll_card.dart';
import '../widgets/community_card.dart';

class TrendingHubScreen extends StatefulWidget {
  const TrendingHubScreen({Key? key}) : super(key: key);

  @override
  State<TrendingHubScreen> createState() => _TrendingHubScreenState();
}

class _TrendingHubScreenState extends State<TrendingHubScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  bool _isLoading = true;
  List<dynamic> _allTrending = [];
  List<QuestionModel> _trendingQuestions = [];
  List<DebateModel> _trendingDebates = [];
  List<PollModel> _trendingPolls = [];
  List<CommunityModel> _trendingCommunities = [];

  final List<String> _tabs = [
    'All',
    'Debates',
    'Questions',
    'Polls',
    'Communities',
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: _tabs.length, vsync: this);
    _fetchTrending();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _fetchTrending() async {
    setState(() => _isLoading = true);

    try {
      final res = await ApiService.get('/trending');
      final data = json.decode(res.body);

      if (res.statusCode == 200 && data['success'] == true) {
        final trending = data['trending'] ?? {};
        final rawAll = trending['all'] as List? ?? [];

        final parsedAll = rawAll.map((item) {
          final type = item['type'] ?? item['itemType'] ?? 'post';
          if (type == 'debate') return DebateModel.fromJson(item);
          if (type == 'question') return QuestionModel.fromJson(item);
          if (type == 'poll') return PollModel.fromJson(item);
          if (type == 'community') return CommunityModel.fromJson(item);
          return PostModel.fromJson(item);
        }).toList();

        final parsedDebates = (trending['debates'] as List? ?? [])
            .map((d) => DebateModel.fromJson(d))
            .toList();

        final parsedQuestions = (trending['questions'] as List? ?? [])
            .map((q) => QuestionModel.fromJson(q))
            .toList();

        final parsedPolls = (trending['polls'] as List? ?? [])
            .map((p) => PollModel.fromJson(p))
            .toList();

        final parsedCommunities = (trending['communities'] as List? ?? [])
            .map((c) => CommunityModel.fromJson(c))
            .toList();

        setState(() {
          _allTrending = parsedAll;
          _trendingDebates = parsedDebates;
          _trendingQuestions = parsedQuestions;
          _trendingPolls = parsedPolls;
          _trendingCommunities = parsedCommunities;
          _isLoading = false;
        });
      } else {
        setState(() => _isLoading = false);
      }
    } catch (_) {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final primaryColor = Theme.of(context).primaryColor;

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            const Icon(Icons.local_fire_department_rounded, color: Colors.orange),
            const SizedBox(width: 6),
            Text(
              'Trending',
              style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w800),
            ),
          ],
        ),
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          indicatorColor: primaryColor,
          labelColor: primaryColor,
          unselectedLabelColor: isDark ? Colors.white54 : Colors.black45,
          tabs: _tabs.map((t) => Tab(text: t)).toList(),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : TabBarView(
              controller: _tabController,
              children: [
                _buildMixedList(_allTrending, isDark),
                _buildDebatesList(_trendingDebates, isDark),
                _buildQuestionsList(_trendingQuestions, isDark),
                _buildPollsList(_trendingPolls, isDark),
                _buildCommunitiesList(_trendingCommunities, isDark),
              ],
            ),
    );
  }

  Widget _buildMixedList(List<dynamic> items, bool isDark) {
    if (items.isEmpty) return _buildEmptyState('No trending content right now.', isDark);
    return RefreshIndicator(
      onRefresh: _fetchTrending,
      child: ListView.builder(
        padding: const EdgeInsets.only(top: 8, bottom: 24),
        itemCount: items.length,
        itemBuilder: (ctx, i) {
          final item = items[i];
          if (item is DebateModel) return DebateCard(debate: item, onRefresh: _fetchTrending);
          if (item is QuestionModel) return QuestionCard(question: item, onRefresh: _fetchTrending);
          if (item is PollModel) return PollCard(poll: item);
          if (item is CommunityModel) return CommunityCard(community: item, onUpdate: _fetchTrending);
          if (item is PostModel) return PostCard(post: item);
          return const SizedBox();
        },
      ),
    );
  }

  Widget _buildDebatesList(List<DebateModel> items, bool isDark) {
    if (items.isEmpty) return _buildEmptyState('No trending debates right now.', isDark);
    return RefreshIndicator(
      onRefresh: _fetchTrending,
      child: ListView.builder(
        padding: const EdgeInsets.only(top: 8, bottom: 24),
        itemCount: items.length,
        itemBuilder: (ctx, i) => DebateCard(debate: items[i], onRefresh: _fetchTrending),
      ),
    );
  }

  Widget _buildQuestionsList(List<QuestionModel> items, bool isDark) {
    if (items.isEmpty) return _buildEmptyState('No trending questions right now.', isDark);
    return RefreshIndicator(
      onRefresh: _fetchTrending,
      child: ListView.builder(
        padding: const EdgeInsets.only(top: 8, bottom: 24),
        itemCount: items.length,
        itemBuilder: (ctx, i) => QuestionCard(question: items[i], onRefresh: _fetchTrending),
      ),
    );
  }

  Widget _buildPollsList(List<PollModel> items, bool isDark) {
    if (items.isEmpty) return _buildEmptyState('No trending polls right now.', isDark);
    return RefreshIndicator(
      onRefresh: _fetchTrending,
      child: ListView.builder(
        padding: const EdgeInsets.only(top: 8, bottom: 24),
        itemCount: items.length,
        itemBuilder: (ctx, i) => PollCard(poll: items[i]),
      ),
    );
  }

  Widget _buildCommunitiesList(List<CommunityModel> items, bool isDark) {
    if (items.isEmpty) return _buildEmptyState('No trending communities right now.', isDark);
    return RefreshIndicator(
      onRefresh: _fetchTrending,
      child: ListView.builder(
        padding: const EdgeInsets.only(top: 8, bottom: 24),
        itemCount: items.length,
        itemBuilder: (ctx, i) => CommunityCard(community: items[i], onUpdate: _fetchTrending),
      ),
    );
  }

  Widget _buildEmptyState(String message, bool isDark) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.local_fire_department_outlined, size: 48, color: Colors.grey),
            const SizedBox(height: 12),
            Text(message, style: TextStyle(color: isDark ? Colors.white54 : Colors.black45)),
          ],
        ),
      ),
    );
  }
}
