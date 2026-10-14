import { test, describe, after } from "node:test";
import assert from "node:assert";
import { formatCommentForClient, CommentService } from "../services/comment.service.js";
import redis from "../config/redis.js";

describe("Phase 4 & 5: Comment Service Unit, Formatting & Validation Tests", () => {
  after(async () => {
    try {
      redis?.disconnect();
    } catch (_) {}
  });
  test("1. formatCommentForClient formats comment and calculates isLiked and reactionCounts", () => {
    const rawComment = {
      _id: "comm_123",
      content: "Insightful perspective!",
      post: "post_1",
      poll: null,
      author: { _id: "author_1", username: "alice" },
      parentComment: null,
      depth: 0,
      replyCount: 2,
      likes: ["user_bob", "user_alice"],
      reactions: new Map([
        ["like", ["user_bob", "user_alice"]],
        ["love", ["user_bob"]],
        ["insightful", ["user_charlie"]],
      ]),
      isEdited: false,
      isPinned: true,
      pinnedAt: new Date("2026-10-14T10:00:00Z"),
      status: "active",
      createdAt: new Date("2026-10-14T09:00:00Z"),
      updatedAt: new Date("2026-10-14T09:00:00Z"),
    };

    const formattedForAlice = formatCommentForClient(rawComment, "user_alice");
    assert.strictEqual(formattedForAlice._id, "comm_123");
    assert.strictEqual(formattedForAlice.content, "Insightful perspective!");
    assert.strictEqual(formattedForAlice.isLiked, true);
    assert.strictEqual(formattedForAlice.likeCount, 2);
    assert.strictEqual(formattedForAlice.isPinned, true);
    assert.strictEqual(formattedForAlice.reactionCounts.like, 2);
    assert.strictEqual(formattedForAlice.reactionCounts.love, 1);
    assert.strictEqual(formattedForAlice.reactionCounts.insightful, 1);
    assert.strictEqual(formattedForAlice.reactionCounts.laugh, 0);

    const formattedForGuest = formatCommentForClient(rawComment, null);
    assert.strictEqual(formattedForGuest.isLiked, false);
    assert.strictEqual(formattedForGuest.likeCount, 2);
  });

  test("2. formatCommentForClient masks content of deleted comments", () => {
    const deletedComment = {
      _id: "comm_del",
      content: "Sensitive old text",
      status: "deleted",
      author: { _id: "author_1", username: "alice" },
      likes: [],
      createdAt: new Date(),
    };

    const formatted = formatCommentForClient(deletedComment, "author_1");
    assert.strictEqual(formatted.content, "This comment was deleted.");
    assert.strictEqual(formatted.status, "deleted");
  });

  test("3. CommentService.createComment rejects empty or whitespace-only content", async () => {
    await assert.rejects(
      async () => {
        await CommentService.createComment({
          authorId: "user_alice",
          content: "   ",
          postId: "post_1",
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.ok(err.message.includes("cannot be empty"));
        return true;
      }
    );
  });

  test("4. CommentService.createComment rejects oversized content (>3000 chars)", async () => {
    const oversized = "a".repeat(3001);
    await assert.rejects(
      async () => {
        await CommentService.createComment({
          authorId: "user_alice",
          content: oversized,
          postId: "post_1",
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.ok(err.message.includes("exceeds maximum limit"));
        return true;
      }
    );
  });

  test("5. CommentService.createComment rejects calls missing both postId and pollId", async () => {
    await assert.rejects(
      async () => {
        await CommentService.createComment({
          authorId: "user_alice",
          content: "Valid text",
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.ok(err.message.includes("Must provide a postId or pollId"));
        return true;
      }
    );
  });
});
