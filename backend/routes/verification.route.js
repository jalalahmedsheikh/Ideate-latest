import express from "express";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import {
  applyVerification,
  getMyVerificationStatus,
  reviewVerification,
} from "../controllers/verification.controller.js";

const router = express.Router();

router.post("/apply", isAuthenticated, applyVerification);
router.get("/status", isAuthenticated, getMyVerificationStatus);
router.post("/admin/review", isAuthenticated, reviewVerification);

export default router;
