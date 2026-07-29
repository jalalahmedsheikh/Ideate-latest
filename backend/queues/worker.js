import { Worker } from "bullmq";
import redis, { setCached } from "../config/redis.js";
import { User } from "../models/user.model.js";
import { Post } from "../models/post.model.js";
import { Poll } from "../models/poll.model.js";
import { io } from "../socket/socket.js";
import nodemailer from "nodemailer";
import { computeScore } from "../controllers/TrendingPostsPolls.controller.js";
import { createAndPushNotification } from "../controllers/notification.controller.js";

// ─────────────────────────────────────────────────────────────
// 1. NOTIFICATION WORKER — persists to DB + pushes via socket
// ─────────────────────────────────────────────────────────────
const notificationWorker = new Worker(
  "notifications",
  async (job) => {
    const { type, userId, userDetails, postId, pollId, message, targetOwnerId } = job.data;
    await createAndPushNotification({
      io,
      recipientId:   targetOwnerId,
      senderId:      userId,
      senderDetails: userDetails,
      type,
      message,
      postId:  postId  || null,
      pollId:  pollId  || null,
    });
  },
  { connection: redis }
);

// ─────────────────────────────────────────────────────────────
// 2. FEED FAN-OUT WORKER
// ─────────────────────────────────────────────────────────────
const feedWorker = new Worker(
  "feeds",
  async (job) => {
    const { action, postId, pollId, authorId } = job.data;

    if (action === "createPost" || action === "createPoll") {
      const id   = postId || pollId;
      const type = postId ? "post" : "poll";

      // Push to global explore feed list
      const exploreItem = JSON.stringify({ id, type, createdAt: Date.now() });
      await redis.lpush("feed:explore:ids", exploreItem);
      await redis.ltrim("feed:explore:ids", 0, 499);

      // Fan-out to followers
      const author = await User.findById(authorId).select("followers").lean();
      if (author?.followers?.length > 0) {
        const pipeline = redis.pipeline();
        author.followers.forEach((followerId) => {
          const key = `feed:following:${followerId}:ids`;
          pipeline.lpush(key, id.toString());
          pipeline.ltrim(key, 0, 199);
        });
        await pipeline.exec();
      }

      // ── Real-time: push new item to all feed subscribers ──
      let newItem = null;
      if (type === "post") {
        newItem = await Post.findById(id)
          .populate({ path: "author", select: "username profileImage isverified" })
          .lean();
        if (newItem) newItem.feedType = "post";
      } else {
        newItem = await Poll.findById(id)
          .populate({ path: "author", select: "username profileImage isverified" })
          .lean();
        if (newItem) newItem.feedType = "poll";
      }
      if (newItem) {
        io.to("feed_subscribers").emit("feed:new_item", newItem);
      }

    } else if (action === "deletePost" || action === "deletePoll") {
      const id = postId || pollId;

      // Remove from explore feed list
      const items = await redis.lrange("feed:explore:ids", 0, -1);
      for (const item of items) {
        try {
          const parsed = JSON.parse(item);
          if (parsed.id === id.toString()) {
            await redis.lrem("feed:explore:ids", 0, item);
            break;
          }
        } catch (_) {}
      }

      // Remove from follower feeds
      const author = await User.findById(authorId).select("followers").lean();
      if (author?.followers?.length > 0) {
        const pipeline = redis.pipeline();
        author.followers.forEach((followerId) => {
          pipeline.lrem(`feed:following:${followerId}:ids`, 0, id.toString());
        });
        await pipeline.exec();
      }

      // Notify clients to remove item
      io.to("feed_subscribers").emit("feed:item_removed", { id, type: postId ? "post" : "poll" });
    }
  },
  { connection: redis }
);

// ─────────────────────────────────────────────────────────────
// 3. TRENDING RECALCULATION WORKER
//    Runs every 2 min (repeating job) + on-demand after events
// ─────────────────────────────────────────────────────────────
const trendingWorker = new Worker(
  "trending",
  async (job) => {
    console.log("🔄 Recalculating trending feed...");

    const restrictedUsers = await User.find({
      $or: [{ isBanned: true }, { isShadowBanned: true }],
    }).select("_id").lean();
    const restrictedIds = restrictedUsers.map((u) => u._id);

    const [posts, polls] = await Promise.all([
      Post.find({ author: { $nin: restrictedIds }, status: "active" })
        .sort({ createdAt: -1 })
        .limit(300)
        .populate({ path: "author", select: "username profileImage isverified" })
        .populate({
          path: "comments",
          options: { limit: 10 },
          populate: { path: "author", select: "username profileImage" },
        })
        .lean(),

      Poll.find({ author: { $nin: restrictedIds }, status: "open" })
        .sort({ createdAt: -1 })
        .limit(300)
        .populate({ path: "author", select: "username profileImage isverified" })
        .lean(),
    ]);

    const scoredPosts = posts.map((p) => ({ ...p, feedType: "post", score: computeScore(p, "post") }));
    const scoredPolls = polls.map((p) => ({ ...p, feedType: "poll", score: computeScore(p, "poll") }));

    const trendingContent = [...scoredPosts, ...scoredPolls]
      .sort((a, b) => b.score - a.score)
      .slice(0, 100);

    // Cache for 2 minutes (worker refreshes every 2 min so this stays fresh)
    await setCached("feed:trending", trendingContent, 120);
    console.log(`✅ Trending feed updated: ${trendingContent.length} items cached`);

    // Push lightweight update signal to all feed subscribers
    io.to("feed_subscribers").emit("feed:trending_updated", {
      updatedAt: Date.now(),
      itemCount: trendingContent.length,
    });
  },
  { connection: redis }
);

// ─────────────────────────────────────────────────────────────
// 4. EMAIL WORKER
// ─────────────────────────────────────────────────────────────
const emailWorker = new Worker(
  "emails",
  async (job) => {
    const { to, subject, text, html } = job.data;
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.warn(`[Email] Credentials missing — would send to: ${to}, subject: ${subject}`);
      return;
    }
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
    await transporter.sendMail({
      from: `"Ideate" <${process.env.EMAIL_USER}>`,
      to, subject, text, html,
    });
    console.log(`✅ Email sent to ${to}`);
  },
  { connection: redis }
);

// ─────────────────────────────────────────────────────────────
// ERROR HANDLING
// ─────────────────────────────────────────────────────────────
[notificationWorker, feedWorker, trendingWorker, emailWorker].forEach((worker) => {
  worker.on("failed", (job, err) => {
    console.error(`Worker job ${job?.id ?? "unknown"} failed:`, err.message);
  });
  worker.on("error", (err) => {
    console.error("Worker system error:", err.message);
  });
});

export default { notificationWorker, feedWorker, trendingWorker, emailWorker };
