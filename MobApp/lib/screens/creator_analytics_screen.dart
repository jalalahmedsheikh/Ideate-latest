import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../models/creator_analytics_model.dart';
import '../services/api_service.dart';

class CreatorAnalyticsScreen extends StatefulWidget {
  const CreatorAnalyticsScreen({Key? key}) : super(key: key);

  @override
  State<CreatorAnalyticsScreen> createState() => _CreatorAnalyticsScreenState();
}

class _CreatorAnalyticsScreenState extends State<CreatorAnalyticsScreen> {
  String _selectedWindow = '28d';
  CreatorAnalyticsModel? _analytics;
  bool _isLoading = true;
  String? _errorMessage;

  final List<String> _windows = ['7d', '28d', '90d'];

  @override
  void initState() {
    super.initState();
    _fetchAnalytics();
  }

  Future<void> _fetchAnalytics() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final res = await ApiService.get('/creator/analytics?window=$_selectedWindow');
      final data = json.decode(res.body);

      if (res.statusCode == 200 && data['success'] == true) {
        setState(() {
          _analytics = CreatorAnalyticsModel.fromJson(data['analytics']);
          _isLoading = false;
        });
      } else {
        setState(() {
          _errorMessage = data['message'] ?? 'Failed to load analytics';
          _isLoading = false;
        });
      }
    } catch (_) {
      setState(() {
        _errorMessage = 'Network error loading analytics';
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final primaryColor = Theme.of(context).primaryColor;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Creator Analytics',
          style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w800),
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
                      ElevatedButton(onPressed: _fetchAnalytics, child: const Text('Retry')),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _fetchAnalytics,
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Window Selector
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              'Reporting Window',
                              style: GoogleFonts.plusJakartaSans(
                                fontWeight: FontWeight.w700,
                                fontSize: 14,
                              ),
                            ),
                            Row(
                              children: _windows.map((w) {
                                final isSelected = _selectedWindow == w;
                                return Padding(
                                  padding: const EdgeInsets.only(left: 6),
                                  child: ChoiceChip(
                                    label: Text(w.toUpperCase()),
                                    selected: isSelected,
                                    selectedColor: primaryColor.withOpacity(0.2),
                                    onSelected: (val) {
                                      if (val) {
                                        setState(() => _selectedWindow = w);
                                        _fetchAnalytics();
                                      }
                                    },
                                  ),
                                );
                              }).toList(),
                            ),
                          ],
                        ),

                        const SizedBox(height: 16),

                        // 4 Key Metric Cards (2x2 Grid)
                        GridView.count(
                          crossAxisCount: 2,
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          crossAxisSpacing: 12,
                          mainAxisSpacing: 12,
                          childAspectRatio: 1.45,
                          children: [
                            _buildMetricCard(
                              title: 'Impressions',
                              value: '${_analytics?.totalImpressions ?? 0}',
                              icon: Icons.visibility_outlined,
                              color: const Color(0xFF1E88E5),
                              isDark: isDark,
                            ),
                            _buildMetricCard(
                              title: 'Interactions',
                              value: '${_analytics?.totalInteractions ?? 0}',
                              icon: Icons.touch_app_outlined,
                              color: const Color(0xFF43A047),
                              isDark: isDark,
                            ),
                            _buildMetricCard(
                              title: 'Engagement Rate',
                              value: '${(_analytics?.overallEngagementRate ?? 0.0).toStringAsFixed(1)}%',
                              icon: Icons.trending_up_rounded,
                              color: const Color(0xFF8E24AA),
                              isDark: isDark,
                            ),
                            _buildMetricCard(
                              title: 'New Followers',
                              value: '+${_analytics?.newFollowers ?? 0}',
                              icon: Icons.person_add_alt_1_outlined,
                              color: const Color(0xFFFF8F00),
                              isDark: isDark,
                            ),
                          ],
                        ),

                        const SizedBox(height: 24),

                        // Deterministic Growth Insights
                        if (_analytics?.deterministicInsights.isNotEmpty ?? false) ...[
                          Text(
                            'Performance Insights',
                            style: GoogleFonts.plusJakartaSans(
                              fontWeight: FontWeight.w800,
                              fontSize: 16,
                            ),
                          ),
                          const SizedBox(height: 10),
                          Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: const Color(0xFF6200EA).withOpacity(0.08),
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(color: const Color(0xFF6200EA).withOpacity(0.2)),
                            ),
                            child: Column(
                              children: _analytics!.deterministicInsights.map((insight) {
                                return Padding(
                                  padding: const EdgeInsets.symmetric(vertical: 4.0),
                                  child: Row(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      const Icon(Icons.bolt_rounded, size: 18, color: Color(0xFF6200EA)),
                                      const SizedBox(width: 8),
                                      Expanded(
                                        child: Text(
                                          insight,
                                          style: const TextStyle(fontSize: 13, height: 1.4),
                                        ),
                                      ),
                                    ],
                                  ),
                                );
                              }).toList(),
                            ),
                          ),
                          const SizedBox(height: 24),
                        ],

                        // Breakdown by Content Type
                        Text(
                          'Content Type Breakdown',
                          style: GoogleFonts.plusJakartaSans(
                            fontWeight: FontWeight.w800,
                            fontSize: 16,
                          ),
                        ),
                        const SizedBox(height: 10),
                        ...(_analytics?.breakdownByType.entries.map((entry) {
                              final type = entry.key;
                              final data = entry.value;
                              return Card(
                                margin: const EdgeInsets.only(bottom: 8),
                                child: ListTile(
                                  leading: CircleAvatar(
                                    backgroundColor: primaryColor.withOpacity(0.1),
                                    child: Text(
                                      type[0].toUpperCase(),
                                      style: TextStyle(fontWeight: FontWeight.bold, color: primaryColor),
                                    ),
                                  ),
                                  title: Text(
                                    type.toUpperCase(),
                                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                                  ),
                                  subtitle: Text(
                                    '${data.count} items • ${data.impressions} views • ${data.interactions} actions',
                                    style: const TextStyle(fontSize: 12),
                                  ),
                                  trailing: Text(
                                    '${data.engagementRate.toStringAsFixed(1)}% ER',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w800,
                                      color: primaryColor,
                                      fontSize: 13,
                                    ),
                                  ),
                                ),
                              );
                            }) ??
                            []),

                        const SizedBox(height: 24),

                        // Top Performing Content
                        if (_analytics?.topPerformingContent.isNotEmpty ?? false) ...[
                          Text(
                            'Top Performing Content',
                            style: GoogleFonts.plusJakartaSans(
                              fontWeight: FontWeight.w800,
                              fontSize: 16,
                            ),
                          ),
                          const SizedBox(height: 10),
                          ..._analytics!.topPerformingContent.map((item) {
                            return Card(
                              margin: const EdgeInsets.only(bottom: 8),
                              child: ListTile(
                                title: Text(
                                  item.title,
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                subtitle: Text(
                                  '${item.type.toUpperCase()} • ${item.views} views • ${item.interactions} actions',
                                  style: const TextStyle(fontSize: 11.5),
                                ),
                                trailing: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: Colors.green.withOpacity(0.12),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Text(
                                    '${item.engagementRate.toStringAsFixed(1)}% ER',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.bold,
                                      color: Colors.green,
                                      fontSize: 12,
                                    ),
                                  ),
                                ),
                              ),
                            );
                          }),
                        ],
                      ],
                    ),
                  ),
                ),
    );
  }

  Widget _buildMetricCard({
    required String title,
    required String value,
    required IconData icon,
    required Color color,
    required bool isDark,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E1E2C) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withOpacity(0.2), width: 1.2),
        boxShadow: [
          BoxShadow(
            color: color.withOpacity(0.06),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                title,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: isDark ? Colors.white60 : Colors.black54,
                ),
              ),
              Icon(icon, size: 18, color: color),
            ],
          ),
          Text(
            value,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}
