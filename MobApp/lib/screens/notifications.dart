import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../models/user_model.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import 'other_profile.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<UserModel> _suggestedUsers = [];
  bool _isLoadingSuggestions = true;
  final List<Map<String, dynamic>> _mockNotifications = [
    {
      'id': '1',
      'username': 'wahaj',
      'action': 'liked your post',
      'time': '5m ago',
      'icon': Icons.favorite,
      'iconColor': Colors.red,
    },
    {
      'id': '2',
      'username': 'ahmed',
      'action': 'commented on your poll: "Superb idea!"',
      'time': '20m ago',
      'icon': Icons.comment,
      'iconColor': Colors.blue,
    },
    {
      'id': '3',
      'username': 'creator_ideate',
      'action': 'started following you',
      'time': '2h ago',
      'icon': Icons.person_add,
      'iconColor': Colors.purple,
    },
  ];

  @override
  void initState() {
    super.initState();
    _fetchSuggestedUsers();
  }

  Future<void> _fetchSuggestedUsers() async {
    setState(() {
      _isLoadingSuggestions = true;
    });

    try {
      final response = await ApiService.get('/user/suggestions');
      final data = json.decode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        final List<UserModel> loaded = [];
        if (data['suggestedUsers'] != null) {
          for (var item in data['suggestedUsers']) {
            loaded.add(UserModel.fromJson(item));
          }
        }
        setState(() {
          _suggestedUsers = loaded;
        });
      }
    } catch (e) {
      debugPrint("Error fetching suggestions: $e");
    } finally {
      setState(() {
        _isLoadingSuggestions = false;
      });
    }
  }

  Future<void> _toggleFollow(UserModel targetUser, int index) async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final currentUserId = authProvider.currentUser?.id;
    if (currentUserId == null) return;

    final isFollowing = targetUser.followers.contains(currentUserId);
    final action = isFollowing ? 'unfollow' : 'follow';

    try {
      final response = await ApiService.post('/user/toggleFollow', {
        'targetUserId': targetUser.id,
        'action': action,
      });

      final data = json.decode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        // Update local user followers list
        final List<String> updatedFollowers = List.from(targetUser.followers);
        if (action == 'follow') {
          updatedFollowers.add(currentUserId);
        } else {
          updatedFollowers.remove(currentUserId);
        }

        setState(() {
          _suggestedUsers[index] = UserModel(
            id: targetUser.id,
            username: targetUser.username,
            email: targetUser.email,
            profileImage: targetUser.profileImage,
            bio: targetUser.bio,
            category: targetUser.category,
            followers: updatedFollowers,
            followings: targetUser.followings,
            posts: targetUser.posts,
            bookmarks: targetUser.bookmarks,
            isverified: targetUser.isverified,
          );
        });

        // Also update logged-in user followings state in provider
        final currentUser = authProvider.currentUser;
        if (currentUser != null) {
          final List<String> updatedFollowings = List.from(currentUser.followings);
          if (action == 'follow') {
            updatedFollowings.add(targetUser.id);
          } else {
            updatedFollowings.remove(targetUser.id);
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

  void _navigateToProfile(String userId) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => OtherProfileScreen(userId: userId),
      ),
    ).then((_) => _fetchSuggestedUsers());
  }

  @override
  Widget build(BuildContext context) {
    final currentUserId = Provider.of<AuthProvider>(context).currentUser?.id;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Updates & Suggestions',
          style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 22),
        ),
        backgroundColor: const Color(0xFF0B0B0F),
        elevation: 0,
      ),
      body: RefreshIndicator(
        color: const Color(0xFF7828B4),
        onRefresh: () async {
          await _fetchSuggestedUsers();
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Horizontal suggested users section
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Text(
                  'Suggested Creators',
                  style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
                ),
              ),

              _isLoadingSuggestions
                  ? const SizedBox(
                      height: 180,
                      child: Center(child: CircularProgressIndicator(color: Color(0xFF7828B4))),
                    )
                  : _suggestedUsers.isEmpty
                      ? const SizedBox(
                          height: 60,
                          child: Center(child: Text('No suggestions available.', style: TextStyle(color: Colors.grey))),
                        )
                      : SizedBox(
                          height: 200,
                          child: ListView.builder(
                            padding: const EdgeInsets.symmetric(horizontal: 8),
                            scrollDirection: Axis.horizontal,
                            itemCount: _suggestedUsers.length,
                            itemBuilder: (context, index) {
                              final user = _suggestedUsers[index];
                              final isFollowing = user.followers.contains(currentUserId);

                              return Container(
                                margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                width: 140,
                                decoration: BoxDecoration(
                                  color: const Color(0xFF181824),
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(color: const Color(0xFF2C2C3E)),
                                ),
                                child: Padding(
                                  padding: const EdgeInsets.all(12),
                                  child: Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      GestureDetector(
                                        onTap: () => _navigateToProfile(user.id),
                                        child: CircleAvatar(
                                          radius: 28,
                                          backgroundImage: user.profileImage != null
                                              ? NetworkImage(user.profileImage!)
                                              : null,
                                          child: user.profileImage == null
                                              ? const Icon(Icons.person, size: 28)
                                              : null,
                                        ),
                                      ),
                                      const SizedBox(height: 8),
                                      GestureDetector(
                                        onTap: () => _navigateToProfile(user.id),
                                        child: Row(
                                          mainAxisAlignment: MainAxisAlignment.center,
                                          children: [
                                            Expanded(
                                              child: Text(
                                                '@${user.username}',
                                                textAlign: TextAlign.center,
                                                overflow: TextOverflow.ellipsis,
                                                style: GoogleFonts.inter(
                                                  fontSize: 13,
                                                  fontWeight: FontWeight.bold,
                                                  color: Colors.white,
                                                ),
                                              ),
                                            ),
                                            if (user.isverified) ...[
                                              const Icon(Icons.verified, color: Colors.blue, size: 12),
                                            ],
                                          ],
                                        ),
                                      ),
                                      Text(
                                        user.category,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: GoogleFonts.inter(fontSize: 11, color: Colors.grey),
                                      ),
                                      const SizedBox(height: 12),
                                      SizedBox(
                                        width: double.infinity,
                                        height: 32,
                                        child: ElevatedButton(
                                          style: ElevatedButton.styleFrom(
                                            backgroundColor: isFollowing ? const Color(0xFF2C2C3E) : const Color(0xFF7828B4),
                                            padding: EdgeInsets.zero,
                                            shape: RoundedRectangleBorder(
                                              borderRadius: BorderRadius.circular(8),
                                            ),
                                          ),
                                          onPressed: () => _toggleFollow(user, index),
                                          child: Text(
                                            isFollowing ? 'Following' : 'Follow',
                                            style: GoogleFonts.inter(
                                              fontSize: 12,
                                              fontWeight: FontWeight.bold,
                                              color: Colors.white,
                                            ),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),
                        ),

              const Divider(color: Color(0xFF2C2C3E), height: 32),

              // Mock updates list
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: Text(
                  'Recent Updates',
                  style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
                ),
              ),

              ListView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: _mockNotifications.length,
                itemBuilder: (context, index) {
                  final notif = _mockNotifications[index];
                  return ListTile(
                    leading: CircleAvatar(
                      backgroundColor: const Color(0xFF1E1E2C),
                      child: Icon(notif['icon'], color: notif['iconColor'], size: 20),
                    ),
                    title: RichText(
                      text: TextSpan(
                        style: GoogleFonts.inter(fontSize: 14, color: Colors.white),
                        children: [
                          TextSpan(
                            text: '@${notif['username']} ',
                            style: const TextStyle(fontWeight: FontWeight.bold),
                          ),
                          TextSpan(text: notif['action']),
                        ],
                      ),
                    ),
                    subtitle: Text(
                      notif['time'],
                      style: GoogleFonts.inter(fontSize: 11, color: Colors.grey),
                    ),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}
