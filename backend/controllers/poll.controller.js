import mongoose from "mongoose";
import { User } from "../models/user.model.js";
import { Poll } from "../models/poll.model.js";
import { Topic } from "../models/topic.model.js";
import { checkSpamAndToxicity } from "./ai.controller.js";
import { getCached, setCached, invalidateCached } from "../config/redis.js";
import { queueFeedGeneration, queueTrendingUpdate } from "../queues/queue.js";
import { io } from "../socket/socket.js";
import { awardReputation } from "./reputation.controller.js";
import { evaluateUserBadges } from "./badge.controller.js";

// Helper to safely resolve/validate topic ObjectIds
const resolveValidTopicIds = async (topics) => {
  if (!topics) return [];
  let rawTopics = topics;
  if (typeof rawTopics === "string") {
    try {
      rawTopics = JSON.parse(rawTopics);
    } catch {
      rawTopics = rawTopics.split(",").map((t) => t.trim());
    }
  }
  if (!Array.isArray(rawTopics)) return [];

  const validIds = [];
  for (const t of rawTopics) {
    if (!t) continue;
    const str = String(t).trim();
    if (mongoose.Types.ObjectId.isValid(str) && String(new mongoose.Types.ObjectId(str)) === str) {
      validIds.push(new mongoose.Types.ObjectId(str));
    }
  }
  return validIds;
};

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

