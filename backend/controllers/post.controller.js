import mongoose from "mongoose";
import { Post } from "../models/post.model.js";
import { User } from "../models/user.model.js";
import { Comment } from "../models/comment.model.js";
import { Poll } from "../models/poll.model.js";
import { Topic } from "../models/topic.model.js";
import { checkSpamAndToxicity } from "./ai.controller.js";
import redis, { getCached, setCached, invalidateCached } from "../config/redis.js";
import { queueNotification, queueFeedGeneration, queueTrendingUpdate } from "../queues/queue.js";
import { io } from "../socket/socket.js";
import { CommentService } from "../services/comment.service.js";

// Helper to safely resolve/validate topic ObjectIds
const resolveValidTopicIds = async (topics) => {
  if (!topics) return [];
  let rawTopics = topics;
  if (typeof rawTopics === "string") {
    try {
      rawTopics = JSON.parse(rawTopics);
    } catch {
      rawTopics = rawTopics.split(",").map((t) => t.trim());
    }
  }
  if (!Array.isArray(rawTopics)) return [];

  const validIds = [];
  for (const t of rawTopics) {
    if (!t) continue;
    const str = String(t).trim();
    if (mongoose.Types.ObjectId.isValid(str) && String(new mongoose.Types.ObjectId(str)) === str) {
      validIds.push(new mongoose.Types.ObjectId(str));
    } else if (str.startsWith("fallback_")) {
      const idx = parseInt(str.replace("fallback_", ""), 10);
      const DEFAULT_CATEGORIES = [
        "Technology", "Programming", "Artificial Intelligence", "Business",
        "Design", "Science", "Education", "Startups", "Productivity",
        "Finance", "Philosophy", "General"
      ];
      const catName = DEFAULT_CATEGORIES[idx];
      if (catName) {
        let topicDoc = await Topic.findOne({ name: { $regex: new RegExp(`^${catName}$`, "i") } });
        if (!topicDoc) {
          topicDoc = await Topic.create({
            name: catName,
            slug: catName.toLowerCase().replace(/\s+/g, "-"),
            icon: "💡",
            category: catName,
            description: `Discussion and ideas about ${catName}`,
            status: "active"
          });
        }
        validIds.push(topicDoc._id);
      }
    }
  }
  return validIds;
};

// Helper to invalidate post related caches
const invalidatePostCaches = async (postId, authorId) => {
  await invalidateCached("posts:all");
  await invalidateCached("feed:trending");
  if (postId) {
    await invalidateCached(`post:detail:${postId}`);
    await invalidateCached(`post:comments:${postId}`);
  }
  if (authorId) {
    await invalidateCached(`user:posts:${authorId}`);
  }
};

export const addNewPost = async (req, res) => {
  try {
    const { caption, topics } = req.body;
    const authorId = req.id;

    if (!caption) {
      return res.status(400).json({
        success: false,
        message: "Caption field cannot be empty."
      });
    }

    const safetyCheck = await checkSpamAndToxicity(caption);
    if (safetyCheck.isViolating) {
      return res.status(400).json({
        success: false,
        message: `Content flagged as inappropriate: ${safetyCheck.reason}`
      });
    }

    const validatedTopics = await resolveValidTopicIds(topics);

    const post = await Post.create({
      caption,
      author: authorId,
      topics: validatedTopics
    });

    // Increment topic post counts
    if (validatedTopics.length > 0) {
      await Topic.updateMany({ _id: { $in: validatedTopics } }, { $inc: { postCount: 1 } });
    }

    const userr = await User.findById(authorId);
    if (userr) {
      userr.posts.push(post._id);
      await userr.save();
      // Invalidate profile cache because posts list changed
      await invalidateCached(`user:profile:${authorId}`);
    }

    await post.populate([
      { path: 'author', select: '-password' },
      { path: 'topics', select: 'name slug icon category' }
    ]);

    // 1. Invalidate list caches
    await invalidatePostCaches(null, authorId);

    // 2. Queue background job for feed precomputation and fan-out
    await queueFeedGeneration({
      action: "createPost",
      postId: post._id,
      authorId
    });

    // 3. Trigger trending score recalculation (non-blocking)
    queueTrendingUpdate({}).catch(() => {});

    return res.status(201).json({
      success: true,
      post,
      message: "New post added."
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Internal server error."
    });
  }
};

