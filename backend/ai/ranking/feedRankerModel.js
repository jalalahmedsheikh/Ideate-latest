import { modelRegistry } from "../core/modelRegistry.js";
import { safePredict } from "../core/tfEngine.js";
import { buildInteractionFeatures, INTERACTION_FEATURE_DIM } from "../features/interactionFeatures.js";

/**
 * Ranks candidate Posts and Polls using the TensorFlow.js Feed Ranker model
 * @param {Array<number>} userVector 64-dim user interest vector
 * @param {Array<Object>} candidates Array of candidate items
 * @param {Object} userContext Context containing followedTopicIds, followingUserIds
 * @returns {Promise<Array<Object>>} Scored and ranked candidates
 */
export const rankCandidates = async (userVector, candidates, userContext = {}) => {
  if (!candidates || candidates.length === 0) return [];

  const model = modelRegistry.getModel("feed_ranker");

  // Build batch of interaction feature vectors: [N, 20]
  const featureVectors = candidates.map((item) =>
    buildInteractionFeatures(userVector, item, item.feedType || "post", userContext)
  );

  // Fallback ranking calculation (heuristic linear combination)
  const computeFallbackScores = () => {
    return featureVectors.map((f) => {
      const sim = f[0]; // Semantic similarity
      const following = f[1]; // Author following
      const topicOverlap = f[2]; // Topic overlap
      const freshness = f[3]; // Freshness
      const likes = f[4]; // Like count norm
      const velocity = f[8]; // Velocity

      return 0.35 * sim + 0.25 * freshness + 0.15 * topicOverlap + 0.15 * following + 0.10 * (likes + velocity);
    });
  };

  let mlScores = [];
  try {
    if (model) {
      mlScores = await safePredict(model, featureVectors, computeFallbackScores);
    } else {
      mlScores = computeFallbackScores();
    }
  } catch (err) {
    console.warn("⚠️ [rankCandidates] Falling back to heuristic scoring:", err.message);
    mlScores = computeFallbackScores();
  }

  // Combine ML score with multi-objective factors
  const scoredItems = candidates.map((item, idx) => {
    const mlScore = mlScores[idx] !== undefined ? mlScores[idx] : 0.5;
    const f = featureVectors[idx];
    const semanticSim = f[0];
    const freshness = f[3];
    const isFollowing = f[1];
    const topicOverlap = f[2];

    // Final blended ranking score
    const finalScore =
      0.40 * mlScore +
      0.25 * semanticSim +
      0.20 * freshness +
      0.10 * topicOverlap +
      0.05 * isFollowing;

    return {
      ...item,
      rankingScore: finalScore,
      mlConfidence: mlScore,
      semanticSim,
      freshness,
      isFollowingAuthor: isFollowing === 1.0,
    };
  });

  // Sort descending by final ranking score
  scoredItems.sort((a, b) => b.rankingScore - a.rankingScore);

  return scoredItems;
};
