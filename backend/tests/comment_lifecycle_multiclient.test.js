import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import ioClient from "socket.io-client";
import jwt from "jsonwebtoken";
import { createTestSocketServer } from "./helpers/testServer.js";

const SECRET_KEY = "ideate_development_secret_key_12345";

describe("Phase 2 & 3: Multi-Client Real-Time Discussion & Typing Lifecycle Tests", () => {
  let testEnv;
  let clientA; // Alice
  let clientB; // Bob
  let tokenAlice;
  let tokenBob;

  before(async () => {
    testEnv = await createTestSocketServer({
      mockUsers: new Map([
        ["user_alice", { _id: "user_alice", username: "alice", name: "Alice Smith" }],
        ["user_bob", { _id: "user_bob", username: "bob", name: "Bob Jones" }],
        ["user_charlie", { _id: "user_charlie", username: "charlie", name: "Charlie" }],
      ]),
      mockPosts: new Map([
        ["post_public", { _id: "post_public", author: "user_alice", status: "active" }],
        ["post_private", { _id: "post_private", author: "user_alice", status: "private" }],
        ["post_deleted", { _id: "post_deleted", author: "user_alice", status: "deleted" }],
      ]),
    });

    tokenAlice = jwt.sign({ userId: "user_alice" }, SECRET_KEY, { expiresIn: "1h" });
    tokenBob = jwt.sign({ userId: "user_bob" }, SECRET_KEY, { expiresIn: "1h" });

    clientA = ioClient(testEnv.url, { auth: { token: tokenAlice }, reconnection: false });
    clientB = ioClient(testEnv.url, { auth: { token: tokenBob }, reconnection: false });

    await Promise.all([
      new Promise((res) => clientA.on("connect", res)),
      new Promise((res) => clientB.on("connect", res)),
    ]);
  });

  after(async () => {
    clientA?.close();
    clientB?.close();
    await testEnv.close();
  });

  test("1. Room authorization: Rejects unauthorized joins to private and deleted posts", async () => {
    // Bob attempts to join Alice's private post
    const privateResult = await new Promise((res) => {
      clientB.emit("join_discussion", { targetId: "post_private", targetType: "post" }, res);
    });
    assert.strictEqual(privateResult.success, false);
    assert.ok(privateResult.message.includes("Unauthorized"), `Expected unauthorized, got ${privateResult.message}`);

    // Bob attempts to join deleted post
    const deletedResult = await new Promise((res) => {
      clientB.emit("join_discussion", { targetId: "post_deleted", targetType: "post" }, res);
    });
    assert.strictEqual(deletedResult.success, false);
    assert.ok(deletedResult.message.includes("not found or deleted"));

    // Both Alice and Bob join public discussion
    const aliceJoin = await new Promise((res) => {
      clientA.emit("join_discussion", { targetId: "post_public", targetType: "post" }, res);
    });
    assert.strictEqual(aliceJoin.success, true);
    assert.strictEqual(aliceJoin.room, "post:post_public");

    const bobJoin = await new Promise((res) => {
      clientB.emit("join_discussion", { targetId: "post_public", targetType: "post" }, res);
    });
    assert.strictEqual(bobJoin.success, true);
    assert.strictEqual(bobJoin.room, "post:post_public");
  });

  test("2. Real-time New Comment: Client B receives comment:new when Client A posts", async () => {
    const newCommentPayload = {
      targetId: "post_public",
      targetType: "post",
      comment: {
        _id: "comment_1",
        content: "Hello from Alice!",
        author: { _id: "user_alice", username: "alice" },
        isPinned: false,
        replyCount: 0,
        likeCount: 0,
      },
      isReply: false,
      parentCommentId: null,
    };

    const bReceivedPromise = new Promise((resolve) => {
      clientB.once("comment:new", (payload) => {
        resolve(payload);
      });
    });

    // Server broadcasts event to discussion room
    testEnv.io.to("post:post_public").emit("comment:new", newCommentPayload);

    const received = await bReceivedPromise;
    assert.strictEqual(received.comment._id, "comment_1");
    assert.strictEqual(received.comment.content, "Hello from Alice!");
    assert.strictEqual(received.isReply, false);
  });

  test("3. Real-time Threaded Reply: Client A receives reply under parent comment", async () => {
    const replyPayload = {
      targetId: "post_public",
      targetType: "post",
      comment: {
        _id: "reply_1",
        content: "Replying to Alice from Bob",
        author: { _id: "user_bob", username: "bob" },
        parentComment: "comment_1",
        depth: 1,
      },
      isReply: true,
      parentCommentId: "comment_1",
    };

    const aReceivedPromise = new Promise((resolve) => {
      const handler = (payload) => {
        if (payload.comment?._id === "reply_1") {
          clientA.off("comment:new", handler);
          resolve(payload);
        }
      };
      clientA.on("comment:new", handler);
    });

    testEnv.io.to("post:post_public").emit("comment:new", replyPayload);

    const received = await aReceivedPromise;
    assert.strictEqual(received.comment._id, "reply_1");
    assert.strictEqual(received.isReply, true);
    assert.strictEqual(received.parentCommentId, "comment_1");
  });

  test("4. Real-time Comment Edit: Client B receives comment:edit update", async () => {
    const editPayload = {
      targetId: "post_public",
      targetType: "post",
      commentId: "comment_1",
      content: "Hello from Alice! (Edited)",
      isEdited: true,
      editedAt: new Date().toISOString(),
    };

    const bReceivedPromise = new Promise((resolve) => {
      clientB.once("comment:edit", (payload) => {
        resolve(payload);
      });
    });

    testEnv.io.to("post:post_public").emit("comment:edit", editPayload);

    const received = await bReceivedPromise;
    assert.strictEqual(received.commentId, "comment_1");
    assert.strictEqual(received.content, "Hello from Alice! (Edited)");
    assert.strictEqual(received.isEdited, true);
  });

  test("5. Real-time Reaction: Client A receives live like count and reaction counts", async () => {
    const reactionPayload = {
      targetId: "post_public",
      targetType: "post",
      commentId: "comment_1",
      userId: "user_bob",
      reactionType: "like",
      isAdded: true,
      likeCount: 1,
      reactionCounts: { like: 1, love: 0, insightful: 0, laugh: 0, sad: 0 },
    };

    const aReceivedPromise = new Promise((resolve) => {
      clientA.once("comment:reaction", (payload) => {
        resolve(payload);
      });
    });

    testEnv.io.to("post:post_public").emit("comment:reaction", reactionPayload);

    const received = await aReceivedPromise;
    assert.strictEqual(received.commentId, "comment_1");
    assert.strictEqual(received.reactionType, "like");
    assert.strictEqual(received.likeCount, 1);
    assert.strictEqual(received.isAdded, true);
  });

  test("6. Real-time Pinning: Client B receives comment:pin notification", async () => {
    const pinPayload = {
      targetId: "post_public",
      targetType: "post",
      commentId: "comment_1",
      isPinned: true,
      pinnedAt: new Date().toISOString(),
    };

    const bReceivedPromise = new Promise((resolve) => {
      clientB.once("comment:pin", (payload) => {
        resolve(payload);
      });
    });

    testEnv.io.to("post:post_public").emit("comment:pin", pinPayload);

    const received = await bReceivedPromise;
    assert.strictEqual(received.commentId, "comment_1");
    assert.strictEqual(received.isPinned, true);
  });

  test("7. Ephemeral Typing Indicator: Broadcasts active typers and clears on stop", async () => {
    const typingStartedPromise = new Promise((resolve) => {
      clientB.on("comment:typing", function onTyping(payload) {
        if (payload.typers?.some((t) => t.userId === "user_alice")) {
          clientB.off("comment:typing", onTyping);
          resolve(payload);
        }
      });
    });

    // Alice starts typing
    clientA.emit("comment:typing_start", {
      targetId: "post_public",
      targetType: "post",
      parentCommentId: null,
    });

    const startedPayload = await typingStartedPromise;
    assert.ok(startedPayload.typers.some((t) => t.username === "alice"), "Alice should be listed in active typers");

    const typingStoppedPromise = new Promise((resolve) => {
      clientB.on("comment:typing", function onStopped(payload) {
        if (!payload.typers?.some((t) => t.userId === "user_alice")) {
          clientB.off("comment:typing", onStopped);
          resolve(payload);
        }
      });
    });

    // Alice stops typing
    clientA.emit("comment:typing_stop", {
      targetId: "post_public",
      targetType: "post",
      parentCommentId: null,
    });

    const stoppedPayload = await typingStoppedPromise;
    assert.strictEqual(
      stoppedPayload.typers.some((t) => t.userId === "user_alice"),
      false,
      "Alice should be removed from active typers"
    );
  });

  test("8. Real-time Comment Delete: Client B receives comment:delete", async () => {
    const deletePayload = {
      targetId: "post_public",
      targetType: "post",
      commentId: "comment_1",
      parentCommentId: null,
      status: "deleted",
    };

    const bReceivedPromise = new Promise((resolve) => {
      clientB.once("comment:delete", (payload) => {
        resolve(payload);
      });
    });

    testEnv.io.to("post:post_public").emit("comment:delete", deletePayload);

    const received = await bReceivedPromise;
    assert.strictEqual(received.commentId, "comment_1");
    assert.strictEqual(received.status, "deleted");
  });
});
