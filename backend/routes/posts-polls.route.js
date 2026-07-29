import express from "express";
import { getTrendingPostsPolls } from "../controllers/TrendingPostsPolls.controller.js";
import isAuthenticated from "../middlewares/isAuthenticated.js";

const router = express.Router();

// Route to get all posts and polls except the logged-in user's
router.route("/trending-posts-polls").get(isAuthenticated, getTrendingPostsPolls);

export default router;
