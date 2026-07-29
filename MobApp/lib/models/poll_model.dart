import 'user_model.dart';

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

class PollModel {
  final String id;
  final String question;
  final List<String> options;
  final List<int> votes;
  final List<PollVoteHistory> votesHistory;
  final UserModel author;
  final DateTime createdAt;

  PollModel({
    required this.id,
    required this.question,
    required this.options,
    required this.votes,
    required this.votesHistory,
    required this.author,
    required this.createdAt,
  });

  factory PollModel.fromJson(Map<String, dynamic> json) {
    // Check if votes list is present, otherwise initialize with zeros matching options count
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
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'])
          : DateTime.now(),
    );
  }
}
