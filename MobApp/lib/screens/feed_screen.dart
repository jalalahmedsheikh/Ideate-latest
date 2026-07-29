import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../models/post_model.dart';
import '../models/poll_model.dart';
import '../services/api_service.dart';
import '../widgets/post_card.dart';
import '../widgets/poll_card.dart';
import 'search_screen.dart';

class FeedScreen extends StatefulWidget {
  final bool isExplore;

  const FeedScreen({
    super.key,
    required this.isExplore,
  });

  @override
  State<FeedScreen> createState() => _FeedScreenState();
}

class _FeedScreenState extends State<FeedScreen> {
  List<dynamic> _feedItems = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetchFeed();
  }

  @override
  void didUpdateWidget(covariant FeedScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.isExplore != widget.isExplore) {
      _fetchFeed();
    }
  }

  Future<void> _fetchFeed() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      if (widget.isExplore) {
        // Fetch all posts and all polls in parallel
        final responses = await Future.wait([
          ApiService.get('/post/allposts'),
          ApiService.get('/poll/allpolls'),
        ]);

        final postsRes = responses[0];
        final pollsRes = responses[1];

        final List<dynamic> loadedItems = [];

        if (postsRes.statusCode == 200) {
          final postsData = json.decode(postsRes.body);
          if (postsData['success'] == true && postsData['posts'] != null) {
            for (var item in postsData['posts']) {
              loadedItems.add(PostModel.fromJson(item));
            }
          }
        }

        if (pollsRes.statusCode == 200) {
          final pollsData = json.decode(pollsRes.body);
          if (pollsData['success'] == true && pollsData['polls'] != null) {
            for (var item in pollsData['polls']) {
              loadedItems.add(PollModel.fromJson(item));
            }
          }
        }

        // Sort combined list chronologically (newest first)
        loadedItems.sort((a, b) {
          final DateTime dateA = (a is PostModel) ? a.createdAt : (a as PollModel).createdAt;
          final DateTime dateB = (b is PostModel) ? b.createdAt : (b as PollModel).createdAt;
          return dateB.compareTo(dateA);
        });

        setState(() {
          _feedItems = loadedItems;
          _isLoading = false;
        });
      } else {
        // Followings Feed
        final response = await ApiService.get('/post/followings');
        if (response.statusCode == 200) {
          final data = json.decode(response.body);
          final List<dynamic> loadedItems = [];
          if (data['success'] == true && data['posts'] != null) {
            for (var item in data['posts']) {
              loadedItems.add(PostModel.fromJson(item));
            }
          }
          setState(() {
            _feedItems = loadedItems;
            _isLoading = false;
          });
        } else {
          setState(() {
            _error = "No posts to show. Follow some users to see their posts.";
            _isLoading = false;
          });
        }
      }
    } catch (e) {
      setState(() {
        _error = "Failed to load feed. Check connection.";
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: Padding(
          padding: const EdgeInsets.all(8.0),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: Image.asset(
              'assets/logo/logo.png',
              fit: BoxFit.cover,
            ),
          ),
        ),
        title: Text(
          widget.isExplore ? 'Ideate Explore' : 'Following Feed',
          style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 22),
        ),
        backgroundColor: const Color(0xFF0B0B0F),
        centerTitle: false,
        elevation: 0,
        actions: [
          IconButton(
            tooltip: 'Search',
            icon: const Icon(Icons.search_rounded, color: Colors.white, size: 26),
            onPressed: () {
              Navigator.push(
                context,
                PageRouteBuilder(
                  pageBuilder: (_, __, ___) => const SearchScreen(),
                  transitionsBuilder: (_, anim, __, child) => FadeTransition(
                    opacity: anim,
                    child: child,
                  ),
                  transitionDuration: const Duration(milliseconds: 200),
                ),
              );
            },
          ),
        ],
      ),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(
                color: Color(0xFF7828B4),
              ),
            )
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text(
                      _error!,
                      textAlign: TextAlign.center,
                      style: GoogleFonts.inter(fontSize: 16, color: Colors.grey),
                    ),
                  ),
                )
              : _feedItems.isEmpty
                  ? Center(
                      child: Text(
                        'No creations shared yet.',
                        style: GoogleFonts.inter(fontSize: 16, color: Colors.grey),
                      ),
                    )
                  : RefreshIndicator(
                      color: const Color(0xFF7828B4),
                      backgroundColor: const Color(0xFF181824),
                      onRefresh: _fetchFeed,
                      child: ListView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        itemCount: _feedItems.length,
                        itemBuilder: (context, index) {
                          final item = _feedItems[index];
                          if (item is PostModel) {
                            return PostCard(
                              key: ValueKey('post_${item.id}'),
                              post: item,
                              onRefresh: _fetchFeed,
                            );
                          } else if (item is PollModel) {
                            return PollCard(
                              key: ValueKey('poll_${item.id}'),
                              poll: item,
                              onRefresh: _fetchFeed,
                            );
                          }
                          return const SizedBox.shrink();
                        },
                      ),
                    ),
    );
  }
}
