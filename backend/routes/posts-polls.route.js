import express from "express";
import { getTrendingPostsPolls } from "../controllers/TrendingPostsPolls.controller.js";
import { optionalAuth } from "../middlewares/isAuthenticated.js";

const router = express.Router();

// Route to get trending posts and polls (supports both guest and authenticated users)
router.route("/trending-posts-polls").get(optionalAuth, getTrendingPostsPolls);

export default router;
