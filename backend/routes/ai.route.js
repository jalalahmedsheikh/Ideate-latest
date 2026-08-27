import express from "express";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import {
  suggestTopics,
  checkContentSafety,
  getAIHealth,
} from "../controllers/ai.controller.js";

const router = express.Router();

router.route("/suggest-topics").post(suggestTopics);
router.route("/check-spam").post(checkContentSafety);
router.route("/health").get(getAIHealth);

export default router;
