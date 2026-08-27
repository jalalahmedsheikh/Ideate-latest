import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../models/post_model.dart';
import '../models/poll_model.dart';
import '../models/question_model.dart';
import '../models/debate_model.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../widgets/guest_state_card.dart';
import '../widgets/post_card.dart';
import '../widgets/poll_card.dart';
import '../widgets/question_card.dart';
import '../widgets/debate_card.dart';
import 'search_screen.dart';
import '../utils/app_colors.dart';

class FeedScreen extends StatefulWidget {
  final bool isExplore;

  const FeedScreen({
    super.key,
    required this.isExplore,
  });

  @override
  State<FeedScreen> createState() => FeedScreenState();
}

class FeedScreenState extends State<FeedScreen> {
  final ScrollController _scrollController = ScrollController();
  List<dynamic> _feedItems = [];
  bool _isLoading = true;
  String? _error;
  int _exploreSubTab = 0; // 0: For You (Personalized AI), 1: Explore / Latest

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

  void scrollToTopAndRefresh() {
    if (mounted) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(0, duration: const Duration(milliseconds: 300), curve: Curves.easeOut);
      }
      _fetchFeed();
    }
  }

  dynamic _parseFeedItem(dynamic item) {
    if (item is Map<String, dynamic>) {
      final type = item['type'] ?? item['itemType'] ?? item['feedType'];
      if (type == 'debate' || item['sideA'] != null || item['resolution'] != null) {
        return DebateModel.fromJson(item);
      }
      if (type == 'question' || (item['title'] != null && (item['answersCount'] != null || item['acceptedAnswer'] != null))) {
        return QuestionModel.fromJson(item);
      }
      if (type == 'poll' || (item['options'] != null && item['votes'] != null)) {
        return PollModel.fromJson(item);
      }
      return PostModel.fromJson(item);
    }
    return item;
  }

  Future<void> _fetchFeed() async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);

    // If on Following feed and guest, don't make API calls
    if (!widget.isExplore && !authProvider.isAuthenticated) {
      setState(() {
        _feedItems = [];
        _isLoading = false;
        _error = null;
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      if (widget.isExplore) {
        if (_exploreSubTab == 0) {
          // ── 1. For You: Recommendation Feed ──
          final response = await ApiService.get('/feed/for-you?page=1&limit=30');
          if (response.statusCode == 200) {
            final data = json.decode(response.body);
            final List<dynamic> loadedItems = [];

            if (data['success'] == true && data['feed'] != null) {
              for (var item in data['feed']) {
                loadedItems.add(_parseFeedItem(item));
              }
            }

            if (mounted) {
              setState(() {
                _feedItems = loadedItems;
                _isLoading = false;
              });
            }
          } else {
            await _fetchChronologicalExplore();
          }
        } else {
          // ── 2. Explore / Latest: Multi-Entity ──
          await _fetchChronologicalExplore();
        }
      } else {
        // Followings Feed (Authenticated)
        final response = await ApiService.get('/post/followings');
        if (response.statusCode == 200) {
          final data = json.decode(response.body);
          final List<dynamic> loadedItems = [];

          if (data['success'] == true) {
            if (data['feed'] != null && data['feed'] is List) {
              for (var item in data['feed']) {
                loadedItems.add(_parseFeedItem(item));
              }
            } else {
              if (data['posts'] != null) {
                for (var item in data['posts']) {
                  loadedItems.add(PostModel.fromJson(item));
                }
              }
              if (data['polls'] != null) {
                for (var item in data['polls']) {
                  loadedItems.add(PollModel.fromJson(item));
                }
              }
              loadedItems.sort((a, b) {
                final DateTime dateA = _getItemDate(a);
                final DateTime dateB = _getItemDate(b);
                return dateB.compareTo(dateA);
              });
            }
          }

          if (mounted) {
            setState(() {
              _feedItems = loadedItems;
              _isLoading = false;
            });
          }
        } else {
          if (mounted) {
            setState(() {
              _error = "Could not load your following feed.";
              _isLoading = false;
            });
          }
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = "Failed to load feed. Check your connection.";
          _isLoading = false;
        });
      }
    }
  }

  DateTime _getItemDate(dynamic item) {
    if (item is PostModel) return item.createdAt;
    if (item is PollModel) return item.createdAt;
    if (item is QuestionModel) return item.createdAt;
    if (item is DebateModel) return item.createdAt;
    return DateTime.now();
  }

  Future<void> _fetchChronologicalExplore() async {
    try {
      final responses = await Future.wait([
        ApiService.get('/post/allposts'),
        ApiService.get('/poll/allpolls'),
        ApiService.get('/question?limit=20'),
        ApiService.get('/debate?limit=20'),
      ]);

      final postsRes = responses[0];
      final pollsRes = responses[1];
      final questionsRes = responses[2];
      final debatesRes = responses[3];

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

      if (questionsRes.statusCode == 200) {
        final qData = json.decode(questionsRes.body);
        if (qData['success'] == true && qData['questions'] != null) {
          for (var item in qData['questions']) {
            loadedItems.add(QuestionModel.fromJson(item));
          }
        }
      }

      if (debatesRes.statusCode == 200) {
        final dData = json.decode(debatesRes.body);
        if (dData['success'] == true && dData['debates'] != null) {
          for (var item in dData['debates']) {
            loadedItems.add(DebateModel.fromJson(item));
          }
        }
      }

      loadedItems.sort((a, b) {
        final DateTime dateA = _getItemDate(a);
        final DateTime dateB = _getItemDate(b);
        return dateB.compareTo(dateA);
      });

      if (mounted) {
        setState(() {
          _feedItems = loadedItems;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _error = "Could not load explore feed.";
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isAuthenticated = Provider.of<AuthProvider>(context).isAuthenticated;

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
          widget.isExplore ? 'Ideate' : 'Following Feed',
          style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 22),
        ),
        backgroundColor: AppColors.background,
        centerTitle: false,
        elevation: 0,
        actions: [
          IconButton(
            tooltip: 'Search',
            icon: const Icon(Icons.search_rounded, color: AppColors.textPrimary, size: 26),
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
      body: Column(
        children: [
          // Sub-tabs for Home: "For You" vs "Latest"
          if (widget.isExplore) ...[
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: AppColors.cardBackground,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.border),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: GestureDetector(
                      onTap: () {
                        if (_exploreSubTab != 0) {
                          setState(() => _exploreSubTab = 0);
                          _fetchFeed();
                        }
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        decoration: BoxDecoration(
                          color: _exploreSubTab == 0 ? AppColors.primary : Colors.transparent,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.auto_awesome_rounded,
                              size: 14,
                              color: _exploreSubTab == 0 ? Colors.white : AppColors.textSecondary,
                            ),
                            const SizedBox(width: 6),
                            Text(
                              'For You',
                              textAlign: TextAlign.center,
                              style: GoogleFonts.inter(
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                color: _exploreSubTab == 0 ? Colors.white : AppColors.textSecondary,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  Expanded(
                    child: GestureDetector(
                      onTap: () {
                        if (_exploreSubTab != 1) {
                          setState(() => _exploreSubTab = 1);
                          _fetchFeed();
                        }
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        decoration: BoxDecoration(
                          color: _exploreSubTab == 1 ? AppColors.primary : Colors.transparent,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(
                          'Latest & Explore',
                          textAlign: TextAlign.center,
                          style: GoogleFonts.inter(
                            fontSize: 13,
                            fontWeight: FontWeight.bold,
                            color: _exploreSubTab == 1 ? Colors.white : AppColors.textSecondary,
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
          Expanded(
            child: (!widget.isExplore && !isAuthenticated)
                ? GuestStateCard(
                    title: 'Follow People on Ideate',
                    description: 'Follow other thinkers and creators to build your personalized feed of ideas and polls.',
                    icon: Icons.group_outlined,
                    onAuthSuccess: _fetchFeed,
                  )
                : _isLoading
                    ? const Center(
                        child: CircularProgressIndicator(
                          color: AppColors.primary,
                        ),
                      )
                    : _error != null
                        ? Center(
                            child: Padding(
                              padding: const EdgeInsets.all(24),
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    _error!,
                                    textAlign: TextAlign.center,
                                    style: GoogleFonts.inter(fontSize: 16, color: AppColors.textSecondary),
                                  ),
                                  const SizedBox(height: 16),
                                  ElevatedButton.icon(
                                    onPressed: _fetchFeed,
                                    icon: const Icon(Icons.refresh),
                                    label: const Text('Try Again'),
                                  ),
                                ],
                              ),
                            ),
                          )
                        : _feedItems.isEmpty
                            ? Center(
                                child: Padding(
                                  padding: const EdgeInsets.all(32),
                                  child: Column(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(
                                        widget.isExplore ? Icons.dynamic_feed_outlined : Icons.people_outline,
                                        size: 56,
                                        color: AppColors.textMuted,
                                      ),
                                      const SizedBox(height: 16),
                                      Text(
                                        widget.isExplore
                                            ? 'No creations shared yet.'
                                            : 'Your Following feed is empty.',
                                        textAlign: TextAlign.center,
                                        style: GoogleFonts.outfit(
                                          fontSize: 18,
                                          fontWeight: FontWeight.bold,
                                          color: AppColors.textPrimary,
                                        ),
                                      ),
                                      const SizedBox(height: 8),
                                      Text(
                                        widget.isExplore
                                            ? 'Be the first to share an idea, ask a question, or open a debate!'
                                            : 'Follow creators to see their ideas and debates here.',
                                        textAlign: TextAlign.center,
                                        style: GoogleFonts.inter(fontSize: 14, color: AppColors.textSecondary),
                                      ),
                                    ],
                                  ),
                                ),
                              )
                            : RefreshIndicator(
                                color: AppColors.primary,
                                backgroundColor: AppColors.surface,
                                onRefresh: _fetchFeed,
                                child: ListView.builder(
                                  controller: _scrollController,
                                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
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
                                    } else if (item is QuestionModel) {
                                      return QuestionCard(
                                        key: ValueKey('q_${item.id}'),
                                        question: item,
                                        onRefresh: _fetchFeed,
                                      );
                                    } else if (item is DebateModel) {
                                      return DebateCard(
                                        key: ValueKey('debate_${item.id}'),
                                        debate: item,
                                        onRefresh: _fetchFeed,
                                      );
                                    }
                                    return const SizedBox.shrink();
                                  },
                                ),
                              ),
          ),
        ],
      ),
    );
  }
}
