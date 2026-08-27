import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../models/user_model.dart';
import '../services/api_service.dart';
import '../utils/app_colors.dart';

class MutedUsersScreen extends StatefulWidget {
  const MutedUsersScreen({super.key});

  @override
  State<MutedUsersScreen> createState() => _MutedUsersScreenState();
}

class _MutedUsersScreenState extends State<MutedUsersScreen> {
  List<UserModel> _mutedUsers = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchMutedUsers();
  }

  Future<void> _fetchMutedUsers() async {
    setState(() => _isLoading = true);
    try {
      final response = await ApiService.get('/user/muted');
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['success'] == true && data['mutedUsers'] != null) {
          final List fetched = data['mutedUsers'];
          setState(() {
            _mutedUsers = fetched.map((u) => UserModel.fromJson(u)).toList();
          });
        }
      }
    } catch (e) {
      debugPrint("Error fetching muted users: $e");
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _unmuteUser(UserModel user) async {
    try {
      final response = await ApiService.post('/user/mute', {'targetUserId': user.id});
      if (response.statusCode == 200) {
        setState(() {
          _mutedUsers.removeWhere((u) => u.id == user.id);
        });
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Unmuted @${user.username}.')),
          );
        }
      }
    } catch (e) {
      debugPrint("Unmute error: $e");
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(
          'Muted Accounts',
          style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: AppColors.textPrimary),
        ),
        backgroundColor: AppColors.background,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _mutedUsers.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.volume_off_rounded, size: 48, color: AppColors.textSecondary),
                      const SizedBox(height: 12),
                      Text(
                        'No muted accounts.',
                        style: GoogleFonts.outfit(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Accounts you mute will appear here.',
                        style: GoogleFonts.inter(fontSize: 13, color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _mutedUsers.length,
                  itemBuilder: (ctx, idx) {
                    final user = _mutedUsers[idx];
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
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  user.username,
                                  style: GoogleFonts.inter(
                                    fontWeight: FontWeight.bold,
                                    color: AppColors.textPrimary,
                                  ),
                                ),
                                Text(
                                  user.category,
                                  style: GoogleFonts.inter(fontSize: 12, color: AppColors.textSecondary),
                                ),
                              ],
                            ),
                          ),
                          OutlinedButton(
                            onPressed: () => _unmuteUser(user),
                            style: OutlinedButton.styleFrom(
                              side: const BorderSide(color: AppColors.border),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                            ),
                            child: const Text('Unmute', style: TextStyle(color: AppColors.textPrimary)),
                          ),
                        ],
                      ),
                    );
                  },
                ),
    );
  }
}
