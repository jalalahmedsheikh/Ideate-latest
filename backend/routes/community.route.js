import express from "express";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import {
  createCommunity,
  getAllCommunities,
  getCommunityByHandle,
  joinCommunity,
  leaveCommunity,
  getCommunityFeed,
  handleJoinRequest,
} from "../controllers/community.controller.js";

const router = express.Router();

// Public routes
router.get("/all", getAllCommunities);
router.get("/by-handle/:handle", getCommunityByHandle);
router.get("/:id/feed", getCommunityFeed);

// Protected routes
router.post("/create", isAuthenticated, createCommunity);
router.post("/:id/join", isAuthenticated, joinCommunity);
router.post("/:id/leave", isAuthenticated, leaveCommunity);
router.post("/:id/handle-request", isAuthenticated, handleJoinRequest);

export default router;
