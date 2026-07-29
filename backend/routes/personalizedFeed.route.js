import express from "express";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import { getPersonalizedFeed } from "../controllers/getPersonalizedFeed.js";

const router = express.Router();

// Route to fetch the personalized feed
router.route("/personalizedFeed").get(isAuthenticated, getPersonalizedFeed);

export default router;
