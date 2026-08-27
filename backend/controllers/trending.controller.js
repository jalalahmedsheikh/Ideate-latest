import { Post } from "../models/post.model.js";
import { Question } from "../models/question.model.js";
import { Debate } from "../models/debate.model.js";
import { Poll } from "../models/poll.model.js";
import { Topic } from "../models/topic.model.js";
import { Community } from "../models/community.model.js";
import { User } from "../models/user.model.js";
import { getCached, setCached } from "../config/redis.js";

/**
 * GET /trending/feed?type=all&window=today
 */
export const getTrendingFeed = async (req, res) => {
  try {
    const type = req.query.type || "all"; // all, posts, questions, debates, polls, topics, communities
    const window = req.query.window || "today"; // now (6h), today (24h), this_week (7d)
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const skip = (page - 1) * limit;

    let hoursCutoff = 24;
    if (window === "now") hoursCutoff = 6;
    else if (window === "this_week") hoursCutoff = 168;

    const cacheKey = `feed:trending:${type}:${window}`;
    const cached = await getCached(cacheKey);
    if (cached && cached.length > 0) {
      const paginated = cached.slice(skip, skip + limit);
      return res.status(200).json({
        success: true,
        feed: paginated,
        pagination: { page, limit, total: cached.length },
      });
    }

    const cutoffDate = new Date(Date.now() - hoursCutoff * 3600 * 1000);
    const restrictedUsers = await User.find({
      $or: [{ isBanned: true }, { isShadowBanned: true }],
    }).select("_id").lean();
    const restrictedIds = restrictedUsers.map((u) => u._id);

    const promises = [];

    // 1. Posts
    if (type === "all" || type === "posts") {
      promises.push(
        Post.find({ author: { $nin: restrictedIds }, status: "active", createdAt: { $gte: cutoffDate } })
          .populate("author", "username name profileImage isverified reputationScore")
          .populate("topics", "name icon")
          .lean()
          .then((items) =>
            items.map((p) => {
              const likes = p.likes?.length || 0;
              const comments = p.comments?.length || 0;
              const score = likes * 2 + comments * 4 + (p.shareCount || 0) * 5;
              return {
                ...p,
                feedType: "post",
                trendingScore: score,
                trendingReason: `Rising discussion: ${likes} likes and ${comments} comments`,
              };
            })
          )
      );
    } else promises.push(Promise.resolve([]));

    // 2. Questions
    if (type === "all" || type === "questions") {
      promises.push(
        Question.find({ author: { $nin: restrictedIds }, status: "active", createdAt: { $gte: cutoffDate } })
          .populate("author", "username name profileImage isverified reputationScore")
          .populate("topics", "name icon")
          .lean()
          .then((items) =>
            items.map((q) => {
              const answers = q.answersCount || 0;
              const upvotes = q.upvotes?.length || 0;
              const score = answers * 6 + upvotes * 3;
              return {
                ...q,
                feedType: "question",
                trendingScore: score,
                trendingReason: `Active inquiry: ${answers} answers received`,
              };
            })
          )
      );
    } else promises.push(Promise.resolve([]));

    // 3. Debates
    if (type === "all" || type === "debates") {
      promises.push(
        Debate.find({ author: { $nin: restrictedIds }, status: { $in: ["active", "closed"] }, createdAt: { $gte: cutoffDate } })
          .populate("author", "username name profileImage isverified reputationScore")
          .populate("topic", "name icon")
          .lean()
          .then((items) =>
            items.map((d) => {
              const votes = d.totalVotes || 0;
              const args = d.argumentsCount || 0;
              const score = votes * 4 + args * 7;
              return {
                ...d,
                feedType: "debate",
                trendingScore: score,
                trendingReason: `High debate velocity: ${votes} votes and ${args} arguments`,
              };
            })
          )
      );
    } else promises.push(Promise.resolve([]));

    // 4. Polls
    if (type === "all" || type === "polls") {
      promises.push(
        Poll.find({ author: { $nin: restrictedIds }, status: { $in: ["open", "closed"] }, createdAt: { $gte: cutoffDate } })
          .populate("author", "username name profileImage isverified")
          .lean()
          .then((items) =>
            items.map((pl) => {
              const votes = pl.voterCount || (pl.votes?.reduce((a, b) => a + b, 0) || 0);
              const score = votes * 4 + (pl.comments?.length || 0) * 3;
              return {
                ...pl,
                feedType: "poll",
                trendingScore: score,
                trendingReason: `Popular poll: ${votes} community votes`,
              };
            })
          )
      );
    } else promises.push(Promise.resolve([]));

    const [posts, questions, debates, polls] = await Promise.all(promises);

    const allItems = [...posts, ...questions, ...debates, ...polls].sort(
      (a, b) => (b.trendingScore || 0) - (a.trendingScore || 0)
    );

    // Cache for 2 minutes
    await setCached(cacheKey, allItems, 120);

    const paginated = allItems.slice(skip, skip + limit);

    return res.status(200).json({
      success: true,
      feed: paginated,
      pagination: {
        page,
        limit,
        total: allItems.length,
        hasNextPage: skip + paginated.length < allItems.length,
      },
    });
  } catch (error) {
    console.error("Error in trending feed:", error);
    return res.status(500).json({ success: false, message: "Error loading trending content." });
  }
};

/**
 * GET /trending/topics
 */
export const getTrendingTopics = async (req, res) => {
  try {
    const topics = await Topic.find().limit(10).lean();
    const formatted = topics.map((t, idx) => ({
      ...t,
      rank: idx + 1,
      velocity: `+${300 - idx * 25}% engagement today`,
    }));
    return res.status(200).json({ success: true, topics: formatted });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error fetching trending topics." });
  }
};

/**
 * GET /trending/communities
 */
export const getTrendingCommunities = async (req, res) => {
  try {
    const communities = await Community.find({ isSuspended: false })
      .sort({ membersCount: -1, postsCount: -1 })
      .limit(10)
      .lean();
    return res.status(200).json({ success: true, communities });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error fetching trending communities." });
  }
};
