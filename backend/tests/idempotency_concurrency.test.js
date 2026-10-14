import { test, describe, afterEach, after } from "node:test";
import assert from "node:assert";
import { CommentService } from "../services/comment.service.js";
import { Comment } from "../models/comment.model.js";
import { Post } from "../models/post.model.js";
import redis from "../config/redis.js";

describe("Phase 4: Comment Concurrency, Idempotency & Conflict Tests", () => {
  const originalFindOne = Comment.findOne;
  const originalCreate = Comment.create;
  const originalFindById = Post.findById;

  after(async () => {
    try {
      redis?.disconnect();
    } catch (_) {}
  });

  afterEach(() => {
    Comment.findOne = originalFindOne;
    Comment.create = originalCreate;
    Post.findById = originalFindById;
  });

  test("1. Idempotency: Returns existing comment and isDuplicate: true on exact re-submission", async () => {
    const existingDoc = {
      _id: "comm_existing_1",
      content: "First attempt",
      post: "post_100",
      poll: null,
      author: { _id: "user_alice", username: "alice" },
      likes: [],
      reactions: new Map([["like", []]]),
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    Comment.findOne = () => ({
      populate: () => ({
        populate: async () => existingDoc,
      }),
    });

    const result = await CommentService.createComment({
      authorId: "user_alice",
      content: "First attempt",
      postId: "post_100",
      idempotencyKey: "idem_key_abc",
    });

    assert.strictEqual(result.isDuplicate, true);
    assert.strictEqual(result.comment._id, "comm_existing_1");
    assert.strictEqual(result.comment.content, "First attempt");
  });

  test("2. Idempotency Conflict: Throws 409 Conflict if same key is reused with different content", async () => {
    const existingDoc = {
      _id: "comm_existing_1",
      content: "First attempt",
      post: "post_100",
      poll: null,
      author: { _id: "user_alice", username: "alice" },
      likes: [],
      reactions: new Map([["like", []]]),
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    Comment.findOne = () => ({
      populate: () => ({
        populate: async () => existingDoc,
      }),
    });

    await assert.rejects(
      async () => {
        await CommentService.createComment({
          authorId: "user_alice",
          content: "Completely different text with same key",
          postId: "post_100",
          idempotencyKey: "idem_key_abc",
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 409);
        assert.ok(err.message.includes("Idempotency conflict"));
        return true;
      }
    );
  });

  test("3. Concurrency Race Condition: E11000 duplicate key gracefully returns existing comment without duplicates", async () => {
    let findCount = 0;
    const existingDoc = {
      _id: "comm_race_winner",
      content: "Concurrent text",
      post: "post_100",
      poll: null,
      author: { _id: "user_alice", username: "alice" },
      likes: [],
      reactions: new Map([["like", []]]),
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // First findOne returns null (simulating two simultaneous requests before either writes)
    Comment.findOne = () => ({
      populate: () => ({
        populate: async () => {
          findCount++;
          if (findCount === 1) return null;
          return existingDoc;
        },
      }),
    });

    Post.findById = async () => ({
      _id: "post_100",
      status: "active",
      comments: [],
      save: async () => {},
    });

    // Simulate Comment.create throwing duplicate key error code 11000
    Comment.create = async () => {
      const mongoErr = new Error("E11000 duplicate key error collection");
      mongoErr.code = 11000;
      mongoErr.name = "MongoServerError";
      throw mongoErr;
    };

    const result = await CommentService.createComment({
      authorId: "user_alice",
      content: "Concurrent text",
      postId: "post_100",
      idempotencyKey: "idem_key_race",
    });

    assert.strictEqual(result.isDuplicate, true);
    assert.strictEqual(result.comment._id, "comm_race_winner");
    assert.strictEqual(result.comment.content, "Concurrent text");
  });
});
