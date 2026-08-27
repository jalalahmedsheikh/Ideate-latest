import { User } from "../../models/user.model.js";
import { modelRegistry } from "../core/modelRegistry.js";
import { safePredict } from "../core/tfEngine.js";
import { getUserInterestVector } from "../features/featureStore.js";
import { embedText } from "../embeddings/textEmbedder.js";
import { cosineSimilarity } from "../embeddings/vectorMath.js";

/**
 * Recommends and ranks "People you may like" for a given user using TensorFlow.js Follow Ranker
 * @param {string} userId Current User ID
 * @param {number} limit Number of user recommendations
 * @returns {Promise<Array<Object>>} Ranked list of user recommendations with match reasons
 */
export const rankSuggestedUsers = async (userId, limit = 10) => {
  let currentUser = null;
  let userVector = null;
  let userFollowedTopicIds = new Set();
  let userFollowingIds = new Set();
  let blockedAndMuted = new Set();

  if (userId) {
    currentUser = await User.findById(userId)
      .select("followedTopics followings blockedUsers mutedUsers category")
      .lean();

    if (currentUser) {
      userVector = await getUserInterestVector(userId);
      userFollowedTopicIds = new Set((currentUser.followedTopics || []).map((id) => id.toString()));
      userFollowingIds = new Set((currentUser.followings || []).map((id) => id.toString()));
      blockedAndMuted = new Set([
        ...(currentUser.blockedUsers || []).map((id) => id.toString()),
        ...(currentUser.mutedUsers || []).map((id) => id.toString()),
        userId.toString(),
      ]);
    }
  }

  // Fetch candidate active users not currently followed or blocked
  const candidateUsers = await User.find({
    _id: { $nin: Array.from(blockedAndMuted) },
    isBanned: false,
  })
    .sort({ "followers.length": -1, createdAt: -1 })
    .limit(50)
    .select("username name profileImage bio category isverified followers followings followedTopics")
    .lean();

  if (candidateUsers.length === 0) return [];

  const model = modelRegistry.getModel("follow_ranker");

  // Extract 16-dim user-user feature vectors
  const featureVectors = candidateUsers.map((candidate) => {
    const candidateTopicIds = new Set((candidate.followedTopics || []).map((id) => id.toString()));

    // Shared topics count
    let sharedTopics = 0;
    for (const tid of candidateTopicIds) {
      if (userFollowedTopicIds.has(tid)) sharedTopics++;
    }

    // Mutual followers count
    const candidateFollowers = new Set((candidate.followers || []).map((id) => id.toString()));
    let mutualFollowers = 0;
    for (const fid of userFollowingIds) {
      if (candidateFollowers.has(fid)) mutualFollowers++;
    }

    // Bio / category similarity
    const candidateBioText = `${candidate.category || ""} ${candidate.bio || ""}`;
    const candidateEmb = embedText(candidateBioText);
    const interestSim = userVector ? Math.max(cosineSimilarity(userVector, candidateEmb), 0.0) : 0.0;

    const followerCountNorm = Math.min(Math.log10(1 + (candidate.followers?.length || 0)) / 5.0, 1.0);
    const isVerified = candidate.isverified ? 1.0 : 0.0;
    const sameCategory = currentUser && currentUser.category === candidate.category ? 1.0 : 0.0;

    return [
      Math.min(sharedTopics / 5.0, 1.0), // 0: Shared Topics Norm
      Math.min(mutualFollowers / 10.0, 1.0), // 1: Mutual Followers Norm
      interestSim, // 2: Interest Semantic Sim
      followerCountNorm, // 3: Follower Count Norm
      isVerified, // 4: Verified
      sameCategory, // 5: Same Category
      sharedTopics > 0 ? 1.0 : 0.0, // 6: Has Shared Topics
      mutualFollowers > 0 ? 1.0 : 0.0, // 7: Has Mutual Followers
      0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, // 8..15: Padding/Future signals
    ];
  });

  const fallbackFollowScoring = () => {
    return featureVectors.map((f) => 0.35 * f[0] + 0.30 * f[1] + 0.20 * f[2] + 0.15 * f[3]);
  };

  let scores = [];
  if (model) {
    try {
      scores = await safePredict(model, featureVectors, fallbackFollowScoring);
    } catch {
      scores = fallbackFollowScoring();
    }
  } else {
    scores = fallbackFollowScoring();
  }

  const scoredUsers = candidateUsers.map((candidate, idx) => {
    const score = scores[idx] !== undefined ? scores[idx] : 0.5;
    const f = featureVectors[idx];
    const sharedTopics = Math.round(f[0] * 5.0);
    const mutualFollowers = Math.round(f[1] * 10.0);

    let reason = "Active on Ideate";
    if (mutualFollowers > 0) {
      reason = `${mutualFollowers} mutual connection${mutualFollowers > 1 ? "s" : ""}`;
    } else if (sharedTopics > 0) {
      reason = `Follows ${sharedTopics} similar topic${sharedTopics > 1 ? "s" : ""}`;
    } else if (candidate.category && candidate.category !== "Ideate-User") {
      reason = `Active in ${candidate.category}`;
    }

    return {
      _id: candidate._id,
      username: candidate.username,
      name: candidate.name,
      profileImage: candidate.profileImage,
      category: candidate.category,
      bio: candidate.bio,
      isverified: candidate.isverified,
      followerCount: candidate.followers?.length || 0,
      mutualCount: mutualFollowers,
      recommendationReason: reason,
      score,
      isFollowing: false,
    };
  });

  scoredUsers.sort((a, b) => b.score - a.score);
  return scoredUsers.slice(0, limit);
};
