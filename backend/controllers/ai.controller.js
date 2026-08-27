import { detectSpam } from "../ai/moderation/spamDetector.js";
import { checkDuplicateContent } from "../ai/moderation/duplicateDetector.js";
import { classifyAndSuggestTopics } from "../ai/classification/topicClassifier.js";
import { computeQualityScore } from "../ai/classification/qualityScorer.js";
import { modelRegistry } from "../ai/core/modelRegistry.js";

/**
 * POST /ai/suggest-topics
 * Suggests topic tags and category for post/poll drafting using TensorFlow.js
 */
export const suggestTopics = async (req, res) => {
  try {
    const { text, question } = req.body;
    const content = text || question || "";

    if (!content.trim()) {
      return res.status(400).json({
        success: false,
        message: "Content text is required.",
      });
    }

    const suggestions = await classifyAndSuggestTopics(content);
    return res.status(200).json({
      success: true,
      ...suggestions,
    });
  } catch (error) {
    console.error("suggestTopics error:", error);
    return res.status(500).json({ success: false, message: "Failed to suggest topics." });
  }
};

/**
 * POST /ai/check-spam
 * Analyzes text for spam, abuse patterns, and duplicate signals using TF.js
 */
export const checkContentSafety = async (req, res) => {
  try {
    const { text, caption, question } = req.body;
    const content = text || caption || question || "";

    const [spamResult, duplicateResult] = await Promise.all([
      detectSpam(content),
      checkDuplicateContent(content, req.id),
    ]);

    const isViolating = spamResult.isViolating;
    const isDuplicate = duplicateResult.isDuplicate;

    return res.status(200).json({
      success: true,
      isViolating,
      spamProbability: spamResult.spamProbability,
      isDuplicate,
      duplicateSimilarity: duplicateResult.similarity,
      reason: spamResult.reason || (isDuplicate ? "Near-duplicate content detected." : ""),
    });
  } catch (error) {
    console.error("checkContentSafety error:", error);
    return res.status(500).json({ success: false, message: "Safety check error." });
  }
};

/**
 * Helper function used across other backend controllers for synchronous safety checks
 */
export const checkSpamAndToxicity = async (content) => {
  return await detectSpam(content);
};

/**
 * GET /ai/health
 * Returns status, versioning, and memory profile of the TensorFlow.js ML engine
 */
export const getAIHealth = async (req, res) => {
  try {
    const health = modelRegistry.getHealth();
    return res.status(200).json({
      success: true,
      engine: "TensorFlow.js Node/JS",
      ...health,
    });
  } catch (error) {
    console.error("getAIHealth error:", error);
    return res.status(500).json({ success: false, message: "Failed to retrieve AI health." });
  }
};
