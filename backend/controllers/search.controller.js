import { User } from "../models/user.model.js";
import { Post } from "../models/post.model.js";
import { Poll } from "../models/poll.model.js";
import { getCached, setCached } from "../config/redis.js";

// Unified search: users, posts, polls
export const globalSearch = async (req, res) => {
  try {
    const { q = "" } = req.query;
    const query = q.trim();

    if (!query || query.length < 1) {
      return res.status(200).json({
        success: true,
        results: { users: [], posts: [], polls: [] },
        query,
      });
    }

    // Short cache key (5 seconds) — keeps suggestions snappy without hammering DB
    const cacheKey = `search:${query.toLowerCase()}`;
    const cached = await getCached(cacheKey);
    if (cached) {
      return res.status(200).json({ success: true, ...cached, cached: true });
    }

    const regex = new RegExp(query, "i");

    // Run all three queries in parallel
    const [users, posts, polls] = await Promise.all([
      User.find({
        $or: [{ username: regex }, { category: regex }],
      })
        .select("username profileImage category isverified followers")
        .limit(15)
        .lean(),

      Post.find({
        $or: [
          { caption: regex },
          { hashtags: regex }, // if you store hashtags array
        ],
        status: { $ne: "deleted" },
      })
        .populate({ path: "author", select: "username profileImage isverified" })
        .sort({ createdAt: -1 })
        .limit(15)
        .lean(),

      Poll.find({
        $or: [{ question: regex }, { options: regex }],
        status: "open",
      })
        .populate({ path: "author", select: "username profileImage isverified" })
        .sort({ createdAt: -1 })
        .limit(15)
        .lean(),
    ]);

    const payload = {
      results: { users, posts, polls },
      query,
    };

    // Cache for 5 seconds — live suggestions feel instant, DB not hammered
    await setCached(cacheKey, payload, 5);

    return res.status(200).json({ success: true, ...payload });
  } catch (error) {
    console.error("Search error:", error);
    return res.status(500).json({ success: false, message: "Search failed." });
  }
};

// Quick suggestions (usernames only, for autocomplete dropdown)
export const searchSuggestions = async (req, res) => {
  try {
    const { q = "" } = req.query;
    const query = q.trim();

    if (!query || query.length < 1) {
      return res.status(200).json({ success: true, suggestions: [] });
    }

    const cacheKey = `suggest:${query.toLowerCase()}`;
    const cached = await getCached(cacheKey);
    if (cached) {
      return res.status(200).json({ success: true, ...cached, cached: true });
    }

    const regex = new RegExp("^" + query, "i"); // starts-with for suggestions

    const [users, posts, polls] = await Promise.all([
      User.find({ username: regex })
        .select("username profileImage isverified")
        .limit(5)
        .lean(),

      Post.find({ caption: regex })
        .select("caption")
        .limit(3)
        .lean(),

      Poll.find({ question: regex })
        .select("question")
        .limit(3)
        .lean(),
    ]);

    const suggestions = [
      ...users.map((u) => ({
        type: "user",
        id: u._id,
        label: `@${u.username}`,
        profileImage: u.profileImage,
        isverified: u.isverified,
      })),
      ...posts.map((p) => ({
        type: "post",
        id: p._id,
        label: p.caption.length > 50 ? p.caption.substring(0, 50) + "…" : p.caption,
      })),
      ...polls.map((p) => ({
        type: "poll",
        id: p._id,
        label: p.question.length > 50 ? p.question.substring(0, 50) + "…" : p.question,
      })),
    ];

    const payload = { suggestions };
    await setCached(cacheKey, payload, 5);

    return res.status(200).json({ success: true, ...payload });
  } catch (error) {
    console.error("Suggestion error:", error);
    return res.status(500).json({ success: false, suggestions: [] });
  }
};
