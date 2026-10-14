import express from "express";
import isAuthenticated, { optionalAuth } from "../middlewares/isAuthenticated.js";
import {
  createComment,
  getComments,
  getCommentReplies,
  toggleCommentLike,
  editComment,
  deleteComment,
  togglePinComment,
} from "../controllers/comment.controller.js";

const router = express.Router();

router.route("/add").post(isAuthenticated, createComment);
router.route("/list").get(optionalAuth, getComments);
router.route("/:id/replies").get(optionalAuth, getCommentReplies);
router.route("/:id/like").post(isAuthenticated, toggleCommentLike);
router.route("/:id/pin").post(isAuthenticated, togglePinComment);
router.route("/:id/edit").put(isAuthenticated, editComment);
router.route("/:id").delete(isAuthenticated, deleteComment);

export default router;
