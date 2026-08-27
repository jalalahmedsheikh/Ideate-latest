import express from "express";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import {
  getPersonalizedForYouFeed,
  getRelatedContentForPost,
  getRelatedContentForPoll,
  getSuggestedPeople,
  handleResetRecommendations,
  getPersonalizationSettings,
  updatePersonalizationSettings,
} from "../controllers/personalization.controller.js";

const router = express.Router();

const optionalAuth = (req, res, next) => {
  const token = req.cookies?.token || req.headers?.authorization?.split(" ")[1];
  if (token) {
    return isAuthenticated(req, res, next);
  }
  next();
};

// Feed & Discovery Endpoints
router.route("/for-you").get(optionalAuth, getPersonalizedForYouFeed);
router.route("/related-ideas/:postId").get(optionalAuth, getRelatedContentForPost);
router.route("/related-polls/:pollId").get(optionalAuth, getRelatedContentForPoll);
router.route("/suggested-people").get(optionalAuth, getSuggestedPeople);

// User Personalization Management Endpoints
router.route("/reset-recommendations").post(isAuthenticated, handleResetRecommendations);
router.route("/settings").get(isAuthenticated, getPersonalizationSettings);
router.route("/settings").put(isAuthenticated, updatePersonalizationSettings);

export default router;
