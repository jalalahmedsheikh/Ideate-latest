import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../models/user_model.dart';
import '../models/post_model.dart';
import '../models/poll_model.dart';
import '../services/api_service.dart';
import '../widgets/post_card.dart';
import '../widgets/poll_card.dart';
import 'other_profile.dart';

// ─────────────────────────────────────────────
// Data classes
// ─────────────────────────────────────────────
class _Suggestion {
  final String type; // 'user' | 'post' | 'poll'
  final String id;
  final String label;
  final String? profileImage;
  final bool isverified;

  _Suggestion({
    required this.type,
    required this.id,
    required this.label,
    this.profileImage,
    this.isverified = false,
  });

  factory _Suggestion.fromJson(Map<String, dynamic> j) => _Suggestion(
        type: j['type'] ?? '',
        id: j['id']?.toString() ?? '',
        label: j['label'] ?? '',
        profileImage: j['profileImage'],
        isverified: j['isverified'] ?? false,
      );
}

// ─────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────
class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen>
    with SingleTickerProviderStateMixin {
  // Controllers
  final _searchController = TextEditingController();
  final _focusNode = FocusNode();

  // Tab controller (created after search)
  TabController? _tabController;

  // State
  String _query = '';
  bool _hasSearched = false;
  bool _isSearching = false;
  bool _showSuggestions = false;

  // Suggestion state
  List<_Suggestion> _suggestions = [];
  bool _loadingSuggestions = false;
  Timer? _debounce;

  // Results
  List<UserModel> _users = [];
  List<PostModel> _posts = [];
  List<PollModel> _polls = [];

  // ── constants ──────────────────────────────
  static const _purple = Color(0xFF7828B4);
  static const _bg = Color(0xFF0B0B0F);
  static const _card = Color(0xFF181824);
  static const _border = Color(0xFF2C2C3E);

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
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
    _tabController?.dispose();
    super.dispose();
  }

  // ── query change → debounced suggestions ───
  void _onQueryChanged() {
    final text = _searchController.text.trim();
    setState(() {
      _query = text;
      _showSuggestions = text.isNotEmpty && !_hasSearched;
    });

    _debounce?.cancel();
    if (text.isEmpty) {
      setState(() => _suggestions = []);
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 280), () {
      _fetchSuggestions(text);
    });
  }

  Future<void> _fetchSuggestions(String q) async {
    setState(() => _loadingSuggestions = true);
    try {
      final res = await ApiService.get('/search/suggest?q=${Uri.encodeComponent(q)}');
      if (res.statusCode == 200) {
        final data = json.decode(res.body);
        final list = (data['suggestions'] as List? ?? [])
            .map((e) => _Suggestion.fromJson(e))
            .toList();
        if (mounted) setState(() => _suggestions = list);
      }
    } catch (_) {}
    if (mounted) setState(() => _loadingSuggestions = false);
  }

  // ── full search ─────────────────────────────
  Future<void> _doSearch(String q) async {
    final query = q.trim();
    if (query.isEmpty) return;

    _focusNode.unfocus();
    setState(() {
      _query = query;
      _hasSearched = true;
      _showSuggestions = false;
      _isSearching = true;
      _users = [];
      _posts = [];
      _polls = [];
    });

    try {
      final res =
          await ApiService.get('/search?q=${Uri.encodeComponent(query)}');
      if (res.statusCode == 200) {
        final data = json.decode(res.body);
        final results = data['results'] as Map<String, dynamic>? ?? {};

        final users = (results['users'] as List? ?? [])
            .map((u) => UserModel.fromJson(u))
            .toList();
        final posts = (results['posts'] as List? ?? [])
            .map((p) => PostModel.fromJson(p))
            .toList();
        final polls = (results['polls'] as List? ?? [])
            .map((p) => PollModel.fromJson(p))
            .toList();

        if (mounted) {
          setState(() {
            _users = users;
            _posts = posts;
            _polls = polls;
          });
        }
      }
    } catch (e) {
      debugPrint('Search error: $e');
    }

    if (mounted) setState(() => _isSearching = false);
  }

  void _clearSearch() {
    _searchController.clear();
    setState(() {
      _query = '';
      _hasSearched = false;
      _showSuggestions = false;
      _suggestions = [];
      _users = [];
      _posts = [];
      _polls = [];
    });
    _focusNode.requestFocus();
  }

  // ─────────────────────────────────────────────
  // BUILD
  // ─────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bg,
      appBar: _buildAppBar(),
      body: Stack(
        children: [
          // Main content
          _hasSearched
              ? _buildResultsView()
              : _buildEmptyState(),

          // Live suggestion overlay
          if (_showSuggestions && _suggestions.isNotEmpty)
            _buildSuggestionOverlay(),
        ],
      ),
    );
  }

  // ── AppBar with search field ───────────────
  AppBar _buildAppBar() {
    return AppBar(
      backgroundColor: _bg,
      elevation: 0,
      leading: IconButton(
        icon: const Icon(Icons.arrow_back_ios_new, color: Colors.white, size: 20),
        onPressed: () => Navigator.of(context).pop(),
      ),
      title: Container(
        height: 44,
        decoration: BoxDecoration(
          color: _card,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: _border),
        ),
        child: TextField(
          controller: _searchController,
          focusNode: _focusNode,
          style: GoogleFonts.inter(color: Colors.white, fontSize: 15),
          cursorColor: _purple,
          textInputAction: TextInputAction.search,
          onSubmitted: _doSearch,
          decoration: InputDecoration(
            hintText: 'Search users, posts, polls…',
            hintStyle: GoogleFonts.inter(
              color: const Color(0xFF8D8D99),
              fontSize: 14,
            ),
            prefixIcon: const Icon(Icons.search, color: Color(0xFF8D8D99), size: 20),
            suffixIcon: _query.isNotEmpty
                ? GestureDetector(
                    onTap: _clearSearch,
                    child: const Icon(Icons.close, color: Color(0xFF8D8D99), size: 18),
                  )
                : null,
            border: InputBorder.none,
            contentPadding: const EdgeInsets.symmetric(vertical: 12),
          ),
          onChanged: (v) {
            // handled by listener
            if (_hasSearched) {
              setState(() => _hasSearched = false);
            }
          },
        ),
      ),
      actions: [
        if (_query.isNotEmpty)
          TextButton(
            onPressed: () => _doSearch(_query),
            child: Text(
              'Search',
              style: GoogleFonts.inter(
                color: _purple,
                fontWeight: FontWeight.bold,
                fontSize: 14,
              ),
            ),
          ),
      ],
      bottom: _hasSearched
          ? TabBar(
              controller: _tabController,
              indicatorColor: _purple,
              indicatorWeight: 3,
              labelColor: Colors.white,
              unselectedLabelColor: const Color(0xFF8D8D99),
              labelStyle: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 13),
              unselectedLabelStyle: GoogleFonts.inter(fontSize: 13),
              tabs: [
                Tab(text: 'All (${_users.length + _posts.length + _polls.length})'),
                Tab(text: 'Users (${_users.length})'),
                Tab(text: 'Posts (${_posts.length})'),
                Tab(text: 'Polls (${_polls.length})'),
              ],
            )
          : null,
    );
  }

  // ── empty / idle state ────────────────────
  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.search_rounded, size: 72, color: Colors.white.withOpacity(0.08)),
          const SizedBox(height: 16),
          Text(
            'Discover Ideate',
            style: GoogleFonts.outfit(
              fontSize: 22,
              fontWeight: FontWeight.bold,
              color: Colors.white.withOpacity(0.6),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Search for users, posts, polls & more',
            style: GoogleFonts.inter(
              fontSize: 14,
              color: Colors.white.withOpacity(0.3),
            ),
          ),
          const SizedBox(height: 32),
          _buildSearchTag(Icons.person_outline, 'Find people'),
          _buildSearchTag(Icons.article_outlined, 'Browse posts'),
          _buildSearchTag(Icons.poll_outlined, 'Explore polls'),
        ],
      ),
    );
  }

  Widget _buildSearchTag(IconData icon, String label) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: InkWell(
        onTap: () {
          _searchController.text = label.split(' ').last;
          _doSearch(label.split(' ').last);
        },
        borderRadius: BorderRadius.circular(30),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
          decoration: BoxDecoration(
            color: _card,
            borderRadius: BorderRadius.circular(30),
            border: Border.all(color: _border),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 16, color: _purple),
              const SizedBox(width: 8),
              Text(label, style: GoogleFonts.inter(color: Colors.white70, fontSize: 13)),
            ],
          ),
        ),
      ),
    );
  }

  // ── suggestion overlay ────────────────────
  Widget _buildSuggestionOverlay() {
    return Positioned(
      top: 0,
      left: 0,
      right: 0,
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 12),
        constraints: const BoxConstraints(maxHeight: 280),
        decoration: BoxDecoration(
          color: _card,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: _border),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.4),
              blurRadius: 20,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: _loadingSuggestions
            ? const Padding(
                padding: EdgeInsets.all(20),
                child: Center(
                  child: SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Color(0xFF7828B4),
                    ),
                  ),
                ),
              )
            : ListView.separated(
                shrinkWrap: true,
                itemCount: _suggestions.length,
                separatorBuilder: (_, __) =>
                    Divider(height: 1, color: _border),
                itemBuilder: (ctx, i) => _buildSuggestionTile(_suggestions[i]),
              ),
      ),
    );
  }

  Widget _buildSuggestionTile(_Suggestion s) {
    IconData icon;
    Color iconColor;
    switch (s.type) {
      case 'user':
        icon = Icons.person;
        iconColor = _purple;
        break;
      case 'poll':
        icon = Icons.poll;
        iconColor = const Color(0xFF2196F3);
        break;
      default:
        icon = Icons.article;
        iconColor = const Color(0xFF4CAF50);
    }

    return InkWell(
      onTap: () {
        _searchController.text = s.label.replaceAll('@', '');
        _doSearch(s.label.replaceAll('@', ''));
      },
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            if (s.type == 'user' && s.profileImage != null)
              CircleAvatar(
                radius: 16,
                backgroundImage: NetworkImage(s.profileImage!),
              )
            else
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: iconColor.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, size: 16, color: iconColor),
              ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                s.label,
                style: GoogleFonts.inter(color: Colors.white, fontSize: 14),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            Icon(Icons.north_west, size: 14, color: Colors.white.withOpacity(0.3)),
          ],
        ),
      ),
    );
  }

  // ── results view (tabbed) ──────────────────
  Widget _buildResultsView() {
    if (_isSearching) {
      return const Center(
        child: CircularProgressIndicator(color: Color(0xFF7828B4)),
      );
    }

    final allEmpty = _users.isEmpty && _posts.isEmpty && _polls.isEmpty;
    if (allEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.search_off_rounded,
                size: 64, color: Colors.white.withOpacity(0.1)),
            const SizedBox(height: 16),
            Text(
              'No results for "$_query"',
              style: GoogleFonts.inter(
                fontSize: 16,
                color: Colors.white.withOpacity(0.5),
              ),
            ),
          ],
        ),
      );
    }

    return TabBarView(
      controller: _tabController,
      children: [
        _buildAllTab(),
        _buildUsersTab(),
        _buildPostsTab(),
        _buildPollsTab(),
      ],
    );
  }

  // ── ALL tab ───────────────────────────────
  Widget _buildAllTab() {
    return ListView(
      padding: const EdgeInsets.symmetric(vertical: 12),
      children: [
        if (_users.isNotEmpty) ...[
          _sectionHeader('People', Icons.person, _users.length),
          ..._users.take(3).map(_buildUserTile),
          if (_users.length > 3)
            _viewMoreButton('View all ${_users.length} users', () {
              _tabController?.animateTo(1);
            }),
          const SizedBox(height: 8),
        ],
        if (_posts.isNotEmpty) ...[
          _sectionHeader('Posts', Icons.article, _posts.length),
          ..._posts.take(2).map((p) => PostCard(
                post: p,
                onRefresh: () => _doSearch(_query),
              )),
          if (_posts.length > 2)
            _viewMoreButton('View all ${_posts.length} posts', () {
              _tabController?.animateTo(2);
            }),
          const SizedBox(height: 8),
        ],
        if (_polls.isNotEmpty) ...[
          _sectionHeader('Polls', Icons.poll, _polls.length),
          ..._polls.take(2).map((p) => PollCard(
                poll: p,
                onRefresh: () => _doSearch(_query),
              )),
          if (_polls.length > 2)
            _viewMoreButton('View all ${_polls.length} polls', () {
              _tabController?.animateTo(3);
            }),
        ],
      ],
    );
  }

  // ── USERS tab ─────────────────────────────
  Widget _buildUsersTab() {
    if (_users.isEmpty) return _emptyTab('No users found', Icons.person_off_outlined);
    return ListView.separated(
      padding: const EdgeInsets.symmetric(vertical: 12),
      itemCount: _users.length,
      separatorBuilder: (_, __) => Divider(height: 1, color: _border),
      itemBuilder: (_, i) => _buildUserTile(_users[i]),
    );
  }

  // ── POSTS tab ─────────────────────────────
  Widget _buildPostsTab() {
    if (_posts.isEmpty) return _emptyTab('No posts found', Icons.article_outlined);
    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      itemCount: _posts.length,
      itemBuilder: (_, i) => PostCard(
        post: _posts[i],
        onRefresh: () => _doSearch(_query),
      ),
    );
  }

  // ── POLLS tab ─────────────────────────────
  Widget _buildPollsTab() {
    if (_polls.isEmpty) return _emptyTab('No polls found', Icons.poll_outlined);
    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      itemCount: _polls.length,
      itemBuilder: (_, i) => PollCard(
        poll: _polls[i],
        onRefresh: () => _doSearch(_query),
      ),
    );
  }

  // ── shared helpers ────────────────────────
  Widget _buildUserTile(UserModel u) {
    return InkWell(
      onTap: () => Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => OtherProfileScreen(userId: u.id),
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            CircleAvatar(
              radius: 24,
              backgroundColor: _card,
              backgroundImage:
                  u.profileImage != null ? NetworkImage(u.profileImage!) : null,
              child: u.profileImage == null
                  ? const Icon(Icons.person, color: Colors.white38, size: 26)
                  : null,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        u.username,
                        style: GoogleFonts.inter(
                          color: Colors.white,
                          fontWeight: FontWeight.w600,
                          fontSize: 15,
                        ),
                      ),
                      if (u.isverified) ...[
                        const SizedBox(width: 4),
                        const Icon(Icons.verified, color: Colors.blue, size: 15),
                      ],
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    u.category,
                    style: GoogleFonts.inter(
                      color: const Color(0xFF8D8D99),
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
            Text(
              '${u.followers.length} followers',
              style: GoogleFonts.inter(
                color: Colors.white38,
                fontSize: 12,
              ),
            ),
            const SizedBox(width: 4),
            const Icon(Icons.chevron_right, color: Colors.white24, size: 18),
          ],
        ),
      ),
    );
  }

  Widget _sectionHeader(String title, IconData icon, int count) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
      child: Row(
        children: [
          Icon(icon, size: 16, color: _purple),
          const SizedBox(width: 8),
          Text(
            title,
            style: GoogleFonts.outfit(
              color: Colors.white,
              fontWeight: FontWeight.bold,
              fontSize: 15,
            ),
          ),
          const SizedBox(width: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
            decoration: BoxDecoration(
              color: _purple.withOpacity(0.2),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              '$count',
              style: GoogleFonts.inter(color: _purple, fontSize: 11, fontWeight: FontWeight.bold),
            ),
          ),
        ],
      ),
    );
  }

  Widget _viewMoreButton(String label, VoidCallback onTap) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: TextButton(
        onPressed: onTap,
        style: TextButton.styleFrom(
          backgroundColor: _card,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
            side: BorderSide(color: _border),
          ),
        ),
        child: Text(
          label,
          style: GoogleFonts.inter(color: _purple, fontSize: 13),
        ),
      ),
    );
  }

  Widget _emptyTab(String message, IconData icon) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 52, color: Colors.white.withOpacity(0.1)),
          const SizedBox(height: 12),
          Text(
            message,
            style: GoogleFonts.inter(color: Colors.white38, fontSize: 15),
          ),
        ],
      ),
    );
  }
}
