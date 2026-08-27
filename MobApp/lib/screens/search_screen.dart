import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../models/user_model.dart';
import '../models/post_model.dart';
import '../models/poll_model.dart';
import '../models/topic_model.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../widgets/post_card.dart';
import '../widgets/poll_card.dart';
import '../widgets/auth_prompt_sheet.dart';
import 'other_profile.dart';
import 'topic_screen.dart';
import '../utils/app_colors.dart';

class _Suggestion {
  final String type; // 'user' | 'post' | 'poll' | 'topic'
  final String id;
  final String label;
  final String? profileImage;
  final String? slug;
  final String? icon;
  final bool isverified;

  _Suggestion({
    required this.type,
    required this.id,
    required this.label,
    this.profileImage,
    this.slug,
    this.icon,
    this.isverified = false,
  });

  factory _Suggestion.fromJson(Map<String, dynamic> j) => _Suggestion(
        type: j['type'] ?? '',
        id: j['id']?.toString() ?? '',
        label: j['label'] ?? '',
        profileImage: j['profileImage'],
        slug: j['slug'],
        icon: j['icon'],
        isverified: j['isverified'] ?? false,
      );
}

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen>
    with SingleTickerProviderStateMixin {
  final _searchController = TextEditingController();
  final _focusNode = FocusNode();

  late TabController _tabController;

  String _query = '';
  bool _hasSearched = false;
  bool _isSearching = false;
  bool _showSuggestions = false;

  List<_Suggestion> _suggestions = [];
  bool _loadingSuggestions = false;
  Timer? _debounce;

  // Results
  List<UserModel> _users = [];
  List<PostModel> _posts = [];
  List<PollModel> _polls = [];
  List<TopicModel> _topics = [];

  final Set<String> _followingUserIds = {};

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 5, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _focusNode.requestFocus();
    });
    _searchController.addListener(_onQueryChanged);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.removeListener(_onQueryChanged);
    _searchController.dispose();
    _focusNode.dispose();
    _tabController.dispose();
    super.dispose();
  }

  void _onQueryChanged() {
    final text = _searchController.text.trim();
    if (text == _query) return;
    _query = text;

    if (text.isEmpty) {
      setState(() {
        _suggestions = [];
        _showSuggestions = false;
        _hasSearched = false;
        _users = [];
        _posts = [];
        _polls = [];
        _topics = [];
      });
      return;
    }

    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      _fetchSuggestions(text);
    });
  }

  Future<void> _fetchSuggestions(String q) async {
    setState(() => _loadingSuggestions = true);
    try {
      final res = await ApiService.get('/search/suggestions?q=${Uri.encodeComponent(q)}');
      if (res.statusCode == 200) {
        final data = json.decode(res.body);
        if (data['success'] == true && data['suggestions'] != null) {
          final list = (data['suggestions'] as List)
              .map((s) => _Suggestion.fromJson(s))
              .toList();
          setState(() {
            _suggestions = list;
            _showSuggestions = list.isNotEmpty && !_hasSearched;
          });
        }
      }
    } catch (_) {
    } finally {
      if (mounted) setState(() => _loadingSuggestions = false);
    }
  }

  Future<void> _performSearch([String? overrideQuery]) async {
    final q = (overrideQuery ?? _searchController.text).trim();
    if (q.isEmpty) return;

    _focusNode.unfocus();
    setState(() {
      _isSearching = true;
      _showSuggestions = false;
      _hasSearched = true;
    });

    try {
      final res = await ApiService.get('/search?q=${Uri.encodeComponent(q)}&type=all');
      if (res.statusCode == 200) {
        final data = json.decode(res.body);
        if (data['success'] == true && data['results'] != null) {
          final r = data['results'];
          final users = ((r['users'] ?? []) as List).map((u) => UserModel.fromJson(u)).toList();
          final posts = ((r['posts'] ?? []) as List).map((p) => PostModel.fromJson(p)).toList();
          final polls = ((r['polls'] ?? []) as List).map((p) => PollModel.fromJson(p)).toList();
          final topics = ((r['topics'] ?? []) as List).map((t) => TopicModel.fromJson(t)).toList();

          setState(() {
            _users = users;
            _posts = posts;
            _polls = polls;
            _topics = topics;
            for (var u in users) {
              if (u.toJson()['isFollowing'] == true) {
                _followingUserIds.add(u.id);
              }
            }
          });
        }
      }
    } catch (e) {
      debugPrint("Search error: $e");
    } finally {
      if (mounted) setState(() => _isSearching = false);
    }
  }

  Future<void> _toggleUserFollow(UserModel user) async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (!auth.isAuthenticated) {
      AuthPrompt.show(
        context,
        title: 'Follow User',
        message: 'Log in to follow creators.',
        icon: Icons.person_add_rounded,
      );
      return;
    }

    final isFollowing = _followingUserIds.contains(user.id);
    setState(() {
      if (isFollowing) {
        _followingUserIds.remove(user.id);
      } else {
        _followingUserIds.add(user.id);
      }
    });

    try {
      final response = await ApiService.post('/user/toggleFollow', {'targetUserId': user.id});
      if (response.statusCode != 200) {
        setState(() {
          if (isFollowing) {
            _followingUserIds.add(user.id);
          } else {
            _followingUserIds.remove(user.id);
          }
        });
      }
    } catch (e) {
      debugPrint("Follow error: $e");
    }
  }

  Future<void> _toggleTopicFollow(TopicModel topic) async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (!auth.isAuthenticated) {
      AuthPrompt.show(
        context,
        title: 'Follow Topic',
        message: 'Log in to follow topics.',
        icon: Icons.tag_rounded,
      );
      return;
    }

    final prevIsFollowing = topic.isFollowing;
    setState(() {
      final idx = _topics.indexWhere((t) => t.id == topic.id);
      if (idx != -1) {
        _topics[idx] = topic.copyWith(
          isFollowing: !prevIsFollowing,
          followerCount: prevIsFollowing ? topic.followerCount - 1 : topic.followerCount + 1,
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
              followerCount: topic.followerCount,
            );
          }
        });
      }
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          children: [
            // Search Input Header
            Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back, color: AppColors.textPrimary),
                    onPressed: () => Navigator.pop(context),
                  ),
                  Expanded(
                    child: TextField(
                      controller: _searchController,
                      focusNode: _focusNode,
                      textInputAction: TextInputAction.search,
                      onSubmitted: (_) => _performSearch(),
                      style: GoogleFonts.inter(color: AppColors.textPrimary),
                      decoration: InputDecoration(
                        hintText: 'Search people, ideas, polls, topics...',
                        prefixIcon: const Icon(Icons.search_rounded, color: AppColors.textSecondary),
                        suffixIcon: _searchController.text.isNotEmpty
                            ? IconButton(
                                icon: const Icon(Icons.clear, color: AppColors.textSecondary),
                                onPressed: () {
                                  _searchController.clear();
                                  _onQueryChanged();
                                },
                              )
                            : null,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton(
                    icon: const Icon(Icons.search_rounded, color: AppColors.primary),
                    onPressed: () => _performSearch(),
                  ),
                ],
              ),
            ),

            // Tab Bar when searched
            if (_hasSearched)
              TabBar(
                controller: _tabController,
                isScrollable: true,
                indicatorColor: AppColors.primary,
                labelColor: AppColors.primary,
                unselectedLabelColor: AppColors.textSecondary,
                labelStyle: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 13),
                tabs: [
                  const Tab(text: 'All'),
                  Tab(text: 'People (${_users.length})'),
                  Tab(text: 'Posts (${_posts.length})'),
                  Tab(text: 'Polls (${_polls.length})'),
                  Tab(text: 'Topics (${_topics.length})'),
                ],
              ),

            // Body
            Expanded(
              child: _isSearching
                  ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
                  : _showSuggestions
                      ? _buildSuggestionsList()
                      : _hasSearched
                          ? TabBarView(
                              controller: _tabController,
                              children: [
                                _buildAllTab(),
                                _buildUsersTab(),
                                _buildPostsTab(),
                                _buildPollsTab(),
                                _buildTopicsTab(),
                              ],
                            )
                          : _buildInitialPlaceholder(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSuggestionsList() {
    return ListView.builder(
      itemCount: _suggestions.length,
      itemBuilder: (context, index) {
        final s = _suggestions[index];
        IconData icon = Icons.search;
        if (s.type == 'user') icon = Icons.person_outline;
        if (s.type == 'poll') icon = Icons.poll_outlined;
        if (s.type == 'post') icon = Icons.article_outlined;
        if (s.type == 'topic') icon = Icons.tag_rounded;

        return ListTile(
          leading: Icon(icon, color: AppColors.primary),
          title: Text(s.label, style: GoogleFonts.inter(color: AppColors.textPrimary)),
          onTap: () {
            _searchController.text = s.label.replaceAll('@', '').replaceAll('#', '');
            _performSearch(_searchController.text);
          },
        );
      },
    );
  }

  Widget _buildInitialPlaceholder() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.search_rounded, size: 54, color: AppColors.borderLight),
          const SizedBox(height: 12),
          Text(
            'Explore Ideate',
            style: GoogleFonts.outfit(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Search for creators, topics, opinions, and discussions.',
            style: GoogleFonts.inter(
              fontSize: 13,
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAllTab() {
    final hasNoResults = _users.isEmpty && _posts.isEmpty && _polls.isEmpty && _topics.isEmpty;

    if (hasNoResults) {
      return Center(
        child: Text(
          'No results found for "$_query"',
          style: GoogleFonts.inter(color: AppColors.textSecondary),
        ),
      );
    }

    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      children: [
        if (_topics.isNotEmpty) ...[
          _sectionHeader('Topics', 4),
          ..._topics.take(3).map((t) => _buildTopicTile(t)),
          const SizedBox(height: 12),
        ],
        if (_users.isNotEmpty) ...[
          _sectionHeader('People', 1),
          ..._users.take(3).map((u) => _buildUserTile(u)),
          const SizedBox(height: 12),
        ],
        if (_posts.isNotEmpty) ...[
          _sectionHeader('Posts', 2),
          ..._posts.take(3).map((p) => PostCard(post: p)),
          const SizedBox(height: 12),
        ],
        if (_polls.isNotEmpty) ...[
          _sectionHeader('Polls', 3),
          ..._polls.take(3).map((p) => PollCard(poll: p)),
          const SizedBox(height: 12),
        ],
      ],
    );
  }

  Widget _sectionHeader(String title, int tabIndex) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            title,
            style: GoogleFonts.outfit(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: AppColors.textPrimary,
            ),
          ),
          InkWell(
            onTap: () => _tabController.animateTo(tabIndex),
            child: Text(
              'See all',
              style: GoogleFonts.inter(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: AppColors.primary,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildUsersTab() {
    if (_users.isEmpty) {
      return Center(child: Text('No users found.', style: GoogleFonts.inter(color: AppColors.textSecondary)));
    }
    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      itemCount: _users.length,
      itemBuilder: (ctx, idx) => _buildUserTile(_users[idx]),
    );
  }

  Widget _buildTopicsTab() {
    if (_topics.isEmpty) {
      return Center(child: Text('No topics found.', style: GoogleFonts.inter(color: AppColors.textSecondary)));
    }
    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      itemCount: _topics.length,
      itemBuilder: (ctx, idx) => _buildTopicTile(_topics[idx]),
    );
  }

  Widget _buildPostsTab() {
    if (_posts.isEmpty) {
      return Center(child: Text('No posts found.', style: GoogleFonts.inter(color: AppColors.textSecondary)));
    }
    return ListView.builder(
      padding: const EdgeInsets.symmetric(vertical: 8),
      itemCount: _posts.length,
      itemBuilder: (ctx, idx) => PostCard(post: _posts[idx]),
    );
  }

  Widget _buildPollsTab() {
    if (_polls.isEmpty) {
      return Center(child: Text('No polls found.', style: GoogleFonts.inter(color: AppColors.textSecondary)));
    }
    return ListView.builder(
      padding: const EdgeInsets.symmetric(vertical: 8),
      itemCount: _polls.length,
      itemBuilder: (ctx, idx) => PollCard(poll: _polls[idx]),
    );
  }

  Widget _buildUserTile(UserModel user) {
    final isFollowing = _followingUserIds.contains(user.id);

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.cardBackground,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 20,
            backgroundImage: user.profileImage != null && user.profileImage!.isNotEmpty
                ? NetworkImage(user.profileImage!)
                : null,
            child: user.profileImage == null ? const Icon(Icons.person, size: 20) : null,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: InkWell(
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => OtherProfileScreen(userId: user.id)),
                );
              },
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    user.username,
                    style: GoogleFonts.inter(fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                  ),
                  Text(
                    user.category,
                    style: GoogleFonts.inter(fontSize: 12, color: AppColors.textSecondary),
                  ),
                ],
              ),
            ),
          ),
          ElevatedButton(
            onPressed: () => _toggleUserFollow(user),
            style: ElevatedButton.styleFrom(
              backgroundColor: isFollowing ? AppColors.surface : AppColors.primary,
              foregroundColor: isFollowing ? AppColors.textPrimary : Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
                side: BorderSide(color: isFollowing ? AppColors.border : Colors.transparent),
              ),
            ),
            child: Text(isFollowing ? 'Following' : 'Follow', style: const TextStyle(fontSize: 12)),
          ),
        ],
      ),
    );
  }

  Widget _buildTopicTile(TopicModel topic) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.cardBackground,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.border),
            ),
            child: Text(topic.icon, style: const TextStyle(fontSize: 18)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: InkWell(
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => TopicScreen(slug: topic.slug, initialTopic: topic),
                  ),
                );
              },
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '#${topic.name}',
                    style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                  ),
                  Text(
                    '${topic.followerCount} followers • ${topic.category}',
                    style: GoogleFonts.inter(fontSize: 11, color: AppColors.textSecondary),
                  ),
                ],
              ),
            ),
          ),
          ElevatedButton(
            onPressed: () => _toggleTopicFollow(topic),
            style: ElevatedButton.styleFrom(
              backgroundColor: topic.isFollowing ? AppColors.surface : AppColors.primary,
              foregroundColor: topic.isFollowing ? AppColors.textPrimary : Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
                side: BorderSide(color: topic.isFollowing ? AppColors.border : Colors.transparent),
              ),
            ),
            child: Text(topic.isFollowing ? 'Following' : 'Follow', style: const TextStyle(fontSize: 12)),
          ),
        ],
      ),
    );
  }
}
