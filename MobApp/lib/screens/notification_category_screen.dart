import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';
import '../utils/app_colors.dart';

class NotificationCategoryScreen extends StatefulWidget {
  final String category; // 'followers' | 'activity' | 'system'
  final String title;

  const NotificationCategoryScreen({
    super.key,
    required this.category,
    required this.title,
  });

  @override
  State<NotificationCategoryScreen> createState() => _NotificationCategoryScreenState();
}

class _NotificationCategoryScreenState extends State<NotificationCategoryScreen> {
  List<dynamic> _notifications = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchCategoryNotifications();
  }

  Future<void> _fetchCategoryNotifications() async {
    setState(() => _isLoading = true);
    try {
      final response = await ApiService.get('/notifications?category=${widget.category}');
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['success'] == true && data['notifications'] != null) {
          setState(() {
            _notifications = data['notifications'];
            _isLoading = false;
          });
        }
      }
    } catch (e) {
      debugPrint("Error fetching category notifications: $e");
      setState(() => _isLoading = false);
    }
  }

  String _formatTime(String rawDate) {
    try {
      final dt = DateTime.parse(rawDate).toLocal();
      return DateFormat.jm().format(dt);
    } catch (_) {
      return '';
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
          widget.title,
          style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 20, color: AppColors.textPrimary),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _notifications.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        widget.category == 'followers'
                            ? Icons.group_outlined
                            : widget.category == 'activity'
                                ? Icons.favorite_border
                                : Icons.mark_email_unread_outlined,
                        size: 48,
                        color: AppColors.textMuted,
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'No notifications yet in ${widget.title}.',
                        style: GoogleFonts.inter(color: AppColors.textSecondary, fontSize: 14),
                      ),
                    ],
                  ),
                )
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: _notifications.length,
                  separatorBuilder: (_, __) => const Divider(color: AppColors.border),
                  itemBuilder: (context, index) {
                    final item = _notifications[index];
                    final sender = item['senderDetails'] ?? {};

                    return ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: CircleAvatar(
                        radius: 22,
                        backgroundImage: sender['profileImage'] != null && sender['profileImage'].toString().isNotEmpty
                            ? NetworkImage(sender['profileImage'])
                            : null,
                        child: sender['profileImage'] == null || sender['profileImage'].toString().isEmpty
                            ? const Icon(Icons.person, color: Colors.white, size: 20)
                            : null,
                      ),
                      title: RichText(
                        text: TextSpan(
                          style: GoogleFonts.inter(fontSize: 14, color: AppColors.textPrimary),
                          children: [
                            TextSpan(
                              text: sender['username'] != null ? '@${sender['username']} ' : 'Ideate System ',
                              style: const TextStyle(fontWeight: FontWeight.bold),
                            ),
                            TextSpan(text: item['message'] ?? ''),
                          ],
                        ),
                      ),
                      subtitle: Text(
                        _formatTime(item['createdAt'] ?? ''),
                        style: GoogleFonts.inter(fontSize: 11, color: AppColors.textSecondary),
                      ),
                    );
                  },
                ),
    );
  }
}
