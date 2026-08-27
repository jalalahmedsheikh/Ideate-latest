class ReputationEventModel {
  final String id;
  final String actionType;
  final int delta;
  final String reason;
  final String? sourceType;
  final String? sourceId;
  final DateTime createdAt;

  ReputationEventModel({
    required this.id,
    required this.actionType,
    required this.delta,
    required this.reason,
    this.sourceType,
    this.sourceId,
    required this.createdAt,
  });

  factory ReputationEventModel.fromJson(Map<String, dynamic> json) {
    return ReputationEventModel(
      id: json['_id'] ?? json['id'] ?? '',
      actionType: json['actionType'] ?? 'general',
      delta: (json['delta'] as num?)?.toInt() ?? 0,
      reason: json['reason'] ?? '',
      sourceType: json['sourceType'],
      sourceId: json['sourceId'] is Map
          ? (json['sourceId']['_id'] ?? '')
          : (json['sourceId'] ?? '').toString(),
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'])
          : DateTime.now(),
    );
  }
}

class ReputationSummaryModel {
  final int score;
  final String level;
  final int positiveCount;
  final int negativeCount;
  final int rank;
  final int pointsToNextLevel;
  final double levelProgress;
  final List<ReputationEventModel> recentEvents;

  ReputationSummaryModel({
    this.score = 0,
    this.level = 'Newcomer',
    this.positiveCount = 0,
    this.negativeCount = 0,
    this.rank = 0,
    this.pointsToNextLevel = 100,
    this.levelProgress = 0.0,
    this.recentEvents = const [],
  });

  factory ReputationSummaryModel.fromJson(Map<String, dynamic> json) {
    return ReputationSummaryModel(
      score: (json['score'] as num?)?.toInt() ?? 0,
      level: json['level'] ?? 'Newcomer',
      positiveCount: (json['positiveCount'] as num?)?.toInt() ?? 0,
      negativeCount: (json['negativeCount'] as num?)?.toInt() ?? 0,
      rank: (json['rank'] as num?)?.toInt() ?? 0,
      pointsToNextLevel: (json['pointsToNextLevel'] as num?)?.toInt() ?? 100,
      levelProgress: (json['levelProgress'] as num?)?.toDouble() ?? 0.0,
      recentEvents: (json['recentEvents'] as List?)
              ?.map((e) => ReputationEventModel.fromJson(e))
              .toList() ??
          [],
    );
  }
}
