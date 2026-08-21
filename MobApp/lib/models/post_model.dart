import 'user_model.dart';

class CommentModel {
  final String id;
  final String content;
  final UserModel author;
  final DateTime createdAt;

  CommentModel({
    required this.id,
    required this.content,
    required this.author,
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
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'])
          : DateTime.now(),
    );
  }
}

class PostModel {
  final String id;
  final String caption;
  final UserModel author;
  final List<String> likes;
  final List<CommentModel> comments;
  final DateTime createdAt;

  PostModel({
    required this.id,
    required this.caption,
    required this.author,
    required this.likes,
    required this.comments,
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
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'])
          : DateTime.now(),
    );
  }
}
