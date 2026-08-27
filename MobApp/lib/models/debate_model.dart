import 'user_model.dart';
import 'topic_model.dart';

class DebateEvidence {
  final String title;
  final String url;

  DebateEvidence({required this.title, required this.url});

  factory DebateEvidence.fromJson(Map<String, dynamic> json) {
    return DebateEvidence(
      title: json['title'] ?? '',
      url: json['url'] ?? '',
    );
  }

  Map<String, dynamic> toJson() => {'title': title, 'url': url};
}

class DebateArgumentModel {
  final String id;
  final String debateId;
  final UserModel author;
  final String side; // 'sideA', 'sideB', 'neutral'
  final String text;
  final List<DebateEvidence> evidenceLinks;
  final List<String> upvotes;
  final Map<String, int> reactions;
  final int repliesCount;
  final String status;
  final DateTime createdAt;

  DebateArgumentModel({
    required this.id,
    required this.debateId,
    required this.author,
    required this.side,
    required this.text,
    this.evidenceLinks = const [],
    this.upvotes = const [],
    this.reactions = const {},
    this.repliesCount = 0,
    this.status = 'active',
    required this.createdAt,
  });

  bool isUpvotedBy(String userId) => upvotes.contains(userId);

  factory DebateArgumentModel.fromJson(Map<String, dynamic> json) {
    return DebateArgumentModel(
      id: json['_id'] ?? json['id'] ?? '',
      debateId: json['debate'] is Map
          ? (json['debate']['_id'] ?? '')
          : (json['debate'] ?? '').toString(),
      author: json['author'] is Map<String, dynamic>
          ? UserModel.fromJson(json['author'])
          : UserModel(
              id: (json['author'] ?? '').toString(),
              username: 'Debater',
              email: '',
              category: 'User',
              followers: [],
              followings: [],
              posts: [],
              bookmarks: [],
              isverified: false,
            ),
      side: json['side'] ?? 'sideA',
      text: json['text'] ?? '',
      evidenceLinks: (json['evidenceLinks'] as List?)
              ?.map((e) => DebateEvidence.fromJson(e))
              .toList() ??
          [],
      upvotes: List<String>.from((json['upvotes'] ?? []).map((e) =>
          e is Map ? (e['_id'] ?? e['id'] ?? '') : e.toString())),
      reactions: (json['reactions'] as Map<String, dynamic>?)?.map(
              (k, v) => MapEntry(k, (v as num).toInt())) ??
          {},
      repliesCount: (json['repliesCount'] as num?)?.toInt() ?? 0,
      status: json['status'] ?? 'active',
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'])
          : DateTime.now(),
    );
  }
}

class DebateSide {
  final String label;
  final String description;
  final int participantsCount;
  final int votesCount;

  DebateSide({
    required this.label,
    this.description = '',
    this.participantsCount = 0,
    this.votesCount = 0,
  });

  factory DebateSide.fromJson(Map<String, dynamic>? json) {
    if (json == null) return DebateSide(label: 'Side');
    return DebateSide(
      label: json['label'] ?? '',
      description: json['description'] ?? '',
      participantsCount: (json['participantsCount'] as num?)?.toInt() ?? 0,
      votesCount: (json['votesCount'] as num?)?.toInt() ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'label': label,
      'description': description,
      'participantsCount': participantsCount,
      'votesCount': votesCount,
    };
  }
}

class DebateNeutralSide {
  final bool enabled;
  final String label;
  final int participantsCount;
  final int votesCount;

  DebateNeutralSide({
    this.enabled = true,
    this.label = 'Neutral / Nuanced',
    this.participantsCount = 0,
    this.votesCount = 0,
  });

  factory DebateNeutralSide.fromJson(Map<String, dynamic>? json) {
    if (json == null) return DebateNeutralSide();
    return DebateNeutralSide(
      enabled: json['enabled'] ?? true,
      label: json['label'] ?? 'Neutral / Nuanced',
      participantsCount: (json['participantsCount'] as num?)?.toInt() ?? 0,
      votesCount: (json['votesCount'] as num?)?.toInt() ?? 0,
    );
  }
}

class DebateParticipant {
  final String userId;
  final String side;
  final bool hasVoted;
  final String? votedSide;
  final int switchCount;

  DebateParticipant({
    required this.userId,
    required this.side,
    this.hasVoted = false,
    this.votedSide,
    this.switchCount = 0,
  });

