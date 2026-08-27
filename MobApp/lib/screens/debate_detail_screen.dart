import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../models/debate_model.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../widgets/auth_prompt_sheet.dart';
import '../widgets/reputation_chip.dart';
import '../widgets/verification_badge.dart';
import '../widgets/share_sheet.dart';

class DebateDetailScreen extends StatefulWidget {
  final String debateId;

  const DebateDetailScreen({Key? key, required this.debateId}) : super(key: key);

  @override
  State<DebateDetailScreen> createState() => _DebateDetailScreenState();
}

class _DebateDetailScreenState extends State<DebateDetailScreen>
    with SingleTickerProviderStateMixin {
  DebateModel? _debate;
  List<DebateArgumentModel> _arguments = [];
  bool _isLoading = true;
  String? _errorMessage;
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _fetchDebateDetails();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _fetchDebateDetails() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final res = await ApiService.get('/debate/${widget.debateId}');
      final data = json.decode(res.body);

      if (res.statusCode == 200 && data['success'] == true) {
        setState(() {
          _debate = DebateModel.fromJson(data['debate']);
          _arguments = (data['arguments'] as List? ?? [])
              .map((item) => DebateArgumentModel.fromJson(item))
              .toList();
          _isLoading = false;
        });
      } else {
        setState(() {
          _errorMessage = data['message'] ?? 'Failed to load debate';
          _isLoading = false;
        });
      }
    } catch (_) {
      setState(() {
        _errorMessage = 'Network error loading debate';
        _isLoading = false;
      });
    }
  }

  Future<void> _voteSide(String side) async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (!auth.isAuthenticated) {
      AuthPrompt.show(
        context,
        title: 'Join Debate',
        message: 'Log in to take a stance, cast your vote, and enter the debate.',
      );
      return;
    }

    try {
      final res = await ApiService.post('/debate/${widget.debateId}/vote', {
        'side': side,
      });
      final data = json.decode(res.body);

      if (res.statusCode == 200 && data['success'] == true) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Voted for ${side == "sideA" ? _debate?.sideA.label : (side == "sideB" ? _debate?.sideB.label : "Neutral")}')),
        );
        _fetchDebateDetails();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(data['message'] ?? 'Vote failed')),
        );
      }
    } catch (_) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Network error voting')),
      );
    }
  }

  void _showAddArgumentSheet(String defaultSide) {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (!auth.isAuthenticated) {
      AuthPrompt.show(
        context,
        title: 'Post Argument',
        message: 'Log in to submit an evidence-backed argument to this debate.',
      );
      return;
    }

    final textController = TextEditingController();
    final linkTitleController = TextEditingController();
    final linkUrlController = TextEditingController();
    String selectedSide = defaultSide;
    bool isSubmitting = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) {
          final isDark = Theme.of(ctx).brightness == Brightness.dark;
          final sheetBg = isDark ? const Color(0xFF1E1E2C) : Colors.white;

          return Container(
            padding: EdgeInsets.only(
              left: 16,
              right: 16,
              top: 16,
              bottom: MediaQuery.of(ctx).viewInsets.bottom + 16,
            ),
            decoration: BoxDecoration(
              color: sheetBg,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
            ),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Post Debate Argument',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 12),
                  // Select Side
                  Row(
                    children: [
                      ChoiceChip(
                        label: Text(_debate?.sideA.label ?? 'Side A'),
                        selected: selectedSide == 'sideA',
                        selectedColor: const Color(0xFF1E88E5).withOpacity(0.2),
                        onSelected: (val) => setSheetState(() => selectedSide = 'sideA'),
                      ),
                      const SizedBox(width: 8),
                      ChoiceChip(
                        label: Text(_debate?.sideB.label ?? 'Side B'),
                        selected: selectedSide == 'sideB',
                        selectedColor: const Color(0xFFE53935).withOpacity(0.2),
                        onSelected: (val) => setSheetState(() => selectedSide = 'sideB'),
                      ),
                      const SizedBox(width: 8),
                      ChoiceChip(
                        label: const Text('Neutral'),
                        selected: selectedSide == 'neutral',
                        selectedColor: Colors.amber.withOpacity(0.2),
                        onSelected: (val) => setSheetState(() => selectedSide = 'neutral'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: textController,
                    maxLines: 4,
                    decoration: InputDecoration(
                      hintText: 'Present your thesis with reasoned arguments...',
                      filled: true,
                      fillColor: isDark ? Colors.white10 : Colors.grey.shade100,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text('Evidence / Reference (Optional)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 6),
                  TextField(
                    controller: linkTitleController,
                    decoration: InputDecoration(
                      hintText: 'Source Title (e.g. arXiv Research)',
                      filled: true,
                      fillColor: isDark ? Colors.white10 : Colors.grey.shade100,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
                    ),
                  ),
                  const SizedBox(height: 6),
                  TextField(
                    controller: linkUrlController,
                    decoration: InputDecoration(
                      hintText: 'https://...',
                      filled: true,
                      fillColor: isDark ? Colors.white10 : Colors.grey.shade100,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
                    ),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    height: 46,
                    child: ElevatedButton(
                      onPressed: isSubmitting
                          ? null
                          : () async {
                              final text = textController.text.trim();
                              if (text.length < 10) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(content: Text('Argument must be at least 10 characters')),
                                );
                                return;
                              }
                              setSheetState(() => isSubmitting = true);

                              final evidenceLinks = [];
                              if (linkUrlController.text.trim().isNotEmpty) {
                                evidenceLinks.add({
                                  'title': linkTitleController.text.trim().isEmpty
                                      ? 'Reference'
                                      : linkTitleController.text.trim(),
                                  'url': linkUrlController.text.trim(),
                                });
                              }

                              try {
                                final res = await ApiService.post('/debate/${widget.debateId}/argument', {
                                  'side': selectedSide,
                                  'text': text,
                                  'evidenceLinks': evidenceLinks,
                                });
                                final data = json.decode(res.body);

                                if (res.statusCode == 201 && data['success'] == true) {
                                  Navigator.pop(ctx);
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(content: Text('Argument submitted successfully! (+10 Rep)')),
                                  );
                                  _fetchDebateDetails();
                                } else {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(content: Text(data['message'] ?? 'Failed to submit argument')),
                                  );
                                }
                              } catch (_) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(content: Text('Error submitting argument')),
                                );
                              } finally {
                                setSheetState(() => isSubmitting = false);
                              }
                            },
                      child: isSubmitting
                          ? const CircularProgressIndicator(color: Colors.white)
                          : const Text('Submit Argument'),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final primaryColor = Theme.of(context).primaryColor;
    final currentUserId = Provider.of<AuthProvider>(context).currentUser?.id;

    if (_isLoading) {
      return Scaffold(
        appBar: AppBar(title: const Text('Debate')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    if (_errorMessage != null || _debate == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Debate')),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(_errorMessage ?? 'Debate not found'),
              const SizedBox(height: 12),
              ElevatedButton(onPressed: _fetchDebateDetails, child: const Text('Retry')),
            ],
          ),
        ),
      );
    }

    final sideAArgs = _arguments.where((a) => a.side == 'sideA').toList();
    final sideBArgs = _arguments.where((a) => a.side == 'sideB').toList();
    final neutralArgs = _arguments.where((a) => a.side == 'neutral').toList();

    final userPart = currentUserId != null ? _debate!.getUserParticipation(currentUserId) : null;

    return Scaffold(
      appBar: AppBar(
        title: Text('Debate', style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w700)),
        actions: [
          IconButton(
            icon: const Icon(Icons.share_outlined),
            onPressed: () {
              ShareSheet.show(context, title: _debate!.title, content: _debate!.resolution);
            },
          ),
        ],
      ),
      body: NestedScrollView(
        headerSliverBuilder: (ctx, innerBoxIsScrolled) => [
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Title
                  Text(
                    _debate!.title,
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      height: 1.3,
                    ),
                  ),

                  const SizedBox(height: 10),

                  // Resolution
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: isDark ? Colors.white.withOpacity(0.04) : Colors.grey.shade50,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFF9C27B0).withOpacity(0.4)),
                    ),
                    child: Text(
                      'Resolution: ${_debate!.resolution}',
                      style: const TextStyle(fontStyle: FontStyle.italic, fontSize: 14),
                    ),
                  ),

                  const SizedBox(height: 16),

                  // Dual Progress Split
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        '${_debate!.sideA.label}: ${_debate!.sideAPercentage.toStringAsFixed(1)}%',
                        style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF1E88E5)),
                      ),
                      Text(
                        '${_debate!.sideB.label}: ${_debate!.sideBPercentage.toStringAsFixed(1)}%',
                        style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFFE53935)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(6),
                    child: Container(
                      height: 12,
                      color: Colors.grey.withOpacity(0.2),
                      child: Row(
                        children: [
                          Flexible(
                            flex: (_debate!.sideAPercentage * 10).toInt().clamp(1, 1000),
                            child: Container(color: const Color(0xFF1E88E5)),
                          ),
                          if (_debate!.neutral.enabled && _debate!.neutralPercentage > 0)
                            Flexible(
                              flex: (_debate!.neutralPercentage * 10).toInt().clamp(1, 1000),
                              child: Container(color: Colors.amber),
                            ),
                          Flexible(
                            flex: (_debate!.sideBPercentage * 10).toInt().clamp(1, 1000),
                            child: Container(color: const Color(0xFFE53935)),
                          ),
                        ],
                      ),
                    ),
                  ),

                  const SizedBox(height: 16),

                  // Vote Action Buttons
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          style: OutlinedButton.styleFrom(
                            side: BorderSide(
                              color: userPart?.votedSide == 'sideA'
                                  ? const Color(0xFF1E88E5)
                                  : Colors.grey.withOpacity(0.3),
                              width: userPart?.votedSide == 'sideA' ? 2 : 1,
                            ),
                          ),
                          onPressed: () => _voteSide('sideA'),
                          child: Text(
                            'Support ${_debate!.sideA.label}',
                            style: const TextStyle(color: Color(0xFF1E88E5), fontSize: 12),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: OutlinedButton(
                          style: OutlinedButton.styleFrom(
                            side: BorderSide(
                              color: userPart?.votedSide == 'sideB'
                                  ? const Color(0xFFE53935)
                                  : Colors.grey.withOpacity(0.3),
                              width: userPart?.votedSide == 'sideB' ? 2 : 1,
                            ),
                          ),
                          onPressed: () => _voteSide('sideB'),
                          child: Text(
                            'Support ${_debate!.sideB.label}',
                            style: const TextStyle(color: Color(0xFFE53935), fontSize: 12),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          SliverPersistentHeader(
            pinned: true,
            delegate: _SliverAppBarDelegate(
              TabBar(
                controller: _tabController,
                indicatorColor: primaryColor,
                labelColor: primaryColor,
                unselectedLabelColor: isDark ? Colors.white54 : Colors.black45,
                tabs: [
                  Tab(text: '${_debate!.sideA.label} (${sideAArgs.length})'),
                  Tab(text: '${_debate!.sideB.label} (${sideBArgs.length})'),
                  Tab(text: 'Neutral (${neutralArgs.length})'),
                ],
              ),
              isDark ? const Color(0xFF12121A) : Colors.white,
            ),
          ),
        ],
        body: TabBarView(
          controller: _tabController,
          children: [
            _buildArgumentsList(sideAArgs, 'sideA', isDark),
            _buildArgumentsList(sideBArgs, 'sideB', isDark),
            _buildArgumentsList(neutralArgs, 'neutral', isDark),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          final sideKey = _tabController.index == 0
              ? 'sideA'
              : (_tabController.index == 1 ? 'sideB' : 'neutral');
          _showAddArgumentSheet(sideKey);
        },
        icon: const Icon(Icons.edit_note_rounded),
        label: const Text('Add Argument'),
      ),
    );
  }

  Widget _buildArgumentsList(List<DebateArgumentModel> args, String side, bool isDark) {
    if (args.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.forum_outlined, size: 48, color: Colors.grey),
              const SizedBox(height: 12),
              Text(
                'No arguments posted for this position yet.',
                style: TextStyle(color: isDark ? Colors.white54 : Colors.black45),
              ),
              const SizedBox(height: 8),
              ElevatedButton(
                onPressed: () => _showAddArgumentSheet(side),
                child: const Text('Post First Argument'),
              ),
            ],
          ),
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.only(left: 14, right: 14, top: 12, bottom: 80),
      itemCount: args.length,
      itemBuilder: (ctx, i) {
        final arg = args[i];
        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF1E1E2C) : Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: isDark ? Colors.white10 : Colors.black12),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  CircleAvatar(
                    radius: 14,
                    backgroundImage: arg.author.profileImage != null &&
                            arg.author.profileImage!.isNotEmpty
                        ? NetworkImage(arg.author.profileImage!)
                        : null,
                    child: arg.author.profileImage == null ||
                            arg.author.profileImage!.isEmpty
                        ? Text(arg.author.username[0].toUpperCase(), style: const TextStyle(fontSize: 10))
                        : null,
                  ),
                  const SizedBox(width: 8),
                  Text(arg.author.username, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                  if (arg.author.isverified)
                    VerificationBadge(category: arg.author.verificationCategory, size: 12),
                  const SizedBox(width: 4),
                  ReputationChip(score: arg.author.reputationScore, level: arg.author.reputationLevel, compact: true),
                  const Spacer(),
                  Text(
                    DateFormat.yMMMd().format(arg.createdAt),
                    style: TextStyle(fontSize: 10, color: isDark ? Colors.white54 : Colors.black45),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Text(arg.text, style: const TextStyle(fontSize: 14, height: 1.45)),
              if (arg.evidenceLinks.isNotEmpty) ...[
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  children: arg.evidenceLinks.map((ev) {
                    return Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.blue.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.link, size: 12, color: Colors.blue),
                          const SizedBox(width: 4),
                          Text(
                            ev.title,
                            style: const TextStyle(fontSize: 11, color: Colors.blue, fontWeight: FontWeight.w600),
                          ),
                        ],
                      ),
                    );
                  }).toList(),
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}

class _SliverAppBarDelegate extends SliverPersistentHeaderDelegate {
  final TabBar tabBar;
  final Color backgroundColor;

  _SliverAppBarDelegate(this.tabBar, this.backgroundColor);

  @override
  double get minExtent => tabBar.preferredSize.height;
  @override
  double get maxExtent => tabBar.preferredSize.height;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    return Container(
      color: backgroundColor,
      child: tabBar,
    );
  }

  @override
  bool shouldRebuild(_SliverAppBarDelegate oldDelegate) {
    return false;
  }
}