// Create a new poll (supports single, multiple, rating, scale, yes_no, ranked_choice)
export const createPoll = async (req, res) => {
  try {
    const { question, options, optionDetails, topics, pollType, settings, durationHours, community } = req.body;
    const authorId = req.id;

    if (!question || question.trim().length < 4) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid question for the poll.",
      });
    }

    let finalOptions = options;
    const type = pollType || "single_choice";

    if (type === "yes_no" && (!options || options.length === 0)) {
      finalOptions = ["Yes", "No"];
    } else if (type === "rating" && (!options || options.length === 0)) {
      finalOptions = ["1 Star", "2 Stars", "3 Stars", "4 Stars", "5 Stars"];
    } else if (type === "scale" && (!options || options.length === 0)) {
      finalOptions = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
    }

    if (!finalOptions || !Array.isArray(finalOptions) || finalOptions.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Poll must contain at least 2 options.",
      });
    }

    // Toxicity check
    const textToCheck = [question, ...finalOptions].join(" ");
    const safetyCheck = await checkSpamAndToxicity(textToCheck);
    if (safetyCheck.isViolating) {
      return res.status(400).json({
        success: false,
        message: `Content flagged as inappropriate: ${safetyCheck.reason}`,
      });
    }

    const validatedTopics = await resolveValidTopicIds(topics);
    const initialVotes = new Array(finalOptions.length).fill(0);

    const endDate = durationHours && durationHours > 0
      ? new Date(Date.now() + durationHours * 3600 * 1000)
      : null;

    const poll = await Poll.create({
      question: question.trim(),
      options: finalOptions,
      optionDetails: Array.isArray(optionDetails) ? optionDetails : finalOptions.map((o) => ({ text: o })),
      pollType: type,
      settings: settings || {
        minSelections: 1,
        maxSelections: type === "multiple_choice" ? finalOptions.length : 1,
        isAnonymous: false,
        allowVoteChange: true,
        showResultsBeforeVote: false,
        hideVoteCounts: false,
      },
      votes: initialVotes,
      author: authorId,
      topics: validatedTopics,
      community: community || null,
      end: endDate,
    });

    if (validatedTopics.length > 0) {
      await Topic.updateMany({ _id: { $in: validatedTopics } }, { $inc: { pollCount: 1 } });
    }

    const userr = await User.findById(authorId);
    if (userr) {
      userr.polls.push(poll._id);
      await userr.save();
      await invalidateCached(`user:profile:${authorId}`);
    }

    awardReputation({
      userId: authorId,
      actionType: "poll_participation",
      reason: "Published a community poll",
      sourceType: "poll",
      sourceId: poll._id,
    });
    evaluateUserBadges(authorId);

    await poll.populate([
      { path: "author", select: "username name profileImage isverified reputationScore" },
      { path: "topics", select: "name slug icon category" },
    ]);

    await invalidatePollCaches(null, authorId);

    await queueFeedGeneration({
      action: "createPoll",
      pollId: poll._id,
      authorId,
    });

    queueTrendingUpdate({}).catch(() => {});

    return res.status(201).json({
      success: true,
      poll,
      message: "New poll published successfully.",
    });
  } catch (error) {
    console.error("Error creating poll:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// Get all polls
export const getAllPolls = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const skip = (page - 1) * limit;

    const polls = await Poll.find({ status: { $in: ["open", "closed"] } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({ path: "author", select: "username name profileImage isverified reputationScore" })
      .populate("topics", "name icon")
      .lean();

    return res.status(200).json({
      success: true,
      polls,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error fetching polls." });
  }
};

// Get all polls created by user
export const getUserPolls = async (req, res) => {
  try {
    const authorId = req.params.userId || req.id;
    const polls = await Poll.find({ author: authorId })
      .sort({ createdAt: -1 })
      .populate({ path: "author", select: "username name profileImage isverified" })
      .populate("topics", "name icon")
      .lean();

    return res.status(200).json({
      success: true,
      polls,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error fetching user polls." });
  }
};

// Record or change a vote on a poll
export const voteOnPoll = async (req, res) => {
  try {
    const userId = req.id;
    const pollId = req.params.id;
    const { optionIndex, selectedIndices, rankedOrder, ratingValue } = req.body;

    const poll = await Poll.findById(pollId);
    if (!poll) {
      return res.status(404).json({ success: false, message: "Poll not found." });
    }

    if (poll.status && poll.status !== "open") {
      return res.status(400).json({
        success: false,
        message: "This poll is closed or ended.",
      });
    }

    // Call schema method for atomic vote change
    await poll.recordVote(userId, {
      optionIndex,
      selectedIndices,
      rankedOrder,
      ratingValue,
    });

    awardReputation({
      userId,
      actionType: "poll_participation",
      reason: "Participated in a poll",
      sourceType: "poll",
      sourceId: poll._id,
    });

    await poll.populate({ path: "author", select: "username name profileImage isverified" });

    const authorIdStr = poll.author?._id ? poll.author._id.toString() : poll.author?.toString();
    await invalidatePollCaches(pollId, authorIdStr);

    // Socket real-time broadcast
    if (io) {
      try {
        io.to(`poll:${pollId}`).emit("poll:vote_update", {
          pollId,
          votes: poll.votes,
          voterCount: poll.voterCount,
        });
      } catch (socketErr) {}
    }

    queueTrendingUpdate({}).catch(() => {});

    return res.status(200).json({
      success: true,
      message: "Vote recorded successfully.",
      poll,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || "Error voting on poll." });
  }
};

// Get poll analytics
export const getPollAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const poll = await Poll.findById(id).lean();
    if (!poll) {
      return res.status(404).json({ success: false, message: "Poll not found." });
    }

    const totalVotes = poll.votes ? poll.votes.reduce((a, b) => a + b, 0) : 0;
    const breakdown = (poll.options || []).map((opt, idx) => {
      const count = poll.votes?.[idx] || 0;
      const percentage = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
      return {
        option: opt,
        votes: count,
        percentage,
      };
    });

    return res.status(200).json({
      success: true,
      analytics: {
        totalVotes,
        voterCount: poll.voterCount || totalVotes,
        breakdown,
        isExpired: poll.status === "closed" || (poll.end && new Date() > new Date(poll.end)),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error calculating poll analytics." });
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

    if (poll.author.toString() !== userId) {
      return res.status(403).json({ success: false, message: "Unauthorized." });
    }

    await Poll.findByIdAndDelete(pollId);
    await User.findByIdAndUpdate(userId, { $pull: { polls: pollId } });
    await invalidatePollCaches(pollId, userId);

    return res.status(200).json({
      success: true,
      message: "Poll deleted successfully.",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// Get poll details
export const getPollDetails = async (req, res) => {
  try {
    const pollId = req.params.id;
    const poll = await Poll.findById(pollId)
      .populate({ path: "author", select: "username name profileImage isverified" })
      .populate("topics", "name icon");

    if (!poll) {
      return res.status(404).json({ success: false, message: "Poll not found." });
    }

    poll.views = (poll.views || 0) + 1;
    await poll.save();

    return res.status(200).json({
      success: true,
      poll,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// Save a poll
export const savePoll = async (req, res) => {
  try {
    const pollId = req.params.id;
    const userId = req.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    let isSaved = false;
    if (user.bookmarks.includes(pollId)) {
      user.bookmarks = user.bookmarks.filter((id) => id.toString() !== pollId);
    } else {
      user.bookmarks.push(pollId);
      isSaved = true;
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: isSaved ? "Poll saved to bookmarks." : "Poll removed from bookmarks.",
      isSaved,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};