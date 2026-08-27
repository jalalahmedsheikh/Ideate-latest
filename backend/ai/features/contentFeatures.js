import { embedText, EMBEDDING_DIM } from "../embeddings/textEmbedder.js";

const HOUR_MS = 3600 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * Extracts comprehensive content features (embedding + statistical metrics)
 * @param {Object} item Post or Poll MongoDB document
 * @param {string} type 'post' | 'poll'
 * @returns {Object} { embedding: number[], stats: number[], fullVector: number[] }
 */
export const extractContentFeatures = (item, type = "post") => {
  if (!item) {
    return {
      embedding: new Array(EMBEDDING_DIM).fill(0),
      stats: new Array(16).fill(0),
      fullVector: new Array(EMBEDDING_DIM + 16).fill(0),
    };
  }

  // 1. Text Representation
  let text = "";
  if (type === "post") {
    text = `${item.caption || ""} ${item.location || ""}`;
  } else {
    const optionTexts = (item.options || []).map((o) => (typeof o === "string" ? o : o.text || "")).join(" ");
    text = `${item.question || ""} ${item.description || ""} ${optionTexts}`;
  }

  // Include topic names if populated
  if (item.topics && Array.isArray(item.topics)) {
    const topicNames = item.topics
      .map((t) => (typeof t === "object" ? t.name || t.slug : t))
      .filter(Boolean)
      .join(" ");
    text += ` ${topicNames}`;
  }

  const embedding = embedText(text);

  // 2. Temporal & Velocity Metrics
  const createdAt = item.createdAt ? new Date(item.createdAt).getTime() : Date.now();
  const ageMs = Math.max(Date.now() - createdAt, 0);
  const ageHours = Math.max(ageMs / HOUR_MS, 0.1);
  const ageDays = ageMs / DAY_MS;

  // Freshness score: half-life of 3 days
  const freshnessScore = Math.exp(-0.231 * ageDays); // e^(-ln(2)/3 * days)

  // Engagement Counts
  const likeCount = item.likes ? item.likes.length : 0;
  const commentCount = item.comments ? item.comments.length : 0;
  const shareCount = item.shareCount || 0;
  const pollVoteCount = item.votesHistory ? item.votesHistory.length : 0;

  const totalInteractions = likeCount + commentCount * 2 + shareCount * 3 + pollVoteCount;
  const engagementVelocity = Math.min(totalInteractions / ageHours, 50) / 50;

  // Author signals
  const author = item.author || {};
  const authorFollowers = author.followers ? author.followers.length : 0;
  const authorVerified = author.isverified ? 1.0 : 0.0;

  const now = new Date();
  const hourOfDay = now.getHours() / 24.0;
  const dayOfWeek = now.getDay() / 7.0;

  const stats = [
    freshnessScore, // 0: Freshness
    Math.min(Math.log10(1 + likeCount) / 5.0, 1.0), // 1: Likes
    Math.min(Math.log10(1 + commentCount) / 4.0, 1.0), // 2: Comments
    Math.min(Math.log10(1 + shareCount) / 3.0, 1.0), // 3: Shares
    Math.min(Math.log10(1 + pollVoteCount) / 5.0, 1.0), // 4: Poll Votes
    engagementVelocity, // 5: Velocity
    item.image ? 1.0 : 0.0, // 6: Has Image
    type === "post" ? 1.0 : 0.0, // 7: Content Type (1=post, 0=poll)
    Math.min(Math.log10(1 + authorFollowers) / 6.0, 1.0), // 8: Author followers
    authorVerified, // 9: Author verified
    item.topics && item.topics.length > 0 ? 1.0 : 0.0, // 10: Has Topics
    Math.min((item.topics?.length || 0) / 5.0, 1.0), // 11: Number of topics
    Math.min(text.length / 500.0, 1.0), // 12: Text length
    hourOfDay, // 13: Hour of day
    dayOfWeek, // 14: Day of week
    authorVerified || authorFollowers > 100 ? 1.0 : 0.0, // 15: Established creator
  ];

  return {
    embedding,
    stats,
    fullVector: [...embedding, ...stats],
  };
};
