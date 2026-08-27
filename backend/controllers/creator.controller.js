import { CreatorProfile } from "../models/creatorProfile.model.js";
import { User } from "../models/user.model.js";
import { UserBadge } from "../models/userBadge.model.js";
import { Post } from "../models/post.model.js";
import { Question } from "../models/question.model.js";
import { Debate } from "../models/debate.model.js";
import { Poll } from "../models/poll.model.js";

/**
 * POST /creator/toggle-mode
 */
export const toggleCreatorMode = async (req, res) => {
  try {
    const userId = req.id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const nextState = !user.isCreator;
    user.isCreator = nextState;
    await user.save();

    let creatorProfile = await CreatorProfile.findOne({ user: userId });
    if (!creatorProfile) {
      creatorProfile = await CreatorProfile.create({
        user: userId,
        isCreatorEnabled: nextState,
      });
    } else {
      creatorProfile.isCreatorEnabled = nextState;
      await creatorProfile.save();
    }

    return res.status(200).json({
      success: true,
      message: nextState ? "Creator Mode activated!" : "Creator Mode deactivated.",
      isCreator: nextState,
      creatorProfile,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error toggling creator mode." });
  }
};

/**
 * PUT /creator/profile
 */
export const updateCreatorProfile = async (req, res) => {
  try {
    const userId = req.id;
    const { intro, expertise, socialLinks, selectedBadges } = req.body;

    const profile = await CreatorProfile.findOneAndUpdate(
      { user: userId },
      {
        $set: {
          intro: intro ? intro.trim() : "",
          expertise: Array.isArray(expertise) ? expertise : [],
          socialLinks: socialLinks || {},
          selectedBadges: Array.isArray(selectedBadges) ? selectedBadges : [],
        },
      },
      { upsert: true, new: true }
    );

    return res.status(200).json({
      success: true,
      message: "Creator profile updated successfully!",
      creatorProfile: profile,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error updating creator profile." });
  }
};

/**
 * GET /creator/profile/:userId
 */
export const getCreatorProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const [user, creatorProfile, userBadges, postsCount, questionsCount, debatesCount, pollsCount] =
      await Promise.all([
        User.findById(userId)
          .select("name username profileImage bio isverified verificationCategory reputationScore reputationLevel followers followings createdAt")
          .lean(),
        CreatorProfile.findOne({ user: userId })
          .populate("topics", "name icon")
          .populate("selectedBadges")
          .lean(),
        UserBadge.find({ user: userId, revokedAt: null })
          .populate("badge")
          .lean(),
        Post.countDocuments({ author: userId, status: "active" }),
        Question.countDocuments({ author: userId, status: "active" }),
        Debate.countDocuments({ author: userId, status: { $in: ["active", "closed"] } }),
        Poll.countDocuments({ author: userId, status: { $in: ["open", "closed"] } }),
      ]);

    if (!user) {
      return res.status(404).json({ success: false, message: "Creator profile not found." });
    }

    return res.status(200).json({
      success: true,
      creator: {
        ...user,
        creatorProfile: creatorProfile || {
          isCreatorEnabled: false,
          intro: "",
          expertise: [],
          socialLinks: {},
          featuredContent: [],
        },
        badges: userBadges,
        stats: {
          postsCount,
          questionsCount,
          debatesCount,
          pollsCount,
          followersCount: user.followers?.length || 0,
          followingCount: user.followings?.length || 0,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error loading creator profile." });
  }
};

/**
 * POST /creator/featured
 */
export const setFeaturedContent = async (req, res) => {
  try {
    const userId = req.id;
    const { featuredContent } = req.body; // array of { contentType, contentId }

    if (!Array.isArray(featuredContent) || featuredContent.length > 5) {
      return res.status(400).json({ success: false, message: "You can pin up to 5 featured items." });
    }

    const profile = await CreatorProfile.findOneAndUpdate(
      { user: userId },
      { $set: { featuredContent } },
      { upsert: true, new: true }
    );

    return res.status(200).json({
      success: true,
      message: "Featured content updated!",
      featuredContent: profile.featuredContent,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error setting featured content." });
  }
};
