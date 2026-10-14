import http from "http";
import express from "express";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config({});
const SECRET_KEY = process.env.SECRET_KEY || "ideate_development_secret_key_12345";

/**
 * Creates an in-memory test Socket.IO server with identical auth and room logic
 */
export async function createTestSocketServer(options = {}) {
  const app = express();
  app.use(express.json());
  const server = http.createServer(app);

  const io = new Server(server, {
    cors: { origin: "*" },
  });

  const userSockets = new Map();
  const typingRegistry = new Map();

  const mockUsers = options.mockUsers || new Map();
  const mockPosts = options.mockPosts || new Map();

  // Socket Auth Middleware matching backend/socket/socket.js
  io.use(async (socket, next) => {
    try {
      let token = socket.handshake.auth?.token;
      if (!token && socket.handshake.headers?.authorization?.startsWith("Bearer ")) {
        token = socket.handshake.headers.authorization.split(" ")[1];
      }
      if (!token && socket.handshake.query?.token) {
        token = socket.handshake.query.token;
      }

      if (!token) {
        return next(new Error("Authentication error: No token provided"));
      }

      let decoded = null;
      try {
        decoded = jwt.verify(token, SECRET_KEY);
      } catch (jwtErr) {
        return next(new Error(`Authentication error: ${jwtErr.name === "TokenExpiredError" ? "Token expired" : "Invalid token"}`));
      }

      if (!decoded || !decoded.userId) {
        return next(new Error("Authentication error: Invalid token structure"));
      }

      const user = mockUsers.get(decoded.userId) || {
        _id: decoded.userId,
        username: `user_${decoded.userId}`,
        name: `User ${decoded.userId}`,
      };

      socket.userId = decoded.userId.toString();
      socket.user = user;
      socket.activeRooms = new Set();
      next();
    } catch (err) {
      return next(new Error(`Authentication error: ${err.message}`));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.userId;
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(socket.id);
    socket.join(userId);

    io.emit("getOnlineUsers", Array.from(userSockets.keys()));

    socket.on("join_discussion", ({ targetId, targetType = "post" }, callback) => {
      const doc = mockPosts.get(targetId);
      if (!doc || doc.status === "deleted") {
        if (typeof callback === "function") callback({ success: false, message: "Target not found or deleted" });
        return;
      }
      if (doc.status === "private" && doc.author !== socket.userId) {
        if (typeof callback === "function") callback({ success: false, message: "Unauthorized to join private discussion" });
        return;
      }

      const roomKey = `${targetType}:${targetId}`;
      socket.join(roomKey);
      socket.activeRooms.add(roomKey);
      if (typeof callback === "function") callback({ success: true, room: roomKey });
    });

    socket.on("leave_discussion", ({ targetId, targetType = "post" } = {}) => {
      const roomKey = `${targetType}:${targetId}`;
      socket.leave(roomKey);
      socket.activeRooms.delete(roomKey);
    });

    socket.on("comment:typing_start", ({ targetId, targetType = "post", parentCommentId = null }) => {
      const roomKey = `${targetType}:${targetId}`;
      if (!socket.rooms.has(roomKey)) return;

      const threadKey = parentCommentId ? parentCommentId.toString() : "root";
      const regKey = `${roomKey}::${threadKey}`;
      if (!typingRegistry.has(regKey)) typingRegistry.set(regKey, new Map());
      const threadMap = typingRegistry.get(regKey);

      threadMap.set(socket.userId, {
        userId: socket.userId,
        username: socket.user.username,
        name: socket.user.name,
      });

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
      const set = userSockets.get(userId);
      if (set) {
        set.delete(socket.id);
        if (set.size === 0) {
          userSockets.delete(userId);
          io.emit("getOnlineUsers", Array.from(userSockets.keys()));
        }
      }
    });
  });

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  return {
    server,
    io,
    port,
    url: `http://localhost:${port}`,
    userSockets,
    mockUsers,
    mockPosts,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
