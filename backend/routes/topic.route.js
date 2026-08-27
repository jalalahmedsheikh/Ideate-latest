import express from "express";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import {
  getTopics,
  getTopicBySlug,
  toggleFollowTopic,
  getTopicFeed,
  getSuggestedTopics,
  createTopic,
} from "../controllers/topic.controller.js";

const router = express.Router();

// Middleware to optionally extract user token for personalized public feeds
const optionalAuth = (req, res, next) => {
  const token = req.cookies?.token || req.headers?.authorization?.split(" ")[1];
  if (token) {
    return isAuthenticated(req, res, next);
  }
  next();
};

router.route("/all").get(optionalAuth, getTopics);
router.route("/suggestions").get(optionalAuth, getSuggestedTopics);
router.route("/create").post(isAuthenticated, createTopic);
router.route("/by-slug/:slug").get(optionalAuth, getTopicBySlug);
router.route("/:id/feed").get(optionalAuth, getTopicFeed);
router.route("/:id/toggleFollow").post(isAuthenticated, toggleFollowTopic);

export default router;
