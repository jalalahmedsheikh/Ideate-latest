import redis from "../config/redis.js";

/**
 * Custom Redis-based rate limiting middleware.
 * 
 * @param {Object} options Configuration options
 * @param {number} options.windowMs Time window in milliseconds (default: 1 minute)
 * @param {number} options.max Maximum number of requests allowed within the window (default: 60)
 * @param {string} options.message Error message returned when rate limit is exceeded
 * @returns {Function} Express middleware
 */
export const rateLimiter = ({
  windowMs = 60 * 1000,
  max = 60,
  message = "Too many requests from this IP, please try again later."
} = {}) => {
  return async (req, res, next) => {
    try {
      // Use authenticated user ID if present, otherwise fallback to IP address
      const identifier = req.id || req.ip;
      const key = `ratelimit:${identifier}:${req.baseUrl + req.path}`;

      const multi = redis.multi();
      multi.incr(key);
      multi.ttl(key);
      
      const results = await multi.exec();
      const currentCount = results[0][1];
      const ttl = results[1][1];

      // If key is newly created or has no TTL, set the expiration
      if (currentCount === 1 || ttl === -1) {
        await redis.expire(key, Math.ceil(windowMs / 1000));
      }

      res.setHeader("X-RateLimit-Limit", max);
      res.setHeader("X-RateLimit-Remaining", Math.max(0, max - currentCount));

      if (currentCount > max) {
        return res.status(429).json({
          success: false,
          message
        });
      }

      next();
    } catch (error) {
      console.error("Rate limiter error:", error);
      // Fallback: allow request in case of Redis failure to prevent service disruption
      next();
    }
  };
};

export default rateLimiter;
