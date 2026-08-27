class ContentTypeBreakdown {
  final int count;
  final int impressions;
  final int interactions;
  final double engagementRate;

  ContentTypeBreakdown({
    this.count = 0,
    this.impressions = 0,
    this.interactions = 0,
    this.engagementRate = 0.0,
  });

  factory ContentTypeBreakdown.fromJson(Map<String, dynamic>? json) {
    if (json == null) return ContentTypeBreakdown();
    return ContentTypeBreakdown(
      count: (json['count'] as num?)?.toInt() ?? 0,
      impressions: (json['impressions'] as num?)?.toInt() ?? 0,
      interactions: (json['interactions'] as num?)?.toInt() ?? 0,
      engagementRate: (json['engagementRate'] as num?)?.toDouble() ?? 0.0,
    );
  }
}

class TopContentItem {
  final String id;
  final String title;
  final String type;
  final int views;
  final int interactions;
  final double engagementRate;
  final DateTime createdAt;

  TopContentItem({
    required this.id,
    required this.title,
    required this.type,
    this.views = 0,
    this.interactions = 0,
    this.engagementRate = 0.0,
    required this.createdAt,
  });

  factory TopContentItem.fromJson(Map<String, dynamic> json) {
    return TopContentItem(
      id: json['_id'] ?? json['id'] ?? '',
      title: json['title'] ?? json['question'] ?? json['text'] ?? 'Untitled',
      type: json['type'] ?? 'post',
      views: (json['views'] as num?)?.toInt() ?? 0,
      interactions: (json['interactions'] as num?)?.toInt() ?? 0,
      engagementRate: (json['engagementRate'] as num?)?.toDouble() ?? 0.0,
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'])
          : DateTime.now(),
    );
  }
}

class CreatorAnalyticsModel {
  final String window;
  final int totalImpressions;
  final int totalInteractions;
  final double overallEngagementRate;
  final int newFollowers;
  final int followerGrowthDelta;
  final Map<String, ContentTypeBreakdown> breakdownByType;
  final List<TopContentItem> topPerformingContent;
  final List<String> deterministicInsights;

  CreatorAnalyticsModel({
    this.window = '28d',
    this.totalImpressions = 0,
    this.totalInteractions = 0,
    this.overallEngagementRate = 0.0,
    this.newFollowers = 0,
    this.followerGrowthDelta = 0,
    this.breakdownByType = const {},
    this.topPerformingContent = const [],
    this.deterministicInsights = const [],
  });

  factory CreatorAnalyticsModel.fromJson(Map<String, dynamic> json) {
    final Map<String, dynamic> rawBreakdown = json['breakdownByType'] ?? {};
    final Map<String, ContentTypeBreakdown> breakdownMap = {};
    rawBreakdown.forEach((key, val) {
      breakdownMap[key] = ContentTypeBreakdown.fromJson(val);
    });

    return CreatorAnalyticsModel(
      window: json['window'] ?? '28d',
      totalImpressions: (json['totalImpressions'] as num?)?.toInt() ?? 0,
      totalInteractions: (json['totalInteractions'] as num?)?.toInt() ?? 0,
      overallEngagementRate: (json['overallEngagementRate'] as num?)?.toDouble() ?? 0.0,
      newFollowers: (json['newFollowers'] as num?)?.toInt() ?? 0,
      followerGrowthDelta: (json['followerGrowthDelta'] as num?)?.toInt() ?? 0,
      breakdownByType: breakdownMap,
      topPerformingContent: (json['topPerformingContent'] as List?)
              ?.map((item) => TopContentItem.fromJson(item))
              .toList() ??
          [],
      deterministicInsights: List<String>.from(json['deterministicInsights'] ?? []),
    );
  }
}
