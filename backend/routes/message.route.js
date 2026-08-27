import express from "express";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import {
  sendMessage,
  getConversations,
  getMessages,
  markMessagesAsRead,
  getMessageRequests,
  respondToMessageRequest,
  deleteMessage,
} from "../controllers/message.controller.js";

const router = express.Router();

router.post("/send", isAuthenticated, sendMessage);
router.get("/conversations", isAuthenticated, getConversations);
router.get("/requests", isAuthenticated, getMessageRequests);
router.post("/request/respond", isAuthenticated, respondToMessageRequest);
router.get("/chat/:otherUserId", isAuthenticated, getMessages);
router.put("/read/:otherUserId", isAuthenticated, markMessagesAsRead);
router.delete("/:id", isAuthenticated, deleteMessage);

export default router;
