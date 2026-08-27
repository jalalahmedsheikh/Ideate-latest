import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../models/community_model.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../widgets/auth_prompt_sheet.dart';
import '../widgets/community_card.dart';

class CommunitiesHubScreen extends StatefulWidget {
  const CommunitiesHubScreen({Key? key}) : super(key: key);

  @override
  State<CommunitiesHubScreen> createState() => _CommunitiesHubScreenState();
}

class _CommunitiesHubScreenState extends State<CommunitiesHubScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  List<CommunityModel> _discoverCommunities = [];
  List<CommunityModel> _myCommunities = [];
  bool _isLoading = true;
  String? _selectedCategory;

  final List<String> _categories = [
    'All',
    'Technology',
    'Science',
    'Philosophy',
    'Economics',
    'Design',
    'Startups',
    'General',
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _fetchCommunities();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _fetchCommunities() async {
    setState(() => _isLoading = true);

    try {
      final queryParam = _selectedCategory != null && _selectedCategory != 'All'
          ? '?category=$_selectedCategory'
          : '';
      final res = await ApiService.get('/community$queryParam');
      final data = json.decode(res.body);

      if (res.statusCode == 200 && data['success'] == true) {
        final list = (data['communities'] as List? ?? [])
            .map((c) => CommunityModel.fromJson(c))
            .toList();

        setState(() {
          _discoverCommunities = list;
          _myCommunities = list.where((c) => c.isMember).toList();
          _isLoading = false;
        });
      } else {
        setState(() => _isLoading = false);
      }
    } catch (_) {
      setState(() => _isLoading = false);
    }
  }

  void _showCreateCommunitySheet() {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (!auth.isAuthenticated) {
      AuthPrompt.show(
        context,
        title: 'Create Community',
        message: 'Log in to create and lead your own domain-specific community.',
      );
      return;
    }

    final nameController = TextEditingController();
    final handleController = TextEditingController();
    final descController = TextEditingController();
    String category = 'Technology';
    String visibility = 'public';
    bool isCreating = false;

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
                    'Create New Community',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: nameController,
                    decoration: InputDecoration(
                      labelText: 'Community Name',
                      hintText: 'e.g. Distributed Systems Lab',
                      filled: true,
                      fillColor: isDark ? Colors.white10 : Colors.grey.shade100,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: handleController,
                    decoration: InputDecoration(
                      labelText: 'Handle (c/handle)',
                      hintText: 'e.g. dist_sys',
                      filled: true,
                      fillColor: isDark ? Colors.white10 : Colors.grey.shade100,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: descController,
                    maxLines: 2,
                    decoration: InputDecoration(
                      labelText: 'Description',
                      hintText: 'What is this community about?',
                      filled: true,
                      fillColor: isDark ? Colors.white10 : Colors.grey.shade100,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                    ),
                  ),
                  const SizedBox(height: 10),
                  DropdownButtonFormField<String>(
                    value: category,
                    decoration: InputDecoration(
                      labelText: 'Category',
                      filled: true,
                      fillColor: isDark ? Colors.white10 : Colors.grey.shade100,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                    ),
                    items: _categories.where((c) => c != 'All').map((c) {
                      return DropdownMenuItem(value: c, child: Text(c));
                    }).toList(),
                    onChanged: (val) => setSheetState(() => category = val ?? 'Technology'),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    height: 46,
                    child: ElevatedButton(
                      onPressed: isCreating
                          ? null
                          : () async {
                              final name = nameController.text.trim();
                              final handle = handleController.text.trim();
                              final desc = descController.text.trim();

                              if (name.isEmpty || handle.isEmpty) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(content: Text('Name and handle are required.')),
                                );
                                return;
                              }

                              setSheetState(() => isCreating = true);

                              try {
                                final res = await ApiService.post('/community', {
                                  'name': name,
                                  'handle': handle,
                                  'description': desc,
                                  'category': category,
                                  'visibility': visibility,
                                });
                                final data = json.decode(res.body);

                                if (res.statusCode == 201 && data['success'] == true) {
                                  Navigator.pop(ctx);
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(content: Text('Community created successfully!')),
                                  );
                                  _fetchCommunities();
                                } else {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(content: Text(data['message'] ?? 'Failed to create community')),
                                  );
                                }
                              } catch (_) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(content: Text('Network error creating community')),
                                );
                              } finally {
                                setSheetState(() => isCreating = false);
                              }
                            },
                      child: isCreating
                          ? const CircularProgressIndicator(color: Colors.white)
                          : const Text('Create Community'),
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

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Communities',
          style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w800),
        ),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: primaryColor,
          labelColor: primaryColor,
          unselectedLabelColor: isDark ? Colors.white54 : Colors.black45,
          tabs: [
            Tab(text: 'Discover (${_discoverCommunities.length})'),
            Tab(text: 'My Communities (${_myCommunities.length})'),
          ],
        ),
      ),
      body: Column(
        children: [
          // Category Filter Horizontal Scroll
          Container(
            height: 44,
            margin: const EdgeInsets.symmetric(vertical: 8),
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 14),
              itemCount: _categories.length,
              itemBuilder: (ctx, i) {
                final cat = _categories[i];
                final isSelected = (_selectedCategory ?? 'All') == cat;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: FilterChip(
                    label: Text(cat),
                    selected: isSelected,
                    selectedColor: primaryColor.withOpacity(0.15),
                    labelStyle: TextStyle(
                      fontSize: 12,
                      fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                      color: isSelected ? primaryColor : (isDark ? Colors.white70 : Colors.black87),
                    ),
                    onSelected: (val) {
                      setState(() {
                        _selectedCategory = cat;
                      });
                      _fetchCommunities();
                    },
                  ),
                );
              },
            ),
          ),

          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : TabBarView(
                    controller: _tabController,
                    children: [
                      _buildCommunityList(_discoverCommunities, 'No communities found in this category.'),
                      _buildCommunityList(_myCommunities, 'You haven\'t joined any communities yet.'),
                    ],
                  ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showCreateCommunitySheet,
        icon: const Icon(Icons.add),
        label: const Text('New Community'),
      ),
    );
  }

  Widget _buildCommunityList(List<CommunityModel> list, String emptyMessage) {
    if (list.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.groups_outlined, size: 54, color: Colors.grey),
              const SizedBox(height: 12),
              Text(
                emptyMessage,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.grey, fontSize: 14),
              ),
            ],
          ),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _fetchCommunities,
      child: ListView.builder(
        padding: const EdgeInsets.only(bottom: 80),
        itemCount: list.length,
        itemBuilder: (ctx, i) {
          return CommunityCard(
            community: list[i],
            onUpdate: _fetchCommunities,
          );
        },
      ),
    );
  }
}
