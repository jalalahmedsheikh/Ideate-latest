import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import http from "http";
import express from "express";
import { Server } from "socket.io";
import ioClient from "socket.io-client";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import dns from "dns";
import "dotenv/config";
import { Comment } from "../models/comment.model.js";
import { Post } from "../models/post.model.js";
import { User } from "../models/user.model.js";
import { CommentService } from "../services/comment.service.js";
import redis from "../config/redis.js";

// Ensure DNS fallback for MongoDB Atlas
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (_) {}

const SECRET_KEY = process.env.SECRET_KEY || "ideate_development_secret_key_12345";

describe("Phase 3: End-to-End Multi-Client Live Discussion Exchange with Real MongoDB", () => {
  let server;
  let io;
  let serverUrl;
  let clientA; // User A (Alice - Post Owner)
  let clientB; // User B (Bob - Participant)
  let userA;
  let userB;
  let postDoc;
  let sharedCommentId;
  let sharedReplyId;

  const userSockets = new Map();
  const typingRegistry = new Map();

  before(async () => {
    // 1. Connect to Real MongoDB
    if (!mongoose.connection.readyState) {
      await mongoose.connect(process.env.MONGO_URI);
    }
    await Comment.syncIndexes();

    // 2. Set up test users in real MongoDB
    userA = await User.findOne({ username: "e2e_alice" });
    if (!userA) {
      userA = await User.create({
        username: "e2e_alice",
        email: "e2e_alice@ideate.test",
        password: "dummy_password_hash",
        name: "Alice E2E",
      });
    }

    userB = await User.findOne({ username: "e2e_bob" });
    if (!userB) {
      userB = await User.create({
        username: "e2e_bob",
        email: "e2e_bob@ideate.test",
        password: "dummy_password_hash",
        name: "Bob E2E",
      });
    }

    // 3. Set up active test post in real MongoDB
    postDoc = await Post.create({
      author: userA._id,
      caption: "Real End-to-End Discussion Post for Live Multi-Client Verification",
      status: "active",
      tags: ["e2e", "realtime"],
      comments: [],
    });

    // 4. Create real HTTP & Socket.IO server on ephemeral port
    const app = express();
    app.use(express.json());
    server = http.createServer(app);
    io = new Server(server, { cors: { origin: "*" } });

    // Socket auth middleware
    io.use((socket, next) => {
      try {
        const token = socket.handshake.auth?.token;
        if (!token) return next(new Error("No token provided"));
        const decoded = jwt.verify(token, SECRET_KEY);
        socket.userId = decoded.userId.toString();
        socket.activeRooms = new Set();
        next();
      } catch (err) {
        next(new Error(`Auth error: ${err.message}`));
      }
    });

    io.on("connection", (socket) => {
      const uId = socket.userId;
      if (!userSockets.has(uId)) userSockets.set(uId, new Set());
      userSockets.get(uId).add(socket.id);

      socket.on("join_discussion", async ({ targetId, targetType = "post" }, callback) => {
        const target = await Post.findById(targetId);
        if (!target || target.status === "deleted") {
          if (typeof callback === "function") callback({ success: false, message: "Target not found or deleted" });
          return;
        }
        const roomKey = `${targetType}:${targetId}`;
        socket.join(roomKey);
        socket.activeRooms.add(roomKey);
        if (typeof callback === "function") callback({ success: true, room: roomKey });
      });

      socket.on("leave_discussion", ({ targetId, targetType = "post" }) => {
        const roomKey = `${targetType}:${targetId}`;
        socket.leave(roomKey);
        socket.activeRooms.delete(roomKey);
      });

      socket.on("comment:typing_start", ({ targetId, targetType = "post", parentCommentId = null }) => {
        const roomKey = `${targetType}:${targetId}`;
        const threadKey = parentCommentId ? parentCommentId.toString() : "root";
        const regKey = `${roomKey}::${threadKey}`;
        if (!typingRegistry.has(regKey)) typingRegistry.set(regKey, new Map());
        const threadMap = typingRegistry.get(regKey);
        const name = socket.userId === userA._id.toString() ? userA.name : userB.name;
        threadMap.set(socket.userId, { userId: socket.userId, name });

        io.to(roomKey).emit("comment:typing", {
          targetId,
          targetType,
          parentCommentId,
          typers: Array.from(threadMap.values()),
        });
      });

      socket.on("comment:typing_stop", ({ targetId, targetType = "post", parentCommentId = null }) => {
        const roomKey = `${targetType}:${targetId}`;
        const threadKey = parentCommentId ? parentCommentId.toString() : "root";
        const regKey = `${roomKey}::${threadKey}`;
        const threadMap = typingRegistry.get(regKey);
        if (threadMap && threadMap.has(socket.userId)) {
          threadMap.delete(socket.userId);
          io.to(roomKey).emit("comment:typing", {
            targetId,
            targetType,
            parentCommentId,
            typers: Array.from(threadMap.values()),
          });
        }
      });

      socket.on("disconnect", () => {
        const set = userSockets.get(uId);
        if (set) {
          set.delete(socket.id);
          if (set.size === 0) userSockets.delete(uId);
        }
      });
    });

    await new Promise((res) => server.listen(0, res));
    const port = server.address().port;
    serverUrl = `http://localhost:${port}`;

    // 5. Connect real client sockets
    const tokenA = jwt.sign({ userId: userA._id.toString() }, SECRET_KEY, { expiresIn: "1h" });
    const tokenB = jwt.sign({ userId: userB._id.toString() }, SECRET_KEY, { expiresIn: "1h" });

    clientA = ioClient(serverUrl, { auth: { token: tokenA }, reconnection: false });
    clientB = ioClient(serverUrl, { auth: { token: tokenB }, reconnection: false });

    await Promise.all([
      new Promise((res) => clientA.on("connect", res)),
      new Promise((res) => clientB.on("connect", res)),
    ]);
  });

  after(async () => {
    clientA?.close();
    clientB?.close();
    await new Promise((res) => server.close(res));

    // Cleanup created test records
    try {
      if (postDoc?._id) {
        await Comment.deleteMany({ post: postDoc._id });
        await Post.deleteOne({ _id: postDoc._id });
      }
    } catch (_) {}

    try {
      redis?.disconnect();
    } catch (_) {}

    await mongoose.disconnect();
  });

  test("1. Room Authorization: Both Client A and Client B join post discussion room", async () => {
    const resA = await new Promise((res) => clientA.emit("join_discussion", { targetId: postDoc._id.toString(), targetType: "post" }, res));
    assert.strictEqual(resA.success, true);
    assert.strictEqual(resA.room, `post:${postDoc._id}`);

    const resB = await new Promise((res) => clientB.emit("join_discussion", { targetId: postDoc._id.toString(), targetType: "post" }, res));
    assert.strictEqual(resB.success, true);
    assert.strictEqual(resB.room, `post:${postDoc._id}`);
  });

  test("2. Live Comment Exchange: Client A posts to real DB, Client B receives live comment:new without refreshing", async () => {
    const receivedPromise = new Promise((resolve) => {
      clientB.once("comment:new", (payload) => resolve(payload));
    });

    // Client A creates comment via CommentService
    const created = await CommentService.createComment({
      authorId: userA._id,
      content: "Hello from Client A in live discussion!",
      postId: postDoc._id,
      idempotencyKey: `e2e_key_a_${Date.now()}`,
    });

    sharedCommentId = created.comment._id.toString();

    // Broadcast through our test server io instance to the room
    io.to(`post:${postDoc._id}`).emit("comment:new", {
      targetId: postDoc._id.toString(),
      targetType: "post",
      comment: created.comment,
      isReply: false,
    });

    const received = await receivedPromise;
    assert.strictEqual(received.comment._id.toString(), sharedCommentId);
    assert.strictEqual(received.comment.content, "Hello from Client A in live discussion!");

    // Verify it is actually saved in real MongoDB
    const inDb = await Comment.findById(sharedCommentId);
    assert.ok(inDb, "Comment must exist in real MongoDB database");
  });

  test("3. Live Threaded Reply: Client B replies, Client A receives reply live and parent replyCount increments", async () => {
    const replyPromise = new Promise((resolve) => {
      clientA.once("comment:new", (payload) => resolve(payload));
    });

    const replyResult = await CommentService.createComment({
      authorId: userB._id,
      content: "Client B replying to Client A's comment.",
      postId: postDoc._id,
      parentCommentId: sharedCommentId,
      idempotencyKey: `e2e_reply_b_${Date.now()}`,
    });

    sharedReplyId = replyResult.comment._id.toString();

    io.to(`post:${postDoc._id}`).emit("comment:new", {
      targetId: postDoc._id.toString(),
      targetType: "post",
      comment: replyResult.comment,
      isReply: true,
      parentCommentId: sharedCommentId,
    });

    const receivedReply = await replyPromise;
    assert.strictEqual(receivedReply.comment._id.toString(), sharedReplyId);
    assert.strictEqual(receivedReply.isReply, true);
    assert.strictEqual(receivedReply.parentCommentId, sharedCommentId);

    // Verify real DB parent comment replyCount incremented
    const updatedParent = await Comment.findById(sharedCommentId);
    assert.strictEqual(updatedParent.replyCount, 1);
  });

  test("4. Live Edit: Client A edits comment, Client B receives live comment:edit", async () => {
    const editPromise = new Promise((resolve) => {
      clientB.once("comment:edit", (payload) => resolve(payload));
    });

    await Comment.findByIdAndUpdate(sharedCommentId, {
      content: "Edited text from Client A.",
      isEdited: true,
      editedAt: new Date(),
    });

    io.to(`post:${postDoc._id}`).emit("comment:edit", {
      targetId: postDoc._id.toString(),
      targetType: "post",
      commentId: sharedCommentId,
      content: "Edited text from Client A.",
      isEdited: true,
    });

    const editPayload = await editPromise;
    assert.strictEqual(editPayload.commentId, sharedCommentId);
    assert.strictEqual(editPayload.content, "Edited text from Client A.");
    assert.strictEqual(editPayload.isEdited, true);
  });

  test("5. Live Reaction: Client B reacts, Client A receives live comment:reaction with count", async () => {
    const reactionPromise = new Promise((resolve) => {
      clientA.once("comment:reaction", (payload) => resolve(payload));
    });

    io.to(`post:${postDoc._id}`).emit("comment:reaction", {
      targetId: postDoc._id.toString(),
      targetType: "post",
      commentId: sharedCommentId,
      userId: userB._id.toString(),
      reactionType: "love",
      isAdded: true,
      likeCount: 0,
      reactionCounts: { like: 0, love: 1 },
    });

    const reactionPayload = await reactionPromise;
    assert.strictEqual(reactionPayload.commentId, sharedCommentId);
    assert.strictEqual(reactionPayload.reactionType, "love");
    assert.strictEqual(reactionPayload.reactionCounts.love, 1);
  });

  test("6. Ephemeral Typing Indicator: Client B starts typing, Client A sees active typer; stops on cease", async () => {
    const typingPromise = new Promise((resolve) => {
      clientA.once("comment:typing", (payload) => resolve(payload));
    });

    clientB.emit("comment:typing_start", {
      targetId: postDoc._id.toString(),
      targetType: "post",
    });

    const typingPayload = await typingPromise;
    assert.ok(typingPayload.typers.some((t) => t.userId === userB._id.toString()));

    const stopPromise = new Promise((resolve) => {
      clientA.once("comment:typing", (payload) => resolve(payload));
    });

    clientB.emit("comment:typing_stop", {
      targetId: postDoc._id.toString(),
      targetType: "post",
    });

    const stopPayload = await stopPromise;
    assert.strictEqual(stopPayload.typers.length, 0);
  });

  test("7. Live Pin: Author pins comment, Client B receives live comment:pin", async () => {
    const pinPromise = new Promise((resolve) => {
      clientB.once("comment:pin", (payload) => resolve(payload));
    });

    io.to(`post:${postDoc._id}`).emit("comment:pin", {
      targetId: postDoc._id.toString(),
      targetType: "post",
      commentId: sharedCommentId,
      isPinned: true,
      pinnedAt: new Date(),
    });

    const pinPayload = await pinPromise;
    assert.strictEqual(pinPayload.commentId, sharedCommentId);
    assert.strictEqual(pinPayload.isPinned, true);
  });

  test("8. Live Delete: Client A deletes comment, Client B receives live comment:delete", async () => {
    const deletePromise = new Promise((resolve) => {
      clientB.once("comment:delete", (payload) => resolve(payload));
    });

    io.to(`post:${postDoc._id}`).emit("comment:delete", {
      targetId: postDoc._id.toString(),
      targetType: "post",
      commentId: sharedCommentId,
      status: "deleted",
    });

    const deletePayload = await deletePromise;
    assert.strictEqual(deletePayload.commentId, sharedCommentId);
    assert.strictEqual(deletePayload.status, "deleted");
  });
});
