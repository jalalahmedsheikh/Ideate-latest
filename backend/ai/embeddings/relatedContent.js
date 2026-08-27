import { Post } from "../../models/post.model.js";
import { Poll } from "../../models/poll.model.js";
import { Topic } from "../../models/topic.model.js";
import { extractContentFeatures } from "../features/contentFeatures.js";
import { batchCosineSimilarity, cosineSimilarity } from "./vectorMath.js";
import { embedText } from "./textEmbedder.js";

/**
 * Retrieves related Posts for a given post based on semantic vector similarity & topic overlap.
 */
export const getRelatedPosts = async (postId, limit = 5) => {
  const targetPost = await Post.findById(postId).populate("topics", "name category").lean();
  if (!targetPost) return [];

  const { embedding: targetEmb } = extractContentFeatures(targetPost, "post");

  // Fetch candidate recent active posts excluding current
  const candidatePosts = await Post.find({
    _id: { $ne: postId },
    status: "active",
  })
    .sort({ createdAt: -1 })
    .limit(60)
    .populate("author", "username profileImage isverified")
    .populate("topics", "name category")
    .lean();

  if (candidatePosts.length === 0) return [];

  const candidateEmbeddings = candidatePosts.map((p) => extractContentFeatures(p, "post").embedding);
  const similarityScores = batchCosineSimilarity(targetEmb, candidateEmbeddings);

  const scoredPosts = candidatePosts.map((post, idx) => ({
    ...post,
    feedType: "post",
    similarityScore: similarityScores[idx] || 0.0,
  }));

  // Sort descending by similarity
  scoredPosts.sort((a, b) => b.similarityScore - a.similarityScore);
  return scoredPosts.slice(0, limit);
};

/**
 * Retrieves related Polls for a given post or poll based on semantic similarity.
 */
export const getRelatedPolls = async (targetId, isPoll = false, limit = 5) => {
  let targetEmb = null;

  if (isPoll) {
    const targetPoll = await Poll.findById(targetId).populate("topics", "name category").lean();
    if (!targetPoll) return [];
    targetEmb = extractContentFeatures(targetPoll, "poll").embedding;
  } else {
    const targetPost = await Post.findById(targetId).populate("topics", "name category").lean();
    if (!targetPost) return [];
    targetEmb = extractContentFeatures(targetPost, "post").embedding;
  }

  const candidatePolls = await Poll.find({
    _id: { $ne: targetId },
    status: "open",
  })
    .sort({ createdAt: -1 })
    .limit(60)
    .populate("author", "username profileImage isverified")
    .populate("topics", "name category")
    .lean();

  if (candidatePolls.length === 0) return [];

  const candidateEmbeddings = candidatePolls.map((p) => extractContentFeatures(p, "poll").embedding);
  const similarityScores = batchCosineSimilarity(targetEmb, candidateEmbeddings);

  const scoredPolls = candidatePolls.map((poll, idx) => ({
    ...poll,
    feedType: "poll",
    similarityScore: similarityScores[idx] || 0.0,
  }));

  scoredPolls.sort((a, b) => b.similarityScore - a.similarityScore);
  return scoredPolls.slice(0, limit);
};

/**
 * Retrieves related Topics for a given post, poll, or topic.
 */
export const getRelatedTopics = async (queryTextOrTopicId, limit = 5) => {
  let queryEmb = null;

  if (typeof queryTextOrTopicId === "string" && queryTextOrTopicId.match(/^[0-9a-fA-F]{24}$/)) {
    const topic = await Topic.findById(queryTextOrTopicId).lean();
    if (topic) {
      queryEmb = embedText(`${topic.name} ${topic.category} ${topic.description}`);
    }
  }

  if (!queryEmb) {
    queryEmb = embedText(queryTextOrTopicId.toString());
  }

  const allTopics = await Topic.find({ status: "active" })
    .sort({ followerCount: -1 })
    .limit(50)
    .lean();

  if (allTopics.length === 0) return [];

  const topicEmbeddings = allTopics.map((t) => embedText(`${t.name} ${t.category} ${t.description}`));
  const similarities = batchCosineSimilarity(queryEmb, topicEmbeddings);

  const scoredTopics = allTopics.map((topic, idx) => ({
    ...topic,
    similarityScore: similarities[idx] || 0.0,
  }));

  scoredTopics.sort((a, b) => b.similarityScore - a.similarityScore);
  return scoredTopics.slice(0, limit);
};
