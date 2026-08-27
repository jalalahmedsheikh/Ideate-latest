import { User } from "../models/user.model.js";
import { OTP } from "../models/otp.model.js";
import { sendOTPEmail } from "../utills/emailService.js";
import { cascadeDeleteUser } from "../utills/cascadeDeleteUser.js";
import bcrypt from 'bcrypt'; // For password hashing
import { generateToken } from "../utills/genrateToken.js";
import { deleteMediaFromCloudinary, uploadMedia } from "../utills/cloudinary.js";
import mongoose from "mongoose";
import redis, { getCached, setCached, invalidateCached } from "../config/redis.js";
import { queueNotification } from "../queues/queue.js";
import jwt from "jsonwebtoken";

/**
 * Check Username Availability & Format
 */
export const checkUsername = async (req, res) => {
  try {
    const { username } = req.body;

    if (!username || username.trim().length === 0) {
      return res.status(400).json({
        success: false,
        available: false,
        message: "Username is required.",
      });
    }

    const trimmedUsername = username.trim();

    // Regex check: 3 to 20 characters, letters, numbers, underscores allowed
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(trimmedUsername)) {
      return res.status(400).json({
        success: false,
        available: false,
        message: "Username must be 3-20 characters long and contain only letters, numbers, or underscores.",
      });
    }

    // Case-insensitive database check
    const existingUser = await User.findOne({
      username: { $regex: new RegExp(`^${trimmedUsername}$`, "i") },
    });

    if (existingUser) {
      return res.status(200).json({
        success: true,
        available: false,
        message: "Username is already taken.",
      });
    }

    return res.status(200).json({
      success: true,
      available: true,
      message: "Username is available!",
    });
  } catch (error) {
    console.error("Check Username Error:", error);
    return res.status(500).json({
      success: false,
      available: false,
      message: "Server error checking username.",
    });
  }
};

/**
 * Check Email Availability & Format
 */
export const checkEmail = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        available: false,
        message: "Email is required.",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        success: false,
        available: false,
        message: "Please enter a valid email address.",
      });
    }

    const existingUser = await User.findOne({ email: email.trim().toLowerCase() });
    if (existingUser) {
      return res.status(200).json({
        success: true,
        available: false,
        message: "An account with this email already exists.",
      });
    }

    return res.status(200).json({
      success: true,
      available: true,
      message: "Email is available.",
    });
  } catch (error) {
    console.error("Check Email Error:", error);
    return res.status(500).json({
      success: false,
      available: false,
      message: "Server error checking email.",
    });
  }
};

/**
 * Generate and Send Email OTP for Registration
 */
export const sendOTP = async (req, res) => {
  try {
    const { email, username } = req.body;

    if (!email || !username) {
      return res.status(400).json({
        success: false,
        message: "Email and username are required.",
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim();

    // Check if email or username already exist
    const existingEmailUser = await User.findOne({ email: cleanEmail });
    if (existingEmailUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this email.",
      });
    }

    const existingUsernameUser = await User.findOne({
      username: { $regex: new RegExp(`^${cleanUsername}$`, "i") },
    });
    if (existingUsernameUser) {
      return res.status(400).json({
        success: false,
        message: "Username is already taken. Please choose another.",
      });
    }

    // Generate 6-digit random OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Clear any previous OTPs for this email
    await OTP.deleteMany({ email: cleanEmail });

    // Save new OTP in MongoDB
    await OTP.create({
      email: cleanEmail,
      otp,
    });

    // Dispatch email
    await sendOTPEmail(cleanEmail, otp, cleanUsername);

    return res.status(200).json({
      success: true,
      message: `Verification code sent to ${cleanEmail}. Please check your inbox.`,
    });
  } catch (error) {
    console.error("Send OTP Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send verification code. Please try again.",
    });
  }
};