export const getAllPosts = async (req, res) => {
  try {
    // Try retrieving from Cache first
    const cachedPosts = await getCached("posts:all");
    if (cachedPosts) {
      return res.status(200).json({
        posts: cachedPosts,
        success: true,
        cached: true
      });
    }

    const posts = await Post.find().sort({ createdAt: -1 })
      .populate({ path: 'author', select: 'username profileImage isverified' })
      .populate({
        path: 'comments', sort: { createdAt: -1 },
        populate: {
          path: 'author',
          select: 'username profileImage isverified'
        }
      });

    // Cache list of all posts for 2 minutes
    await setCached("posts:all", posts, 120);

    return res.status(200).json({
      posts,
      success: true
    });
  } catch (error) {
    console.error("Error fetching posts:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching posts"
    });
  }
};

// Controller to fetch a single post by its ID
export const getSinglePost = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Post ID is required"
      });
    }

    // Try retrieving from Cache
    const cachedPost = await getCached(`post:detail:${id}`);
    if (cachedPost) {
      return res.status(200).json({
        success: true,
        post: cachedPost,
        cached: true
      });
    }

    const post = await Post.findById(id)
      .populate({ path: 'author', select: 'username profileImage isverified' })
      .populate({
        path: 'comments', sort: { createdAt: -1 },
        populate: {
          path: 'author',
          select: 'username profileImage isverified'
        }
      });

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found"
      });
    }

    // Cache single post for 10 minutes
    await setCached(`post:detail:${id}`, post, 600);

    return res.status(200).json({
      success: true,
      post
    });
  } catch (error) {
    console.error("Error fetching post:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching post"
    });
  }
};

