import express from "express";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import {
  createQuestion,
  detectDuplicates,
  getAllQuestions,
  getQuestionById,
  addAnswer,
  getQuestionAnswers,
  acceptAnswer,
  toggleFollowQuestion,
  voteQuestion,
  voteAnswer,
} from "../controllers/question.controller.js";

const router = express.Router();

// Public routes
router.get("/all", getAllQuestions);
router.get("/:id", getQuestionById);
router.get("/:id/answers", getQuestionAnswers);
router.post("/detect-duplicates", detectDuplicates);

// Protected routes
router.post("/create", isAuthenticated, createQuestion);
router.post("/:id/answer", isAuthenticated, addAnswer);
router.post("/:id/accept-answer", isAuthenticated, acceptAnswer);
router.post("/:id/follow", isAuthenticated, toggleFollowQuestion);
router.post("/:id/vote", isAuthenticated, voteQuestion);
router.post("/answer/:answerId/vote", isAuthenticated, voteAnswer);

export default router;