// 1. Register User: Registers a new user with OTP verification, username availability check & category.
export const register = async (req, res) => {
  try {
    const { username, email, password, category, otp } = req.body;

    // Validate inputs
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Username, email, and password are required.",
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim();

    // Validate Username Format
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(cleanUsername)) {
      return res.status(400).json({
        success: false,
        message: "Username must be 3-20 characters long and contain only letters, numbers, or underscores.",
      });
    }

    // Check if the user already exists by email
    const existingEmail = await User.findOne({ email: cleanEmail });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    // Check if username is taken
    const existingUsername = await User.findOne({
      username: { $regex: new RegExp(`^${cleanUsername}$`, "i") },
    });
    if (existingUsername) {
      return res.status(400).json({
        success: false,
        message: "Username is already taken.",
      });
    }

    // Verify OTP (if provided or required)
    if (otp) {
      const otpRecord = await OTP.findOne({ email: cleanEmail }).sort({ createdAt: -1 });
      if (!otpRecord || otpRecord.otp !== otp.trim()) {
        return res.status(400).json({
          success: false,
          message: "Invalid or expired verification code. Please request a new code.",
        });
      }
      // OTP is valid - clear it so it cannot be reused
      await OTP.deleteMany({ email: cleanEmail });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the user
    const newUser = new User({
      username: cleanUsername,
      email: cleanEmail,
      password: hashedPassword,
      category: category || "Ideate-User",
      isverified: false,
    });

    // Save the new user
    await newUser.save();

    // Return success response
    return res.status(201).json({
      success: true,
      message: "Account created successfully! You can now log in.",
      user: newUser,
    });
  } catch (error) {
    console.error("Registration Error:", error);
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

// 2.5 Social Auth (Google / Facebook via Firebase) with MongoDB Atlas persistence
export const socialAuth = async (req, res) => {
  try {
    const { email, name, profileImage, firebaseUid, authProvider = 'google' } = req.body;

    if (!email || !firebaseUid) {
      return res.status(400).json({
        success: false,
        message: "Email and Firebase UID are required for social login.",
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const provider = ['google', 'facebook'].includes(authProvider.toLowerCase())
      ? authProvider.toLowerCase()
      : 'google';

    // 1. Search for existing user by firebaseUid or email
    let user = await User.findOne({
      $or: [
        { firebaseUid: firebaseUid },
        { email: cleanEmail }
      ]
    });

    if (user) {
      // Check if user is banned
      if (user.isBanned) {
        return res.status(403).json({
          success: false,
          message: "Your account has been banned by an administrator.",
        });
      }

      // Update social credentials / profile info if missing
      let hasUpdates = false;
      if (!user.firebaseUid) {
        user.firebaseUid = firebaseUid;
        hasUpdates = true;
      }
      if (provider === 'google' && !user.googleId) {
        user.googleId = firebaseUid;
        hasUpdates = true;
      }
      if (provider === 'facebook' && !user.facebookId) {
        user.facebookId = firebaseUid;
        hasUpdates = true;
      }
      if (!user.profileImage && profileImage) {
        user.profileImage = profileImage;
        hasUpdates = true;
      }
      if (!user.name && name) {
        user.name = name;
        hasUpdates = true;
      }
      if (hasUpdates) {
        await user.save();
      }

      return await generateToken(res, user, `Welcome back ${user.username}`);
    }

    // 2. New User: Auto-generate a clean, unique username
    let baseUsername = (name ? name.toLowerCase().replace(/[^a-z0-9_]/g, '_') : cleanEmail.split('@')[0].replace(/[^a-z0-9_]/g, '_')).slice(0, 15);
    if (baseUsername.length < 3) {
      baseUsername = `user_${baseUsername}`;
    }

    let uniqueUsername = baseUsername;
    let counter = 1;
    while (await User.findOne({ username: { $regex: new RegExp(`^${uniqueUsername}$`, 'i') } })) {
      const suffix = Math.floor(1000 + Math.random() * 9000).toString();
      uniqueUsername = `${baseUsername.slice(0, 14)}_${suffix}`;
      counter++;
      if (counter > 10) {
        uniqueUsername = `user_${Date.now().toString().slice(-6)}`;
        break;
      }
    }

    // 3. Create user in MongoDB Atlas
    const newUser = await User.create({
      name: name || uniqueUsername,
      username: uniqueUsername,
      email: cleanEmail,
      authProvider: provider,
      firebaseUid: firebaseUid,
      googleId: provider === 'google' ? firebaseUid : null,
      facebookId: provider === 'facebook' ? firebaseUid : null,
      profileImage: profileImage || null,
      category: "Ideate-User",
      reputationScore: 0,
      reputationLevel: "Newcomer",
    });

    return await generateToken(res, newUser, `Welcome to Ideate, ${newUser.username}!`);
  } catch (error) {
    console.error("Social Auth Controller Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error processing social login.",
      error: error.message,
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
    const { limit = 20, category } = req.query;
    const limitNum = Math.min(parseInt(limit) || 20, 50);

    let excludedUserIds = [];
    let currentUserFollowings = [];
    let currentUserTopics = [];

    if (loggedInUserId) {
      const currentUser = await User.findById(loggedInUserId)
        .select("followings blockedUsers mutedUsers followedTopics category")
        .lean();

      if (currentUser) {
        currentUserFollowings = (currentUser.followings || []).map((id) => id.toString());
        currentUserTopics = (currentUser.followedTopics || []).map((id) => id.toString());
        excludedUserIds = [
          loggedInUserId.toString(),
          ...currentUserFollowings,
          ...(currentUser.blockedUsers || []).map((id) => id.toString()),
          ...(currentUser.mutedUsers || []).map((id) => id.toString()),
        ];
      }
    }

    const baseFilter = {
      _id: { $nin: excludedUserIds },
      isBanned: false,
      ...(category && category !== "All" ? { category } : {}),
    };

    // Fetch candidate users
    const candidates = await User.find(baseFilter)
      .select("username profileImage isverified name bio category followers followings followedTopics")
      .limit(60)
      .lean();

    // Deterministic ranking algorithm
    const scoredUsers = candidates.map((user) => {
      let score = 0;
      let reason = "Popular on Ideate";

      // Signal 1: Mutual Followers
      const userFollowers = (user.followers || []).map((id) => id.toString());
      const mutuals = userFollowers.filter((id) => currentUserFollowings.includes(id));
      const mutualCount = mutuals.length;

      if (mutualCount > 0) {
        score += mutualCount * 15;
        reason = `Followed by ${mutualCount} people you follow`;
      }

      // Signal 2: Shared Topics
      const userTopics = (user.followedTopics || []).map((id) => id.toString());
      const sharedTopics = userTopics.filter((id) => currentUserTopics.includes(id));
      if (sharedTopics.length > 0) {
        score += sharedTopics.length * 10;
        if (mutualCount === 0) {
          reason = `Shared interests in topics`;
        }
      }

      // Signal 3: Verified status
      if (user.isverified) {
        score += 8;
      }

      // Signal 4: General Popularity (follower count)
      score += Math.min(userFollowers.length, 50) * 0.5;

      return {
        ...user,
        mutualCount,
        recommendationReason: reason,
        isFollowing: false,
        followersCount: userFollowers.length,
        followingCount: (user.followings || []).length,
        followers: undefined, // remove large arrays
        followings: undefined,
        score,
      };
    });

    scoredUsers.sort((a, b) => b.score - a.score);
    const resultUsers = scoredUsers.slice(0, limitNum);

    return res.status(200).json({
      success: true,
      suggestedUsers: resultUsers,
    });
  } catch (error) {
    console.error("Error fetching suggested users:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching suggested users",
    });
  }
};

// ─── GET /user/followers/:id ──────────────────────────────────────────────
export const getFollowers = async (req, res) => {
  try {
    const targetUserId = req.params.id || req.id;
    const { page = 1, limit = 20, search } = req.query;
    const pageNum = Math.max(parseInt(page) || 1, 1);
    const limitNum = Math.min(parseInt(limit) || 20, 50);
    const skip = (pageNum - 1) * limitNum;

    const user = await User.findById(targetUserId).select("followers").lean();
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    let filter = { _id: { $in: user.followers || [] } };
    if (search && search.trim().length > 0) {
      const regex = new RegExp(search.trim(), "i");
      filter.$or = [{ username: regex }, { name: regex }];
    }

    const [followers, totalItems] = await Promise.all([
      User.find(filter)
        .select("username profileImage name isverified category followers followings")
        .skip(skip)
        .limit(limitNum)
        .lean(),
      User.countDocuments(filter),
    ]);

    let loggedInUserFollowings = new Set();
    if (req.id) {
      const loggedIn = await User.findById(req.id).select("followings").lean();
      if (loggedIn && loggedIn.followings) {
        loggedInUserFollowings = new Set(loggedIn.followings.map((id) => id.toString()));
      }
    }

    const formattedFollowers = followers.map((f) => ({
      ...f,
      isFollowing: loggedInUserFollowings.has(f._id.toString()),
      followerCount: (f.followers || []).length,
      followingCount: (f.followings || []).length,
      followers: undefined,
      followings: undefined,
    }));

    return res.status(200).json({
      success: true,
      followers: formattedFollowers,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalItems,
        totalPages: Math.ceil(totalItems / limitNum),
      },
    });
  } catch (error) {
    console.error("Error in getFollowers:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch followers." });
  }
};

// ─── GET /user/following/:id ──────────────────────────────────────────────
export const getFollowing = async (req, res) => {
  try {
    const targetUserId = req.params.id || req.id;
    const { page = 1, limit = 20, search } = req.query;
    const pageNum = Math.max(parseInt(page) || 1, 1);
    const limitNum = Math.min(parseInt(limit) || 20, 50);
    const skip = (pageNum - 1) * limitNum;

    const user = await User.findById(targetUserId).select("followings").lean();
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    let filter = { _id: { $in: user.followings || [] } };
    if (search && search.trim().length > 0) {
      const regex = new RegExp(search.trim(), "i");
      filter.$or = [{ username: regex }, { name: regex }];
    }

    const [following, totalItems] = await Promise.all([
      User.find(filter)
        .select("username profileImage name isverified category followers followings")
        .skip(skip)
        .limit(limitNum)
        .lean(),
      User.countDocuments(filter),
    ]);

    let loggedInUserFollowings = new Set();
    if (req.id) {
      const loggedIn = await User.findById(req.id).select("followings").lean();
      if (loggedIn && loggedIn.followings) {
        loggedInUserFollowings = new Set(loggedIn.followings.map((id) => id.toString()));
      }
    }

    const formattedFollowing = following.map((f) => ({
      ...f,
      isFollowing: loggedInUserFollowings.has(f._id.toString()),
      followerCount: (f.followers || []).length,
      followingCount: (f.followings || []).length,
      followers: undefined,
      followings: undefined,
    }));

    return res.status(200).json({
      success: true,
      following: formattedFollowing,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalItems,
        totalPages: Math.ceil(totalItems / limitNum),
      },
    });
  } catch (error) {
    console.error("Error in getFollowing:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch following users." });
  }
};

// ─── GET /user/blocked ───────────────────────────────────────────────────
export const getBlockedUsers = async (req, res) => {
  try {
    const userId = req.id;
    const user = await User.findById(userId)
      .populate("blockedUsers", "username profileImage name isverified category")
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    return res.status(200).json({
      success: true,
      blockedUsers: user.blockedUsers || [],
    });
  } catch (error) {
    console.error("Error in getBlockedUsers:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch blocked users." });
  }
};

