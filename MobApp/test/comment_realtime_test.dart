import 'package:flutter_test/flutter_test.dart';
import 'package:ideate/models/post_model.dart';
import 'package:ideate/models/user_model.dart';

void main() {
  group('Flutter MobApp Comment & Real-Time Event State Tests', () {
    test('1. CommentModel deserializes isPinned and replyCount correctly', () {
      final json = {
        '_id': 'c1',
        'content': 'First comment',
        'author': {
          '_id': 'u1',
          'username': 'alice',
          'name': 'Alice Smith',
          'profileImage': null,
          'isverified': false,
        },
        'likes': ['u2'],
        'replyCount': 3,
        'isPinned': true,
        'pinnedAt': '2026-10-14T10:00:00.000Z',
        'isEdited': false,
        'status': 'active',
        'createdAt': '2026-10-14T09:00:00.000Z',
      };

      final comment = CommentModel.fromJson(json);
      expect(comment.id, 'c1');
      expect(comment.content, 'First comment');
      expect(comment.isPinned, true);
      expect(comment.replyCount, 3);
      expect(comment.likeCount, 1);
      expect(comment.author.username, 'alice');
    });

    test('2. Live Event: comment:new adds comment and updates thread replyCount', () {
      final comments = <CommentModel>[
        CommentModel(
          id: 'parent_1',
          author: UserModel.fromJson({'_id': 'u1', 'username': 'alice', 'name': 'Alice'}),
          content: 'Parent thread',
          createdAt: DateTime.now(),
          replyCount: 0,
        ),
      ];

      final repliesMap = <String, List<CommentModel>>{};

      // Simulate comment:new with isReply: true
      final newReply = CommentModel(
        id: 'reply_1',
        author: UserModel.fromJson({'_id': 'u2', 'username': 'bob', 'name': 'Bob'}),
        content: 'Replying to alice',
        parentComment: 'parent_1',
        createdAt: DateTime.now(),
      );

      final parentIdx = comments.indexWhere((c) => c.id == 'parent_1');
      expect(parentIdx, isNot(-1));
      comments[parentIdx] = comments[parentIdx].copyWith(replyCount: comments[parentIdx].replyCount + 1);
      repliesMap.putIfAbsent('parent_1', () => []).add(newReply);

      expect(comments[0].replyCount, 1);
      expect(repliesMap['parent_1']!.length, 1);
      expect(repliesMap['parent_1']!.first.id, 'reply_1');
    });

    test('3. Live Event: comment:edit updates content and marks isEdited: true in place', () {
      var comment = CommentModel(
        id: 'c1',
        author: UserModel.fromJson({'_id': 'u1', 'username': 'alice', 'name': 'Alice'}),
        content: 'Original content',
        createdAt: DateTime.now(),
      );

      // Simulate comment:edit event
      const updatedText = 'Updated new content';
      comment = comment.copyWith(content: updatedText, isEdited: true);

      expect(comment.content, 'Updated new content');
      expect(comment.isEdited, true);
    });

    test('4. Live Event: comment:reaction updates likeCount in real-time', () {
      var comment = CommentModel(
        id: 'c1',
        author: UserModel.fromJson({'_id': 'u1', 'username': 'alice', 'name': 'Alice'}),
        content: 'React to me',
        createdAt: DateTime.now(),
        likeCount: 5,
      );

      // Simulate incoming like count
      comment = comment.copyWith(likeCount: 6);
      expect(comment.likeCount, 6);
    });

    test('5. Live Event: comment:pin toggles isPinned and sorts pinned comment to top', () {
      var list = <CommentModel>[
        CommentModel(
          id: 'c1',
          author: UserModel.fromJson({'_id': 'u1', 'username': 'alice', 'name': 'Alice'}),
          content: 'Comment 1',
          createdAt: DateTime.now(),
          isPinned: false,
        ),
        CommentModel(
          id: 'c2',
          author: UserModel.fromJson({'_id': 'u2', 'username': 'bob', 'name': 'Bob'}),
          content: 'Comment 2',
          createdAt: DateTime.now(),
          isPinned: false,
        ),
      ];

      // Pin c2
      list = list.map<CommentModel>((CommentModel c) {
        if (c.id == 'c2') return c.copyWith(isPinned: true);
        return c.copyWith(isPinned: false);
      }).toList();

      list.sort((a, b) => (b.isPinned ? 1 : 0).compareTo(a.isPinned ? 1 : 0));

      expect(list.first.id, 'c2');
      expect(list.first.isPinned, true);
      expect(list.last.isPinned, false);
    });

    test('6. Live Event: comment:delete displays soft-delete tombstone text', () {
      var comment = CommentModel(
        id: 'c1',
        author: UserModel.fromJson({'_id': 'u1', 'username': 'alice', 'name': 'Alice'}),
        content: 'Before delete',
        createdAt: DateTime.now(),
        status: 'active',
      );

      comment = comment.copyWith(
        content: 'This comment was deleted.',
        status: 'deleted',
      );

      expect(comment.content, 'This comment was deleted.');
      expect(comment.status, 'deleted');
    });

    test('7. Ephemeral Event: comment:typing extracts typer names excluding current user', () {
      const currentUserId = 'u_alice';
      final rawTypers = [
        {'userId': 'u_alice', 'username': 'alice', 'name': 'Alice'},
        {'userId': 'u_bob', 'username': 'bob', 'name': 'Bob'},
        {'userId': 'u_charlie', 'username': 'charlie', 'name': 'Charlie'},
      ];

      final names = <String>[];
      for (final t in rawTypers) {
        if (t['userId'] != currentUserId) {
          names.add(t['name'] ?? t['username'] ?? 'User');
        }
      }

      expect(names.length, 2);
      expect(names, ['Bob', 'Charlie']);
    });
  });
}
