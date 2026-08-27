import express from "express";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import {
  toggleCreatorMode,
  updateCreatorProfile,
  getCreatorProfile,
  setFeaturedContent,
} from "../controllers/creator.controller.js";
import {
  getCreatorAnalytics,
  exportCreatorAnalytics,
} from "../controllers/creatorAnalytics.controller.js";

const router = express.Router();

// Public creator profile
router.get("/profile/:userId", getCreatorProfile);

// Protected creator actions
router.post("/toggle-mode", isAuthenticated, toggleCreatorMode);
router.put("/profile", isAuthenticated, updateCreatorProfile);
router.post("/featured", isAuthenticated, setFeaturedContent);
router.get("/analytics", isAuthenticated, getCreatorAnalytics);
router.get("/analytics/export", isAuthenticated, exportCreatorAnalytics);

export default router;
