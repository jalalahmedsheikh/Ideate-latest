import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import dotenvLib from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenvLib.config({ path: path.join(__dirname, "..", ".env") });

import { Poll } from "../models/poll.model.js";
import { User } from "../models/user.model.js";
import redis from "../config/redis.js";

async function migrate() {
  try {
    const mongoUri = process.env.MONGO_URI;
    console.log("Connecting to MongoDB:", mongoUri);
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB!");

    // Default user ID for Jalal Ahmed (ahmed)
    const defaultUserId = "677847e912c2ac4d31860a7c";
    const defaultUser = await User.findById(defaultUserId);
    if (!defaultUser) {
      console.error("Default user not found in database!");
      process.exit(1);
    }
    console.log(`Default user found: ${defaultUser.username} (${defaultUser._id})`);

    // Find polls with null / undefined author
    const orphanedPolls = await Poll.find({
      $or: [
        { author: null },
        { author: { $exists: false } }
      ]
    });

    console.log(`Found ${orphanedPolls.length} orphaned polls (author is null/missing).`);

    if (orphanedPolls.length > 0) {
      const pollIds = orphanedPolls.map(p => p._id);
      console.log("Migrating polls:", pollIds);

      // Update polls to set default user as author
      const updateResult = await Poll.updateMany(
        { _id: { $in: pollIds } },
        { $set: { author: defaultUserId } }
      );
      console.log(`Updated ${updateResult.modifiedCount} polls successfully!`);

      // Add these poll IDs to the user's polls array if not already present
      let updatedUserPolls = false;
      pollIds.forEach(id => {
        if (!defaultUser.polls.some(pId => pId.toString() === id.toString())) {
          defaultUser.polls.push(id);
          updatedUserPolls = true;
        }
      });
      if (updatedUserPolls) {
        await defaultUser.save();
        console.log("Updated default user's polls association array!");
      }
    }

    // Now clear Redis caches to ensure fresh data loads
    console.log("Clearing relevant Redis caches...");
    const keysToDelete = [
      "polls:all",
      "feed:trending",
      `user:polls:${defaultUserId}`,
      `user:profile:${defaultUserId}`
    ];

    // Also scan for and delete explore feed lists
    const exploreKeys = await redis.keys("feed:explore:*");
    const followingKeys = await redis.keys("feed:following:*");
    const allKeysToDelete = [...keysToDelete, ...exploreKeys, ...followingKeys];

    console.log("Keys to delete from Redis:", allKeysToDelete);
    if (allKeysToDelete.length > 0) {
      const deletedCount = await redis.del(...allKeysToDelete);
      console.log(`Deleted ${deletedCount} cache keys from Redis Cloud!`);
    } else {
      console.log("No Redis cache keys found to delete.");
    }

    console.log("Migration and cache clear complete!");
  } catch (error) {
    console.error("Migration error:", error);
  } finally {
    await mongoose.disconnect();
    await redis.quit();
    console.log("Disconnected from MongoDB and Redis.");
  }
}

migrate();
