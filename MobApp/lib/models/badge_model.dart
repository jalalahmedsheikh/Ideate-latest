class BadgeModel {
  final String id;
  final String badgeId;
  final String name;
  final String description;
  final String icon;
  final String category; // 'contribution', 'quality', 'community', 'creator', 'milestone'
  final String rarity; // 'common', 'rare', 'epic', 'legendary'
  final bool isEarned;
  final bool isDisplayed;
  final DateTime? awardedAt;

  BadgeModel({
    required this.id,
    required this.badgeId,
    required this.name,
    required this.description,
    required this.icon,
    required this.category,
    required this.rarity,
    this.isEarned = false,
    this.isDisplayed = false,
    this.awardedAt,
  });

  factory BadgeModel.fromJson(Map<String, dynamic> json) {
    return BadgeModel(
      id: json['_id'] ?? json['id'] ?? '',
      badgeId: json['badgeId'] ?? '',
      name: json['name'] ?? '',
      description: json['description'] ?? '',
      icon: json['icon'] ?? '🏅',
      category: json['category'] ?? 'contribution',
      rarity: json['rarity'] ?? 'common',
      isEarned: json['isEarned'] ?? json['earned'] ?? false,
      isDisplayed: json['isDisplayed'] ?? false,
      awardedAt: json['awardedAt'] != null
          ? DateTime.parse(json['awardedAt'])
          : null,
    );
  }
}