// ─── GET /user/muted ─────────────────────────────────────────────────────
export const getMutedUsers = async (req, res) => {
  try {
    const userId = req.id;
    const user = await User.findById(userId)
      .populate("mutedUsers", "username profileImage name isverified category")
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    return res.status(200).json({
      success: true,
      mutedUsers: user.mutedUsers || [],
    });
  } catch (error) {
    console.error("Error in getMutedUsers:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch muted users." });
  }
};

// ─── PUT /user/privacy-settings ──────────────────────────────────────────
export const updatePrivacySettings = async (req, res) => {
  try {
    const userId = req.id;
    const { isPrivate, messagePrivacy } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    if (isPrivate !== undefined) {
      user.isPrivate = Boolean(isPrivate);
    }

    if (messagePrivacy && ["everyone", "following", "nobody"].includes(messagePrivacy)) {
      user.messagePrivacy = messagePrivacy;
    }

    await user.save();
    await invalidateCached(`user:profile:${userId}`);

    return res.status(200).json({
      success: true,
      message: "Privacy settings updated.",
      privacy: {
        isPrivate: user.isPrivate,
        messagePrivacy: user.messagePrivacy,
      },
    });
  } catch (error) {
    console.error("Error in updatePrivacySettings:", error);
    return res.status(500).json({ success: false, message: "Failed to update privacy settings." });
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

// Permanent User Self-Service Cascade Account Deletion
export const deleteAccount = async (req, res) => {
  try {
    const userId = req.id;
    const { password } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    // Optional password verification if provided
    if (password) {
      const isPasswordMatch = await bcrypt.compare(password, user.password);
      if (!isPasswordMatch) {
        return res.status(400).json({ success: false, message: "Incorrect password. Account deletion aborted." });
      }
    }

    // Execute full cascade deletion
    const result = await cascadeDeleteUser(userId);

    // Clear authentication cookie
    return res
      .status(200)
      .cookie("token", "", { maxAge: 0 })
      .json(result);
  } catch (error) {
    console.error("Error during deleteAccount:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error during account deletion."
    });
  }
};

/**
 * Change Password for Authenticated User
 */
export const changePassword = async (req, res) => {
  try {
    const userId = req.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required.",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters long.",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Current password does not match.",
      });
    }

    // Hash new password and save
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    // Invalidate Redis profile cache
    await invalidateCached(`user:profile:${userId}`);

    return res.status(200).json({
      success: true,
      message: "Password changed successfully.",
    });
  } catch (error) {
    console.error("Error in changePassword:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while updating password.",
    });
  }
};