  factory DebateParticipant.fromJson(Map<String, dynamic> json) {
    final rawUser = json['user'];
    final uId = rawUser is Map ? (rawUser['_id'] ?? '') : (rawUser ?? '').toString();
    return DebateParticipant(
      userId: uId,
      side: json['side'] ?? 'neutral',
      hasVoted: json['hasVoted'] ?? false,
      votedSide: json['votedSide'],
      switchCount: (json['switchCount'] as num?)?.toInt() ?? 0,
    );
  }
}

class DebateModel {
  final String id;
  final String title;
  final String resolution;
  final String context;
  final UserModel author;
  final List<TopicModel> topics;
  final String? communityId;
  final DebateSide sideA;
  final DebateSide sideB;
  final DebateNeutralSide neutral;
  final String debateType; // 'two_sided', 'three_position', 'open'
  final int durationHours;
  final DateTime? deadline;
  final String status; // 'active', 'closed', 'locked'
  final int participantsCount;
  final int argumentsCount;
  final int totalVotes;
  final int views;
  final List<DebateParticipant> participants;
  final DateTime createdAt;

  DebateModel({
    required this.id,
    required this.title,
    required this.resolution,
    this.context = '',
    required this.author,
    this.topics = const [],
    this.communityId,
    required this.sideA,
    required this.sideB,
    DebateNeutralSide? neutral,
    this.debateType = 'two_sided',
    this.durationHours = 48,
    this.deadline,
    this.status = 'active',
    this.participantsCount = 0,
    this.argumentsCount = 0,
    this.totalVotes = 0,
    this.views = 0,
    this.participants = const [],
    required this.createdAt,
  }) : neutral = neutral ?? DebateNeutralSide();

  bool get isClosed => status == 'closed' || (deadline != null && deadline!.isBefore(DateTime.now()));

  DebateParticipant? getUserParticipation(String userId) {
    try {
      return participants.firstWhere((p) => p.userId == userId);
    } catch (_) {
      return null;
    }
  }

  double get sideAPercentage {
    if (totalVotes == 0) return 0.0;
    return (sideA.votesCount / totalVotes) * 100.0;
  }

  double get sideBPercentage {
    if (totalVotes == 0) return 0.0;
    return (sideB.votesCount / totalVotes) * 100.0;
  }

  double get neutralPercentage {
    if (totalVotes == 0 || !neutral.enabled) return 0.0;
    return (neutral.votesCount / totalVotes) * 100.0;
  }

  factory DebateModel.fromJson(Map<String, dynamic> json) {
    return DebateModel(
      id: json['_id'] ?? json['id'] ?? '',
      title: json['title'] ?? '',
      resolution: json['resolution'] ?? '',
      context: json['context'] ?? '',
      author: json['author'] is Map<String, dynamic>
          ? UserModel.fromJson(json['author'])
          : UserModel(
              id: (json['author'] ?? '').toString(),
              username: 'Moderator',
              email: '',
              category: 'User',
              followers: [],
              followings: [],
              posts: [],
              bookmarks: [],
              isverified: false,
            ),
      topics: (json['topics'] as List?)
              ?.map((item) => TopicModel.fromJson(item))
              .toList() ??
          [],
      communityId: json['community'] is Map
          ? (json['community']['_id'] ?? '')
          : (json['community'] ?? '').toString(),
      sideA: DebateSide.fromJson(json['sideA']),
      sideB: DebateSide.fromJson(json['sideB']),
      neutral: DebateNeutralSide.fromJson(json['neutral']),
      debateType: json['debateType'] ?? 'two_sided',
      durationHours: (json['durationHours'] as num?)?.toInt() ?? 48,
      deadline: json['deadline'] != null ? DateTime.parse(json['deadline']) : null,
      status: json['status'] ?? 'active',
      participantsCount: (json['participantsCount'] as num?)?.toInt() ?? 0,
      argumentsCount: (json['argumentsCount'] as num?)?.toInt() ?? 0,
      totalVotes: (json['totalVotes'] as num?)?.toInt() ?? 0,
      views: (json['views'] as num?)?.toInt() ?? 0,
      participants: (json['participants'] as List?)
              ?.map((p) => DebateParticipant.fromJson(p))
              .toList() ??
          [],
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'])
          : DateTime.now(),
    );
  }
}
