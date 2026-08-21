import express from "express";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import {
  sendMessage,
  getConversations,
  getMessages,
  markMessagesAsRead,
} from "../controllers/message.controller.js";

const router = express.Router();

router.post("/send", isAuthenticated, sendMessage);
router.get("/conversations", isAuthenticated, getConversations);
router.get("/chat/:otherUserId", isAuthenticated, getMessages);
router.put("/read/:otherUserId", isAuthenticated, markMessagesAsRead);

export default router;
