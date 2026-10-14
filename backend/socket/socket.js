import { Server } from "socket.io";
import express from "express";
import http from "http";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import redis from "../config/redis.js";
import { User } from "../models/user.model.js";
import { Post } from "../models/post.model.js";
import { Poll } from "../models/poll.model.js";

dotenv.config({});

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => callback(null, true),
    credentials: true,
    methods: ["GET", "POST"],
  },
  pingTimeout: 30000,
  pingInterval: 10000,
});

/**
 * Multi-device / Multi-tab Socket Map
 * userId -> Set<socketId>
 */
const userSockets = new Map();

export const getReceiverSocketIds = (userId) => {
  if (!userId) return [];
  const set = userSockets.get(userId.toString());
  return set ? Array.from(set) : [];
};

// Backward-compatible single socket ID helper
export const getReceiverSocketId = (userId) => {
  const ids = getReceiverSocketIds(userId);
  return ids.length > 0 ? ids[0] : null;
};

export const isUserOnline = (userId) => {
  if (!userId) return false;
  const set = userSockets.get(userId.toString());
  return !!(set && set.size > 0);
};

/**
 * Ephemeral Typing Registry
 * Key: `${roomKey}:${threadKey}` -> Map<userId, { username, name, profileImage, expiresAt, timer }>
 */
const typingRegistry = new Map();

const broadcastTypingState = (roomKey, threadKey, targetId, targetType) => {
  const registryKey = `${roomKey}:${threadKey}`;
  const threadMap = typingRegistry.get(registryKey);
  const activeTypers = [];

  if (threadMap) {
    const now = Date.now();
    for (const [uid, info] of threadMap.entries()) {
      if (info.expiresAt > now) {
        activeTypers.push({
          userId: uid,
          username: info.username,
          name: info.name,
          profileImage: info.profileImage,
        });
      } else {
        if (info.timer) clearTimeout(info.timer);
        threadMap.delete(uid);
      }
    }
    if (threadMap.size === 0) {
      typingRegistry.delete(registryKey);
    }
  }

  io.to(roomKey).emit("comment:typing", {
    targetId,
    targetType,
    parentCommentId: threadKey === "root" ? null : threadKey,
    typers: activeTypers,
  });
};

export const clearUserTyping = (userId, roomKey = null) => {
  if (!userId) return;
  const uStr = userId.toString();

  for (const [registryKey, threadMap] of typingRegistry.entries()) {
    if (roomKey && !registryKey.startsWith(roomKey)) continue;

    if (threadMap.has(uStr)) {
      const info = threadMap.get(uStr);
      if (info?.timer) clearTimeout(info.timer);
      threadMap.delete(uStr);

      const [rKey, threadKey] = registryKey.split("::");
      const [targetType, targetId] = rKey.split(":");
      broadcastTypingState(rKey, threadKey || "root", targetId, targetType);
    }
  }
};

/**
 * ── 1. SOCKET.IO AUTHENTICATION MIDDLEWARE ─────────────────────────────────
 * Verifies JWT and confirms session in Redis. Never trusts client query userId!
 */
io.use(async (socket, next) => {
  try {
    let token = socket.handshake.auth?.token;

    if (!token && socket.handshake.headers?.authorization?.startsWith("Bearer ")) {
      token = socket.handshake.headers.authorization.split(" ")[1];
    }
    if (!token && socket.handshake.headers?.cookie) {
      const cookieMatch = socket.handshake.headers.cookie.match(/(?:^|;\s*)token=([^;]+)/);
      if (cookieMatch) token = decodeURIComponent(cookieMatch[1]);
    }
    if (!token && socket.handshake.query?.token) {
      token = socket.handshake.query.token;
    }

    if (!token) {
      return next(new Error("Authentication error: No token provided"));
    }

    let decoded = null;
    try {
      decoded = jwt.verify(token, process.env.SECRET_KEY);
    } catch (jwtErr) {
      return next(new Error(`Authentication error: ${jwtErr.name === "TokenExpiredError" ? "Token expired" : "Invalid token"}`));
    }

    if (!decoded || !decoded.userId) {
      return next(new Error("Authentication error: Invalid token structure"));
    }

    // Verify session in Redis if session exists
    try {
      if (redis) {
        const cachedToken = await redis.get(`session:${decoded.userId}`);
        if (cachedToken && cachedToken !== token) {
          return next(new Error("Authentication error: Session expired or invalid"));
        }
      }
    } catch (redisErr) {
      console.warn("⚠️ Socket Redis session check warning:", redisErr.message);
    }

    // Attach authenticated identity from database / token to socket context
    const user = await User.findById(decoded.userId).select("username name profileImage isverified").lean();
    if (!user) {
      return next(new Error("Authentication error: User record not found"));
    }

    socket.userId = decoded.userId.toString();
    socket.user = {
      _id: decoded.userId.toString(),
      username: user.username || "User",
      name: user.name || user.username || "User",
      profileImage: user.profileImage || null,
      isverified: !!user.isverified,
    };
    socket.activeRooms = new Set();

    next();
  } catch (err) {
    return next(new Error(`Authentication error: ${err.message || "Unauthorized"}`));
  }
});

/**
 * ── 2. CONNECTION & EVENT HANDLERS ─────────────────────────────────────────
 */
