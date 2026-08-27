import express from "express";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import {
  createDebate,
  getAllDebates,
  getDebateById,
  joinSide,
  voteDebateSide,
  addArgument,
  getDebateArguments,
  reactArgument,
} from "../controllers/debate.controller.js";

const router = express.Router();

// Public routes
router.get("/all", getAllDebates);
router.get("/:id", getDebateById);
router.get("/:id/arguments", getDebateArguments);

// Protected routes
router.post("/create", isAuthenticated, createDebate);
router.post("/:id/join-side", isAuthenticated, joinSide);
router.post("/:id/vote", isAuthenticated, voteDebateSide);
router.post("/:id/argument", isAuthenticated, addArgument);
router.post("/argument/:argumentId/react", isAuthenticated, reactArgument);

export default router;
