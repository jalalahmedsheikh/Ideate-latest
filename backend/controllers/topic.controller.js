import { Topic } from "../models/topic.model.js";
import { User } from "../models/user.model.js";
import { Post } from "../models/post.model.js";
import { Poll } from "../models/poll.model.js";
import { getCached, setCached, invalidateCached } from "../config/redis.js";

// Helper: Normalize slug from topic name
const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w\-]+/g, "") // Remove all non-word chars
    .replace(/\-\-+/g, "-"); // Replace multiple - with single -
};

// ─── GET /topic/all ────────────────────────────────────────────────────────
export const getTopics = async (req, res) => {
  try {
    const { category, search, page = 1, limit = 30 } = req.query;
    const pageNum = Math.max(parseInt(page) || 1, 1);
    const limitNum = Math.min(parseInt(limit) || 30, 100);
    const skip = (pageNum - 1) * limitNum;

    const query = { status: "active" };

    if (category && category !== "All") {
      query.category = category;
    }

    if (search && search.trim().length > 0) {
      const searchRegex = new RegExp(search.trim(), "i");
      query.$or = [{ name: searchRegex }, { description: searchRegex }, { slug: searchRegex }];
    }

    const [topics, totalItems] = await Promise.all([
      Topic.find(query)
        .sort({ followerCount: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Topic.countDocuments(query),
    ]);

    // If authenticated, check which topics current user follows
    let followedTopicIds = new Set();
    if (req.id) {
      const user = await User.findById(req.id).select("followedTopics").lean();
      if (user && user.followedTopics) {
        followedTopicIds = new Set(user.followedTopics.map((id) => id.toString()));
      }
    }

    const formattedTopics = topics.map((t) => ({
      ...t,
      isFollowing: followedTopicIds.has(t._id.toString()),
    }));

    return res.status(200).json({
      success: true,
      topics: formattedTopics,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalItems,
        totalPages: Math.ceil(totalItems / limitNum),
      },
    });
  } catch (error) {
    console.error("Error in getTopics:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch topics." });
  }
};

// ─── GET /topic/by-slug/:slug ─────────────────────────────────────────────
export const getTopicBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const topic = await Topic.findOne({ slug: slug.toLowerCase() }).lean();

    if (!topic) {
      return res.status(404).json({ success: false, message: "Topic not found." });
    }

    let isFollowing = false;
    if (req.id) {
      const user = await User.findById(req.id).select("followedTopics").lean();
      if (user && user.followedTopics) {
        isFollowing = user.followedTopics.some((id) => id.toString() === topic._id.toString());
      }
    }

    // Refresh dynamic counts
    const [livePostCount, livePollCount] = await Promise.all([
      Post.countDocuments({ topics: topic._id, status: { $ne: "deleted" } }),
      Poll.countDocuments({ topics: topic._id, status: { $ne: "archived" } }),
    ]);

    return res.status(200).json({
      success: true,
      topic: {
        ...topic,
        postCount: livePostCount,
        pollCount: livePollCount,
        isFollowing,
      },
    });
  } catch (error) {
    console.error("Error in getTopicBySlug:", error);
    return res.status(500).json({ success: false, message: "Failed to retrieve topic." });
  }
};

// ─── POST /topic/:id/toggleFollow ─────────────────────────────────────────
export const toggleFollowTopic = async (req, res) => {
  try {
    const userId = req.id;
    const topicId = req.params.id;

    const [topic, user] = await Promise.all([
      Topic.findById(topicId),
      User.findById(userId),
    ]);

    if (!topic) {
      return res.status(404).json({ success: false, message: "Topic not found." });
    }
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const isFollowing = user.followedTopics && user.followedTopics.some((id) => id.toString() === topicId);

    if (isFollowing) {
      // Unfollow
      await User.findByIdAndUpdate(userId, { $pull: { followedTopics: topicId } });
      await Topic.findByIdAndUpdate(topicId, { $inc: { followerCount: -1 } });
    } else {
      // Follow
      await User.findByIdAndUpdate(userId, { $addToSet: { followedTopics: topicId } });
      await Topic.findByIdAndUpdate(topicId, { $inc: { followerCount: 1 } });
    }

    const updatedTopic = await Topic.findById(topicId).lean();

    return res.status(200).json({
      success: true,
      isFollowing: !isFollowing,
      followerCount: Math.max(updatedTopic.followerCount || 0, 0),
      message: isFollowing ? `Unfollowed #${topic.name}` : `Now following #${topic.name}`,
    });
  } catch (error) {
    console.error("Error in toggleFollowTopic:", error);
    return res.status(500).json({ success: false, message: "Failed to toggle topic follow." });
  }
};

