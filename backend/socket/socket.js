import { Server } from "socket.io";
import express from "express";
import http from "http";
import dotenv from "dotenv";

dotenv.config({});

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.URL || "*",
    methods: ["GET", "POST"],
  },
});

const userSocketMap = {};
export const getReceiverSocketId = (receiverId) => userSocketMap[receiverId];

io.on("connection", (socket) => {
  const userId = socket.handshake.query.userId;

  if (userId) {
    userSocketMap[userId] = socket.id;
    // User-specific room for notifications
    socket.join(userId);
    // Global feed room — ALL authenticated users subscribe to feed events
    socket.join("feed_subscribers");
    console.log(`Socket connected: ${socket.id} → user room: ${userId}, feed_subscribers`);
  }

  // Broadcast online users list
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  // ── Post room events (for live comment / like updates) ───
  socket.on("join_post_room", (postId) => {
    if (postId) {
      socket.join(`post:${postId}`);
    }
  });

  socket.on("leave_post_room", (postId) => {
    if (postId) {
      socket.leave(`post:${postId}`);
    }
  });

  // ── Poll room events (for live vote updates) ─────────────
  socket.on("join_poll_room", (pollId) => {
    if (pollId) {
      socket.join(`poll:${pollId}`);
    }
  });

  socket.on("leave_poll_room", (pollId) => {
    if (pollId) {
      socket.leave(`poll:${pollId}`);
    }
  });

  // ── Disconnect ───────────────────────────────────────────
  socket.on("disconnect", () => {
    if (userId) {
      delete userSocketMap[userId];
      socket.leave(userId);
      socket.leave("feed_subscribers");
      console.log(`Socket disconnected: ${socket.id} (user: ${userId})`);
    }
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

export { app, server, io };