class TopicModel {
  final String id;
  final String name;
  final String slug;
  final String description;
  final String icon;
  final String category;
  final int followerCount;
  final int postCount;
  final int pollCount;
  final bool isFollowing;

  TopicModel({
    required this.id,
    required this.name,
    required this.slug,
    required this.description,
    required this.icon,
    required this.category,
    required this.followerCount,
    required this.postCount,
    required this.pollCount,
    this.isFollowing = false,
  });

  factory TopicModel.fromJson(dynamic json) {
    if (json is! Map<String, dynamic>) {
      return TopicModel(
        id: json?.toString() ?? '',
        name: 'General',
        slug: 'general',
        description: '',
        icon: '💡',
        category: 'General',
        followerCount: 0,
        postCount: 0,
        pollCount: 0,
        isFollowing: false,
      );
    }

    return TopicModel(
      id: json['_id'] ?? json['id'] ?? '',
      name: json['name'] ?? '',
      slug: json['slug'] ?? '',
      description: json['description'] ?? '',
      icon: json['icon'] ?? '💡',
      category: json['category'] ?? 'General',
      followerCount: (json['followerCount'] as num?)?.toInt() ?? 0,
      postCount: (json['postCount'] as num?)?.toInt() ?? 0,
      pollCount: (json['pollCount'] as num?)?.toInt() ?? 0,
      isFollowing: json['isFollowing'] ?? false,
    );
  }

  TopicModel copyWith({
    bool? isFollowing,
    int? followerCount,
  }) {
    return TopicModel(
      id: id,
      name: name,
      slug: slug,
      description: description,
      icon: icon,
      category: category,
      followerCount: followerCount ?? this.followerCount,
      postCount: postCount,
      pollCount: pollCount,
      isFollowing: isFollowing ?? this.isFollowing,
    );
  }
}
