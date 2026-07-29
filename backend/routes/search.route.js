import express from "express";
import { globalSearch, searchSuggestions } from "../controllers/search.controller.js";

const router = express.Router();

// Full search results: GET /search?q=flutter
router.get("/", globalSearch);

// Live suggestions (autocomplete): GET /search/suggest?q=flu
router.get("/suggest", searchSuggestions);

export default router;