io.on("connection", (socket) => {
  const userId = socket.userId;

  // Multi-device socket tracking
  if (!userSockets.has(userId)) {
    userSockets.set(userId, new Set());
  }
  userSockets.get(userId).add(socket.id);

  // Join user's private notification room
  socket.join(userId);
  // Join global feed subscriber room
  socket.join("feed_subscribers");

  // Broadcast updated list of online users
  io.emit("getOnlineUsers", Array.from(userSockets.keys()));

  /**
   * ── Join Discussion Room (with server-side authorization) ────────────────
   */
  socket.on("join_discussion", async (payload = {}, callback) => {
    try {
      const { targetId, targetType = "post" } = payload;
      if (!targetId) {
        if (typeof callback === "function") callback({ success: false, message: "Target ID required" });
        return;
      }

      // Check document existence & visibility
      let doc = null;
      if (targetType === "post") {
        doc = await Post.findById(targetId).select("status author");
      } else if (targetType === "poll") {
        doc = await Poll.findById(targetId).select("status author");
      }

      if (!doc || doc.status === "deleted") {
        if (typeof callback === "function") {
          callback({ success: false, message: `${targetType} not found or has been deleted` });
        }
        return;
      }

      if (doc.status === "private" && doc.author?.toString() !== socket.userId) {
        if (typeof callback === "function") {
          callback({ success: false, message: "Unauthorized to join private discussion" });
        }
        return;
      }

      const roomKey = `${targetType}:${targetId}`;
      socket.join(roomKey);
      socket.activeRooms.add(roomKey);

      if (typeof callback === "function") {
        callback({ success: true, room: roomKey });
      }
    } catch (err) {
      if (typeof callback === "function") callback({ success: false, message: err.message });
    }
  });

  /**
   * ── Leave Discussion Room ────────────────────────────────────────────────
   */
  socket.on("leave_discussion", ({ targetId, targetType = "post" } = {}) => {
    if (!targetId) return;
    const roomKey = `${targetType}:${targetId}`;
    socket.leave(roomKey);
    socket.activeRooms.delete(roomKey);
    clearUserTyping(socket.userId, roomKey);
  });

  // Backward compatibility room listeners
  socket.on("join_post_room", (postId) => {
    if (postId) {
      const roomKey = `post:${postId}`;
      socket.join(roomKey);
      socket.activeRooms.add(roomKey);
    }
  });

  socket.on("leave_post_room", (postId) => {
    if (postId) {
      const roomKey = `post:${postId}`;
      socket.leave(roomKey);
      socket.activeRooms.delete(roomKey);
      clearUserTyping(socket.userId, roomKey);
    }
  });

  socket.on("join_poll_room", (pollId) => {
    if (pollId) {
      const roomKey = `poll:${pollId}`;
      socket.join(roomKey);
      socket.activeRooms.add(roomKey);
    }
  });

  socket.on("leave_poll_room", (pollId) => {
    if (pollId) {
      const roomKey = `poll:${pollId}`;
      socket.leave(roomKey);
      socket.activeRooms.delete(roomKey);
      clearUserTyping(socket.userId, roomKey);
    }
  });

  /**
   * ── 3. TYPING INDICATORS (Ephemeral & Auto-expiring) ──────────────────────
   */
  socket.on("comment:typing_start", ({ targetId, targetType = "post", parentCommentId = null } = {}) => {
    if (!targetId) return;
    const roomKey = `${targetType}:${targetId}`;
    if (!socket.rooms.has(roomKey)) return; // User must be in room

    const threadKey = parentCommentId ? parentCommentId.toString() : "root";
    const registryKey = `${roomKey}::${threadKey}`;

    if (!typingRegistry.has(registryKey)) {
      typingRegistry.set(registryKey, new Map());
    }

    const threadMap = typingRegistry.get(registryKey);
    const existing = threadMap.get(socket.userId);
    if (existing?.timer) clearTimeout(existing.timer);

    // Auto-expire typing state after 4 seconds
    const timer = setTimeout(() => {
      threadMap.delete(socket.userId);
      broadcastTypingState(roomKey, threadKey, targetId, targetType);
    }, 4000);

    threadMap.set(socket.userId, {
      username: socket.user.username,
      name: socket.user.name,
      profileImage: socket.user.profileImage,
      expiresAt: Date.now() + 4000,
      timer,
    });

    broadcastTypingState(roomKey, threadKey, targetId, targetType);
  });

  socket.on("comment:typing_stop", ({ targetId, targetType = "post", parentCommentId = null } = {}) => {
    if (!targetId) return;
    const roomKey = `${targetType}:${targetId}`;
    const threadKey = parentCommentId ? parentCommentId.toString() : "root";
    const registryKey = `${roomKey}::${threadKey}`;

    const threadMap = typingRegistry.get(registryKey);
    if (threadMap && threadMap.has(socket.userId)) {
      const existing = threadMap.get(socket.userId);
      if (existing?.timer) clearTimeout(existing.timer);
      threadMap.delete(socket.userId);
      broadcastTypingState(roomKey, threadKey, targetId, targetType);
    }
  });

  /**
   * ── 4. DISCONNECT CLEANUP ────────────────────────────────────────────────
   */
  socket.on("disconnect", () => {
    clearUserTyping(socket.userId);

    const set = userSockets.get(userId);
    if (set) {
      set.delete(socket.id);
      if (set.size === 0) {
        userSockets.delete(userId);
        // Only broadcast offline when all sockets for this user are closed
        io.emit("getOnlineUsers", Array.from(userSockets.keys()));
      }
    }
  });
});

export { app, server, io };