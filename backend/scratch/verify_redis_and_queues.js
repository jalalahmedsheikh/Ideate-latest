import redis from "../config/redis.js";
import { notificationQueue, feedQueue } from "../queues/queue.js";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const runVerification = async () => {
  console.log("=== STARTING BACKEND VERIFICATION ===");

  // 1. Verify Redis Connection
  try {
    const pingResult = await redis.ping();
    console.log(`[PASS] Redis connection verified: PING -> ${pingResult}`);
  } catch (err) {
    console.error("[FAIL] Redis connection failed:", err.message);
    process.exit(1);
  }

  // 2. Verify Redis Cache Set/Get
  try {
    const testKey = "test:verification:key";
    const testValue = { status: "OK", timestamp: Date.now() };
    
    await redis.set(testKey, JSON.stringify(testValue), "EX", 10);
    const retrieved = await redis.get(testKey);
    const parsed = JSON.parse(retrieved);

    if (parsed.status === "OK") {
      console.log("[PASS] Redis set/get cache verified.");
    } else {
      throw new Error("Retrieved value does not match.");
    }
  } catch (err) {
    console.error("[FAIL] Redis cache operations failed:", err.message);
  }

  // 3. Verify BullMQ Queue Job Placement
  try {
    const job = await notificationQueue.add("testNotificationJob", {
      type: "test",
      userId: "test-user-id",
      message: "This is a verification notification",
      targetOwnerId: "test-owner-id"
    });
    console.log(`[PASS] BullMQ job queued successfully. Job ID: ${job.id}`);
  } catch (err) {
    console.error("[FAIL] BullMQ job queueing failed:", err.message);
  }

  // 4. Verify MongoDB Connection Configuration
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.warn("[WARN] MONGO_URI environment variable not found in .env");
    } else {
      console.log("[PASS] MONGO_URI found in configuration.");
    }
  } catch (err) {
    console.error("[FAIL] MongoDB configuration check failed:", err.message);
  }

  console.log("=== VERIFICATION COMPLETED ===");
  redis.disconnect();
  process.exit(0);
};

runVerification().catch(err => {
  console.error("Unhandled error during verification:", err);
  process.exit(1);
});