export const getAllPostsOfFollowing = async (req, res) => {
  try {
    const loggedInUserId = req.id;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const skip = (page - 1) * limit;

    const user = await User.findById(loggedInUserId)
      .select("followings blockedUsers mutedUsers")
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const followingIds = (user.followings || []).map(id => id.toString());
    if (followingIds.length === 0) {
      return res.status(200).json({
        success: true,
        feed: [],
        posts: [],
        polls: [],
        pagination: {
          page,
          limit,
          totalItems: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        }
      });
    }

    const blockedAndMuted = new Set([
      ...(user.blockedUsers || []).map(id => id.toString()),
      ...(user.mutedUsers || []).map(id => id.toString()),
    ]);
    const eligibleFollowingIds = followingIds.filter(id => !blockedAndMuted.has(id));

    // Fetch both Posts and Polls from followed creators in parallel
    const [posts, polls] = await Promise.all([
      Post.find({ author: { $in: eligibleFollowingIds }, status: { $ne: 'deleted' } })
        .sort({ createdAt: -1 })
        .limit(100)
        .populate({ path: 'author', select: 'username profileImage isverified' })
        .populate({
          path: 'comments',
          options: { limit: 10 },
          populate: { path: 'author', select: 'username profileImage isverified' },
        })
        .lean(),
      Poll.find({ author: { $in: eligibleFollowingIds }, status: { $ne: 'archived' } })
        .sort({ createdAt: -1 })
        .limit(100)
        .populate({ path: 'author', select: 'username profileImage isverified' })
        .lean(),
    ]);

    const formattedPosts = posts.map(p => ({ ...p, feedType: 'post' }));
    const formattedPolls = polls.map(p => ({ ...p, feedType: 'poll' }));

    const combined = [...formattedPosts, ...formattedPolls].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    const paginatedItems = combined.slice(skip, skip + limit);
    const totalItems = combined.length;
    const totalPages = Math.ceil(totalItems / limit);

    return res.status(200).json({
      success: true,
      feed: paginatedItems,
      posts: posts,
      polls: polls,
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
    console.error('Error fetching posts of following:', error.message || error);
    return res.status(500).json({
      success: false,
      message: 'There was an issue retrieving posts of users you follow. Please try again later.',
    });
  }
};

export const getUserPosts = async (req, res) => {
  try {
    const authorId = req.params.id || req.id;
    if (!authorId) {
      return res.status(400).json({
        success: false,
        message: 'Author ID is required.',
      });
    }

    // Try retrieving from Cache
    const cachedUserPosts = await getCached(`user:posts:${authorId}`);
    if (cachedUserPosts) {
      return res.status(200).json({
        success: true,
        posts: cachedUserPosts,
        cached: true
      });
    }

    const posts = await Post.find({ author: authorId })
      .sort({ createdAt: -1 })
      .populate({
        path: 'author',
        select: 'username profileImage isverified',
      })
      .populate({
        path: 'comments',
        sort: { createdAt: -1 },
        populate: {
          path: 'author',
          select: 'username profileImage isverified',
        },
      });

    // Cache user posts for 5 minutes
    await setCached(`user:posts:${authorId}`, posts, 300);

    return res.status(200).json({
      success: true,
      posts: posts || [],
    });
  } catch (error) {
    console.error('Error fetching user posts:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching user posts.',
    });
  }
};

export const handlePostReaction = async (req, res, action) => {
  try {
    const userId = req.id;
    const postId = req.params.id;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    const updateQuery =
      action === 'like'
        ? { $addToSet: { likes: userId } }
        : { $pull: { likes: userId } };

    await post.updateOne(updateQuery);
    
    // Invalidate caches
    await invalidatePostCaches(postId, post.author.toString());

    // Real-time: broadcast updated like count to post room
    const updatedPost = await Post.findById(postId).select('likes').lean();
    io.to(`post:${postId}`).emit('post:like_update', {
      postId,
      likeCount: updatedPost?.likes?.length ?? 0,
      action,
    });

    // Trigger trending recalculation (non-blocking)
    queueTrendingUpdate({}).catch(() => {});

    // Send async notification using BullMQ queue instead of blocking
    const postOwnerId = post.author.toString();
    if (postOwnerId !== userId) {
      const user = await User.findById(userId).select('username profileImage name');
      const messageAction = action === 'like' ? 'liked' : 'disliked';

      await queueNotification({
        type: action,
        userId,
        userDetails: { username: user.username, profileImage: user.profileImage, name: user.name },
        postId,
        message: `Your post "${post.caption.slice(0, 7)}..." was ${messageAction} by ${user.name || user.username}.`,
        targetOwnerId: postOwnerId
      });
    }

    return res.status(200).json({
      success: true,
      message: `Post ${action}d`,
    });
  } catch (error) {
    console.error(`Error during ${action}Post:`, error);
    return res.status(500).json({
      success: false,
      message: `Failed to ${action} post`,
    });
  }
};

export const addComment = async (req, res) => {
  try {
    const postId = req.params.id;
    const userCommentById = req.id;
    const { text, content, idempotencyKey } = req.body;

    const result = await CommentService.createComment({
      authorId: userCommentById,
      content: text || content,
      postId,
      idempotencyKey,
    });

    return res.status(201).json({
      message: "Comment Added",
      comment: result.comment,
      success: true,
      isDuplicate: result.isDuplicate,
    });
  } catch (error) {
    console.error("Error in addComment:", error);
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Internal server error.",
    });
  }
};

export const getCommentsOfPost = async (req, res) => {
  try {
    const postId = req.params.id;
    const currentUserId = req.id || null;

    const result = await CommentService.getComments({
      postId,
      limit: 100,
      currentUserId,
    });

    return res.status(200).json({
      success: true,
      comments: result.comments,
    });
  } catch (error) {
    console.error("Error in getCommentsOfPost:", error);
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Internal server error.",
    });
  }
};

