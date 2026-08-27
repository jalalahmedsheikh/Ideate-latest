import { Post } from "../../models/post.model.js";
import { embedText } from "../embeddings/textEmbedder.js";
import { batchCosineSimilarity } from "../embeddings/vectorMath.js";
import { extractContentFeatures } from "../features/contentFeatures.js";

const DUPLICATE_THRESHOLD = 0.92;

/**
 * Checks whether a piece of content is an exact or near-duplicate of recent posts
 * @param {string} text Post caption
 * @param {string} authorId Author ID
 * @returns {Promise<Object>} { isDuplicate: boolean, similarity: number, originalPostId: string }
 */
export const checkDuplicateContent = async (text, authorId = null) => {
  if (!text || text.trim().length < 15) {
    return { isDuplicate: false, similarity: 0.0, originalPostId: null };
  }

  const queryEmb = embedText(text);

  // Check recent posts from the last 7 days
  const recentPosts = await Post.find({
    createdAt: { $gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) },
    status: "active",
  })
    .sort({ createdAt: -1 })
    .limit(100)
    .select("caption author createdAt")
    .lean();

  if (recentPosts.length === 0) {
    return { isDuplicate: false, similarity: 0.0, originalPostId: null };
  }

  const candidateEmbeddings = recentPosts.map((p) => extractContentFeatures(p, "post").embedding);
  const similarities = batchCosineSimilarity(queryEmb, candidateEmbeddings);

  for (let i = 0; i < recentPosts.length; i++) {
    const sim = similarities[i] || 0.0;
    if (sim >= DUPLICATE_THRESHOLD) {
      return {
        isDuplicate: true,
        similarity: sim,
        originalPostId: recentPosts[i]._id.toString(),
        isSameAuthor: authorId && recentPosts[i].author?.toString() === authorId.toString(),
      };
    }
  }

  return { isDuplicate: false, similarity: 0.0, originalPostId: null };
};
