import express from "express";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import {
  getAllBadges,
  getUserBadges,
  toggleBadgeDisplay,
} from "../controllers/badge.controller.js";

const router = express.Router();

router.get("/all", getAllBadges);
router.get("/user/:id", getUserBadges);
router.post("/toggle-display", isAuthenticated, toggleBadgeDisplay);

export default router;