// ─── GET /topic/:id/feed ──────────────────────────────────────────────────
export const getTopicFeed = async (req, res) => {
  try {
    const topicId = req.params.id;
    const { tab = "latest", page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(parseInt(page) || 1, 1);
    const limitNum = Math.min(parseInt(limit) || 20, 50);
    const skip = (pageNum - 1) * limitNum;

    const topic = await Topic.findById(topicId).lean();
    if (!topic) {
      return res.status(404).json({ success: false, message: "Topic not found." });
    }

    let blockedUserIds = [];
    if (req.id) {
      const user = await User.findById(req.id).select("blockedUsers mutedUsers").lean();
      if (user) {
        blockedUserIds = [
          ...(user.blockedUsers || []).map((id) => id.toString()),
          ...(user.mutedUsers || []).map((id) => id.toString()),
        ];
      }
    }

    const basePostFilter = {
      topics: topic._id,
      status: { $ne: "deleted" },
      ...(blockedUserIds.length > 0 ? { author: { $nin: blockedUserIds } } : {}),
    };

    const basePollFilter = {
      topics: topic._id,
      status: { $ne: "archived" },
      ...(blockedUserIds.length > 0 ? { author: { $nin: blockedUserIds } } : {}),
    };

    if (tab === "polls") {
      const polls = await Poll.find(basePollFilter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate("author", "username profileImage isverified")
        .lean();

      const totalItems = await Poll.countDocuments(basePollFilter);

      return res.status(200).json({
        success: true,
        topic,
        items: polls.map((p) => ({ ...p, feedType: "poll" })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          totalItems,
          totalPages: Math.ceil(totalItems / limitNum),
        },
      });
    }

    // Fetch posts and polls
    const [posts, polls] = await Promise.all([
      Post.find(basePostFilter)
        .sort(tab === "top" ? { "likes.length": -1, createdAt: -1 } : { createdAt: -1 })
        .limit(50)
        .populate("author", "username profileImage isverified")
        .populate({
          path: "comments",
          options: { limit: 5 },
          populate: { path: "author", select: "username profileImage isverified" },
        })
        .lean(),
      Poll.find(basePollFilter)
        .sort({ createdAt: -1 })
        .limit(50)
        .populate("author", "username profileImage isverified")
        .lean(),
    ]);

    const formattedPosts = posts.map((p) => ({ ...p, feedType: "post" }));
    const formattedPolls = polls.map((p) => ({ ...p, feedType: "poll" }));

    let combined = [...formattedPosts, ...formattedPolls];

    if (tab === "top") {
      combined.sort((a, b) => {
        const aScore = (a.likes ? a.likes.length : 0) + (a.votes ? a.votes.reduce((acc, v) => acc + v, 0) : 0);
        const bScore = (b.likes ? b.likes.length : 0) + (b.votes ? b.votes.reduce((acc, v) => acc + v, 0) : 0);
        return bScore - aScore;
      });
    } else {
      combined.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    const paginatedItems = combined.slice(skip, skip + limitNum);

    return res.status(200).json({
      success: true,
      topic,
      items: paginatedItems,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalItems: combined.length,
        totalPages: Math.ceil(combined.length / limitNum),
      },
    });
  } catch (error) {
    console.error("Error in getTopicFeed:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch topic feed." });
  }
};

// ─── GET /topic/suggestions ───────────────────────────────────────────────
export const getSuggestedTopics = async (req, res) => {
  try {
    const userId = req.id;
    let followedTopicIds = [];

    if (userId) {
      const user = await User.findById(userId).select("followedTopics").lean();
      if (user && user.followedTopics) {
        followedTopicIds = user.followedTopics;
      }
    }

    // Return popular active topics user does not yet follow
    const topics = await Topic.find({
      status: "active",
      _id: { $nin: followedTopicIds },
    })
      .sort({ followerCount: -1, postCount: -1 })
      .limit(10)
      .lean();

    return res.status(200).json({
      success: true,
      topics: topics.map((t) => ({ ...t, isFollowing: false })),
    });
  } catch (error) {
    console.error("Error in getSuggestedTopics:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch suggested topics." });
  }
};

// ─── POST /topic/create ───────────────────────────────────────────────────
export const createTopic = async (req, res) => {
  try {
    const { name, description, icon, category } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ success: false, message: "Topic name is required." });
    }

    const slug = slugify(name);
    const existing = await Topic.findOne({ slug });
    if (existing) {
      return res.status(400).json({ success: false, message: "Topic already exists." });
    }

    const topic = await Topic.create({
      name: name.trim(),
      slug,
      description: description ? description.trim() : "",
      icon: icon || "💡",
      category: category ? category.trim() : "General",
      createdBy: req.id || null,
    });

    return res.status(201).json({
      success: true,
      topic,
      message: "Topic created successfully.",
    });
  } catch (error) {
    console.error("Error in createTopic:", error);
    return res.status(500).json({ success: false, message: "Failed to create topic." });
  }
};
