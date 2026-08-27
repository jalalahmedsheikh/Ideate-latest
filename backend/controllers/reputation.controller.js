import { Reputation } from "../models/reputation.model.js";
import { User } from "../models/user.model.js";
import { Notification } from "../models/notification.model.js";

// Reputation level thresholds
const REPUTATION_LEVELS = [
  { min: 1000, level: "Community Leader" },
  { min: 500, level: "Expert Contributor" },
  { min: 150, level: "Trusted Contributor" },
  { min: 30, level: "Contributor" },
  { min: 0, level: "Newcomer" },
];

export const calculateReputationLevel = (score) => {
  for (const threshold of REPUTATION_LEVELS) {
    if (score >= threshold.min) {
      return threshold.level;
    }
  }
  return "Newcomer";
};

// Points mapping per action
export const REPUTATION_POINTS = {
  accepted_answer: 15,
  helpful_answer: 5,
  quality_post: 3,
  constructive_debate: 5,
  poll_participation: 1,
  community_contribution: 2,
  upvote_received: 2,
  badge_earned: 10,
  spam_violation: -25,
  moderation_strike: -50,
};

/**
 * Award or deduct reputation safely with anti-gaming checks.
 */
export const awardReputation = async ({
  userId,
  actionType,
  delta = null,
  reason,
  sourceType = "post",
  sourceId = null,
  actorId = null,
}) => {
  try {
    if (!userId) return null;

    // Prevent self-gaming (e.g. user upvoting own content or answering own question)
    if (actorId && actorId.toString() === userId.toString() && !["badge_earned"].includes(actionType)) {
      return null;
    }

    const pointsDelta = delta !== null ? delta : (REPUTATION_POINTS[actionType] || 0);
    if (pointsDelta === 0) return null;

    let reputationRecord = await Reputation.findOne({ user: userId });
    if (!reputationRecord) {
      reputationRecord = new Reputation({
        user: userId,
        score: 0,
        level: "Newcomer",
        history: [],
      });
    }

    // Update score (never drop below 0 unless severe moderation)
    const newScore = Math.max(0, reputationRecord.score + pointsDelta);
    const prevLevel = reputationRecord.level;
    const newLevel = calculateReputationLevel(newScore);

    reputationRecord.score = newScore;
    reputationRecord.level = newLevel;
    if (pointsDelta > 0) {
      reputationRecord.positiveCount = (reputationRecord.positiveCount || 0) + pointsDelta;
    } else {
      reputationRecord.negativeCount = (reputationRecord.negativeCount || 0) + Math.abs(pointsDelta);
    }

    // Append to audit history (keep last 100 events)
    reputationRecord.history.unshift({
      actionType,
      delta: pointsDelta,
      reason: reason || actionType.replace(/_/g, " "),
      sourceType,
      sourceId,
      createdAt: new Date(),
    });
    if (reputationRecord.history.length > 100) {
      reputationRecord.history = reputationRecord.history.slice(0, 100);
    }

    await reputationRecord.save();

    // Sync score & level to User document for fast indexed queries
    await User.findByIdAndUpdate(userId, {
      reputationScore: newScore,
      reputationLevel: newLevel,
    });

    // Notify user on milestone level-up
    if (prevLevel !== newLevel && pointsDelta > 0) {
      await Notification.create({
        recipient: userId,
        sender: userId,
        type: "reputation_milestone",
        message: `Congratulations! Your Ideate reputation reached ${newScore} points. You are now a ${newLevel}!`,
      });
    }

    return { score: newScore, level: newLevel, delta: pointsDelta };
  } catch (error) {
    console.error("Error awarding reputation:", error);
    return null;
  }
};

/**
 * GET /reputation/my-reputation
 */
export const getMyReputation = async (req, res) => {
  try {
    const userId = req.id;
    let record = await Reputation.findOne({ user: userId }).lean();

    if (!record) {
      record = {
        score: 0,
        level: "Newcomer",
        positiveCount: 0,
        negativeCount: 0,
        history: [],
      };
    }

    return res.status(200).json({
      success: true,
      reputation: record,
      nextLevelThreshold: getNextLevelThreshold(record.score),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error fetching reputation", error: error.message });
  }
};

/**
 * GET /reputation/user/:id
 */
export const getUserReputation = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select("username name profileImage isverified reputationScore reputationLevel").lean();
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.status(200).json({
      success: true,
      user,
      reputation: {
        score: user.reputationScore || 0,
        level: user.reputationLevel || "Newcomer",
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error fetching user reputation" });
  }
};

/**
 * GET /reputation/history?page=1&limit=20
 */
export const getReputationHistory = async (req, res) => {
  try {
    const userId = req.id;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const skip = (page - 1) * limit;

    const record = await Reputation.findOne({ user: userId }).select("history score level").lean();
    if (!record || !record.history) {
      return res.status(200).json({ success: true, history: [], pagination: { total: 0, page, limit } });
    }

    const paginatedHistory = record.history.slice(skip, skip + limit);
    return res.status(200).json({
      success: true,
      score: record.score,
      level: record.level,
      history: paginatedHistory,
      pagination: {
        total: record.history.length,
        page,
        limit,
        hasMore: skip + limit < record.history.length,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error fetching reputation history" });
  }
};

const getNextLevelThreshold = (score) => {
  for (let i = REPUTATION_LEVELS.length - 1; i >= 0; i--) {
    if (score < REPUTATION_LEVELS[i].min) {
      return {
        nextLevel: REPUTATION_LEVELS[i].level,
        pointsNeeded: REPUTATION_LEVELS[i].min - score,
        targetScore: REPUTATION_LEVELS[i].min,
      };
    }
  }
  return { nextLevel: "Maximum Level Reached", pointsNeeded: 0, targetScore: score };
};
