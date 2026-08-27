import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../models/reputation_model.dart';
import '../services/api_service.dart';
import 'badges_screen.dart';

class ReputationScreen extends StatefulWidget {
  const ReputationScreen({Key? key}) : super(key: key);

  @override
  State<ReputationScreen> createState() => _ReputationScreenState();
}

class _ReputationScreenState extends State<ReputationScreen> {
  ReputationSummaryModel? _summary;
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _fetchReputation();
  }

  Future<void> _fetchReputation() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final res = await ApiService.get('/reputation/me');
      final data = json.decode(res.body);

      if (res.statusCode == 200 && data['success'] == true) {
        setState(() {
          _summary = ReputationSummaryModel.fromJson(data['reputation']);
          _isLoading = false;
        });
      } else {
        setState(() {
          _errorMessage = data['message'] ?? 'Failed to load reputation';
          _isLoading = false;
        });
      }
    } catch (_) {
      setState(() {
        _errorMessage = 'Network error loading reputation';
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Reputation & Trust',
          style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w800),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.military_tech_outlined),
            tooltip: 'View Badges',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const BadgesScreen()),
              );
            },
          ),
        ],
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
                      ElevatedButton(onPressed: _fetchReputation, child: const Text('Retry')),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _fetchReputation,
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Reputation Score Hero Card
                        Container(
                          padding: const EdgeInsets.all(20),
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [Color(0xFF1E88E5), Color(0xFF1565C0)],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            borderRadius: BorderRadius.circular(20),
                            boxShadow: [
                              BoxShadow(
                                color: const Color(0xFF1E88E5).withOpacity(0.3),
                                blurRadius: 14,
                                offset: const Offset(0, 5),
                              ),
                            ],
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  const Text(
                                    'Reputation Score',
                                    style: TextStyle(
                                      color: Colors.white70,
                                      fontSize: 14,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: Colors.white.withOpacity(0.2),
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: Text(
                                      _summary?.level ?? 'Newcomer',
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontWeight: FontWeight.bold,
                                        fontSize: 12,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 10),
                              Text(
                                '${_summary?.score ?? 0}',
                                style: GoogleFonts.plusJakartaSans(
                                  fontSize: 42,
                                  fontWeight: FontWeight.w900,
                                  color: Colors.white,
                                ),
                              ),
                              const SizedBox(height: 12),
                              // Progress Bar to next level
                              ClipRRect(
                                borderRadius: BorderRadius.circular(6),
                                child: LinearProgressIndicator(
                                  value: _summary?.levelProgress ?? 0.0,
                                  minHeight: 8,
                                  backgroundColor: Colors.white.withOpacity(0.2),
                                  valueColor: const AlwaysStoppedAnimation<Color>(Colors.white),
                                ),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                '${_summary?.pointsToNextLevel ?? 100} points until next tier',
                                style: const TextStyle(color: Colors.white70, fontSize: 12),
                              ),
                            ],
                          ),
                        ),

                        const SizedBox(height: 24),

                        // Tier Progression Guide
                        Text(
                          'Reputation Tiers',
                          style: GoogleFonts.plusJakartaSans(
                            fontWeight: FontWeight.w800,
                            fontSize: 16,
                          ),
                        ),
                        const SizedBox(height: 10),
                        _buildTierRow('Newcomer', '0 – 99 points', Icons.eco, const Color(0xFF78909C), isDark),
                        _buildTierRow('Contributor', '100 – 499 points', Icons.trending_up, const Color(0xFF00C853), isDark),
                        _buildTierRow('Trusted Contributor', '500 – 1499 points', Icons.verified_user, const Color(0xFF2962FF), isDark),
                        _buildTierRow('Expert Contributor', '1500 – 4999 points', Icons.auto_awesome, const Color(0xFF6200EA), isDark),
                        _buildTierRow('Community Leader', '5000+ points', Icons.military_tech, const Color(0xFFFF6D00), isDark),

                        const SizedBox(height: 24),

                        // Event History Log
                        Text(
                          'Reputation History',
                          style: GoogleFonts.plusJakartaSans(
                            fontWeight: FontWeight.w800,
                            fontSize: 16,
                          ),
                        ),
                        const SizedBox(height: 10),
                        if (_summary?.recentEvents.isEmpty ?? true)
                          Center(
                            child: Padding(
                              padding: const EdgeInsets.all(24.0),
                              child: Text(
                                'No reputation events recorded yet.',
                                style: TextStyle(color: isDark ? Colors.white54 : Colors.black45),
                              ),
                            ),
                          )
                        else
                          ..._summary!.recentEvents.map((e) {
                            final isPositive = e.delta >= 0;
                            return Card(
                              margin: const EdgeInsets.only(bottom: 8),
                              child: ListTile(
                                leading: CircleAvatar(
                                  backgroundColor: isPositive
                                      ? Colors.green.withOpacity(0.12)
                                      : Colors.red.withOpacity(0.12),
                                  child: Icon(
                                    isPositive ? Icons.add_circle : Icons.remove_circle,
                                    color: isPositive ? Colors.green : Colors.red,
                                    size: 20,
                                  ),
                                ),
                                title: Text(
                                  e.reason,
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5),
                                ),
                                subtitle: Text(
                                  DateFormat.yMMMd().add_jm().format(e.createdAt),
                                  style: TextStyle(fontSize: 11, color: isDark ? Colors.white54 : Colors.black45),
                                ),
                                trailing: Text(
                                  '${isPositive ? "+" : ""}${e.delta}',
                                  style: TextStyle(
                                    fontWeight: FontWeight.w900,
                                    fontSize: 15,
                                    color: isPositive ? Colors.green : Colors.red,
                                  ),
                                ),
                              ),
                            );
                          }),
                      ],
                    ),
                  ),
                ),
    );
  }

  Widget _buildTierRow(String title, String threshold, IconData icon, Color color, bool isDark) {
    final isCurrent = _summary?.level.toLowerCase() == title.toLowerCase();
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: isCurrent
            ? color.withOpacity(0.1)
            : (isDark ? const Color(0xFF1E1E2C) : Colors.white),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isCurrent ? color : (isDark ? Colors.white10 : Colors.black12),
          width: isCurrent ? 1.5 : 1,
        ),
      ),
      child: Row(
        children: [
          Icon(icon, size: 20, color: color),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              title,
              style: TextStyle(
                fontWeight: isCurrent ? FontWeight.w800 : FontWeight.w600,
                color: isCurrent ? color : null,
              ),
            ),
          ),
          Text(
            threshold,
            style: TextStyle(
              fontSize: 12,
              color: isDark ? Colors.white60 : Colors.black54,
            ),
          ),
        ],
      ),
    );
  }
}
