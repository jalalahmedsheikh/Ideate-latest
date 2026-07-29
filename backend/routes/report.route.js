import express from "express";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import { createReport } from "../controllers/report.controller.js";

const router = express.Router();

router.route("/create").post(isAuthenticated, createReport);

export default router;
