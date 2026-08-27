import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../models/badge_model.dart';
import '../services/api_service.dart';
import '../widgets/badge_pill.dart';

class BadgesScreen extends StatefulWidget {
  const BadgesScreen({Key? key}) : super(key: key);

  @override
  State<BadgesScreen> createState() => _BadgesScreenState();
}

class _BadgesScreenState extends State<BadgesScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  List<BadgeModel> _allBadges = [];
  List<BadgeModel> _earnedBadges = [];
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _fetchBadges();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _fetchBadges() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final res = await ApiService.get('/badges/catalog');
      final data = json.decode(res.body);

      if (res.statusCode == 200 && data['success'] == true) {
        final list = (data['badges'] as List? ?? [])
            .map((b) => BadgeModel.fromJson(b))
            .toList();

        setState(() {
          _allBadges = list;
          _earnedBadges = list.where((b) => b.isEarned).toList();
          _isLoading = false;
        });
      } else {
        setState(() {
          _errorMessage = data['message'] ?? 'Failed to load badges';
          _isLoading = false;
        });
      }
    } catch (_) {
      setState(() {
        _errorMessage = 'Network error loading badges';
        _isLoading = false;
      });
    }
  }

  Future<void> _togglePinBadge(BadgeModel badge) async {
    try {
      final res = await ApiService.put('/badges/display/${badge.badgeId}', {
        'isDisplayed': !badge.isDisplayed,
      });
      if (res.statusCode == 200) {
        _fetchBadges();
      }
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final primaryColor = Theme.of(context).primaryColor;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Achievements & Badges',
          style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w800),
        ),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: primaryColor,
          labelColor: primaryColor,
          unselectedLabelColor: isDark ? Colors.white54 : Colors.black45,
          tabs: [
            Tab(text: 'Earned (${_earnedBadges.length})'),
            Tab(text: 'Catalog (${_allBadges.length})'),
          ],
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _errorMessage != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(_errorMessage!),
                      const SizedBox(height: 12),
                      ElevatedButton(onPressed: _fetchBadges, child: const Text('Retry')),
                    ],
                  ),
                )
              : TabBarView(
                  controller: _tabController,
                  children: [
                    _buildBadgeGrid(_earnedBadges, true, isDark),
                    _buildBadgeGrid(_allBadges, false, isDark),
                  ],
                ),
    );
  }

  Widget _buildBadgeGrid(List<BadgeModel> list, bool isEarnedTab, bool isDark) {
    if (list.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.military_tech_outlined, size: 54, color: Colors.grey),
              const SizedBox(height: 12),
              Text(
                isEarnedTab
                    ? 'No badges earned yet. Participate in debates and accepted answers to earn badges!'
                    : 'No badges in catalog.',
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.grey),
              ),
            ],
          ),
        ),
      );
    }

    return GridView.builder(
      padding: const EdgeInsets.all(16),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
        childAspectRatio: 0.85,
      ),
      itemCount: list.length,
      itemBuilder: (ctx, i) {
        final badge = list[i];
        return Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF1E1E2C) : Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: badge.isEarned
                  ? const Color(0xFFFFB300).withOpacity(0.4)
                  : (isDark ? Colors.white10 : Colors.black12),
              width: badge.isEarned ? 1.5 : 1,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(isDark ? 0.2 : 0.03),
                blurRadius: 8,
                offset: const Offset(0, 3),
              ),
            ],
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(badge.icon, style: const TextStyle(fontSize: 32)),
              Text(
                badge.name,
                textAlign: TextAlign.center,
                style: GoogleFonts.plusJakartaSans(
                  fontWeight: FontWeight.w800,
                  fontSize: 14,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              Text(
                badge.description,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 11,
                  color: isDark ? Colors.white60 : Colors.black54,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              BadgePill(badge: badge, compact: true),
              if (badge.isEarned)
                InkWell(
                  onTap: () => _togglePinBadge(badge),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        badge.isDisplayed ? Icons.push_pin : Icons.push_pin_outlined,
                        size: 13,
                        color: badge.isDisplayed ? Colors.amber : Colors.grey,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        badge.isDisplayed ? 'Pinned' : 'Pin',
                        style: TextStyle(
                          fontSize: 11,
                          color: badge.isDisplayed ? Colors.amber : Colors.grey,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}