export const deletePost = async (req, res) => {
  try {
    const postId = req.params.id;
    const authorId = req.id;

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: 'Post not found', success: false });

    // check if the logged-in user is the owner of the post
    if (post.author.toString() !== authorId) return res.status(403).json({ message: 'Unauthorized' });

    // delete post
    await Post.findByIdAndDelete(postId);

    // remove the post id from the user's post list
    let user = await User.findById(authorId);
    if (user) {
      user.posts = user.posts.filter(id => id.toString() !== postId);
      await user.save();
      await invalidateCached(`user:profile:${authorId}`);
    }

    // delete associated comments
    await Comment.deleteMany({ post: postId });

    // Invalidate all associated caches
    await invalidatePostCaches(postId, authorId);

    // Queue background feed job to clean up caches and fan-out deletions
    await queueFeedGeneration({
      action: "deletePost",
      postId,
      authorId
    });

    return res.status(200).json({
      success: true,
      message: 'Post deleted'
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

export const SavePost = async (req, res) => {
  try {
    const postId = req.params.id;
    const authorId = req.id;
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: 'Post not found', success: false });

    const user = await User.findById(authorId);
    if (!user) return res.status(404).json({ message: 'User not found', success: false });

    let type = 'saved';
    let message = 'Post saved';

    if (user.bookmarks.includes(post._id)) {
      // already saved -> remove from the bookmarks
      user.bookmarks = user.bookmarks.filter(id => id.toString() !== postId.toString());
      type = 'unsaved';
      message = 'Post removed from saved posts';
    } else {
      // bookmark it
      user.bookmarks.push(post._id);
    }

    await user.save();
    
    // Invalidate user profile cache since bookmarks list has changed
    await invalidateCached(`user:profile:${authorId}`);

    return res.status(200).json({ type, message, success: true });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// Share Post
export const sharePost = async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.id;

    const post = await Post.findById(postId)
      .populate({ path: 'author', select: 'username' });

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found.',
      });
    }

    // Increment share count in DB
    await Post.findByIdAndUpdate(postId, { $inc: { shareCount: 1 } });
    await invalidatePostCaches(postId, post.author._id.toString());

    const user = await User.findById(userId).select('username profileImage name');

    const shareData = {
      postUrl: `http://localhost:3000/posts/${post._id}`,
      caption: post.caption,
      sharedBy: user.username,
      userProfileImage: user.profileImage,
      postOwner: post.author.username,
    };

    // Queue share notification asynchronously
    await queueNotification({
      type: 'share',
      userId: userId,
      userDetails: { username: user.username, profileImage: user.profileImage, name: user.name },
      postId: postId,
      message: `${user.name || user.username} shared your post "${post.caption.slice(0, 7)}..."`,
      targetOwnerId: post.author._id.toString()
    });

    return res.status(200).json({
      success: true,
      message: 'Post shared successfully!',
      shareData,
    });
  } catch (error) {
    console.error("Error sharing post:", error);
    return res.status(500).json({
      success: false,
      message: 'Error sharing post.',
    });
  }
};

export const getSavedPostsAndPolls = async (req, res) => {
  try {
    const userId = req.id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    // Fetch bookmarked posts
    const posts = await Post.find({ _id: { $in: user.bookmarks } })
      .populate({ path: 'author', select: 'username profileImage isverified' })
      .populate({
        path: 'comments',
        populate: { path: 'author', select: 'username profileImage' }
      });

    // Fetch bookmarked polls
    const polls = await Poll.find({ _id: { $in: user.bookmarks } })
      .populate({ path: 'author', select: 'username profileImage isverified' });

    return res.status(200).json({
      success: true,
      posts: posts || [],
      polls: polls || []
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

export const getLikedPosts = async (req, res) => {
  try {
    const userId = req.id;

    // Fetch posts where likes array contains userId
    const posts = await Post.find({ likes: userId })
      .populate({ path: 'author', select: 'username profileImage isverified' })
      .populate({
        path: 'comments',
        populate: { path: 'author', select: 'username profileImage' }
      });

    return res.status(200).json({
      success: true,
      posts: posts || []
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};
