import { Queue } from "bullmq";
import redis from "../config/redis.js";

// Initialize BullMQ queues reusing the existing Redis connection
export const notificationQueue = new Queue("notifications", { connection: redis });
export const feedQueue         = new Queue("feeds",         { connection: redis });
export const trendingQueue     = new Queue("trending",      { connection: redis });
export const emailQueue        = new Queue("emails",        { connection: redis });
export const mlQueue           = new Queue("ml_tasks",      { connection: redis });

[notificationQueue, feedQueue, trendingQueue, emailQueue, mlQueue].forEach((queue) => {
  queue.on("error", () => {
    // Error listener attached to prevent unhandled EventEmitter console spam when Redis is offline
  });
});

// ── Notification ──────────────────────────────────────────────
export const queueNotification = async (data) => {
  try {
    await notificationQueue.add("sendNotification", data, {
      removeOnComplete: true,
      removeOnFail: 100,
    });
  } catch (err) {
    console.warn("⚠️ [queueNotification] Redis offline or queue error:", err.message);
  }
};

// ── Feed fan-out ──────────────────────────────────────────────
export const queueFeedGeneration = async (data) => {
  try {
    await feedQueue.add("generateFeed", data, {
      removeOnComplete: true,
      removeOnFail: 100,
    });
  } catch (err) {
    console.warn("⚠️ [queueFeedGeneration] Redis offline or queue error:", err.message);
  }
};

// ── One-off trending recalculation (triggered on events) ──────
export const queueTrendingUpdate = async (data = {}) => {
  try {
    // Deduplicate: only one pending trending job at a time
    await trendingQueue.add("calculateTrending", data, {
      jobId: "trending-recalc",   // fixed ID = deduplication
      removeOnComplete: true,
      removeOnFail: 100,
    });
  } catch (err) {
    console.warn("⚠️ [queueTrendingUpdate] Redis offline or queue error:", err.message);
  }
};

// ── Repeating trending recalculation (every 2 minutes) ────────
export const startRepeatingTrendingJob = async () => {
  try {
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
  } catch (err) {
    console.warn("⚠️ Could not schedule repeating trending job (Redis may be offline):", err.message);
  }
};

// ── Background ML User Vector Recalculation ───────────────────
export const queueUserVectorUpdate = async (userId) => {
  try {
    await mlQueue.add(
      "updateUserVector",
      { userId },
      {
        jobId: `user-vector-${userId}`,
        removeOnComplete: true,
        removeOnFail: 50,
      }
    );
  } catch (err) {
    console.warn("⚠️ [queueUserVectorUpdate] Redis offline or queue error:", err.message);
  }
};

// ── Email ─────────────────────────────────────────────────────
export const queueEmail = async (data) => {
  try {
    await emailQueue.add("sendEmail", data, {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: true,
      removeOnFail: 100,
    });
  } catch (err) {
    console.warn("⚠️ [queueEmail] Redis offline or queue error:", err.message);
  }
};
