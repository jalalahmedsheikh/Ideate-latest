import { Badge } from "../models/badge.model.js";
import { UserBadge } from "../models/userBadge.model.js";
import { User } from "../models/user.model.js";
import { Post } from "../models/post.model.js";
import { Question } from "../models/question.model.js";
import { Answer } from "../models/answer.model.js";
import { Debate } from "../models/debate.model.js";
import { Poll } from "../models/poll.model.js";
import { Notification } from "../models/notification.model.js";
import { awardReputation } from "./reputation.controller.js";

// Core Seed Badges Catalog
export const SEED_BADGES = [
  {
    badgeId: "first_post",
    name: "Idea Starter",
    description: "Published your first idea or thesis on Ideate.",
    icon: "lightbulb",
    category: "contribution",
    rarity: "common",
    criteria: { action: "create_post", threshold: 1 },
  },
  {
    badgeId: "first_question",
    name: "Curious Mind",
    description: "Asked your first thought-provoking question.",
    icon: "help_outline",
    category: "contribution",
    rarity: "common",
    criteria: { action: "create_question", threshold: 1 },
  },
  {
    badgeId: "first_answer",
    name: "Knowledge Sharer",
    description: "Provided your first helpful answer to a community question.",
    icon: "forum",
    category: "contribution",
    rarity: "common",
    criteria: { action: "create_answer", threshold: 1 },
  },
  {
    badgeId: "accepted_answer_master",
    name: "Top Solution",
    description: "Had an answer marked as the Accepted Answer by the author.",
    icon: "verified",
    category: "quality",
    rarity: "rare",
    criteria: { action: "accepted_answers", threshold: 1 },
  },
  {
    badgeId: "debate_champion",
    name: "Constructive Debater",
    description: "Participated with evidence-backed arguments in structured debates.",
    icon: "balance",
    category: "quality",
    rarity: "rare",
    criteria: { action: "debate_arguments", threshold: 3 },
  },
  {
    badgeId: "poll_creator",
    name: "Pulse Checker",
    description: "Created community polls gathering diverse perspectives.",
    icon: "how_to_vote",
    category: "contribution",
    rarity: "common",
    criteria: { action: "create_poll", threshold: 2 },
  },
  {
    badgeId: "rising_creator",
    name: "Rising Creator",
    description: "Reached over 50 combined upvotes and saves across your ideas.",
    icon: "trending_up",
    category: "creator",
    rarity: "epic",
    criteria: { action: "total_engagements", threshold: 50 },
  },
  {
    badgeId: "community_leader",
    name: "Community Pillar",
    description: "Achieved Trusted Contributor reputation rank on Ideate.",
    icon: "military_tech",
    category: "milestone",
    rarity: "legendary",
    criteria: { action: "reputation_score", threshold: 150 },
  },
];

/**
 * Ensure core badges exist in the database.
 */
export const initializeBadges = async () => {
  try {
    for (const b of SEED_BADGES) {
      await Badge.findOneAndUpdate(
        { badgeId: b.badgeId },
        { $setOnInsert: b },
        { upsert: true, new: true }
      );
    }
  } catch (error) {
    console.error("Error seeding badges:", error.message);
  }
};

/**
 * Evaluate badge criteria for a user and award newly unlocked badges.
 */
export const evaluateUserBadges = async (userId) => {
  try {
    if (!userId) return [];
    const user = await User.findById(userId).lean();
    if (!user) return [];

    // Fetch user activity counts
    const [postsCount, questionsCount, answersCount, acceptedAnswersCount, debatesCount, pollsCount] =
      await Promise.all([
        Post.countDocuments({ author: userId, status: "active" }),
        Question.countDocuments({ author: userId, status: "active" }),
        Answer.countDocuments({ author: userId, status: "active" }),
        Answer.countDocuments({ author: userId, isAccepted: true, status: "active" }),
        Debate.countDocuments({ author: userId, status: { $in: ["active", "closed"] } }),
        Poll.countDocuments({ author: userId, status: { $in: ["open", "closed"] } }),
      ]);

    const allBadges = await Badge.find({ isActive: true }).lean();
    const existingUserBadges = await UserBadge.find({ user: userId, revokedAt: null }).select("badgeId").lean();
    const existingBadgeIds = new Set(existingUserBadges.map((ub) => ub.badgeId));

    const newlyAwarded = [];

    for (const badge of allBadges) {
      if (existingBadgeIds.has(badge.badgeId)) continue;

      let eligible = false;
      const { action, threshold } = badge.criteria;

      if (action === "create_post" && postsCount >= threshold) eligible = true;
      if (action === "create_question" && questionsCount >= threshold) eligible = true;
      if (action === "create_answer" && answersCount >= threshold) eligible = true;
      if (action === "accepted_answers" && acceptedAnswersCount >= threshold) eligible = true;
      if (action === "create_poll" && pollsCount >= threshold) eligible = true;
      if (action === "reputation_score" && (user.reputationScore || 0) >= threshold) eligible = true;

      if (eligible) {
        // Award badge atomically
        const newBadge = await UserBadge.create({
          user: userId,
          badge: badge._id,
          badgeId: badge.badgeId,
          reason: `Achieved ${badge.name} criteria (${action}: ${threshold})`,
        });

        // Award reputation bonus
        await awardReputation({
          userId,
          actionType: "badge_earned",
          delta: 10,
          reason: `Earned badge: ${badge.name}`,
          sourceType: "post",
          sourceId: newBadge._id,
        });

        // Notify user
        await Notification.create({
          recipient: userId,
          sender: userId,
          type: "badge_earned",
          message: `🏅 Achievement Unlocked! You earned the "${badge.name}" badge.`,
        });

        newlyAwarded.push(badge);
      }
    }

    if (newlyAwarded.length > 0) {
      const totalActiveBadges = await UserBadge.countDocuments({ user: userId, revokedAt: null });
      await User.findByIdAndUpdate(userId, { badgesCount: totalActiveBadges });
    }

    return newlyAwarded;
  } catch (error) {
    console.error("Error evaluating badges:", error);
    return [];
  }
};

/**
 * GET /badges/all
 */
export const getAllBadges = async (req, res) => {
  try {
    await initializeBadges();
    const badges = await Badge.find({ isActive: true }).sort({ category: 1, rarity: 1 }).lean();
    return res.status(200).json({ success: true, badges });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error loading badges" });
  }
};

/**
 * GET /badges/user/:id
 */
export const getUserBadges = async (req, res) => {
  try {
    const { id } = req.params;
    // Auto-evaluate current status first
    await evaluateUserBadges(id);

    const userBadges = await UserBadge.find({ user: id, revokedAt: null })
      .populate("badge")
      .sort({ awardedAt: -1 })
      .lean();

    return res.status(200).json({ success: true, badges: userBadges });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error fetching user badges" });
  }
};

/**
 * POST /badges/toggle-display
 */
export const toggleBadgeDisplay = async (req, res) => {
  try {
    const userId = req.id;
    const { userBadgeId } = req.body;

    const userBadge = await UserBadge.findOne({ _id: userBadgeId, user: userId });
    if (!userBadge) {
      return res.status(404).json({ success: false, message: "Badge record not found" });
    }

    userBadge.isDisplayed = !userBadge.isDisplayed;
    await userBadge.save();

    return res.status(200).json({ success: true, isDisplayed: userBadge.isDisplayed });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error updating badge display" });
  }
};
