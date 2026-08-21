import { User } from "../models/user.model.js";
import { Post } from "../models/post.model.js";
import { Poll } from "../models/poll.model.js";
import { Comment } from "../models/comment.model.js";
import { Notification } from "../models/notification.model.js";
import { Report } from "../models/report.model.js";
import { deleteMediaFromCloudinary } from "./cloudinary.js";
import redis, { invalidateCached } from "../config/redis.js";

/**
 * Performs complete, professional cascade deletion of a user account.
 * Purges all associated posts, polls, comments, notifications, media,
 * and updates social graph relationships across all other users.
 */
export const cascadeDeleteUser = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    return { success: false, message: "User not found." };
  }

  // 1. Clean up user profile image on Cloudinary if present
  if (user.profileImage && user.profileImage.includes("cloudinary")) {
    try {
      const parts = user.profileImage.split("/");
      const publicIdWithExt = parts[parts.length - 1];
      const publicId = publicIdWithExt.split(".")[0];
      await deleteMediaFromCloudinary(publicId);
    } catch (err) {
      console.warn("⚠️ Cloudinary profile image delete warning:", err.message);
    }
  }

  // 2. Find all Posts by user, clean media & delete associated comments
  const userPosts = await Post.find({ author: userId }).select("_id image mediaUrl");
  const userPostIds = userPosts.map((p) => p._id);

  for (const post of userPosts) {
    const imageUrl = post.image || post.mediaUrl;
    if (imageUrl && imageUrl.includes("cloudinary")) {
      try {
        const parts = imageUrl.split("/");
        const publicIdWithExt = parts[parts.length - 1];
        const publicId = publicIdWithExt.split(".")[0];
        await deleteMediaFromCloudinary(publicId);
      } catch (err) {
        console.warn("⚠️ Cloudinary post image delete warning:", err.message);
      }
    }
  }

  // Delete all comments on user's posts
  if (userPostIds.length > 0) {
    await Comment.deleteMany({ post: { $in: userPostIds } });
  }

  // Delete user's posts
  await Post.deleteMany({ author: userId });

  // 3. Delete user's polls
  await Poll.deleteMany({ author: userId });

  // 4. Delete user's authored comments & pull from existing posts
  await Comment.deleteMany({ author: userId });

  // 5. Remove userId from all other users' followers, followings, requests, blocks, mutes
  await User.updateMany(
    {},
    {
      $pull: {
        followers: userId,
        followings: userId,
        followRequests: userId,
        blockedUsers: userId,
        mutedUsers: userId,
      },
    }
  );

  // 6. Remove userId from likes & bookmarks on all Posts and Polls
  await Post.updateMany({}, { $pull: { likes: userId, bookmarks: userId } });
  await Poll.updateMany({}, { $pull: { bookmarks: userId } });

  // Remove votes from Poll options
  await Poll.updateMany(
    { "options.votes": userId },
    { $pull: { "options.$.votes": userId } }
  );

  // 7. Delete Notifications and Reports linked to user
  await Notification.deleteMany({
    $or: [{ recipient: userId }, { sender: userId }],
  });

  await Report.deleteMany({
    $or: [{ reportedBy: userId }, { targetId: userId }],
  });

  // 8. Delete the User document itself
  await User.findByIdAndDelete(userId);

  // 9. Evict session and clear cache in Redis
  try {
    if (redis) {
      await redis.del(`session:${userId}`);
    }
    await invalidateCached("posts:all");
    await invalidateCached("feed:trending");
    await invalidateCached(`user:posts:${userId}`);
    await invalidateCached(`user:profile:${userId}`);
  } catch (err) {
    console.warn("⚠️ Redis cache cleanup warning during user delete:", err.message);
  }

  return { success: true, message: "User account and all associated data permanently deleted." };
};
