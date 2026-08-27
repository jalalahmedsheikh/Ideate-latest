import 'user_model.dart';
import 'topic_model.dart';
import 'post_model.dart';

class PollVoteHistory {
  final String userId;
  final int optionIndex;

  PollVoteHistory({
    required this.userId,
    required this.optionIndex,
  });

  factory PollVoteHistory.fromJson(Map<String, dynamic> json) {
    final rawUser = json['user'] ?? json['userId'];
    final userId = (rawUser is Map) ? (rawUser['_id'] ?? '') : (rawUser ?? '').toString();
    return PollVoteHistory(
      userId: userId,
      optionIndex: json['optionIndex'] ?? 0,
    );
  }
}

class PollSettings {
  final int minSelections;
  final int maxSelections;
  final bool isAnonymous;
  final bool allowVoteChange;
  final bool showResultsBeforeVote;
  final bool hideVoteCounts;

  PollSettings({
    this.minSelections = 1,
    this.maxSelections = 1,
    this.isAnonymous = false,
    this.allowVoteChange = true,
    this.showResultsBeforeVote = false,
    this.hideVoteCounts = false,
  });

  factory PollSettings.fromJson(Map<String, dynamic>? json) {
    if (json == null) return PollSettings();
    return PollSettings(
      minSelections: (json['minSelections'] as num?)?.toInt() ?? 1,
      maxSelections: (json['maxSelections'] as num?)?.toInt() ?? 1,
      isAnonymous: json['isAnonymous'] ?? false,
      allowVoteChange: json['allowVoteChange'] ?? true,
      showResultsBeforeVote: json['showResultsBeforeVote'] ?? false,
      hideVoteCounts: json['hideVoteCounts'] ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'minSelections': minSelections,
      'maxSelections': maxSelections,
      'isAnonymous': isAnonymous,
      'allowVoteChange': allowVoteChange,
      'showResultsBeforeVote': showResultsBeforeVote,
      'hideVoteCounts': hideVoteCounts,
    };
  }
}

class PollModel {
  final String id;
  final String question;
  final List<String> options;
  final List<int> votes;
  final List<PollVoteHistory> votesHistory;
  final UserModel author;
  final List<TopicModel> topics;
  final List<CommentModel> comments;
  final int shareCount;
  final String pollType;
  final PollSettings settings;
  final String? recommendationSignal;
  final DateTime createdAt;

  PollModel({
    required this.id,
    required this.question,
    required this.options,
    required this.votes,
    required this.votesHistory,
    required this.author,
    this.topics = const [],
    this.comments = const [],
    this.shareCount = 0,
    this.pollType = 'single_choice',
    PollSettings? settings,
    this.recommendationSignal,
    required this.createdAt,
  }) : settings = settings ?? PollSettings();

  factory PollModel.fromJson(Map<String, dynamic> json) {
    List<String> rawOptions = List<String>.from(json['options'] ?? []);
    List<int> rawVotes = (json['votes'] as List?)
            ?.map((v) => (v as num).toInt())
            .toList() ??
        [];
    if (rawVotes.length < rawOptions.length) {
      rawVotes = List<int>.filled(rawOptions.length, 0);
    }

    return PollModel(
      id: json['_id'] ?? json['id'] ?? '',
      question: json['question'] ?? '',
      options: rawOptions,
      votes: rawVotes,
      votesHistory: List<PollVoteHistory>.from((json['votesHistory'] ?? [])
          .map((item) => PollVoteHistory.fromJson(item))),
      author: json['author'] is Map<String, dynamic>
          ? UserModel.fromJson(json['author'])
          : UserModel(
              id: (json['author'] ?? '').toString(),
              username: 'User',
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
      comments: List<CommentModel>.from((json['comments'] ?? [])
          .map((item) => CommentModel.fromJson(item))),
      shareCount: (json['shareCount'] as num?)?.toInt() ?? 0,
      pollType: json['pollType'] ?? 'single_choice',
      settings: PollSettings.fromJson(json['settings']),
      recommendationSignal: json['recommendationSignal'] as String?,
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'])
          : DateTime.now(),
    );
  }
}
