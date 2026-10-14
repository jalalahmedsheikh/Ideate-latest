import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import mongoose from "mongoose";
import dns from "dns";
import "dotenv/config";
import { Comment } from "../models/comment.model.js";
import { Post } from "../models/post.model.js";
import { User } from "../models/user.model.js";
import { CommentService } from "../services/comment.service.js";
import redis from "../config/redis.js";

// Ensure public DNS fallback for Atlas SRV resolution
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (_) {}

describe("Phase 1: Real MongoDB Atlas Integration & Concurrency Verification", () => {
  let testUser;
  let testPost;
  const createdCommentIds = [];

  before(async () => {
    if (!mongoose.connection.readyState) {
      await mongoose.connect(process.env.MONGO_URI);
    }

    // Ensure partial unique index is synced to the real collection
    await Comment.syncIndexes();

    // Create or find an isolated test user and post
    testUser = await User.findOne({ username: "test_integration_user" });
    if (!testUser) {
      testUser = await User.create({
        username: "test_integration_user",
        email: "test_integration_user@ideate.test",
        password: "hashed_dummy_password",
        name: "Integration Test User",
      });
    }

    testPost = await Post.create({
      author: testUser._id,
      caption: "Real MongoDB Integration Discussion Post: Testing persistence, partial indexes, and concurrency.",
      status: "active",
      tags: ["test"],
      comments: [],
    });
  });

  after(async () => {
    // Clean up created test comments and post (safe cleanup, no broad drops)
    try {
      if (createdCommentIds.length > 0) {
        await Comment.deleteMany({ _id: { $in: createdCommentIds } });
      }
      if (testPost?._id) {
        await Post.deleteOne({ _id: testPost._id });
      }
    } catch (err) {
      console.warn("Cleanup warning:", err.message);
    }

    try {
      redis?.disconnect();
    } catch (_) {}

    await mongoose.disconnect();
  });

  test("1. Index Verification: Verifies partial unique idempotency index exists in real MongoDB", async () => {
    const indexes = await Comment.collection.indexes();
    const idemIndex = indexes.find((idx) => idx.name === "author_1_idempotencyKey_1");

    assert.ok(idemIndex, "author_1_idempotencyKey_1 index must exist in MongoDB collection");
    assert.strictEqual(idemIndex.unique, true, "Index must be unique");
    assert.deepStrictEqual(
      idemIndex.partialFilterExpression,
      { idempotencyKey: { $type: "string" } },
      "Index must specify partialFilterExpression"
    );
  });

  test("2. Real Comment Persistence: Creates and verifies comment persisted in MongoDB", async () => {
    const result = await CommentService.createComment({
      authorId: testUser._id,
      content: "This is a real database persisted comment.",
      postId: testPost._id,
      idempotencyKey: `real_test_key_${Date.now()}_1`,
    });

    assert.ok(result.comment._id);
    assert.strictEqual(result.isDuplicate, false);
    createdCommentIds.push(result.comment._id);

    // Verify directly from real MongoDB
    const persisted = await Comment.findById(result.comment._id);
    assert.ok(persisted, "Comment document must exist in real MongoDB");
    assert.strictEqual(persisted.content, "This is a real database persisted comment.");
    assert.strictEqual(persisted.depth, 0);
    assert.strictEqual(persisted.status, "active");
  });

  test("3. Real Threaded Reply & Atomic Counter: Increments replyCount on parent in real MongoDB", async () => {
    const parent = await CommentService.createComment({
      authorId: testUser._id,
      content: "Parent discussion thread starter.",
      postId: testPost._id,
      idempotencyKey: `real_test_parent_${Date.now()}`,
    });
    createdCommentIds.push(parent.comment._id);

    const reply = await CommentService.createComment({
      authorId: testUser._id,
      content: "Nested direct reply.",
      postId: testPost._id,
      parentCommentId: parent.comment._id,
      idempotencyKey: `real_test_reply_${Date.now()}`,
    });
    createdCommentIds.push(reply.comment._id);

    const updatedParent = await Comment.findById(parent.comment._id);
    assert.strictEqual(updatedParent.replyCount, 1, "Parent comment replyCount must increment to 1");

    const replyDoc = await Comment.findById(reply.comment._id);
    assert.strictEqual(replyDoc.depth, 1, "Reply depth must be 1");
    assert.strictEqual(replyDoc.parentComment.toString(), parent.comment._id.toString());
  });

  test("4. Real Concurrency: Simultaneous duplicate submissions create exactly 1 document in MongoDB", async () => {
    const sharedIdempotencyKey = `concurrent_race_key_${Date.now()}`;
    const commentContent = "Concurrent idempotent content submission.";

    // Fire 5 simultaneous requests with the identical author and idempotencyKey
    const results = await Promise.all([
      CommentService.createComment({
        authorId: testUser._id,
        content: commentContent,
        postId: testPost._id,
        idempotencyKey: sharedIdempotencyKey,
      }),
      CommentService.createComment({
        authorId: testUser._id,
        content: commentContent,
        postId: testPost._id,
        idempotencyKey: sharedIdempotencyKey,
      }),
      CommentService.createComment({
        authorId: testUser._id,
        content: commentContent,
        postId: testPost._id,
        idempotencyKey: sharedIdempotencyKey,
      }),
      CommentService.createComment({
        authorId: testUser._id,
        content: commentContent,
        postId: testPost._id,
        idempotencyKey: sharedIdempotencyKey,
      }),
      CommentService.createComment({
        authorId: testUser._id,
        content: commentContent,
        postId: testPost._id,
        idempotencyKey: sharedIdempotencyKey,
      }),
    ]);

    // Track for cleanup
    createdCommentIds.push(results[0].comment._id);

    // Count how many were returned as duplicate
    const duplicates = results.filter((r) => r.isDuplicate === true);
    assert.strictEqual(duplicates.length, 4, "4 of the 5 requests must be recognized as duplicates");

    // All results must reference the exact same comment ID
    const firstId = results[0].comment._id.toString();
    for (const res of results) {
      assert.strictEqual(res.comment._id.toString(), firstId, "All responses must return the same comment ID");
    }

    // Direct database check: exactly 1 document with this key must exist in real MongoDB!
    const countInDb = await Comment.countDocuments({
      author: testUser._id,
      idempotencyKey: sharedIdempotencyKey,
    });
    assert.strictEqual(countInDb, 1, "Exactly 1 document must exist in real MongoDB collection");
  });

  test("5. Real Conflict Detection: Re-using key with different content rejects with 409 Conflict", async () => {
    const key = `conflict_key_${Date.now()}`;

    // First submission
    const first = await CommentService.createComment({
      authorId: testUser._id,
      content: "Original intended content",
      postId: testPost._id,
      idempotencyKey: key,
    });
    createdCommentIds.push(first.comment._id);

    // Second submission with differing payload
    await assert.rejects(
      async () => {
        await CommentService.createComment({
          authorId: testUser._id,
          content: "Conflicting different content reusing same key",
          postId: testPost._id,
          idempotencyKey: key,
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 409);
        assert.ok(err.message.includes("Idempotency conflict"));
        return true;
      }
    );
  });
});
