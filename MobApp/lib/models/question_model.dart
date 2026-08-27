import 'user_model.dart';
import 'topic_model.dart';
import 'answer_model.dart';

class QuestionModel {
  final String id;
  final String title;
  final String description;
  final UserModel author;
  final List<TopicModel> topics;
  final String? communityId;
  final String visibility;
  final String status;
  final int views;
  final List<String> upvotes;
  final List<String> downvotes;
  final List<String> saves;
  final int shares;
  final String? acceptedAnswerId;
  final AnswerModel? acceptedAnswer;
  final List<String> followers;
  final int answersCount;
  final String? questionType;
  final DateTime createdAt;

  QuestionModel({
    required this.id,
    required this.title,
    required this.description,
    required this.author,
    this.topics = const [],
    this.communityId,
    this.visibility = 'public',
    this.status = 'active',
    this.views = 0,
    this.upvotes = const [],
    this.downvotes = const [],
    this.saves = const [],
    this.shares = 0,
    this.acceptedAnswerId,
    this.acceptedAnswer,
    this.followers = const [],
    this.answersCount = 0,
    this.questionType,
    required this.createdAt,
  });

  int get score => upvotes.length - downvotes.length;

  bool isUpvotedBy(String userId) => upvotes.contains(userId);
  bool isDownvotedBy(String userId) => downvotes.contains(userId);
  bool isSavedBy(String userId) => saves.contains(userId);
  bool isFollowedBy(String userId) => followers.contains(userId);
  bool get hasAcceptedAnswer => acceptedAnswerId != null && acceptedAnswerId!.isNotEmpty;

  factory QuestionModel.fromJson(Map<String, dynamic> json) {
    return QuestionModel(
      id: json['_id'] ?? json['id'] ?? '',
      title: json['title'] ?? '',
      description: json['description'] ?? '',
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
      topics: (json['topics'] as List?)
              ?.map((item) => TopicModel.fromJson(item))
              .toList() ??
          [],
      communityId: json['community'] is Map
          ? (json['community']['_id'] ?? '')
          : (json['community'] ?? '').toString(),
      visibility: json['visibility'] ?? 'public',
      status: json['status'] ?? 'active',
      views: (json['views'] as num?)?.toInt() ?? 0,
      upvotes: List<String>.from((json['upvotes'] ?? []).map((e) =>
          e is Map ? (e['_id'] ?? e['id'] ?? '') : e.toString())),
      downvotes: List<String>.from((json['downvotes'] ?? []).map((e) =>
          e is Map ? (e['_id'] ?? e['id'] ?? '') : e.toString())),
      saves: List<String>.from((json['saves'] ?? []).map((e) =>
          e is Map ? (e['_id'] ?? e['id'] ?? '') : e.toString())),
      shares: (json['shares'] as num?)?.toInt() ?? 0,
      acceptedAnswerId: json['acceptedAnswer'] is Map
          ? (json['acceptedAnswer']['_id'] ?? '')
          : (json['acceptedAnswer'] ?? '').toString(),
      acceptedAnswer: json['acceptedAnswer'] is Map<String, dynamic>
          ? AnswerModel.fromJson(json['acceptedAnswer'])
          : null,
      followers: List<String>.from((json['followers'] ?? []).map((e) =>
          e is Map ? (e['_id'] ?? e['id'] ?? '') : e.toString())),
      answersCount: (json['answersCount'] as num?)?.toInt() ?? 0,
      questionType: json['questionType'],
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'])
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'title': title,
      'description': description,
      'author': author.toJson(),
      'topics': topics.map((t) => t.id).toList(),
      'community': communityId,
      'visibility': visibility,
      'status': status,
      'views': views,
      'upvotes': upvotes,
      'downvotes': downvotes,
      'saves': saves,
      'shares': shares,
      'acceptedAnswer': acceptedAnswerId,
      'followers': followers,
      'answersCount': answersCount,
      'questionType': questionType,
      'createdAt': createdAt.toIso8601String(),
    };
  }
}
