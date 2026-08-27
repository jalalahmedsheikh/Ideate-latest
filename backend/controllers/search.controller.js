import { User } from "../models/user.model.js";
import { Post } from "../models/post.model.js";
import { Question } from "../models/question.model.js";
import { Debate } from "../models/debate.model.js";
import { Poll } from "../models/poll.model.js";
import { Community } from "../models/community.model.js";
import { Topic } from "../models/topic.model.js";

// Unified search across all Ideate Identity entities
export const globalSearch = async (req, res) => {
  try {
    const { q = "", type = "all" } = req.query;
    const query = q.trim();

    if (!query || query.length < 1) {
      return res.status(200).json({
        success: true,
        results: {
          users: [],
          creators: [],
          posts: [],
          questions: [],
          debates: [],
          polls: [],
          communities: [],
          topics: [],
        },
        query,
      });
    }

    let excludedUserIds = [];
    if (req.id) {
      const currentUser = await User.findById(req.id).select("blockedUsers mutedUsers").lean();
      if (currentUser) {
        excludedUserIds = [
          ...(currentUser.blockedUsers || []).map((id) => id.toString()),
          ...(currentUser.mutedUsers || []).map((id) => id.toString()),
        ];
      }
    }

    const regex = new RegExp(query, "i");

    const [users, creators, posts, questions, debates, polls, communities, topics] = await Promise.all([
      // 1. Users
      type === "all" || type === "users"
        ? User.find({
            _id: { $nin: excludedUserIds },
            isBanned: false,
            $or: [{ username: regex }, { name: regex }, { bio: regex }],
          })
            .select("username name profileImage category isverified reputationScore reputationLevel followers followings")
            .limit(20)
            .lean()
        : [],

      // 2. Creators
      type === "all" || type === "creators"
        ? User.find({
            _id: { $nin: excludedUserIds },
            isBanned: false,
            isCreator: true,
            $or: [{ username: regex }, { name: regex }, { bio: regex }],
          })
            .select("username name profileImage category isverified reputationScore reputationLevel followers")
            .limit(20)
            .lean()
        : [],

      // 3. Posts
      type === "all" || type === "posts"
        ? Post.find({
            status: "active",
            ...(excludedUserIds.length > 0 ? { author: { $nin: excludedUserIds } } : {}),
            $or: [{ caption: regex }, { hashtags: regex }, { tags: regex }],
          })
            .populate("author", "username name profileImage isverified reputationScore")
            .populate("topics", "name icon")
            .sort({ createdAt: -1 })
            .limit(20)
            .lean()
        : [],

      // 4. Questions
      type === "all" || type === "questions"
        ? Question.find({
            status: "active",
            ...(excludedUserIds.length > 0 ? { author: { $nin: excludedUserIds } } : {}),
            $or: [{ title: regex }, { description: regex }],
          })
            .populate("author", "username name profileImage isverified reputationScore")
            .populate("topics", "name icon")
            .sort({ createdAt: -1 })
            .limit(20)
            .lean()
        : [],

      // 5. Debates
      type === "all" || type === "debates"
        ? Debate.find({
            status: { $in: ["active", "closed"] },
            ...(excludedUserIds.length > 0 ? { author: { $nin: excludedUserIds } } : {}),
            $or: [{ title: regex }, { resolution: regex }, { context: regex }],
          })
            .populate("author", "username name profileImage isverified reputationScore")
            .populate("topic", "name icon")
            .sort({ createdAt: -1 })
            .limit(20)
            .lean()
        : [],

      // 6. Polls
      type === "all" || type === "polls"
        ? Poll.find({
            status: { $in: ["open", "closed"] },
            ...(excludedUserIds.length > 0 ? { author: { $nin: excludedUserIds } } : {}),
            $or: [{ question: regex }, { options: regex }],
          })
            .populate("author", "username name profileImage isverified")
            .populate("topics", "name icon")
            .sort({ createdAt: -1 })
            .limit(20)
            .lean()
        : [],

      // 7. Communities
      type === "all" || type === "communities"
        ? Community.find({
            isSuspended: false,
            $or: [{ name: regex }, { handle: regex }, { description: regex }, { tags: regex }],
          })
            .populate("creator", "username name profileImage isverified")
            .sort({ membersCount: -1 })
            .limit(20)
            .lean()
        : [],

      // 8. Topics
      type === "all" || type === "topics"
        ? Topic.find({
            status: "active",
            $or: [{ name: regex }, { description: regex }, { slug: regex }],
          })
            .sort({ followerCount: -1 })
            .limit(20)
            .lean()
        : [],
    ]);

    return res.status(200).json({
      success: true,
      query,
      results: {
        users,
        creators,
        posts: posts.map((p) => ({ ...p, feedType: "post" })),
        questions: questions.map((q) => ({ ...q, feedType: "question" })),
        debates: debates.map((d) => ({ ...d, feedType: "debate" })),
        polls: polls.map((pl) => ({ ...pl, feedType: "poll" })),
        communities,
        topics,
      },
    });
  } catch (error) {
    console.error("Search error:", error);
    return res.status(500).json({ success: false, message: "Search failed." });
  }
};

// Quick autocomplete suggestions
export const searchSuggestions = async (req, res) => {
  try {
    const { q = "" } = req.query;
    const query = q.trim();

    if (!query || query.length < 1) {
      return res.status(200).json({ success: true, suggestions: [] });
    }

    const regex = new RegExp("^" + query, "i");

    const [users, questions, communities, topics] = await Promise.all([
      User.find({ username: regex, isBanned: false })
        .select("username name profileImage isverified")
        .limit(3)
        .lean(),
      Question.find({ title: regex, status: "active" })
        .select("title")
        .limit(3)
        .lean(),
      Community.find({ name: regex, isSuspended: false })
        .select("name handle profileImage")
        .limit(3)
        .lean(),
      Topic.find({ name: regex, status: "active" })
        .select("name slug icon")
        .limit(3)
        .lean(),
    ]);

    const suggestions = [
      ...topics.map((t) => ({
        type: "topic",
        id: t._id,
        label: `#${t.name}`,
        icon: t.icon,
      })),
      ...communities.map((c) => ({
        type: "community",
        id: c._id,
        label: `c/${c.handle}`,
        name: c.name,
      })),
      ...users.map((u) => ({
        type: "user",
        id: u._id,
        label: `@${u.username}`,
        profileImage: u.profileImage,
        isverified: u.isverified,
      })),
      ...questions.map((q) => ({
        type: "question",
        id: q._id,
        label: q.title.length > 50 ? q.title.substring(0, 50) + "…" : q.title,
      })),
    ];

    return res.status(200).json({ success: true, suggestions });
  } catch (error) {
    return res.status(500).json({ success: false, suggestions: [] });
  }
};
