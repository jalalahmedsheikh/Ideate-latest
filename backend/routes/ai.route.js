import express from 'express';
import isAuthenticated from '../middlewares/isAuthenticated.js';
import { generatePollOptions, analyzeContentRoute } from '../controllers/ai.controller.js';

const router = express.Router();

router.route("/generate-options").post(isAuthenticated, generatePollOptions);
router.route("/analyze-content").post(isAuthenticated, analyzeContentRoute);

export default router;
