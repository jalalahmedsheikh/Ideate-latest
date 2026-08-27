import express from "express";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import {
  createComment,
  getComments,
  getCommentReplies,
  toggleCommentLike,
  editComment,
  deleteComment,
} from "../controllers/comment.controller.js";

const router = express.Router();

const optionalAuth = (req, res, next) => {
  const token = req.cookies?.token || req.headers?.authorization?.split(" ")[1];
  if (token) {
    return isAuthenticated(req, res, next);
  }
  next();
};

router.route("/add").post(isAuthenticated, createComment);
router.route("/list").get(optionalAuth, getComments);
router.route("/:id/replies").get(optionalAuth, getCommentReplies);
router.route("/:id/like").post(isAuthenticated, toggleCommentLike);
router.route("/:id/edit").put(isAuthenticated, editComment);
router.route("/:id").delete(isAuthenticated, deleteComment);

export default router;
