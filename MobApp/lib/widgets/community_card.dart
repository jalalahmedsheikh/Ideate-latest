import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../models/community_model.dart';
import '../providers/auth_provider.dart';
import '../screens/community_detail_screen.dart';
import '../services/api_service.dart';
import 'auth_prompt_sheet.dart';

class CommunityCard extends StatefulWidget {
  final CommunityModel community;
  final VoidCallback? onUpdate;

  const CommunityCard({
    Key? key,
    required this.community,
    this.onUpdate,
  }) : super(key: key);

  @override
  State<CommunityCard> createState() => _CommunityCardState();
}

class _CommunityCardState extends State<CommunityCard> {
  late bool _isMember;
  late bool _isPending;
  late int _membersCount;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _initData();
  }

  @override
  void didUpdateWidget(covariant CommunityCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.community.id != widget.community.id ||
        oldWidget.community.membersCount != widget.community.membersCount ||
        oldWidget.community.userRole != widget.community.userRole) {
      _initData();
    }
  }

  void _initData() {
    _isMember = widget.community.isMember;
    _isPending = widget.community.isPending;
    _membersCount = widget.community.membersCount;
  }

  Future<void> _handleJoinToggle() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (!auth.isAuthenticated) {
      AuthPrompt.show(
        context,
        title: 'Join Community',
        message: 'Log in to join discussions and participate in exclusive community debates.',
        icon: Icons.groups_outlined,
      );
      return;
    }

    if (_isLoading) return;
    setState(() => _isLoading = true);

    try {
      if (_isMember) {
        // Leave
        final res = await ApiService.post('/community/${widget.community.id}/leave', {});
        final data = json.decode(res.body);
        if (res.statusCode == 200 && data['success'] == true) {
          setState(() {
            _isMember = false;
            _isPending = false;
            _membersCount = (_membersCount - 1).clamp(0, 999999);
          });
          widget.onUpdate?.call();
        }
      } else {
        // Join / Request
        final res = await ApiService.post('/community/${widget.community.id}/join', {});
        final data = json.decode(res.body);
        if (res.statusCode == 200 && data['success'] == true) {
          if (data['status'] == 'pending' || data['message']?.contains('request') == true) {
            setState(() => _isPending = true);
          } else {
            setState(() {
              _isMember = true;
              _isPending = false;
              _membersCount += 1;
            });
          }
          widget.onUpdate?.call();
        }
      }
    } catch (_) {
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surfaceColor = isDark ? const Color(0xFF1E1E2C) : Colors.white;
    final primaryColor = Theme.of(context).primaryColor;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
      decoration: BoxDecoration(
        color: surfaceColor,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: isDark ? Colors.white.withOpacity(0.08) : Colors.black.withOpacity(0.06),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(isDark ? 0.25 : 0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => CommunityDetailScreen(communityId: widget.community.id),
              ),
            ).then((_) => widget.onUpdate?.call());
          },
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    // Community Avatar
                    CircleAvatar(
                      radius: 24,
                      backgroundColor: primaryColor.withOpacity(0.15),
                      backgroundImage: widget.community.profileImage != null &&
                              widget.community.profileImage!.isNotEmpty
                          ? NetworkImage(widget.community.profileImage!)
                          : null,
                      child: widget.community.profileImage == null ||
                              widget.community.profileImage!.isEmpty
                          ? Text(
                              widget.community.name.isNotEmpty
                                  ? widget.community.name[0].toUpperCase()
                                  : 'C',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                color: primaryColor,
                                fontSize: 18,
                              ),
                            )
                          : null,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            widget.community.name,
                            style: GoogleFonts.plusJakartaSans(
                              fontWeight: FontWeight.w800,
                              fontSize: 15,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 2),
                          Row(
                            children: [
                              Text(
                                'c/${widget.community.handle}',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: isDark ? Colors.white54 : Colors.black45,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                              const SizedBox(width: 6),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: primaryColor.withOpacity(0.1),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  widget.community.category,
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w600,
                                    color: primaryColor,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    // Join / Member Button
                    SizedBox(
                      height: 34,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: _isMember
                              ? (isDark ? Colors.white.withOpacity(0.1) : Colors.grey.shade200)
                              : primaryColor,
                          foregroundColor: _isMember
                              ? (isDark ? Colors.white : Colors.black87)
                              : Colors.white,
                          elevation: 0,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(18),
                          ),
                          padding: const EdgeInsets.symmetric(horizontal: 14),
                        ),
                        onPressed: _isLoading ? null : _handleJoinToggle,
                        child: _isLoading
                            ? const SizedBox(
                                width: 14,
                                height: 14,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              )
                            : Text(
                                _isMember
                                    ? 'Joined'
                                    : (_isPending ? 'Requested' : 'Join'),
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                      ),
                    ),
                  ],
                ),

                if (widget.community.description.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  Text(
                    widget.community.description,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 13,
                      height: 1.35,
                      color: isDark ? Colors.white70 : Colors.black87,
                    ),
                  ),
                ],

                const SizedBox(height: 12),

                // Stats row
                Row(
                  children: [
                    Icon(Icons.people_outline, size: 14, color: isDark ? Colors.white54 : Colors.black45),
                    const SizedBox(width: 4),
                    Text(
                      '$_membersCount members',
                      style: TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w600,
                        color: isDark ? Colors.white60 : Colors.black54,
                      ),
                    ),
                    const SizedBox(width: 14),
                    Icon(Icons.article_outlined, size: 14, color: isDark ? Colors.white54 : Colors.black45),
                    const SizedBox(width: 4),
                    Text(
                      '${widget.community.postsCount + widget.community.debatesCount + widget.community.questionsCount} items',
                      style: TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w600,
                        color: isDark ? Colors.white60 : Colors.black54,
                      ),
                    ),
                    const Spacer(),
                    if (widget.community.visibility != 'public')
                      Row(
                        children: [
                          Icon(Icons.lock_outline, size: 12, color: Colors.amber.shade700),
                          const SizedBox(width: 3),
                          Text(
                            widget.community.visibility.toUpperCase(),
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: Colors.amber.shade700,
                            ),
                          ),
                        ],
                      ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
