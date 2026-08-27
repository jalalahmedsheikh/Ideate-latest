import { User } from "../../models/user.model.js";
import { Post } from "../../models/post.model.js";
import { Poll } from "../../models/poll.model.js";
import { Topic } from "../../models/topic.model.js";
import { Comment } from "../../models/comment.model.js";
import { embedText, EMBEDDING_DIM } from "../embeddings/textEmbedder.js";
import { l2Normalize } from "../embeddings/vectorMath.js";

const DAY_MS = 24 * 3600 * 1000;
const DECAY_LAMBDA = 0.099; // Half-life of ~7 days: e^(-0.099 * 7) = 0.5

/**
 * Computes an aggregated, time-decayed interest vector for a given user.
 * @param {string} userId MongoDB User ID
 * @returns {Promise<Array<number>>} 64-dim normalized user vector
 */
export const buildUserInterestVector = async (userId) => {
  if (!userId) {
    return new Array(EMBEDDING_DIM).fill(0);
  }

  const user = await User.findById(userId)
    .populate("followedTopics", "name slug category description")
    .lean();

  if (!user) {
    return new Array(EMBEDDING_DIM).fill(0);
  }

  const now = Date.now();
  const aggregatedVector = new Array(EMBEDDING_DIM).fill(0);
  let totalWeight = 0;

  // 1. Followed Topics (Strong base interest signals)
  if (user.followedTopics && user.followedTopics.length > 0) {
    for (const topic of user.followedTopics) {
      const topicText = `${topic.name} ${topic.category || ""} ${topic.description || ""}`;
      const topicEmb = embedText(topicText);
      const weight = 2.0;

      for (let i = 0; i < EMBEDDING_DIM; i++) {
        aggregatedVector[i] += topicEmb[i] * weight;
      }
      totalWeight += weight;
    }
  }

  // 2. Recent Liked Posts (Limit last 30)
  const likedPosts = await Post.find({
    likes: userId,
    status: { $ne: "deleted" },
  })
    .sort({ createdAt: -1 })
    .limit(30)
    .populate("topics", "name category")
    .lean();

  for (const post of likedPosts) {
    const ageDays = Math.max((now - new Date(post.createdAt).getTime()) / DAY_MS, 0);
    const decay = Math.exp(-DECAY_LAMBDA * ageDays);
    const weight = 1.0 * decay;

    const postText = `${post.caption || ""} ${(post.topics || []).map((t) => t.name).join(" ")}`;
    const postEmb = embedText(postText);

    for (let i = 0; i < EMBEDDING_DIM; i++) {
      aggregatedVector[i] += postEmb[i] * weight;
    }
    totalWeight += weight;
  }

  // 3. Bookmarked / Saved Posts (Very strong intent signal)
  if (user.bookmarks && user.bookmarks.length > 0) {
    const savedPosts = await Post.find({
      _id: { $in: user.bookmarks.slice(-20) },
      status: { $ne: "deleted" },
    })
      .populate("topics", "name category")
      .lean();

    for (const post of savedPosts) {
      const weight = 2.5; // High weight for bookmarks
      const postText = `${post.caption || ""} ${(post.topics || []).map((t) => t.name).join(" ")}`;
      const postEmb = embedText(postText);

      for (let i = 0; i < EMBEDDING_DIM; i++) {
        aggregatedVector[i] += postEmb[i] * weight;
      }
      totalWeight += weight;
    }
  }

  // 4. Recent Poll Votes
  const votedPolls = await Poll.find({
    "votesHistory.user": userId,
    status: "open",
  })
    .sort({ createdAt: -1 })
    .limit(20)
    .populate("topics", "name category")
    .lean();

  for (const poll of votedPolls) {
    const ageDays = Math.max((now - new Date(poll.createdAt).getTime()) / DAY_MS, 0);
    const decay = Math.exp(-DECAY_LAMBDA * ageDays);
    const weight = 1.2 * decay;

    const pollText = `${poll.question || ""} ${(poll.topics || []).map((t) => t.name).join(" ")}`;
    const pollEmb = embedText(pollText);

    for (let i = 0; i < EMBEDDING_DIM; i++) {
      aggregatedVector[i] += pollEmb[i] * weight;
    }
    totalWeight += weight;
  }

  // 5. Recent Comments Written by User
  const recentComments = await Comment.find({
    author: userId,
    status: "active",
  })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  for (const comment of recentComments) {
    const ageDays = Math.max((now - new Date(comment.createdAt).getTime()) / DAY_MS, 0);
    const decay = Math.exp(-DECAY_LAMBDA * ageDays);
    const weight = 1.5 * decay;

    const commentEmb = embedText(comment.content || "");
    for (let i = 0; i < EMBEDDING_DIM; i++) {
      aggregatedVector[i] += commentEmb[i] * weight;
    }
    totalWeight += weight;
  }

  // Cold Start fallback: if user has no interactions, return centroid of popular active topics
  if (totalWeight < 0.1) {
    return await getColdStartInterestVector();
  }

  // Normalize by total weight and L2 normalize
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    aggregatedVector[i] /= totalWeight;
  }

  return l2Normalize(aggregatedVector);
};

/**
 * Cold start interest vector computed from top active platform topics
 */
export const getColdStartInterestVector = async () => {
  const topTopics = await Topic.find({ status: "active" })
    .sort({ followerCount: -1, postCount: -1 })
    .limit(8)
    .lean();

  if (topTopics.length === 0) {
    // Default fallback embedding
    return embedText("Technology Ideas Science Business Education Art Innovation Discussion");
  }

  const combinedText = topTopics.map((t) => `${t.name} ${t.category}`).join(" ");
  return embedText(combinedText);
};
