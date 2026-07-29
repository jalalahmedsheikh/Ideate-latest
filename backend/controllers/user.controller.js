import { User } from "../models/user.model.js";
import bcrypt from 'bcrypt'; // For password hashing
import { generateToken } from "../utills/genrateToken.js";
import { deleteMediaFromCloudinary, uploadMedia } from "../utills/cloudinary.js";
import mongoose from "mongoose";
import redis, { getCached, setCached, invalidateCached } from "../config/redis.js";
import { queueNotification } from "../queues/queue.js";
import jwt from "jsonwebtoken";

// 1. Register User: Registers a new user with location, category, and other details.
export const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validate inputs
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required.",
      });
    }

    // Check if the user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this email.",
      });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the user
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
    });

    // Save the new user
    await newUser.save();

    // Return success response
    return res.status(201).json({
      success: true,
      message: "Account created successfully.",
      user: newUser,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

// 2. Login User: Handles user login and generates a JWT token.
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required.",
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "User not found with this email.",
      });
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      return res.status(400).json({
        success: false,
        message: "Incorrect email or password.",
      });
    }

    if (user.isBanned) {
      return res.status(403).json({
        success: false,
        message: "Your account has been banned by an administrator.",
      });
    }

    // Generate token and send response
    await generateToken(res, user , `Welcome back ${user.username}`);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

// 3. Logout User: Logs out the user by clearing the token cookie.
export const logout = async (req, res) => {
  try {
    // Clear Redis session
    let token = req.cookies?.token;
    if (!token && req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.SECRET_KEY);
        if (decoded && decoded.userId) {
          await redis.del(`session:${decoded.userId}`);
        }
      } catch (err) {
        // Ignore token verification errors during logout
      }
    }

    return res.status(200).cookie("token", "", { maxAge: 0 }).json({
      success: true,
      message: "Logged out successfully.",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

// 4. Get User Profile: Fetches the profile of the logged-in user.
export const getUserProfile = async (req, res) => {
  try {
    const userId = req.id;
    
    // Redis Cache Check
    const cachedUser = await getCached(`user:profile:${userId}`);
    if (cachedUser) {
      return res.status(200).json({
        success: true,
        user: cachedUser,
        cached: true
      });
    }

    const user = await User.findById(userId).select("-password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Profile not found.",
      });
    }

    // Redis Cache Update
    await setCached(`user:profile:${userId}`, user, 3600); // Cache for 1 hour

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

export const getSingleUser = async (req, res) => {
  try {
    const userId = req.params.id;  // Ensure you are using req.params for route parameters
    
    // Check if userId is undefined
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    // Try to convert the userId to a valid ObjectId if necessary
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid User ID"
      });
    }

    // Redis Cache Check
    const cachedUser = await getCached(`user:profile:${userId}`);
    if (cachedUser) {
      return res.status(200).json({
        success: true,
        user: cachedUser,
        cached: true
      });
    }

    const user = await User.findById(userId).select("-password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Redis Cache Update
    await setCached(`user:profile:${userId}`, user, 3600); // Cache for 1 hour

    return res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

// 5. Update User Profile: Updates the user's profile (including photo and name).
export const updateProfile = async (req, res) => {
  try {
    const userId = req.id;
    // Accept all fields the Flutter form sends
    const { username, bio, category } = req.body;
    const profilePhoto = req.file; // multer memoryStorage object

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    // If username is changing, check it isn't already taken
    if (username && username !== user.username) {
      const existing = await User.findOne({ username, _id: { $ne: userId } });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: "Username already taken.",
        });
      }
    }

    let photoUrl = user.profileImage;

    // Handle profile image update if a new photo is provided
    if (profilePhoto) {
      // Delete old image from Cloudinary if it exists
      if (user.profileImage) {
        try {
          // Extract public_id — works for both plain IDs and folder/ID formats
          const parts = user.profileImage.split("/");
          const filenameWithExt = parts[parts.length - 1];
          const publicId = parts.length > 1
            ? `${parts[parts.length - 2]}/${filenameWithExt.split(".")[0]}`
            : filenameWithExt.split(".")[0];
          deleteMediaFromCloudinary(publicId);
        } catch (_) {}
      }
      const cloudResponse = await uploadMedia(profilePhoto);
      photoUrl = cloudResponse.secure_url;
    }

    const updatedData = {
      ...(username && { username }),
      ...(bio !== undefined && { bio }),
      ...(category && { category }),
      profileImage: photoUrl,
    };

    const updatedUser = await User.findByIdAndUpdate(userId, updatedData, { new: true }).select("-password");

    // Invalidate Redis Cache so fresh data is served next time
    await invalidateCached(`user:profile:${userId}`);

    return res.status(200).json({
      success: true,
      user: updatedUser,
      message: "Profile updated successfully.",
    });
  } catch (error) {
    console.error("updateProfile error:", error.message, error.stack);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
      detail: process.env.NODE_ENV !== "production" ? error.message : undefined,
    });
  }
};


