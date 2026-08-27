import 'user_model.dart';

class AnswerModel {
  final String id;
  final String questionId;
  final UserModel author;
  final String content;
  final List<String> upvotes;
  final List<String> downvotes;
  final List<String> saves;
  final int shares;
  final bool isAccepted;
  final int repliesCount;
  final String status;
  final DateTime createdAt;

  AnswerModel({
    required this.id,
    required this.questionId,
    required this.author,
    required this.content,
    this.upvotes = const [],
    this.downvotes = const [],
    this.saves = const [],
    this.shares = 0,
    this.isAccepted = false,
    this.repliesCount = 0,
    this.status = 'active',
    required this.createdAt,
  });

  int get score => upvotes.length - downvotes.length;

  bool isUpvotedBy(String userId) => upvotes.contains(userId);
  bool isDownvotedBy(String userId) => downvotes.contains(userId);

  factory AnswerModel.fromJson(Map<String, dynamic> json) {
    return AnswerModel(
      id: json['_id'] ?? json['id'] ?? '',
      questionId: json['question'] is Map
          ? (json['question']['_id'] ?? '')
          : (json['question'] ?? '').toString(),
      author: json['author'] is Map<String, dynamic>
          ? UserModel.fromJson(json['author'])
          : UserModel(
              id: (json['author'] ?? '').toString(),
              username: 'Thinker',
              email: '',
              category: 'User',
              followers: [],
              followings: [],
              posts: [],
              bookmarks: [],
              isverified: false,
            ),
      content: json['content'] ?? '',
      upvotes: List<String>.from((json['upvotes'] ?? []).map((e) =>
          e is Map ? (e['_id'] ?? e['id'] ?? '') : e.toString())),
      downvotes: List<String>.from((json['downvotes'] ?? []).map((e) =>
          e is Map ? (e['_id'] ?? e['id'] ?? '') : e.toString())),
      saves: List<String>.from((json['saves'] ?? []).map((e) =>
          e is Map ? (e['_id'] ?? e['id'] ?? '') : e.toString())),
      shares: (json['shares'] as num?)?.toInt() ?? 0,
      isAccepted: json['isAccepted'] ?? false,
      repliesCount: (json['repliesCount'] as num?)?.toInt() ?? 0,
      status: json['status'] ?? 'active',
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'])
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'question': questionId,
      'author': author.toJson(),
      'content': content,
      'upvotes': upvotes,
      'downvotes': downvotes,
      'saves': saves,
      'shares': shares,
      'isAccepted': isAccepted,
      'repliesCount': repliesCount,
      'status': status,
      'createdAt': createdAt.toIso8601String(),
    };
  }
}
