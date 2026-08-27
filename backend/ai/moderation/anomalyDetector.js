import redis from "../../config/redis.js";

const WINDOW_SECONDS = 300; // 5 minute sliding window
const VELOCITY_THRESHOLDS = {
  like: 60, // >60 likes in 5 min
  follow: 30, // >30 follows in 5 min
  comment: 25, // >25 comments in 5 min
  post: 10, // >10 posts in 5 min
  vote: 40, // >40 poll votes in 5 min
};

/**
 * Records an interaction event and checks for anomalous velocity bursts
 * @param {string} userId User ID performing action
 * @param {string} actionType 'like' | 'follow' | 'comment' | 'post' | 'vote'
 * @returns {Promise<Object>} { isAnomalous: boolean, count: number, threshold: number, riskScore: number }
 */
export const trackAndDetectAnomaly = async (userId, actionType) => {
  if (!userId || !actionType) return { isAnomalous: false, riskScore: 0.0 };

  const threshold = VELOCITY_THRESHOLDS[actionType] || 50;
  const key = `velocity:${userId}:${actionType}`;

  try {
    if (redis && redis.status === "ready") {
      const currentCount = await redis.incr(key);
      if (currentCount === 1) {
        await redis.expire(key, WINDOW_SECONDS);
      }

      const ratio = currentCount / threshold;
      const isAnomalous = ratio >= 1.0;
      const riskScore = Math.min(ratio, 1.0);

      return {
        isAnomalous,
        count: currentCount,
        threshold,
        riskScore,
      };
    }
  } catch (err) {
    console.warn("⚠️ [anomalyDetector] Redis error:", err.message);
  }

  // Graceful fallback when redis is offline
  return { isAnomalous: false, count: 1, threshold, riskScore: 0.0 };
};
