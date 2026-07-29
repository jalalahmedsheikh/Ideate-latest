import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

console.log(`Connecting to Redis at: ${redisUrl}`);

const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: null, // Required for BullMQ compatibility
});

redis.on("connect", () => {
  console.log("Redis connected successfully");
});

redis.on("error", (err) => {
  console.error("Redis connection error:", err);
});

// Cache Helpers
export const getCached = async (key) => {
  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error(`Error reading from Redis key ${key}:`, error);
    return null;
  }
};

export const setCached = async (key, value, ttlSeconds = 3600) => {
  try {
    const dataString = JSON.stringify(value);
    if (ttlSeconds > 0) {
      await redis.set(key, dataString, "EX", ttlSeconds);
    } else {
      await redis.set(key, dataString);
    }
  } catch (error) {
    console.error(`Error setting Redis key ${key}:`, error);
  }
};

export const invalidateCached = async (key) => {
  try {
    await redis.del(key);
  } catch (error) {
    console.error(`Error invalidating Redis key ${key}:`, error);
  }
};

export const invalidateCachedPattern = async (pattern) => {
  try {
    let cursor = "0";
    do {
      const [newCursor, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = newCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== "0");
  } catch (error) {
    console.error(`Error invalidating Redis pattern ${pattern}:`, error);
  }
};

export default redis;
