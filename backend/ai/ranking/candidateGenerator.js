import { Post } from "../../models/post.model.js";
import { Poll } from "../../models/poll.model.js";
import { User } from "../../models/user.model.js";

/**
 * Gathers candidate Posts and Polls across multiple channels.
 * @param {string} userId Current authenticated user ID (or null for guests)
 * @param {Object} options Configuration options (limit, excludeIds)
 * @returns {Promise<Array<Object>>} Array of candidate items with metadata
 */
export const generateCandidates = async (userId, options = {}) => {
  const { limit = 150, excludeIds = [] } = options;

  let followedTopicIds = [];
  let followingUserIds = [];
  let blockedAndMutedIds = [];

  if (userId) {
    const user = await User.findById(userId)
      .select("followedTopics followings blockedUsers mutedUsers")
      .lean();

    if (user) {
      followedTopicIds = (user.followedTopics || []).map((id) => id.toString());
      followingUserIds = (user.followings || []).map((id) => id.toString());
      blockedAndMutedIds = [
        ...(user.blockedUsers || []).map((id) => id.toString()),
        ...(user.mutedUsers || []).map((id) => id.toString()),
      ];
    }
  }

  // Get globally restricted accounts (banned/shadowbanned)
  const restrictedUsers = await User.find({
    $or: [{ isBanned: true }, { isShadowBanned: true }],
  })
    .select("_id")
    .lean();

  const allExcludedUserIds = new Set([
    ...blockedAndMutedIds,
    ...restrictedUsers.map((u) => u._id.toString()),
  ]);

  if (userId) {
    allExcludedUserIds.add(userId.toString()); // Exclude self from home recommendation feed
  }

  const baseExcludedList = Array.from(allExcludedUserIds);

  // 1. Channel A: Followed Users (Fresh content from people you follow)
  let followPosts = [];
  let followPolls = [];
  if (followingUserIds.length > 0) {
    [followPosts, followPolls] = await Promise.all([
      Post.find({
        author: { $in: followingUserIds },
        status: "active",
        _id: { $nin: excludeIds },
      })
        .sort({ createdAt: -1 })
        .limit(40)
        .populate("author", "username profileImage isverified")
        .populate("topics", "name slug category")
        .lean(),
      Poll.find({
        author: { $in: followingUserIds },
        status: "open",
        _id: { $nin: excludeIds },
      })
        .sort({ createdAt: -1 })
        .limit(30)
        .populate("author", "username profileImage isverified")
        .populate("topics", "name slug category")
        .lean(),
    ]);
  }

  // 2. Channel B: Followed Topics (Content from topics you follow)
  let topicPosts = [];
  let topicPolls = [];
  if (followedTopicIds.length > 0) {
    [topicPosts, topicPolls] = await Promise.all([
      Post.find({
        topics: { $in: followedTopicIds },
        author: { $nin: baseExcludedList },
        status: "active",
        _id: { $nin: excludeIds },
      })
        .sort({ createdAt: -1 })
        .limit(50)
        .populate("author", "username profileImage isverified")
        .populate("topics", "name slug category")
        .lean(),
      Poll.find({
        topics: { $in: followedTopicIds },
        author: { $nin: baseExcludedList },
        status: "open",
        _id: { $nin: excludeIds },
      })
        .sort({ createdAt: -1 })
        .limit(40)
        .populate("author", "username profileImage isverified")
        .populate("topics", "name slug category")
        .lean(),
    ]);
  }

  // 3. Channel C: Popular / Trending Content
  const [trendingPosts, trendingPolls] = await Promise.all([
    Post.find({
      author: { $nin: baseExcludedList },
      status: "active",
      _id: { $nin: excludeIds },
    })
      .sort({ "likes.length": -1, createdAt: -1 })
      .limit(40)
      .populate("author", "username profileImage isverified")
      .populate("topics", "name slug category")
      .lean(),
    Poll.find({
      author: { $nin: baseExcludedList },
      status: "open",
      _id: { $nin: excludeIds },
    })
      .sort({ "votesHistory.length": -1, createdAt: -1 })
      .limit(30)
      .populate("author", "username profileImage isverified")
      .populate("topics", "name slug category")
      .lean(),
  ]);

  // 4. Channel D: Exploration / New Content (Fairness for new creators & fresh ideas)
  const [freshPosts, freshPolls] = await Promise.all([
    Post.find({
      author: { $nin: baseExcludedList },
      status: "active",
      createdAt: { $gte: new Date(Date.now() - 48 * 3600 * 1000) },
      _id: { $nin: excludeIds },
    })
      .sort({ createdAt: -1 })
      .limit(30)
      .populate("author", "username profileImage isverified")
      .populate("topics", "name slug category")
      .lean(),
    Poll.find({
      author: { $nin: baseExcludedList },
      status: "open",
      createdAt: { $gte: new Date(Date.now() - 48 * 3600 * 1000) },
      _id: { $nin: excludeIds },
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate("author", "username profileImage isverified")
      .populate("topics", "name slug category")
      .lean(),
  ]);

  // Deduplicate candidates by ID
  const candidateMap = new Map();

  const addItems = (items, feedType, channel) => {
    for (const item of items) {
      const id = item._id.toString();
      if (!candidateMap.has(id)) {
        candidateMap.set(id, {
          ...item,
          feedType,
          candidateChannel: channel,
        });
      }
    }
  };

  addItems(followPosts, "post", "followed_users");
  addItems(followPolls, "poll", "followed_users");
  addItems(topicPosts, "post", "followed_topics");
  addItems(topicPolls, "poll", "followed_topics");
  addItems(trendingPosts, "post", "trending");
  addItems(trendingPolls, "poll", "trending");
  addItems(freshPosts, "post", "exploration");
  addItems(freshPolls, "poll", "exploration");

  const allCandidates = Array.from(candidateMap.values());
  return allCandidates.slice(0, limit);
};
