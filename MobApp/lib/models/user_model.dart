class UserModel {
  final String id;
  final String username;
  final String email;
  final String? profileImage;
  final String? bio;
  final String category;
  final List<String> followers;
  final List<String> followings;
  final List<String> posts;
  final List<String> bookmarks;
  final bool isverified;
  final int reputationScore;
  final String reputationLevel;
  final bool isCreator;
  final String? verificationCategory;
  final int badgesCount;

  UserModel({
    required this.id,
    required this.username,
    required this.email,
    this.profileImage,
    this.bio,
    required this.category,
    required this.followers,
    required this.followings,
    required this.posts,
    required this.bookmarks,
    required this.isverified,
    this.reputationScore = 0,
    this.reputationLevel = 'Newcomer',
    this.isCreator = false,
    this.verificationCategory,
    this.badgesCount = 0,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['_id'] ?? json['id'] ?? '',
      username: json['username'] ?? '',
      email: json['email'] ?? '',
      profileImage: json['profileImage'],
      bio: json['bio'],
      category: json['category'] ?? 'User',
      followers: List<String>.from((json['followers'] ?? []).map((item) =>
          item is Map ? (item['_id'] ?? item['id'] ?? '') : item.toString())),
      followings: List<String>.from((json['followings'] ?? []).map((item) =>
          item is Map ? (item['_id'] ?? item['id'] ?? '') : item.toString())),
      posts: List<String>.from((json['posts'] ?? []).map((item) =>
          item is Map ? (item['_id'] ?? item['id'] ?? '') : item.toString())),
      bookmarks: List<String>.from((json['bookmarks'] ?? []).map((item) =>
          item is Map ? (item['_id'] ?? item['id'] ?? '') : item.toString())),
      isverified: json['isverified'] ?? false,
      reputationScore: (json['reputationScore'] as num?)?.toInt() ?? 0,
      reputationLevel: json['reputationLevel'] ?? 'Newcomer',
      isCreator: json['isCreator'] ?? false,
      verificationCategory: json['verificationCategory'],
      badgesCount: (json['badgesCount'] as num?)?.toInt() ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'username': username,
      'email': email,
      'profileImage': profileImage,
      'bio': bio,
      'category': category,
      'followers': followers,
      'followings': followings,
      'posts': posts,
      'bookmarks': bookmarks,
      'isverified': isverified,
      'reputationScore': reputationScore,
      'reputationLevel': reputationLevel,
      'isCreator': isCreator,
      'verificationCategory': verificationCategory,
      'badgesCount': badgesCount,
    };
  }
}
