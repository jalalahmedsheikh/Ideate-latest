import express from "express";
import {
  getTrendingFeed,
  getTrendingTopics,
  getTrendingCommunities,
} from "../controllers/trending.controller.js";

const router = express.Router();

router.get("/feed", getTrendingFeed);
router.get("/topics", getTrendingTopics);
router.get("/communities", getTrendingCommunities);

export default router;
