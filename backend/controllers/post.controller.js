import { Post } from "../models/post.model.js";
import { User } from "../models/user.model.js";
import { Comment } from "../models/comment.model.js";
import { Poll } from "../models/poll.model.js";
import { checkSpamAndToxicity } from "./ai.controller.js";
import redis, { getCached, setCached, invalidateCached } from "../config/redis.js";
import { queueNotification, queueFeedGeneration, queueTrendingUpdate } from "../queues/queue.js";
import { io } from "../socket/socket.js";

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
    const { caption } = req.body;
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

    const post = await Post.create({
      caption,
      author: authorId
    });

    const userr = await User.findById(authorId);
    if (userr) {
      userr.posts.push(post._id);
      await userr.save();
      // Invalidate profile cache because posts list changed
      await invalidateCached(`user:profile:${authorId}`);
    }

    await post.populate({ path: 'author', select: '-password' });

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

    // Check if personalized feed IDs exist in Redis list
    const feedKey = `feed:following:${loggedInUserId}:ids`;
    const cachedIds = await redis.lrange(feedKey, 0, 49); // Fetch first 50 post/poll IDs

    if (cachedIds && cachedIds.length > 0) {
      // Fetch details of cached post/poll IDs
      const posts = await Post.find({ _id: { $in: cachedIds } })
        .populate({ path: 'author', select: 'username profileImage isverified' })
        .populate({
          path: 'comments',
          sort: { createdAt: -1 },
          populate: {
            path: 'author',
            select: 'username profileImage isverified',
          },
        });

      // Sort posts in memory to match the cached IDs order
      const idMap = {};
      cachedIds.forEach((id, idx) => { idMap[id] = idx; });
      posts.sort((a, b) => idMap[a._id.toString()] - idMap[b._id.toString()]);

      return res.status(200).json({
        success: true,
        posts,
        cached: true
      });
    }

    // Cache miss: rebuild feed from DB
    const user = await User.findById(loggedInUserId).populate('followings');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const followingIds = user.followings.map(followedUser => followedUser._id);

    const posts = await Post.find({ author: { $in: followingIds } })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate({ path: 'author', select: 'username profileImage isverified' })
      .populate({
        path: 'comments',
        sort: { createdAt: -1 },
        populate: {
          path: 'author',
          select: 'username profileImage isverified',
        },
      });

    // Populate Redis list with these IDs asynchronously for subsequent requests
    if (posts.length > 0) {
      const pipeline = redis.pipeline();
      pipeline.del(feedKey);
      posts.forEach(post => {
        pipeline.rpush(feedKey, post._id.toString());
      });
      pipeline.expire(feedKey, 3600); // 1 hour TTL
      await pipeline.exec();
    }

    return res.status(200).json({
      success: true,
      posts,
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
    const { text } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ message: 'Comment text is required', success: false });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found', success: false });
    }

    const comment = await Comment.create({
      content: text.trim(),
      text: text.trim(),
      author: userCommentById,
      post: postId
    });

    await comment.populate({
      path: 'author',
      select: "username profileImage name isverified"
    });

    post.comments.push(comment._id);
    await post.save();

    // Invalidate caches safely
    try {
      const authorIdStr = post.author ? post.author.toString() : null;
      await invalidatePostCaches(postId, authorIdStr);
    } catch (cacheErr) {
      console.warn("⚠️ Cache invalidation warning in addComment:", cacheErr.message);
    }

    // Real-time: push new comment to post room subscribers
    try {
      if (io) {
        io.to(`post:${postId}`).emit('post:comment_update', {
          postId,
          comment,
          commentCount: post.comments.length,
        });
      }
    } catch (socketErr) {
      console.warn("⚠️ Socket emit warning in addComment:", socketErr.message);
    }

    // Queue comment notification asynchronously
    try {
      const postOwnerId = post.author ? post.author.toString() : null;
      if (postOwnerId && postOwnerId !== userCommentById) {
        const commenter = await User.findById(userCommentById).select('username profileImage name');
        if (commenter) {
          await queueNotification({
            type: 'comment',
            userId: userCommentById,
            userDetails: {
              username: commenter.username || 'User',
              profileImage: commenter.profileImage || null,
              name: commenter.name || commenter.username || 'User',
            },
            postId,
            message: `${commenter.name || commenter.username} commented on your post: "${text.trim().slice(0, 15)}..."`,
            targetOwnerId: postOwnerId
          });
        }
      }
    } catch (notifErr) {
      console.warn("⚠️ Notification queue warning in addComment:", notifErr.message);
    }

    return res.status(201).json({
      message: 'Comment Added',
      comment,
      success: true
    });
  } catch (error) {
    console.error("Error in addComment:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error."
    });
  }
};

export const getCommentsOfPost = async (req, res) => {
  try {
    const postId = req.params.id;

    // Check Cache
    const cachedComments = await getCached(`post:comments:${postId}`);
    if (cachedComments) {
      return res.status(200).json({
        success: true,
        comments: cachedComments,
        cached: true
      });
    }

    const comments = await Comment.find({ post: postId }).populate('author', 'username profileImage isverified name');

    if (!comments) return res.status(404).json({ message: 'No comments found for this post', success: false });

    // Cache comments for 5 minutes
    await setCached(`post:comments:${postId}`, comments, 300);

    return res.status(200).json({ success: true, comments });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error." });
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
