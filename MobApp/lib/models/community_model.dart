import 'user_model.dart';

class CommunityRule {
  final String title;
  final String description;

  CommunityRule({required this.title, required this.description});

  factory CommunityRule.fromJson(Map<String, dynamic> json) {
    return CommunityRule(
      title: json['title'] ?? '',
      description: json['description'] ?? '',
    );
  }

  Map<String, dynamic> toJson() => {'title': title, 'description': description};
}

class CommunityModel {
  final String id;
  final String name;
  final String handle;
  final String description;
  final String? profileImage;
  final String? coverImage;
  final String category;
  final List<CommunityRule> rules;
  final String visibility; // 'public', 'restricted', 'private'
  final UserModel creator;
  final int membersCount;
  final int postsCount;
  final int questionsCount;
  final int debatesCount;
  final int pollsCount;
  final List<String> tags;
  final bool isSuspended;
  final String? userRole; // 'owner', 'admin', 'moderator', 'member', or null
  final String? membershipStatus; // 'active', 'pending', 'banned', 'muted', or null
  final DateTime createdAt;

  CommunityModel({
    required this.id,
    required this.name,
    required this.handle,
    required this.description,
    this.profileImage,
    this.coverImage,
    required this.category,
    this.rules = const [],
    this.visibility = 'public',
    required this.creator,
    this.membersCount = 1,
    this.postsCount = 0,
    this.questionsCount = 0,
    this.debatesCount = 0,
    this.pollsCount = 0,
    this.tags = const [],
    this.isSuspended = false,
    this.userRole,
    this.membershipStatus,
    required this.createdAt,
  });

  bool get isMember => userRole != null && membershipStatus == 'active';
  bool get isOwner => userRole == 'owner';
  bool get isAdmin => userRole == 'owner' || userRole == 'admin';
  bool get isModerator => userRole == 'owner' || userRole == 'admin' || userRole == 'moderator';
  bool get isPending => membershipStatus == 'pending';

  factory CommunityModel.fromJson(Map<String, dynamic> json) {
    return CommunityModel(
      id: json['_id'] ?? json['id'] ?? '',
      name: json['name'] ?? '',
      handle: json['handle'] ?? '',
      description: json['description'] ?? '',
      profileImage: json['profileImage'],
      coverImage: json['coverImage'],
      category: json['category'] ?? 'General',
      rules: (json['rules'] as List?)
              ?.map((r) => CommunityRule.fromJson(r))
              .toList() ??
          [],
      visibility: json['visibility'] ?? 'public',
      creator: json['creator'] is Map<String, dynamic>
          ? UserModel.fromJson(json['creator'])
          : UserModel(
              id: (json['creator'] ?? '').toString(),
              username: 'CommunityLeader',
              email: '',
              category: 'User',
              followers: [],
              followings: [],
              posts: [],
              bookmarks: [],
              isverified: false,
            ),
      membersCount: (json['membersCount'] as num?)?.toInt() ?? 1,
      postsCount: (json['postsCount'] as num?)?.toInt() ?? 0,
      questionsCount: (json['questionsCount'] as num?)?.toInt() ?? 0,
      debatesCount: (json['debatesCount'] as num?)?.toInt() ?? 0,
      pollsCount: (json['pollsCount'] as num?)?.toInt() ?? 0,
      tags: List<String>.from(json['tags'] ?? []),
      isSuspended: json['isSuspended'] ?? false,
      userRole: json['userRole'],
      membershipStatus: json['membershipStatus'],
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'])
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'name': name,
      'handle': handle,
      'description': description,
      'profileImage': profileImage,
      'coverImage': coverImage,
      'category': category,
      'rules': rules.map((r) => r.toJson()).toList(),
      'visibility': visibility,
      'creator': creator.toJson(),
      'membersCount': membersCount,
      'postsCount': postsCount,
      'questionsCount': questionsCount,
      'debatesCount': debatesCount,
      'pollsCount': pollsCount,
      'tags': tags,
      'isSuspended': isSuspended,
      'createdAt': createdAt.toIso8601String(),
    };
  }
}
