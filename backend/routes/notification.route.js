import express from "express";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import {
  getNotifications,
  markAllRead,
  markOneRead,
  clearAllNotifications,
} from "../controllers/notification.controller.js";

const router = express.Router();

router.get("/",            isAuthenticated, getNotifications);
router.put("/mark-read",   isAuthenticated, markAllRead);
router.put("/:id/read",    isAuthenticated, markOneRead);
router.delete("/",         isAuthenticated, clearAllNotifications);

export default router;
