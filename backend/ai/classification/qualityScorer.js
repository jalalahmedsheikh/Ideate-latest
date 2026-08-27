/**
 * Computes a deterministic quality score [0.0 to 1.0] for a content item.
 * @param {Object} item Post or Poll document
 * @param {string} type 'post' | 'poll'
 * @returns {number} Quality score between 0.0 and 1.0
 */
export const computeQualityScore = (item, type = "post") => {
  if (!item) return 0.5;

  let score = 0.5; // Baseline neutral score

  // 1. Text Length & Form Factor
  const text = type === "post" ? item.caption || "" : item.question || "";
  const length = text.trim().length;

  if (length >= 30 && length <= 600) {
    score += 0.15; // Optimal thought length
  } else if (length < 10) {
    score -= 0.15; // Low-effort / too brief
  }

  // 2. Structured Metadata
  if (item.topics && item.topics.length > 0) {
    score += 0.10; // Categorized with structured topics
  }

  if (type === "poll" && item.options && item.options.length >= 2) {
    score += 0.10; // Well-formed discussion poll
  }

  // 3. Author Trust Signals
  const author = item.author || {};
  if (author.isverified) {
    score += 0.15;
  }
  if (author.isShadowBanned || author.isBanned) {
    score -= 0.40;
  }

  // 4. Engagement Depth (Meaningful discussions vs raw clicks)
  const commentCount = item.comments ? item.comments.length : 0;
  const likeCount = item.likes ? item.likes.length : 0;
  const shareCount = item.shareCount || 0;

  if (commentCount > 0) {
    const discussionRatio = commentCount / (likeCount + 1);
    if (discussionRatio > 0.1) {
      score += 0.10; // Genuine discussion-sparking content
    }
  }

  if (shareCount > 0) {
    score += 0.05;
  }

  return Math.max(0.0, Math.min(1.0, score));
};
