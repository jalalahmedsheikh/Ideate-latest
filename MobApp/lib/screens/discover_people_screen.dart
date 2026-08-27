import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../models/user_model.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../utils/app_colors.dart';
import '../widgets/auth_prompt_sheet.dart';
import 'other_profile.dart';

class DiscoverPeopleScreen extends StatefulWidget {
  const DiscoverPeopleScreen({super.key});

  @override
  State<DiscoverPeopleScreen> createState() => _DiscoverPeopleScreenState();
}

class _DiscoverPeopleScreenState extends State<DiscoverPeopleScreen> {
  List<UserModel> _suggestedUsers = [];
  final Set<String> _followingIds = {};
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchSuggestedUsers();
  }

  Future<void> _fetchSuggestedUsers() async {
    setState(() => _isLoading = true);

    try {
      final response = await ApiService.get('/user/suggestions');
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['success'] == true && data['users'] != null) {
          final List fetched = data['users'];
          setState(() {
            _suggestedUsers = fetched.map((u) => UserModel.fromJson(u)).toList();
            for (var u in fetched) {
              if (u['isFollowing'] == true) {
                _followingIds.add(u['_id'] ?? u['id'] ?? '');
              }
            }
          });
        }
      }
    } catch (e) {
      debugPrint("Error fetching suggested users: $e");
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _toggleFollow(UserModel user) async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (!auth.isAuthenticated) {
      AuthPrompt.show(
        context,
        title: 'Follow User',
        message: 'Log in to follow creators and build your network.',
        icon: Icons.person_add_rounded,
      );
      return;
    }

    final isFollowing = _followingIds.contains(user.id);

    setState(() {
      if (isFollowing) {
        _followingIds.remove(user.id);
      } else {
        _followingIds.add(user.id);
      }
    });

    try {
      final response = await ApiService.post('/user/toggleFollow', {
        'targetUserId': user.id,
      });

      if (response.statusCode != 200) {
        setState(() {
          if (isFollowing) {
            _followingIds.add(user.id);
          } else {
            _followingIds.remove(user.id);
          }
        });
      }
    } catch (e) {
      debugPrint("Toggle follow error: $e");
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'Discover People',
          style: GoogleFonts.outfit(
            fontSize: 20,
            fontWeight: FontWeight.bold,
            color: AppColors.textPrimary,
          ),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _suggestedUsers.isEmpty
              ? Center(
                  child: Text(
                    'No new suggestions right now.',
                    style: GoogleFonts.inter(color: AppColors.textSecondary),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _fetchSuggestedUsers,
                  color: AppColors.primary,
                  child: ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    itemCount: _suggestedUsers.length,
                    itemBuilder: (context, index) {
                      final user = _suggestedUsers[index];
                      final isFollowing = _followingIds.contains(user.id);

                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: AppColors.cardBackground,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Row(
                          children: [
                            CircleAvatar(
                              radius: 24,
                              backgroundImage: user.profileImage != null &&
                                      user.profileImage!.isNotEmpty
                                  ? NetworkImage(user.profileImage!)
                                  : null,
                              child: (user.profileImage == null ||
                                      user.profileImage!.isEmpty)
                                  ? const Icon(Icons.person, size: 24)
                                  : null,
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: InkWell(
                                onTap: () {
                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (_) => OtherProfileScreen(userId: user.id),
                                    ),
                                  );
                                },
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Text(
                                          user.username,
                                          style: GoogleFonts.inter(
                                            fontWeight: FontWeight.bold,
                                            fontSize: 15,
                                            color: AppColors.textPrimary,
                                          ),
                                        ),
                                        if (user.isverified) ...[
                                          const SizedBox(width: 4),
                                          const Icon(Icons.verified, color: Colors.blue, size: 14),
                                        ],
                                      ],
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      user.category,
                                      style: GoogleFonts.inter(
                                        fontSize: 12,
                                        color: AppColors.primary,
                                        fontWeight: FontWeight.w500,
                                      ),
                                    ),
                                    if (user.bio != null && user.bio!.isNotEmpty) ...[
                                      const SizedBox(height: 4),
                                      Text(
                                        user.bio!,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: GoogleFonts.inter(
                                          fontSize: 12,
                                          color: AppColors.textSecondary,
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                            ),
                            ElevatedButton(
                              onPressed: () => _toggleFollow(user),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: isFollowing
                                    ? AppColors.surface
                                    : AppColors.primary,
                                foregroundColor: isFollowing
                                    ? AppColors.textPrimary
                                    : Colors.white,
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(16),
                                  side: BorderSide(
                                    color: isFollowing ? AppColors.border : Colors.transparent,
                                  ),
                                ),
                              ),
                              child: Text(
                                isFollowing ? 'Following' : 'Follow',
                                style: GoogleFonts.inter(
                                  fontWeight: FontWeight.w600,
                                  fontSize: 12,
                                ),
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ),
    );
  }
}
