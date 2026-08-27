import { Topic } from "../../models/topic.model.js";
import { embedText } from "../embeddings/textEmbedder.js";
import { batchCosineSimilarity } from "../embeddings/vectorMath.js";
import { modelRegistry } from "../core/modelRegistry.js";
import { safePredict } from "../core/tfEngine.js";

const DEFAULT_CATEGORIES = [
  "Technology",
  "Programming",
  "Artificial Intelligence",
  "Business",
  "Design",
  "Science",
  "Education",
  "Startups",
  "Productivity",
  "Finance",
  "Philosophy",
  "General",
];

/**
 * Predicts and suggests topics and categories for a piece of text (post caption, poll question)
 * @param {string} text Input text
 * @param {number} topK Number of suggestions to return
 * @returns {Promise<Object>} { suggestedTopics: Array, suggestedCategory: string }
 */
export const classifyAndSuggestTopics = async (text, topK = 5) => {
  if (!text || text.trim().length === 0) {
    return {
      suggestedTopics: [],
      suggestedCategory: "General",
    };
  }

  const queryEmb = embedText(text);

  let matchedTopics = [];

  // 1. Fetch active topics from DB if connected
  let activeTopics = [];
  try {
    if (Topic.db && Topic.db.readyState === 1) {
      activeTopics = await Topic.find({ status: "active" })
        .sort({ followerCount: -1 })
        .limit(100)
        .lean();
    }
  } catch (dbErr) {
    console.warn("⚠️ [topicClassifier] DB offline, using default topic list:", dbErr.message);
  }

  // If no DB topics available, use fallback categories as topics
  if (activeTopics.length === 0) {
    try {
      if (Topic.db && Topic.db.readyState === 1) {
        const defaultDocs = DEFAULT_CATEGORIES.map((cat) => ({
          name: cat,
          slug: cat.toLowerCase().replace(/\s+/g, "-"),
          icon: "💡",
          category: cat,
          description: `Discussion and ideas about ${cat}`,
          status: "active"
        }));
        activeTopics = await Topic.insertMany(defaultDocs);
      }
    } catch (_) {}

    if (activeTopics.length === 0) {
      activeTopics = DEFAULT_CATEGORIES.map((cat, idx) => ({
        _id: `fallback_${idx}`,
        name: cat,
        slug: cat.toLowerCase().replace(/\s+/g, "-"),
        icon: "💡",
        category: cat,
        description: `Discussion and ideas about ${cat}`,
      }));
    }
  }

  const topicEmbeddings = activeTopics.map((t) =>
    embedText(`${t.name} ${t.category || ""} ${t.description || ""}`)
  );

  const similarities = batchCosineSimilarity(queryEmb, topicEmbeddings);

  matchedTopics = activeTopics
    .map((topic, idx) => ({
      _id: topic._id,
      name: topic.name,
      slug: topic.slug,
      icon: topic.icon || "💡",
      category: topic.category || "General",
      confidence: similarities[idx] || 0.0,
    }))
    .filter((t) => t.confidence > 0.20)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, topK);

  // 2. Classify top category using TF.js Topic Classifier model
  let categoryScores = [];
  const model = modelRegistry.getModel("topic_classifier");

  const fallbackCategoryScoring = () => {
    return DEFAULT_CATEGORIES.map((cat) => {
      const catEmb = embedText(cat);
      const dot = catEmb.reduce((acc, v, i) => acc + v * (queryEmb[i] || 0), 0);
      return Math.max(dot, 0.0);
    });
  };

  if (model) {
    try {
      categoryScores = await safePredict(model, [queryEmb], fallbackCategoryScoring);
    } catch {
      categoryScores = fallbackCategoryScoring();
    }
  } else {
    categoryScores = fallbackCategoryScoring();
  }

  let bestCatIdx = 0;
  let maxCatScore = -1;
  DEFAULT_CATEGORIES.forEach((cat, idx) => {
    const score = categoryScores[idx] || 0;
    if (score > maxCatScore) {
      maxCatScore = score;
      bestCatIdx = idx;
    }
  });

  const predictedCategory = DEFAULT_CATEGORIES[bestCatIdx] || "General";

  return {
    suggestedTopics: matchedTopics,
    suggestedCategory: predictedCategory,
    confidence: maxCatScore,
  };
};
