import { User } from "../models/user.model.js";
import { Poll } from "../models/poll.model.js";
import { checkSpamAndToxicity } from "./ai.controller.js";
import redis, { getCached, setCached, invalidateCached } from "../config/redis.js";
import { queueFeedGeneration, queueTrendingUpdate } from "../queues/queue.js";
import { io } from "../socket/socket.js";

// Helper to invalidate poll caches
const invalidatePollCaches = async (pollId, authorId) => {
  await invalidateCached("polls:all");
  await invalidateCached("feed:trending");
  if (pollId) {
    await invalidateCached(`poll:detail:${pollId}`);
  }
  if (authorId) {
    await invalidateCached(`user:polls:${authorId}`);
  }
};

// Create a new poll
export const createPoll = async (req, res) => {
  try {
    const { question, options } = req.body;
    const authorId = req.id;

    if (!question || !options || !Array.isArray(options)) {
      return res.status(400).json({
        success: false,
        message: "Field cannot be empty and options must be an array."
      });
    }

    // Toxicity checks
    const textToCheck = [question, ...options].join(" ");
    const safetyCheck = await checkSpamAndToxicity(textToCheck);
    if (safetyCheck.isViolating) {
      return res.status(400).json({
        success: false,
        message: `Content flagged as inappropriate: ${safetyCheck.reason}`
      });
    }

    const initialVotes = new Array(options.length).fill(0);
    const poll = await Poll.create({
      question,
      options,
      votes: initialVotes,
      author: authorId
    });

    const userr = await User.findById(authorId);
    if (userr) {
      userr.polls.push(poll._id);
      await userr.save();
      await invalidateCached(`user:profile:${authorId}`);
    }

    await poll.populate({ path: 'author', select: 'username profileImage isverified' });

    // Invalidate caches
    await invalidatePollCaches(null, authorId);

    // Queue background feed fan-out job
    await queueFeedGeneration({
      action: "createPoll",
      pollId: poll._id,
      authorId
    });

    // Trigger trending recalculation
    queueTrendingUpdate({}).catch(() => {});

    return res.status(201).json({
      success: true,
      poll,
      message: "New poll added."
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// Get all polls
export const getAllPolls = async (req, res) => {
  try {
    const cachedPolls = await getCached("polls:all");
    if (cachedPolls) {
      return res.status(200).json({
        success: true,
        polls: cachedPolls,
        cached: true
      });
    }

    const polls = await Poll.find()
      .sort({ createdAt: -1 })
      .populate({ path: "author", select: "username profileImage" });

    // Cache list of all polls for 2 minutes
    await setCached("polls:all", polls, 120);

    return res.status(200).json({
      success: true,
      polls,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// Get all polls created by the logged-in user
export const getUserPolls = async (req, res) => {
  try {
    const authorId = req.id;

    const cachedUserPolls = await getCached(`user:polls:${authorId}`);
    if (cachedUserPolls) {
      return res.status(200).json({
        success: true,
        polls: cachedUserPolls,
        cached: true
      });
    }

    const polls = await Poll.find({ author: authorId })
      .sort({ createdAt: -1 })
      .populate({ path: "author", select: "username profileImage" });

    // Cache user polls for 5 minutes
    await setCached(`user:polls:${authorId}`, polls, 300);

    return res.status(200).json({
      success: true,
      polls,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

export const voteOnPoll = async (req, res) => {
  try {
    const userId = req.id;
    const pollId = req.params.id;
    const { optionIndex } = req.body;

    const poll = await Poll.findById(pollId);
    if (!poll) {
      return res.status(404).json({ success: false, message: "Poll not found." });
    }

    // Ensure a valid option is selected
    if (optionIndex < 0 || optionIndex >= poll.options.length) {
      return res.status(400).json({ success: false, message: "Invalid option index." });
    }

    // Check if the user has already voted using votesHistory
    const hasVoted = poll.votesHistory && poll.votesHistory.some(vote => vote.user.toString() === userId.toString());
    if (hasVoted) {
      return res.status(403).json({
        success: false,
        message: "You have already voted on this poll.",
      });
    }

    // Use the schema instance method to vote
    await poll.vote(userId, optionIndex);

    // Populate author details
    await poll.populate({ path: "author", select: "username profileImage isverified" });

    // Invalidate Redis caches
    await invalidatePollCaches(pollId, poll.author._id ? poll.author._id.toString() : poll.author.toString());

    // Real-time: broadcast updated vote counts to poll room subscribers
    io.to(`poll:${pollId}`).emit("poll:vote_update", {
      pollId,
      votes: poll.votes,
      totalVotes: poll.votesHistory.length,
    });

    // Trigger trending score recalculation (non-blocking)
    queueTrendingUpdate({}).catch(() => {});

    return res.status(200).json({
      success: true,
      message: "Vote registered successfully.",
      poll,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// Delete a poll
export const deletePoll = async (req, res) => {
  try {
    const pollId = req.params.id;
    const userId = req.id;

    const poll = await Poll.findById(pollId);
    if (!poll) {
      return res.status(404).json({ success: false, message: "Poll not found." });
    }

    // Check if the logged-in user is the owner of the poll
    if (poll.author.toString() !== userId) {
      return res.status(403).json({ success: false, message: "Unauthorized." });
    }

    // Delete the poll
    await Poll.findByIdAndDelete(pollId);

    // Remove poll from user's polls array
    const user = await User.findById(userId);
    if (user) {
      user.polls = user.polls.filter((id) => id.toString() !== pollId);
      await user.save();
      await invalidateCached(`user:profile:${userId}`);
    }

    // Invalidate Redis caches
    await invalidatePollCaches(pollId, userId);

    // Queue background feed cleanup job
    await queueFeedGeneration({
      action: "deletePoll",
      pollId,
      authorId: userId
    });

    return res.status(200).json({
      success: true,
      message: "Poll deleted successfully.",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// Get poll details (with results)
export const getPollDetails = async (req, res) => {
  try {
    const pollId = req.params.id;

    const cachedPoll = await getCached(`poll:detail:${pollId}`);
    if (cachedPoll) {
      return res.status(200).json({
        success: true,
        poll: cachedPoll,
        cached: true
      });
    }

    const poll = await Poll.findById(pollId)
      .populate({ path: "author", select: "username profileImage" });

    if (!poll) {
      return res.status(404).json({ success: false, message: "Poll not found." });
    }

    // Cache single poll detail for 10 minutes
    await setCached(`poll:detail:${pollId}`, poll, 600);

    return res.status(200).json({
      success: true,
      poll,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// Save a poll to bookmarks
export const savePoll = async (req, res) => {
  try {
    const pollId = req.params.id;
    const userId = req.id;

    const poll = await Poll.findById(pollId);
    if (!poll) {
      return res.status(404).json({ success: false, message: "Poll not found." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    let message = "";
    if (user.bookmarks.includes(poll._id)) {
      // If poll is already bookmarked, remove it
      user.bookmarks = user.bookmarks.filter((id) => id.toString() !== pollId);
      message = "Poll removed from bookmarks.";
    } else {
      // Otherwise, add to bookmarks
      user.bookmarks.push(poll._id);
      message = "Poll saved to bookmarks.";
    }

    await user.save();
    
    // Invalidate user profile cache since bookmarks list changed
    await invalidateCached(`user:profile:${userId}`);

    return res.status(200).json({
      success: true,
      message,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};