import express from 'express';
import isAuthenticated from '../middlewares/isAuthenticated.js';
import upload from '../utills/multer.js';
import { createPoll, getAllPolls, getUserPolls, voteOnPoll, getPollDetails, deletePoll, savePoll } from '../controllers/poll.controller.js';

const router = express.Router();

// Route to create a poll
router.route("/createPoll").post(isAuthenticated, upload.single('poll'), createPoll)

// Route to get all polls
router.route("/allpolls").get(getAllPolls);

// Route to get all polls of the logged-in user
router.route("/userpolls/all").get(isAuthenticated, getUserPolls);

// Route to get details of a specific poll
router.route("/:id").get(getPollDetails);

// Route to vote on a poll
router.route("/:id/vote").post(isAuthenticated, voteOnPoll);

// Route to delete a poll
router.route("/:id").delete(isAuthenticated, deletePoll);

// Route to save (bookmark) a poll
router.route("/:id/savepoll").post(isAuthenticated, savePoll);

export default router;