// 6. Follow or Unfollow User: Manages following/unfollowing another user.
export const toggleFollow = async (req, res) => {
  try {
    const currentUserId = req.id;
    const { targetUserId, action } = req.body;

    if (!targetUserId || !action) {
      return res.status(400).json({
        success: false,
        message: "Target user ID and action type (follow/unfollow) are required.",
      });
    }

    if (currentUserId === targetUserId) {
      return res.status(400).json({
        success: false,
        message: "You cannot follow/unfollow yourself.",
      });
    }

    const currentUser = await User.findById(currentUserId);
    const targetUser = await User.findById(targetUserId);

    if (!currentUser || !targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (action === "follow") {
      if (currentUser.followings.includes(targetUserId)) {
        return res.status(400).json({
          success: false,
          message: "You are already following this user.",
        });
      }

      if (targetUser.isPrivate) {
        // If target user is private, we send a follow request
        const alreadyRequested = targetUser.followRequests.includes(currentUserId);
        if (alreadyRequested) {
          return res.status(400).json({
            success: false,
            message: "Follow request is already pending.",
          });
        }
        targetUser.followRequests.push(currentUserId);
        await targetUser.save();

        // Invalidate profile cache
        await invalidateCached(`user:profile:${targetUserId}`);

        // Queue follow request notification
        await queueNotification({
          type: "follow_request",
          userId: currentUserId,
          userDetails: { username: currentUser.username, profileImage: currentUser.profileImage, name: currentUser.name },
          message: `${currentUser.username} requested to follow you.`,
          targetOwnerId: targetUserId
        });

        return res.status(200).json({
          success: true,
          requested: true,
          message: `Follow request sent to ${targetUser.username}`,
        });
      }

      currentUser.followings.push(targetUserId);
      targetUser.followers.push(currentUserId);

      await currentUser.save();
      await targetUser.save();

      // Invalidate Redis caches
      await invalidateCached(`user:profile:${currentUserId}`);
      await invalidateCached(`user:profile:${targetUserId}`);
      await invalidateCached(`feed:following:${currentUserId}:ids`);

      // Queue follow notification
      await queueNotification({
        type: "follow",
        userId: currentUserId,
        userDetails: { username: currentUser.username, profileImage: currentUser.profileImage, name: currentUser.name },
        message: `${currentUser.username} started following you.`,
        targetOwnerId: targetUserId
      });

      return res.status(200).json({
        success: true,
        message: `You are now following ${targetUser.username}`,
      });
    }

    if (action === "unfollow") {
      // Check if there was a pending follow request
      if (targetUser.isPrivate && targetUser.followRequests.includes(currentUserId)) {
        targetUser.followRequests = targetUser.followRequests.filter(
          (id) => id.toString() !== currentUserId.toString()
        );
        await targetUser.save();
        await invalidateCached(`user:profile:${targetUserId}`);
        return res.status(200).json({
          success: true,
          cancelled: true,
          message: `Follow request to ${targetUser.username} cancelled.`,
        });
      }

      if (!currentUser.followings.includes(targetUserId)) {
        return res.status(400).json({
          success: false,
          message: "You are not following this user.",
        });
      }

      currentUser.followings = currentUser.followings.filter(
        (id) => id.toString() !== targetUserId.toString()
      );
      targetUser.followers = targetUser.followers.filter(
        (id) => id.toString() !== currentUserId.toString()
      );

      await currentUser.save();
      await targetUser.save();

      // Invalidate Redis caches
      await invalidateCached(`user:profile:${currentUserId}`);
      await invalidateCached(`user:profile:${targetUserId}`);
      await invalidateCached(`feed:following:${currentUserId}:ids`);

      return res.status(200).json({
        success: true,
        message: `You have unfollowed ${targetUser.username}`,
      });
    }

    return res.status(400).json({
      success: false,
      message: "Invalid action type. Use 'follow' or 'unfollow'.",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

export const suggestedUsers = async (req, res) => {
  try {
      const loggedInUserId = req.id;
      
      const verifiedUsers = await User.find({ _id: { $ne: loggedInUserId }, isverified: true })
          .select('username profileImage isverified followers followings category')
          .limit(10);

      const nonVerifiedUsers = await User.find({ _id: { $ne: loggedInUserId }, isverified: false })
          .select('username profileImage isverified followers followings category')
          .limit(10);

      const suggestedUsers = [...verifiedUsers, ...nonVerifiedUsers];

      return res.status(200).json({
          suggestedUsers,
          success: true
      });
  } catch (error) {
      console.error("Error fetching suggested users:", error);
      return res.status(500).json({
          success: false,
          message: "Error fetching suggested users"
      });
  }
};

// Get pending follow requests
export const getFollowRequests = async (req, res) => {
  try {
    const userId = req.id;
    const user = await User.findById(userId).populate("followRequests", "username profileImage name isverified");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }
    return res.status(200).json({ success: true, requests: user.followRequests || [] });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// Accept or Decline Follow Request
export const respondToFollowRequest = async (req, res) => {
  try {
    const userId = req.id; // Target user (private account)
    const { requesterId, accept } = req.body;

    const user = await User.findById(userId);
    const requester = await User.findById(requesterId);

    if (!user || !requester) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    // Remove from followRequests
    user.followRequests = user.followRequests.filter(id => id.toString() !== requesterId.toString());

    if (accept) {
      // Add requester to user's followers
      if (!user.followers.includes(requesterId)) {
        user.followers.push(requesterId);
      }
      // Add user to requester's followings
      if (!requester.followings.includes(userId)) {
        requester.followings.push(userId);
      }
      await user.save();
      await requester.save();

      // Invalidate Redis caches
      await invalidateCached(`user:profile:${userId}`);
      await invalidateCached(`user:profile:${requesterId}`);
      await invalidateCached(`feed:following:${requesterId}:ids`);

      // Queue follow request accepted notification
      await queueNotification({
        type: "follow_accept",
        userId,
        userDetails: { username: user.username, profileImage: user.profileImage, name: user.name },
        message: `${user.username} accepted your follow request.`,
        targetOwnerId: requesterId
      });

      return res.status(200).json({ success: true, message: "Follow request accepted." });
    } else {
      await user.save();
      await invalidateCached(`user:profile:${userId}`);
      return res.status(200).json({ success: true, message: "Follow request declined." });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// Toggle account privacy (private / public)
export const toggleAccountPrivacy = async (req, res) => {
  try {
    const userId = req.id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }
    user.isPrivate = !user.isPrivate;
    await user.save();

    await invalidateCached(`user:profile:${userId}`);

    return res.status(200).json({ 
      success: true, 
      isPrivate: user.isPrivate, 
      message: `Account is now ${user.isPrivate ? "private" : "public"}.` 
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// Block/Unblock user
export const toggleBlockUser = async (req, res) => {
  try {
    const userId = req.id;
    const { targetUserId } = req.body;

    if (userId === targetUserId) {
      return res.status(400).json({ success: false, message: "You cannot block yourself." });
    }

    const user = await User.findById(userId);
    const targetUser = await User.findById(targetUserId);
    if (!user || !targetUser) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const isBlocked = user.blockedUsers.includes(targetUserId);
    if (isBlocked) {
      user.blockedUsers = user.blockedUsers.filter(id => id.toString() !== targetUserId.toString());
      await user.save();

      await invalidateCached(`user:profile:${userId}`);
      await invalidateCached(`user:profile:${targetUserId}`);

      return res.status(200).json({ success: true, message: `Unblocked ${targetUser.username}.`, isBlocked: false });
    } else {
      user.blockedUsers.push(targetUserId);
      // Remove followings/followers relationships
      user.followings = user.followings.filter(id => id.toString() !== targetUserId.toString());
      user.followers = user.followers.filter(id => id.toString() !== targetUserId.toString());
      targetUser.followings = targetUser.followings.filter(id => id.toString() !== userId.toString());
      targetUser.followers = targetUser.followers.filter(id => id.toString() !== userId.toString());
      
      await user.save();
      await targetUser.save();

      await invalidateCached(`user:profile:${userId}`);
      await invalidateCached(`user:profile:${targetUserId}`);
      await invalidateCached(`feed:following:${userId}:ids`);
      await invalidateCached(`feed:following:${targetUserId}:ids`);

      return res.status(200).json({ success: true, message: `Blocked ${targetUser.username}.`, isBlocked: true });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// Mute/Unmute user
export const toggleMuteUser = async (req, res) => {
  try {
    const userId = req.id;
    const { targetUserId } = req.body;

    if (userId === targetUserId) {
      return res.status(400).json({ success: false, message: "You cannot mute yourself." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const isMuted = user.mutedUsers.includes(targetUserId);
    if (isMuted) {
      user.mutedUsers = user.mutedUsers.filter(id => id.toString() !== targetUserId.toString());
      await user.save();

      await invalidateCached(`user:profile:${userId}`);

      return res.status(200).json({ success: true, message: `Unmuted user.`, isMuted: false });
    } else {
      user.mutedUsers.push(targetUserId);
      await user.save();

      await invalidateCached(`user:profile:${userId}`);

      return res.status(200).json({ success: true, message: `Muted user.`, isMuted: true });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};




