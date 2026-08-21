import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../models/user_model.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../utils/app_colors.dart';
import 'chat_screen.dart';
import 'notification_category_screen.dart';
import 'search_screen.dart';
import 'other_profile.dart';
import 'dart:async';
class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  bool _isLoading = true;
  int _followersUnread = 0;
  int _activityUnread = 0;
  int _systemUnread = 0;

  String _latestFollowerText = 'No new followers yet.';

  // Helper to clear notification count on backend
  Future<void> _clearNotification(String type) async {
    try {
      await ApiService.put('/notifications/clear', {'type': type});
    } catch (e) {
      debugPrint('Error clearing $type notifications: $e');
    }
  }
  String _latestActivityText = 'No recent activity yet.';
  String _latestSystemText = 'Account updates and system alerts.';
  Timer? _refreshTimer;
  List<dynamic> _conversations = [];
  List<UserModel> _suggestedUsers = [];

  @override
  void initState() {
    super.initState();
    _fetchInboxData();
    // Refresh every 30 seconds to show new notification bubbles
    _refreshTimer = Timer.periodic(const Duration(seconds: 30), (_) => _fetchInboxData());
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  Future<void> _fetchInboxData() async {
    setState(() => _isLoading = true);

    try {
      final results = await Future.wait([
        ApiService.get('/notifications'),
        ApiService.get('/message/conversations'),
        ApiService.get('/user/suggestions'),
      ]);

      final notifRes = results[0];
      final convRes = results[1];
      final suggRes = results[2];

      // Parse notifications breakdown
      if (notifRes.statusCode == 200) {
        final notifData = json.decode(notifRes.body);
        if (notifData['success'] == true && notifData['categories'] != null) {
          final cat = notifData['categories'];
          _followersUnread = cat['followersUnread'] ?? 0;
          _activityUnread = cat['activityUnread'] ?? 0;
          _systemUnread = cat['systemUnread'] ?? 0;

          if (cat['latestFollower'] != null) {
            final sender = cat['latestFollower']['senderDetails'] ?? {};
            _latestFollowerText = '${sender['username'] ?? 'User'} started following you.';
          }
          if (cat['latestActivity'] != null) {
            _latestActivityText = cat['latestActivity']['message'] ?? 'New activity on your creation.';
          }
          if (cat['latestSystem'] != null) {
            _latestSystemText = cat['latestSystem']['message'] ?? 'Account updates and security.';
          }
        }
      }

      // Parse 1-to-1 conversations
      if (convRes.statusCode == 200) {
        final convData = json.decode(convRes.body);
        if (convData['success'] == true && convData['conversations'] != null) {
          _conversations = convData['conversations'];
        }
      }

      // Parse user suggestions
      if (suggRes.statusCode == 200) {
        final suggData = json.decode(suggRes.body);
        if (suggData['success'] == true && suggData['suggestedUsers'] != null) {
          final List<UserModel> loaded = [];
          for (var item in suggData['suggestedUsers']) {
            loaded.add(UserModel.fromJson(item));
          }
          _suggestedUsers = loaded;
        }
      }
    } catch (e) {
      debugPrint("Error fetching inbox data: $e");
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  void _showNewChatDialog() {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.dialogBackground,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return Container(
          padding: const EdgeInsets.all(16),
          height: MediaQuery.of(context).size.height * 0.5,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'New 1-to-1 Chat',
                    style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, color: AppColors.textSecondary),
                    onPressed: () => Navigator.pop(ctx),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                'Select a creator to start chatting:',
                style: GoogleFonts.inter(fontSize: 13, color: AppColors.textSecondary),
              ),
              const SizedBox(height: 12),
              Expanded(
                child: _suggestedUsers.isEmpty
                    ? const Center(child: Text('No users found.', style: TextStyle(color: AppColors.textSecondary)))
                    : ListView.builder(
                        itemCount: _suggestedUsers.length,
                        itemBuilder: (context, index) {
                          final user = _suggestedUsers[index];
                          return ListTile(
                            leading: CircleAvatar(
                              backgroundImage: user.profileImage != null && user.profileImage!.isNotEmpty
                                  ? NetworkImage(user.profileImage!)
                                  : null,
                              child: user.profileImage == null || user.profileImage!.isEmpty
                                  ? const Icon(Icons.person, color: Colors.white)
                                  : null,
                            ),
                            title: Text('@${user.username}', style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.bold)),
                            subtitle: Text(user.category, style: GoogleFonts.inter(color: AppColors.textSecondary, fontSize: 12)),
                            onTap: () {
                              Navigator.pop(ctx);
                              Navigator.push(
                                context,
                                MaterialPageRoute(builder: (_) => ChatScreen(targetUser: user)),
                              );
                            },
                          );
                        },
                      ),
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.add_circle_outline_rounded, color: AppColors.textPrimary, size: 26),
          onPressed: _showNewChatDialog,
        ),
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Inbox',
              style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 22, color: AppColors.textPrimary),
            ),
            const SizedBox(width: 6),
            Container(
              width: 8,
              height: 8,
              decoration: const BoxDecoration(
                color: AppColors.success,
                shape: BoxShape.circle,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.search_rounded, color: AppColors.textPrimary, size: 26),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const SearchScreen()),
              );
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        color: AppColors.primary,
        backgroundColor: AppColors.surface,
        onRefresh: _fetchInboxData,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── 1. TOP CATEGORIZED NOTIFICATION ROWS (Matching Reference Image) ──
              _buildCategoryTile(
                icon: Icons.people_alt_rounded,
                iconBgColor: const Color(0xFF00A8FF), // Bright Blue
                title: 'New followers',
                subtitle: _latestFollowerText,
                badgeCount: _followersUnread,
                onTap: () async {
                  // Clear badge count locally
                  setState(() => _followersUnread = 0);
                  await _clearNotification('followers');
                  await Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => const NotificationCategoryScreen(category: 'followers', title: 'New Followers'),
                    ),
                  );
                  await _fetchInboxData();
                },
              ),

              _buildCategoryTile(
                icon: Icons.notifications_rounded,
                iconBgColor: const Color(0xFFE91E63), // Pink / Red
                title: 'Activity',
                subtitle: _latestActivityText,
                badgeCount: _activityUnread,
                onTap: () async {
                  setState(() => _activityUnread = 0);
                  await _clearNotification('activity');
                  await Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => const NotificationCategoryScreen(category: 'activity', title: 'Activity'),
                    ),
                  );
                  await _fetchInboxData();
                },
              ),

              _buildCategoryTile(
                icon: Icons.inbox_rounded,
                iconBgColor: const Color(0xFF1E293B), // Dark Navy
                title: 'System notifications',
                subtitle: _latestSystemText,
                badgeCount: _systemUnread,
                isSystemDot: true,
                onTap: () async {
                  setState(() => _systemUnread = 0);
                  await _clearNotification('system');
                  await Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => const NotificationCategoryScreen(category: 'system', title: 'System Notifications'),
                    ),
                  );
                  await _fetchInboxData();
                },
              ),

              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: Divider(color: AppColors.border, height: 1),
              ),

              // ── 2. MESSAGE REQUESTS TILE ──
              _buildCategoryTile(
                icon: Icons.chat_bubble_rounded,
                iconBgColor: const Color(0xFF1E293B),
                title: 'Message requests',
                subtitle: 'You have 0 requests',
                onTap: () {},
              ),

              const SizedBox(height: 12),

              // ── 3. DIRECT MESSAGES / 1-to-1 CONVERSATIONS HEADER ──
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Direct Messages',
                      style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                    ),
                    GestureDetector(
                      onTap: _showNewChatDialog,
                      child: Text(
                        '+ New Chat',
                        style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.primary),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 8),

              // ── 4. 1-to-1 CONVERSATIONS LIST ──
              _isLoading
                  ? const Padding(
                      padding: EdgeInsets.all(32),
                      child: Center(
                        child: CircularProgressIndicator(color: AppColors.primary),
                      ),
                    )
                  : _conversations.isEmpty
                      ? Container(
                          padding: const EdgeInsets.all(24),
                          alignment: Alignment.center,
                          child: Column(
                            children: [
                              CircleAvatar(
                                radius: 28,
                                backgroundColor: AppColors.surfaceElevated,
                                child: const Icon(Icons.forum_outlined, color: AppColors.textMuted, size: 28),
                              ),
                              const SizedBox(height: 12),
                              Text(
                                'No direct messages yet.',
                                style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                'Tap + New Chat above to message any creator!',
                                textAlign: TextAlign.center,
                                style: GoogleFonts.inter(fontSize: 12, color: AppColors.textSecondary),
                              ),
                            ],
                          ),
                        )
                      : ListView.builder(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          itemCount: _conversations.length,
                          itemBuilder: (context, index) {
                            final conv = _conversations[index];
                            final partnerUser = UserModel.fromJson(conv['user']);
                            final lastMsg = conv['lastMessage'] ?? {};
                            final unread = conv['unreadCount'] ?? 0;
                            final isOnline = conv['isOnline'] == true;

                            return ListTile(
                              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                              leading: Stack(
                                children: [
                                  CircleAvatar(
                                    radius: 24,
                                    backgroundImage: partnerUser.profileImage != null && partnerUser.profileImage!.isNotEmpty
                                        ? NetworkImage(partnerUser.profileImage!)
                                        : null,
                                    child: partnerUser.profileImage == null || partnerUser.profileImage!.isEmpty
                                        ? const Icon(Icons.person, color: Colors.white, size: 24)
                                        : null,
                                  ),
                                  if (isOnline)
                                    Positioned(
                                      right: 0,
                                      bottom: 0,
                                      child: Container(
                                        width: 12,
                                        height: 12,
                                        decoration: BoxDecoration(
                                          color: AppColors.success,
                                          shape: BoxShape.circle,
                                          border: Border.all(color: AppColors.background, width: 2),
                                        ),
                                      ),
                                    ),
                                ],
                              ),
                              title: Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      '@${partnerUser.username}',
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: GoogleFonts.inter(
                                        fontSize: 15,
                                        fontWeight: unread > 0 ? FontWeight.bold : FontWeight.w600,
                                        color: AppColors.textPrimary,
                                      ),
                                    ),
                                  ),
                                  if (partnerUser.isverified) ...[
                                    const SizedBox(width: 4),
                                    const Icon(Icons.verified, color: Colors.blue, size: 14),
                                  ],
                                ],
                              ),
                              subtitle: Text(
                                lastMsg['text'] != null && lastMsg['text'].toString().isNotEmpty
                                    ? lastMsg['text']
                                    : 'Say hi to ${partnerUser.username}',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: GoogleFonts.inter(
                                  fontSize: 13,
                                  color: unread > 0 ? AppColors.textPrimary : AppColors.textSecondary,
                                  fontWeight: unread > 0 ? FontWeight.bold : FontWeight.normal,
                                ),
                              ),
                              trailing: unread > 0
                                  ? Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                      decoration: BoxDecoration(
                                        color: AppColors.accentPink,
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                      child: Text(
                                        '$unread',
                                        style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.white),
                                      ),
                                    )
                                  : const Icon(Icons.chevron_right, color: AppColors.textMuted, size: 18),
                              onTap: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(builder: (_) => ChatScreen(targetUser: partnerUser)),
                                ).then((_) => _fetchInboxData());
                              },
                            );
                          },
                        ),
            ],
          ),
        ),
      ),
    );
  }

  // ── Helper to build top category notification rows (Matching Reference Image) ──
  Widget _buildCategoryTile({
    required IconData icon,
    required Color iconBgColor,
    required String title,
    required String subtitle,
    int badgeCount = 0,
    bool isSystemDot = false,
    required VoidCallback onTap,
  }) {
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      onTap: onTap,
      leading: Container(
        width: 48,
        height: 48,
        decoration: BoxDecoration(
          color: iconBgColor,
          shape: BoxShape.circle,
        ),
        child: Icon(icon, color: Colors.white, size: 24),
      ),
      title: Text(
        title,
        style: GoogleFonts.inter(
          fontSize: 15,
          fontWeight: FontWeight.bold,
          color: AppColors.textPrimary,
        ),
      ),
      subtitle: Text(
        subtitle,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: GoogleFonts.inter(
          fontSize: 13,
          color: AppColors.textSecondary,
        ),
      ),
      trailing: Badge(
        backgroundColor: AppColors.accentPink,
        label: Text(
          '$badgeCount',
          style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.white),
        ),
        isLabelVisible: badgeCount > 0,
        child: isSystemDot && badgeCount > 0
            ? const SizedBox.shrink()
            : const Icon(Icons.chevron_right, color: AppColors.textMuted, size: 20),
      ),
    );
  }
}
