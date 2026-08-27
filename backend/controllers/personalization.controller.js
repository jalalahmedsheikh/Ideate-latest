import { generateCandidates } from "../ai/ranking/candidateGenerator.js";
import { rankCandidates } from "../ai/ranking/feedRankerModel.js";
import { applyDiversityFilter } from "../ai/ranking/diversityFilter.js";
import { generateExplanationSignal } from "../ai/ranking/explanationSignals.js";
import { getUserInterestVector, resetUserRecommendations } from "../ai/features/featureStore.js";
import { getRelatedPosts, getRelatedPolls, getRelatedTopics } from "../ai/embeddings/relatedContent.js";
import { rankSuggestedUsers } from "../ai/classification/followRanker.js";
import { User } from "../models/user.model.js";

/**
 * GET /feed/for-you
 * Primary intelligent personalized recommendation feed
 */
export const getPersonalizedForYouFeed = async (req, res) => {
  try {
    const userId = req.id || null;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const skip = (page - 1) * limit;

    let userContext = {};
    let userVector = null;

    if (userId) {
      const user = await User.findById(userId)
        .select("followedTopics followings blockedUsers mutedUsers personalizationSettings")
        .lean();

      if (user) {
        userContext = {
          followedTopicIds: new Set((user.followedTopics || []).map((id) => id.toString())),
          followingUserIds: new Set((user.followings || []).map((id) => id.toString())),
          personalizationSettings: user.personalizationSettings || { enablePersonalizedFeed: true },
        };
      }
      userVector = await getUserInterestVector(userId);
    } else {
      // Guest: use general cold start interest vector
      userVector = await getUserInterestVector(null);
    }

    // 1. Multi-channel candidate retrieval
    const candidates = await generateCandidates(userId, { limit: 120 });

    if (candidates.length === 0) {
      return res.status(200).json({
        success: true,
        feed: [],
        pagination: { page, limit, totalItems: 0, totalPages: 0, hasNextPage: false },
      });
    }

    // 2. TensorFlow.js Multi-Objective Ranking
    const rankedItems = await rankCandidates(userVector, candidates, userContext);

    // 3. Feed Diversity Optimization (author frequency penalties & interleaving)
    const diversifiedItems = applyDiversityFilter(rankedItems);

    // 4. Attach transparent grounded explanation signals
    const enrichedFeed = diversifiedItems.map((item) => {
      const explanation = generateExplanationSignal(item, userContext);
      return {
        ...item,
        recommendationSignal: explanation.signal,
        recommendationReasonType: explanation.reasonType,
      };
    });

    // 5. Paginate
    const paginatedItems = enrichedFeed.slice(skip, skip + limit);
    const totalItems = enrichedFeed.length;
    const totalPages = Math.ceil(totalItems / limit);

    return res.status(200).json({
      success: true,
      feed: paginatedItems,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("getPersonalizedForYouFeed error:", error);
    return res.status(500).json({ success: false, message: "Failed to generate recommendation feed." });
  }
};

/**
 * GET /feed/related-ideas/:postId
 * Returns mathematically related Posts, Polls, and Topics
 */
export const getRelatedContentForPost = async (req, res) => {
  try {
    const { postId } = req.params;

    const [relatedPosts, relatedPolls, relatedTopics] = await Promise.all([
      getRelatedPosts(postId, 5),
      getRelatedPolls(postId, false, 4),
      getRelatedTopics(postId, 5),
    ]);

    return res.status(200).json({
      success: true,
      relatedPosts,
      relatedPolls,
      relatedTopics,
    });
  } catch (error) {
    console.error("getRelatedContentForPost error:", error);
    return res.status(500).json({ success: false, message: "Failed to retrieve related content." });
  }
};

/**
 * GET /feed/related-polls/:pollId
 */
export const getRelatedContentForPoll = async (req, res) => {
  try {
    const { pollId } = req.params;

    const [relatedPolls, relatedTopics] = await Promise.all([
      getRelatedPolls(pollId, true, 5),
      getRelatedTopics(pollId, 5),
    ]);

    return res.status(200).json({
      success: true,
      relatedPolls,
      relatedTopics,
    });
  } catch (error) {
    console.error("getRelatedContentForPoll error:", error);
    return res.status(500).json({ success: false, message: "Failed to retrieve related polls." });
  }
};

/**
 * GET /feed/suggested-people
 * Returns ML-ranked "People you may like"
 */
export const getSuggestedPeople = async (req, res) => {
  try {
    const userId = req.id || null;
    const limit = Math.min(parseInt(req.query.limit) || 10, 30);

    const suggested = await rankSuggestedUsers(userId, limit);
    return res.status(200).json({
      success: true,
      users: suggested,
    });
  } catch (error) {
    console.error("getSuggestedPeople error:", error);
    return res.status(500).json({ success: false, message: "Failed to retrieve suggested users." });
  }
};

/**
 * POST /user/reset-recommendations
 * Clears recommendation profile and user interest vector
 */
export const handleResetRecommendations = async (req, res) => {
  try {
    const userId = req.id;
    await resetUserRecommendations(userId);

    return res.status(200).json({
      success: true,
      message: "Personalized recommendation profile has been reset successfully.",
    });
  } catch (error) {
    console.error("handleResetRecommendations error:", error);
    return res.status(500).json({ success: false, message: "Failed to reset recommendations." });
  }
};

/**
 * GET /user/personalization-settings
 */
export const getPersonalizationSettings = async (req, res) => {
  try {
    const userId = req.id;
    const user = await User.findById(userId).select("personalizationSettings").lean();

    return res.status(200).json({
      success: true,
      settings: user?.personalizationSettings || {
        enablePersonalizedFeed: true,
        enableTopicRecommendations: true,
        enableUserRecommendations: true,
      },
    });
  } catch (error) {
    console.error("getPersonalizationSettings error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch settings." });
  }
};

/**
 * PUT /user/personalization-settings
 */
export const updatePersonalizationSettings = async (req, res) => {
  try {
    const userId = req.id;
    const { enablePersonalizedFeed, enableTopicRecommendations, enableUserRecommendations } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          "personalizationSettings.enablePersonalizedFeed": enablePersonalizedFeed !== undefined ? enablePersonalizedFeed : true,
          "personalizationSettings.enableTopicRecommendations": enableTopicRecommendations !== undefined ? enableTopicRecommendations : true,
          "personalizationSettings.enableUserRecommendations": enableUserRecommendations !== undefined ? enableUserRecommendations : true,
        },
      },
      { new: true }
    ).select("personalizationSettings");

    return res.status(200).json({
      success: true,
      message: "Personalization preferences updated.",
      settings: user.personalizationSettings,
    });
  } catch (error) {
    console.error("updatePersonalizationSettings error:", error);
    return res.status(500).json({ success: false, message: "Failed to update settings." });
  }
};
