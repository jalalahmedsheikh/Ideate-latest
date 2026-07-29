import { Queue } from "bullmq";
import redis from "../config/redis.js";

// Initialize BullMQ queues reusing the existing Redis connection
export const notificationQueue = new Queue("notifications", { connection: redis });
export const feedQueue         = new Queue("feeds",         { connection: redis });
export const trendingQueue     = new Queue("trending",      { connection: redis });
export const emailQueue        = new Queue("emails",        { connection: redis });

// ── Notification ──────────────────────────────────────────────
export const queueNotification = async (data) => {
  await notificationQueue.add("sendNotification", data, {
    removeOnComplete: true,
    removeOnFail: 100,
  });
};

// ── Feed fan-out ──────────────────────────────────────────────
export const queueFeedGeneration = async (data) => {
  await feedQueue.add("generateFeed", data, {
    removeOnComplete: true,
    removeOnFail: 100,
  });
};

// ── One-off trending recalculation (triggered on events) ──────
export const queueTrendingUpdate = async (data = {}) => {
  // Deduplicate: only one pending trending job at a time
  await trendingQueue.add("calculateTrending", data, {
    jobId: "trending-recalc",   // fixed ID = deduplication
    removeOnComplete: true,
    removeOnFail: 100,
  });
};

// ── Repeating trending recalculation (every 2 minutes) ────────
export const startRepeatingTrendingJob = async () => {
  // Remove any old repeating job with this key first to avoid duplicates on restart
  await trendingQueue.removeRepeatable("calculateTrending", { every: 2 * 60 * 1000 });

  await trendingQueue.add(
    "calculateTrending",
    { scheduled: true },
    {
      repeat: { every: 2 * 60 * 1000 }, // every 2 minutes
      removeOnComplete: 5,
      removeOnFail: 10,
    }
  );
  console.log("✅ Repeating trending job scheduled (every 2 min)");
};

// ── Email ─────────────────────────────────────────────────────
export const queueEmail = async (data) => {
  await emailQueue.add("sendEmail", data, {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: true,
    removeOnFail: 100,
  });
};
