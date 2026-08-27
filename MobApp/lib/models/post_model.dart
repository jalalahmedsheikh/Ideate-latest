import 'user_model.dart';
import 'topic_model.dart';

class CommentModel {
  final String id;
  final String content;
  final UserModel author;
  final String? parentComment;
  final int replyCount;
  final int likeCount;
  final bool isLiked;
  final bool isEdited;
  final String status;
  final DateTime createdAt;

  CommentModel({
    required this.id,
    required this.content,
    required this.author,
    this.parentComment,
    this.replyCount = 0,
    this.likeCount = 0,
    this.isLiked = false,
    this.isEdited = false,
    this.status = "active",
    required this.createdAt,
  });

  factory CommentModel.fromJson(dynamic json) {
    if (json is! Map<String, dynamic>) {
      return CommentModel(
        id: json?.toString() ?? '',
        content: '',
        author: UserModel(
          id: '',
          username: 'User',
          email: '',
          category: 'User',
          followers: [],
          followings: [],
          posts: [],
          bookmarks: [],
          isverified: false,
        ),
        createdAt: DateTime.now(),
      );
    }
    return CommentModel(
      id: json['_id'] ?? json['id'] ?? '',
      content: json['text'] ?? json['content'] ?? '',
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
      parentComment: json['parentComment'] is Map
          ? (json['parentComment']['_id'] ?? json['parentComment']['id'])
          : json['parentComment']?.toString(),
      replyCount: (json['replyCount'] as num?)?.toInt() ?? 0,
      likeCount: (json['likeCount'] as num?)?.toInt() ??
          ((json['likes'] as List?)?.length ?? 0),
      isLiked: json['isLiked'] ?? false,
      isEdited: json['isEdited'] ?? false,
      status: json['status'] ?? 'active',
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'])
          : DateTime.now(),
    );
  }

  CommentModel copyWith({
    String? content,
    int? replyCount,
    int? likeCount,
    bool? isLiked,
    bool? isEdited,
    String? status,
  }) {
    return CommentModel(
      id: id,
      content: content ?? this.content,
      author: author,
      parentComment: parentComment,
      replyCount: replyCount ?? this.replyCount,
      likeCount: likeCount ?? this.likeCount,
      isLiked: isLiked ?? this.isLiked,
      isEdited: isEdited ?? this.isEdited,
      status: status ?? this.status,
      createdAt: createdAt,
    );
  }
}

class PostModel {
  final String id;
  final String caption;
  final UserModel author;
  final List<String> likes;
  final List<CommentModel> comments;
  final List<TopicModel> topics;
  final int shareCount;
  final String? recommendationSignal;
  final DateTime createdAt;

  PostModel({
    required this.id,
    required this.caption,
    required this.author,
    required this.likes,
    required this.comments,
    this.topics = const [],
    this.shareCount = 0,
    this.recommendationSignal,
    required this.createdAt,
  });

  factory PostModel.fromJson(Map<String, dynamic> json) {
    return PostModel(
      id: json['_id'] ?? json['id'] ?? '',
      caption: json['caption'] ?? '',
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
      likes: List<String>.from((json['likes'] ?? []).map((item) =>
          item is Map ? (item['_id'] ?? item['id'] ?? '') : item.toString())),
      comments: List<CommentModel>.from((json['comments'] ?? [])
          .map((item) => CommentModel.fromJson(item))),
      topics: (json['topics'] as List?)
              ?.map((item) => TopicModel.fromJson(item))
              .toList() ??
          [],
      shareCount: (json['shareCount'] as num?)?.toInt() ?? 0,
      recommendationSignal: json['recommendationSignal'] as String?,
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'])
          : DateTime.now(),
    );
  }
}
