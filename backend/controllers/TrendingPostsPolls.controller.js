import { Post } from "../models/post.model.js";
import { User } from "../models/user.model.js";
import { Poll } from "../models/poll.model.js";
import redis, { getCached, setCached } from "../config/redis.js";
import { queueTrendingUpdate } from "../queues/queue.js";

// ─────────────────────────────────────────────────────────────
// VIRAL SCORING ENGINE
// score = (likes×2) + (comments×3) + (votes×4)
//       + recencyBoost + velocityFactor
// ─────────────────────────────────────────────────────────────
const HOUR_MS = 3600 * 1000;

export const computeScore = (item, type) => {
  const now = Date.now();
  const ageMs = now - new Date(item.createdAt).getTime();
  const ageHours = Math.max(ageMs / HOUR_MS, 0.01); // avoid divide-by-zero

  let engagements = 0;
  if (type === "post") {
    const likes    = item.likes?.length ?? 0;
    const comments = item.comments?.length ?? 0;
    const shares   = item.shareCount ?? 0;
    const views    = item.views ?? 0;
    engagements = likes * 2 + comments * 3 + shares * 4 + views * 0.1;
  } else {
    const votes    = item.votesHistory?.length ?? 0;
    engagements = votes * 4;
  }

  // Recency boost — temporary boost for fresh content
  let recencyBoost = 0;
  if (ageMs < 1 * HOUR_MS)  recencyBoost = 50;
  else if (ageMs < 6 * HOUR_MS)  recencyBoost = 20;
  else if (ageMs < 24 * HOUR_MS) recencyBoost = 5;

  // Velocity factor — reward fast-rising content
  const velocity = ageHours > 0 ? engagements / ageHours : 0;

  // Time decay — content older than 7 days approaches 0
  const decayFactor = Math.exp(-0.00001 * ageMs);

  return (engagements + recencyBoost + velocity) * decayFactor;
};

// ─────────────────────────────────────────────────────────────
// SHARED QUERY HELPERS
// ─────────────────────────────────────────────────────────────
const getRestrictedUserIds = async () => {
  const restricted = await User.find({
    $or: [{ isBanned: true }, { isShadowBanned: true }],
  }).select("_id").lean();
  return restricted.map((u) => u._id);
};

const fetchAndScorePosts = async (restrictedIds) => {
  const posts = await Post.find({
    author: { $nin: restrictedIds },
    status: "active",
  })
    .sort({ createdAt: -1 })
    .limit(200)
    .populate({ path: "author", select: "username profileImage isverified" })
    .populate({
      path: "comments",
      options: { limit: 10 },
      populate: { path: "author", select: "username profileImage" },
    })
    .lean();

  return posts.map((p) => ({
    ...p,
    feedType: "post",
    score: computeScore(p, "post"),
  }));
};

const fetchAndScorePolls = async (restrictedIds) => {
  const polls = await Poll.find({
    author: { $nin: restrictedIds },
    status: "open",
  })
    .sort({ createdAt: -1 })
    .limit(200)
    .populate({ path: "author", select: "username profileImage isverified" })
    .lean();

  return polls.map((p) => ({
    ...p,
    feedType: "poll",
    score: computeScore(p, "poll"),
  }));
};

// ─────────────────────────────────────────────────────────────
// MAIN FEED HANDLER
// GET /feed/trending-posts-polls?page=1&limit=20
// ─────────────────────────────────────────────────────────────
export const getTrendingPostsPolls = async (req, res) => {
  try {
    const userId = req.id;
    const page   = Math.max(parseInt(req.query.page)  || 1, 1);
    const limit  = Math.min(parseInt(req.query.limit) || 20, 50);
    const skip   = (page - 1) * limit;

    let allItems = [];

    // ── Step 1: Try Redis cache ───────────────────────────────
    const cachedFeed = await getCached("feed:trending");
    if (cachedFeed && cachedFeed.length > 0) {
      allItems = cachedFeed;
    } else {
      // ── Step 2: Fallback — query DB and score ──────────────
      const restrictedIds = await getRestrictedUserIds();
      const [scoredPosts, scoredPolls] = await Promise.all([
        fetchAndScorePosts(restrictedIds),
        fetchAndScorePolls(restrictedIds),
      ]);

      allItems = [...scoredPosts, ...scoredPolls].sort(
        (a, b) => b.score - a.score
      );

      // ── Step 3: Cache result for 2 minutes ────────────────
      await setCached("feed:trending", allItems, 120);

      // ── Step 4: Trigger background recalculation ──────────
      queueTrendingUpdate({}).catch(() => {});
    }

    // ── Step 5: Personalized filtering ──────────────────────
    if (userId) {
      const user = await User.findById(userId)
        .select("blockedUsers mutedUsers followings")
        .lean();

      if (user) {
        const blockedAndMuted = new Set([
          ...user.blockedUsers.map((id) => id.toString()),
          ...user.mutedUsers.map((id) => id.toString()),
        ]);

        allItems = allItems.filter((item) => {
          const authorId = item.author?._id?.toString();
          if (!authorId) return false;
          if (blockedAndMuted.has(authorId)) return false;
          return true;
        });
      }
    }

    // ── Step 6: Interleave posts and polls for mixed feed ────
    // Pattern: post, poll, post, post, poll, post…
    const posts = allItems.filter((i) => i.feedType === "post");
    const polls = allItems.filter((i) => i.feedType === "poll");
    const mixed = [];
    let pi = 0, li = 0;
    while (pi < posts.length || li < polls.length) {
      if (pi < posts.length) mixed.push(posts[pi++]);
      if (pi < posts.length) mixed.push(posts[pi++]);
      if (li < polls.length) mixed.push(polls[li++]);
    }

    // ── Step 7: Paginate ─────────────────────────────────────
    const paginatedItems = mixed.slice(skip, skip + limit);
    const totalItems = mixed.length;
    const totalPages = Math.ceil(totalItems / limit);

    return res.status(200).json({
      success: true,
      feed: paginatedItems,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching feed:", error);
    return res.status(500).json({ success: false, error: "Error fetching feed" });
  }
};
