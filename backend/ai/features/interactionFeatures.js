import { cosineSimilarity } from "../embeddings/vectorMath.js";
import { extractContentFeatures } from "./contentFeatures.js";

/**
 * Constructs the pairwise feature vector [20 dim] for user-content ranking
 * @param {Array<number>} userVector 64-dim user interest vector
 * @param {Object} item Candidate Post or Poll
 * @param {string} type 'post' | 'poll'
 * @param {Object} userContext Context containing followedTopicIds, followingUserIds
 * @returns {Array<number>} 20-dim feature vector
 */
export const buildInteractionFeatures = (userVector, item, type = "post", userContext = {}) => {
  const { embedding: contentEmb, stats } = extractContentFeatures(item, type);

  // 1. Semantic Cosine Similarity
  const semanticSim = userVector ? Math.max(cosineSimilarity(userVector, contentEmb), 0.0) : 0.0;

  // 2. Author Relationship
  const authorId = item.author?._id?.toString() || item.author?.toString();
  const isFollowingAuthor = userContext.followingUserIds && authorId && userContext.followingUserIds.has(authorId) ? 1.0 : 0.0;

  // 3. Topic Overlap
  let topicOverlap = 0.0;
  if (item.topics && item.topics.length > 0 && userContext.followedTopicIds) {
    const matchingTopics = item.topics.filter((t) => {
      const tid = typeof t === "object" ? t._id?.toString() : t.toString();
      return userContext.followedTopicIds.has(tid);
    });
    topicOverlap = matchingTopics.length / item.topics.length;
  }

  // 4. Freshness
  const freshness = stats[0] || 0.5;

  return [
    semanticSim, // 0: User-Content Semantic Similarity
    isFollowingAuthor, // 1: Author Following
    topicOverlap, // 2: Topic Overlap
    ...stats, // 3..18: 16-dim Content statistical features
    freshness * (1.0 + semanticSim), // 19: Combined Freshness-Relevance score
  ];
};

export const INTERACTION_FEATURE_DIM = 20;
