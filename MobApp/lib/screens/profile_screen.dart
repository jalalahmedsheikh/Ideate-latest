import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../models/post_model.dart';
import '../models/poll_model.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../widgets/guest_state_card.dart';
import '../widgets/post_card.dart';
import '../widgets/poll_card.dart';
import 'edit_profile.dart';
import 'settings_screen.dart';
import 'creator_hub_screen.dart';
import 'reputation_screen.dart';
import 'communities_hub_screen.dart';
import '../widgets/reputation_chip.dart';
import '../widgets/verification_badge.dart';
import '../utils/app_colors.dart';
import '../widgets/custom_button.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  List<PostModel> _userPosts = [];
  List<PollModel> _userPolls = [];
  List<dynamic> _savedCreations = [];
  List<PostModel> _likedPosts = [];
  bool _isLoading = true;
  String? _error;
  int _activeTabIndex = 0; // 0: Posts, 1: Polls, 2: Saved, 3: Liked

  @override
  void initState() {
    super.initState();
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    if (authProvider.isAuthenticated) {
      _fetchProfileData();
    } else {
      _isLoading = false;
    }
  }

  Future<void> _fetchProfileData() async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    if (!authProvider.isAuthenticated) {
      if (mounted) {
        setState(() {
          _userPosts = [];
          _userPolls = [];
          _savedCreations = [];
          _likedPosts = [];
          _isLoading = false;
          _error = null;
        });
      }
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final responses = await Future.wait([
        ApiService.get('/post/userpost/all'),
        ApiService.get('/poll/userpolls/all'),
        ApiService.get('/post/saved/all'),
        ApiService.get('/post/liked/all'),
      ]);

      final postsRes = responses[0];
      final pollsRes = responses[1];
      final savedRes = responses[2];
      final likedRes = responses[3];

      List<PostModel> posts = [];
      List<PollModel> polls = [];
      List<dynamic> saved = [];
      List<PostModel> liked = [];

      // Parse user posts
      if (postsRes.statusCode == 200) {
        final data = json.decode(postsRes.body);
        if (data['success'] == true && data['posts'] != null) {
          for (var item in data['posts']) {
            posts.add(PostModel.fromJson(item));
          }
        }
      }

      // Parse user polls
      if (pollsRes.statusCode == 200) {
        final data = json.decode(pollsRes.body);
        if (data['success'] == true && data['polls'] != null) {
          for (var item in data['polls']) {
            polls.add(PollModel.fromJson(item));
          }
        }
      }

      // Parse saved creations
      if (savedRes.statusCode == 200) {
        final data = json.decode(savedRes.body);
        if (data['success'] == true) {
          if (data['posts'] != null) {
            for (var item in data['posts']) {
              saved.add(PostModel.fromJson(item));
            }
          }
          if (data['polls'] != null) {
            for (var item in data['polls']) {
              saved.add(PollModel.fromJson(item));
            }
          }
        }
      }

      // Parse liked posts
      if (likedRes.statusCode == 200) {
        final data = json.decode(likedRes.body);
        if (data['success'] == true && data['posts'] != null) {
          for (var item in data['posts']) {
            liked.add(PostModel.fromJson(item));
          }
        }
      }

      // Sort saved by creation date
      saved.sort((a, b) {
        final DateTime dateA = (a is PostModel) ? a.createdAt : (a as PollModel).createdAt;
        final DateTime dateB = (b is PostModel) ? b.createdAt : (b as PollModel).createdAt;
        return dateB.compareTo(dateA);
      });

      setState(() {
        _userPosts = posts;
        _userPolls = polls;
        _savedCreations = saved;
        _likedPosts = liked;
      });
    } catch (e, stackTrace) {
      print("ERROR FETCHING PROFILE DATA: $e");
      print(stackTrace);
      setState(() {
        _error = "Could not load profile data: $e";
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final user = authProvider.currentUser;

    if (user == null || !authProvider.isAuthenticated) {
      return Scaffold(
        appBar: AppBar(
          title: Text(
            'Profile',
            style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 22),
          ),
          backgroundColor: AppColors.background,
          elevation: 0,
        ),
        body: GuestStateCard(
          title: 'Your Personal Profile',
          description: 'Log in to view your profile, creations, bookmarks, and account settings.',
          icon: Icons.person_outline,
          onAuthSuccess: () {
            _fetchProfileData();
          },
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(
          '@${user.username}',
          style: GoogleFonts.outfit(fontWeight: FontWeight.bold),
        ),
        backgroundColor: const Color(0xFF0B0B0F),
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.menu, color: Colors.white),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const SettingsScreen()),
              );
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        color: const Color(0xFF7828B4),
        onRefresh: () async {
          // Use safe refresh — never clears token, never navigates away
          await authProvider.refreshCurrentUser();
          await _fetchProfileData();
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Profile stats and info block
              Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 36,
                      backgroundImage: user.profileImage != null
                          ? NetworkImage(user.profileImage!)
                          : null,
                      child: user.profileImage == null
                          ? const Icon(Icons.person, size: 36)
                          : null,
                    ),
                    const SizedBox(width: 24),
                    Expanded(
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceAround,
                        children: [
                          _buildStatColumn('Creations', (_userPosts.length + _userPolls.length).toString()),
                          _buildStatColumn('Followers', user.followers.length.toString()),
                          _buildStatColumn('Following', user.followings.length.toString()),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              // Username and Bio details
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          user.username,
                          style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
                        ),
                        if (user.isverified)
                          VerificationBadge(category: user.verificationCategory, size: 16),
                        const SizedBox(width: 8),
                        ReputationChip(
                          score: user.reputationScore,
                          level: user.reputationLevel,
                          compact: true,
                          onTap: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(builder: (context) => const ReputationScreen()),
                            );
                          },
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        gradient: AppColors.glassGradient,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: AppColors.primary.withOpacity(0.3)),
                      ),
                      child: Text(
                        user.category,
                        style: GoogleFonts.inter(fontSize: 12, color: AppColors.primaryLight, fontWeight: FontWeight.bold),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      user.bio ?? 'No bio added yet.',
                      style: GoogleFonts.inter(fontSize: 14, color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 14),

              // Phase 3 Feature Quick Shortcuts
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14),
                child: Row(
                  children: [
                    Expanded(
                      child: InkWell(
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (context) => const CreatorHubScreen()),
                          );
                        },
                        borderRadius: BorderRadius.circular(12),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
                          decoration: BoxDecoration(
                            color: const Color(0xFF6200EA).withOpacity(0.15),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: const Color(0xFF6200EA).withOpacity(0.35)),
                          ),
                          child: const Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.auto_graph, color: Color(0xFF9C27B0), size: 16),
                              SizedBox(width: 6),
                              Text(
                                'Creator Studio',
                                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Colors.white),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: InkWell(
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (context) => const CommunitiesHubScreen()),
                          );
                        },
                        borderRadius: BorderRadius.circular(12),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
                          decoration: BoxDecoration(
                            color: Colors.blue.withOpacity(0.12),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: Colors.blue.withOpacity(0.35)),
                          ),
                          child: const Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.groups, color: Colors.blue, size: 16),
                              SizedBox(width: 6),
                              Text(
                                'Communities',
                                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Colors.white),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 12),

              // Edit profile action button
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: AppButton(
                  text: 'Edit Profile',
                  icon: Icons.edit,
                  style: AppButtonStyle.secondary,
                  width: double.infinity,
                  height: 44,
                  onPressed: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (context) => const EditProfileScreen()),
                    ).then((_) {
                      _fetchProfileData();
                    });
                  },
                ),
              ),

              const Divider(color: AppColors.border, height: 32),

              // Custom premium tabs
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 4.0),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _buildTabButton(0, Icons.grid_on, 'Posts', _userPosts.length),
                    _buildTabButton(1, Icons.how_to_vote, 'Polls', _userPolls.length),
                    _buildTabButton(2, Icons.bookmark_border, 'Saved', _savedCreations.length),
                    _buildTabButton(3, Icons.favorite_border, 'Liked', _likedPosts.length),
                  ],
                ),
              ),

              const Divider(color: AppColors.border, height: 16),

              // Tab contents
              _buildTabContent(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTabButton(int index, IconData icon, String label, int count) {
    final isActive = _activeTabIndex == index;
    final activeColor = AppColors.primary;
    
    return Expanded(
      child: GestureDetector(
        onTap: () {
          setState(() {
            _activeTabIndex = index;
          });
        },
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            border: Border(
              bottom: BorderSide(
                color: isActive ? activeColor : Colors.transparent,
                width: 2.0,
              ),
            ),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                icon,
                color: isActive ? activeColor : Colors.grey,
                size: 20,
              ),
              const SizedBox(height: 4),
              Text(
                '$label ($count)',
                style: GoogleFonts.inter(
                  fontSize: 10,
                  fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
                  color: isActive ? Colors.white : Colors.grey,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTabContent() {
    if (_isLoading) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 64),
        child: Center(child: CircularProgressIndicator(color: Color(0xFF7828B4))),
      );
    }

    if (_error != null) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 64, horizontal: 16),
        child: Center(child: Text(_error!, style: const TextStyle(color: Colors.grey))),
      );
    }

    List<dynamic> itemsToDisplay = [];
    String emptyMessage = "";

    switch (_activeTabIndex) {
      case 0:
        itemsToDisplay = _userPosts;
        emptyMessage = "You haven't posted any creations yet.";
        break;
      case 1:
        itemsToDisplay = _userPolls;
        emptyMessage = "You haven't created any polls yet.";
        break;
      case 2:
        itemsToDisplay = _savedCreations;
        emptyMessage = "No saved posts or polls.";
        break;
      case 3:
        itemsToDisplay = _likedPosts;
        emptyMessage = "No liked posts yet.";
        break;
    }

    if (itemsToDisplay.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 64, horizontal: 16),
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                _activeTabIndex == 0
                    ? Icons.grid_on
                    : _activeTabIndex == 1
                        ? Icons.how_to_vote
                        : _activeTabIndex == 2
                            ? Icons.bookmark_border
                            : Icons.favorite_border,
                size: 48,
                color: Colors.grey.withOpacity(0.5),
              ),
              const SizedBox(height: 12),
              Text(
                emptyMessage,
                style: GoogleFonts.inter(color: Colors.grey, fontSize: 14),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
    }

    return ListView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 16),
      itemCount: itemsToDisplay.length,
      itemBuilder: (context, index) {
        final item = itemsToDisplay[index];
        if (item is PostModel) {
          return PostCard(post: item, onRefresh: _fetchProfileData);
        } else if (item is PollModel) {
          return PollCard(poll: item, onRefresh: _fetchProfileData);
        }
        return const SizedBox.shrink();
      },
    );
  }

  Widget _buildStatColumn(String label, String value) {
    return Column(
      children: [
        Text(
          value,
          style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: GoogleFonts.inter(fontSize: 13, color: Colors.grey),
        ),
      ],
    );
  }
}
