import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../models/user_model.dart';
import '../models/post_model.dart';
import '../models/poll_model.dart';
import '../models/question_model.dart';
import '../models/debate_model.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../utils/app_colors.dart';
import '../widgets/auth_prompt_sheet.dart';
import '../widgets/custom_button.dart';
import 'chat_screen.dart';
import '../widgets/post_card.dart';
import '../widgets/poll_card.dart';
import '../widgets/question_card.dart';
import '../widgets/debate_card.dart';
import '../widgets/reputation_chip.dart';
import '../widgets/verification_badge.dart';

class OtherProfileScreen extends StatefulWidget {
  final String userId;

  const OtherProfileScreen({
    super.key,
    required this.userId,
  });

  @override
  State<OtherProfileScreen> createState() => _OtherProfileScreenState();
}

class _OtherProfileScreenState extends State<OtherProfileScreen> {
  UserModel? _profileUser;
  List<dynamic> _creations = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetchProfileData();
  }

  Future<void> _fetchProfileData() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      // 1. Fetch target user profile details
      final profileRes = await ApiService.get('/user/profile/${widget.userId}');
      if (profileRes.statusCode != 200) {
        setState(() {
          _error = "Failed to load user profile. Check back shortly.";
          _isLoading = false;
        });
        return;
      }

      final profileData = json.decode(profileRes.body);
      if (profileData['success'] != true || profileData['user'] == null) {
        setState(() {
          _error = "User not found.";
          _isLoading = false;
        });
        return;
      }

      final targetUser = UserModel.fromJson(profileData['user']);

      // 2. Fetch and filter creations from explore feeds
      final responses = await Future.wait([
        ApiService.get('/post/allposts'),
        ApiService.get('/poll/allpolls'),
      ]);

      final postsRes = responses[0];
      final pollsRes = responses[1];

      final List<dynamic> userCreations = [];

      if (postsRes.statusCode == 200) {
        final postsData = json.decode(postsRes.body);
        if (postsData['success'] == true && postsData['posts'] != null) {
          for (var item in postsData['posts']) {
            final post = PostModel.fromJson(item);
            if (post.author.id == widget.userId) {
              userCreations.add(post);
            }
          }
        }
      }

      if (pollsRes.statusCode == 200) {
        final pollsData = json.decode(pollsRes.body);
        if (pollsData['success'] == true && pollsData['polls'] != null) {
          for (var item in pollsData['polls']) {
            final poll = PollModel.fromJson(item);
            if (poll.author.id == widget.userId) {
              userCreations.add(poll);
            }
          }
        }
      }

      // Sort chronological
      userCreations.sort((a, b) {
        final DateTime dateA = (a is PostModel) ? a.createdAt : (a as PollModel).createdAt;
        final DateTime dateB = (b is PostModel) ? b.createdAt : (b as PollModel).createdAt;
        return dateB.compareTo(dateA);
      });

      setState(() {
        _profileUser = targetUser;
        _creations = userCreations;
        _isLoading = false;
      });

    } catch (e) {
      setState(() {
        _error = "Failed to connect to server.";
        _isLoading = false;
      });
    }
  }

  Future<void> _toggleFollow() async {
    if (_profileUser == null) return;

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    if (!authProvider.isAuthenticated) {
      AuthPrompt.show(
        context,
        title: 'Follow Creator',
        message: 'Log in to follow ${_profileUser!.username} and see their creations in your Following feed.',
        icon: Icons.person_add_outlined,
      );
      return;
    }

    final currentUserId = authProvider.currentUser?.id;
    if (currentUserId == null) return;

    final isFollowing = _profileUser!.followers.contains(currentUserId);
    final action = isFollowing ? 'unfollow' : 'follow';

    try {
      final response = await ApiService.post('/user/toggleFollow', {
        'targetUserId': _profileUser!.id,
        'action': action,
      });

      final data = json.decode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        // Update local user followers list
        final List<String> updatedFollowers = List.from(_profileUser!.followers);
        if (action == 'follow') {
          updatedFollowers.add(currentUserId);
        } else {
          updatedFollowers.remove(currentUserId);
        }

        setState(() {
          _profileUser = UserModel(
            id: _profileUser!.id,
            username: _profileUser!.username,
            email: _profileUser!.email,
            profileImage: _profileUser!.profileImage,
            bio: _profileUser!.bio,
            category: _profileUser!.category,
            followers: updatedFollowers,
            followings: _profileUser!.followings,
            posts: _profileUser!.posts,
            bookmarks: _profileUser!.bookmarks,
            isverified: _profileUser!.isverified,
          );
        });

        // Also update logged-in user followings state in provider
        final currentUser = authProvider.currentUser;
        if (currentUser != null) {
          final List<String> updatedFollowings = List.from(currentUser.followings);
          if (action == 'follow') {
            updatedFollowings.add(_profileUser!.id);
          } else {
            updatedFollowings.remove(_profileUser!.id);
          }
          authProvider.updateCurrentUser(
            UserModel(
              id: currentUser.id,
              username: currentUser.username,
              email: currentUser.email,
              profileImage: currentUser.profileImage,
              bio: currentUser.bio,
              category: currentUser.category,
              followers: currentUser.followers,
              followings: updatedFollowings,
              posts: currentUser.posts,
              bookmarks: currentUser.bookmarks,
              isverified: currentUser.isverified,
            ),
          );
        }
      }
    } catch (e) {
      debugPrint("Error toggling follow: $e");
    }
  }

  @override
  Widget build(BuildContext context) {
    final currentUserId = Provider.of<AuthProvider>(context).currentUser?.id;
    final isFollowing = _profileUser?.followers.contains(currentUserId) ?? false;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          _profileUser != null ? '@${_profileUser!.username}' : 'User Profile',
          style: GoogleFonts.outfit(fontWeight: FontWeight.bold),
        ),
        backgroundColor: const Color(0xFF0B0B0F),
        elevation: 0,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF7828B4)))
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text(_error!, textAlign: TextAlign.center, style: GoogleFonts.inter(color: Colors.grey, fontSize: 16)),
                  ),
                )
              : RefreshIndicator(
                  color: const Color(0xFF7828B4),
                  onRefresh: _fetchProfileData,
                  child: SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Profile stats and avatar block
                        Padding(
                          padding: const EdgeInsets.all(16),
                          child: Row(
                            children: [
                              CircleAvatar(
                                radius: 36,
                                backgroundImage: _profileUser!.profileImage != null
                                    ? NetworkImage(_profileUser!.profileImage!)
                                    : null,
                                child: _profileUser!.profileImage == null
                                    ? const Icon(Icons.person, size: 36)
                                    : null,
                              ),
                              const SizedBox(width: 24),
                              Expanded(
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                                  children: [
                                    _buildStatColumn('Creations', _creations.length.toString()),
                                    _buildStatColumn('Followers', _profileUser!.followers.length.toString()),
                                    _buildStatColumn('Following', _profileUser!.followings.length.toString()),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),

                        // Username and Category details
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Text(
                                    _profileUser!.username,
                                    style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
                                  ),
                                  if (_profileUser!.isverified)
                                    VerificationBadge(category: _profileUser!.verificationCategory, size: 16),
                                  const SizedBox(width: 8),
                                  ReputationChip(
                                    score: _profileUser!.reputationScore,
                                    level: _profileUser!.reputationLevel,
                                    compact: true,
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
                                  _profileUser!.category,
                                  style: GoogleFonts.inter(fontSize: 12, color: AppColors.primaryLight, fontWeight: FontWeight.bold),
                                ),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                _profileUser!.bio ?? 'No bio added.',
                                style: GoogleFonts.inter(fontSize: 14, color: AppColors.textSecondary),
                              ),
                            ],
                          ),
                        ),

                        const SizedBox(height: 16),

                        // Follow / Unfollow Toggle & Message Button
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          child: Row(
                            children: [
                              Expanded(
                                child: AppButton(
                                  text: isFollowing ? 'Following' : 'Follow',
                                  icon: isFollowing ? Icons.check : Icons.person_add,
                                  style: isFollowing ? AppButtonStyle.secondary : AppButtonStyle.gradient,
                                  height: 46,
                                  onPressed: _toggleFollow,
                                ),
                              ),
                              const SizedBox(width: 12),
                              AppButton(
                                text: 'Message',
                                icon: Icons.chat_bubble_outline,
                                style: AppButtonStyle.secondary,
                                height: 46,
                                onPressed: () {
                                  final auth = Provider.of<AuthProvider>(context, listen: false);
                                  if (!auth.isAuthenticated) {
                                    AuthPrompt.show(
                                      context,
                                      title: 'Send Message',
                                      message: 'Log in to start private peer discussions.',
                                      icon: Icons.chat_bubble_outline,
                                    );
                                    return;
                                  }
                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (context) => ChatScreen(
                                        targetUser: _profileUser!,
                                      ),
                                    ),
                                  );
                                },
                              ),
                            ],
                          ),
                        ),

                        const Divider(color: AppColors.border, height: 32),

                        // User creations title
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          child: Text(
                            'Creations',
                            style: GoogleFonts.outfit(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: AppColors.textPrimary,
                            ),
                          ),
                        ),

                        const SizedBox(height: 12),

                        // List of creations
                        _creations.isEmpty
                            ? Padding(
                                padding: const EdgeInsets.symmetric(vertical: 48),
                                child: Center(
                                  child: Text(
                                    'No creations shared yet.',
                                    style: GoogleFonts.inter(color: Colors.grey),
                                  ),
                                ),
                              )
                            : ListView.builder(
                                shrinkWrap: true,
                                physics: const NeverScrollableScrollPhysics(),
                                padding: const EdgeInsets.symmetric(horizontal: 16),
                                itemCount: _creations.length,
                                itemBuilder: (context, index) {
                                  final item = _creations[index];
                                  if (item is PostModel) {
                                    return PostCard(post: item, onRefresh: _fetchProfileData);
                                  } else if (item is PollModel) {
                                    return PollCard(poll: item, onRefresh: _fetchProfileData);
                                  } else if (item is QuestionModel) {
                                    return QuestionCard(question: item, onRefresh: _fetchProfileData);
                                  } else if (item is DebateModel) {
                                    return DebateCard(debate: item, onRefresh: _fetchProfileData);
                                  }
                                  return const SizedBox.shrink();
                                },
                              ),
                      ],
                    ),
                  ),
                ),
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
