import { modelRegistry } from "../core/modelRegistry.js";
import { safePredict } from "../core/tfEngine.js";
import { embedText } from "../embeddings/textEmbedder.js";

// Common high-risk spam patterns & regular expressions
const SPAM_PATTERNS = [
  /free\s+crypto|make\s+\$\d+/i,
  /whatsapp\s+me\s+at/i,
  /click\s+here\s+now/i,
  /earn\s+money\s+fast/i,
  /100%\s+guaranteed\s+profit/i,
  /telegram\s+@\w+/i,
];

/**
 * Evaluates whether text content is spam or toxic using local TensorFlow.js classifier
 * @param {string} text Post caption, comment, message, or poll question
 * @returns {Promise<Object>} { isViolating: boolean, spamProbability: number, reason: string }
 */
export const detectSpam = async (text) => {
  if (!text || text.trim().length === 0) {
    return { isViolating: false, spamProbability: 0.0, reason: "" };
  }

  const cleanText = text.trim();

  // 1. Check obvious regex patterns for immediate baseline
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(cleanText)) {
      return {
        isViolating: true,
        spamProbability: 0.98,
        reason: "Contains detected spam phrase pattern.",
      };
    }
  }

  // 2. Extract structural metrics
  const urlCount = (cleanText.match(/https?:\/\/[^\s]+/g) || []).length;
  const capsCount = (cleanText.match(/[A-Z]/g) || []).length;
  const capsRatio = capsCount / (cleanText.length + 1);

  // 3. TF.js Spam Classifier Inference
  const embedding = embedText(cleanText);
  const model = modelRegistry.getModel("spam_classifier");

  const fallbackSpamScore = () => {
    let prob = 0.05;
    if (urlCount >= 2) prob += 0.40;
    if (capsRatio > 0.6 && cleanText.length > 20) prob += 0.35;
    return prob;
  };

  let spamProb = 0.05;
  if (model) {
    try {
      const pred = await safePredict(model, [embedding], () => [fallbackSpamScore()]);
      spamProb = pred[0] !== undefined ? pred[0] : fallbackSpamScore();
    } catch {
      spamProb = fallbackSpamScore();
    }
  } else {
    spamProb = fallbackSpamScore();
  }

  // Boost if excessive links or all-caps
  if (urlCount >= 3) spamProb = Math.max(spamProb, 0.85);
  if (capsRatio > 0.8 && cleanText.length > 30) spamProb = Math.max(spamProb, 0.80);

  const isViolating = spamProb >= 0.75;
  let reason = "";
  if (isViolating) {
    reason = "Flagged by AI spam detector (high commercial or spam probability).";
  }

  return {
    isViolating,
    spamProbability: Math.min(1.0, Math.max(0.0, spamProb)),
    reason,
  };
};
