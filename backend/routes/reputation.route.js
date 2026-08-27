import express from "express";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import {
  getMyReputation,
  getUserReputation,
  getReputationHistory,
} from "../controllers/reputation.controller.js";

const router = express.Router();

router.get("/user/:id", getUserReputation);
router.get("/my-reputation", isAuthenticated, getMyReputation);
router.get("/history", isAuthenticated, getReputationHistory);

export default router;
