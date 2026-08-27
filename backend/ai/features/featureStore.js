import { getCached, setCached, invalidateCached } from "../../config/redis.js";
import { buildUserInterestVector } from "./userFeatures.js";

const USER_VECTOR_TTL = 3600; // 1 hour cache

/**
 * Get or compute the user interest vector with Redis caching
 * @param {string} userId MongoDB User ID
 * @param {boolean} forceRefresh If true, bypass cache and recompute
 * @returns {Promise<Array<number>>} 64-dim interest vector
 */
export const getUserInterestVector = async (userId, forceRefresh = false) => {
  if (!userId) {
    return await buildUserInterestVector(null);
  }

  const cacheKey = `user:vector:${userId}`;

  if (!forceRefresh) {
    const cached = await getCached(cacheKey);
    if (cached && Array.isArray(cached) && cached.length === 64) {
      return cached;
    }
  }

  const vector = await buildUserInterestVector(userId);
  await setCached(cacheKey, vector, USER_VECTOR_TTL);
  return vector;
};

/**
 * Invalidate cached user interest vector (e.g. after like, save, or reset)
 */
export const invalidateUserVector = async (userId) => {
  if (!userId) return;
  const cacheKey = `user:vector:${userId}`;
  await invalidateCached(cacheKey);
};

/**
 * Reset recommendation profile and cached user interest vector
 */
export const resetUserRecommendations = async (userId) => {
  if (!userId) return;
  await invalidateUserVector(userId);
  await invalidateCached(`feed:foryou:${userId}:*`);
};
