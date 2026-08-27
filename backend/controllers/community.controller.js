import { Community } from "../models/community.model.js";
import { CommunityMember } from "../models/communityMember.model.js";
import { CommunityJoinRequest } from "../models/communityJoinRequest.model.js";
import { CommunityInvite } from "../models/communityInvite.model.js";
import { Post } from "../models/post.model.js";
import { Question } from "../models/question.model.js";
import { Debate } from "../models/debate.model.js";
import { Poll } from "../models/poll.model.js";
import { User } from "../models/user.model.js";
import { Notification } from "../models/notification.model.js";
import { awardReputation } from "./reputation.controller.js";
import { evaluateUserBadges } from "./badge.controller.js";
import crypto from "crypto";

/**
 * POST /community/create
 */
export const createCommunity = async (req, res) => {
  try {
    const creatorId = req.id;
    const { name, handle, description, profileImage, coverImage, category, rules, visibility, tags } = req.body;

    if (!name || name.trim().length < 3) {
      return res.status(400).json({ success: false, message: "Community name must be at least 3 characters." });
    }

    if (!handle || handle.trim().length < 3) {
      return res.status(400).json({ success: false, message: "Handle must be at least 3 alphanumeric characters." });
    }

    const cleanHandle = handle.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    const existingHandle = await Community.findOne({ handle: cleanHandle });
    if (existingHandle) {
      return res.status(400).json({ success: false, message: `Handle @${cleanHandle} is already taken.` });
    }

    const community = await Community.create({
      name: name.trim(),
      handle: cleanHandle,
      description: description ? description.trim() : "",
      profileImage: profileImage || null,
      coverImage: coverImage || null,
      category: category || "General",
      rules: Array.isArray(rules) ? rules : [],
      visibility: visibility || "public",
      creator: creatorId,
      tags: Array.isArray(tags) ? tags : [],
      membersCount: 1,
    });

    // Creator is assigned as Owner in CommunityMember
    await CommunityMember.create({
      community: community._id,
      user: creatorId,
      role: "owner",
      status: "active",
    });

    await User.findByIdAndUpdate(creatorId, {
      $push: { communities: community._id },
    });

    awardReputation({
      userId: creatorId,
      actionType: "community_contribution",
      reason: "Founded a new Ideate community",
      sourceType: "community",
      sourceId: community._id,
    });
    evaluateUserBadges(creatorId);

    return res.status(201).json({
      success: true,
      message: "Community created successfully!",
      community,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error creating community.", error: error.message });
  }
};

/**
 * GET /community/all
 */
export const getAllCommunities = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const category = req.query.category;
    const search = req.query.search;
    const skip = (page - 1) * limit;

    const filter = { isSuspended: false };
    if (category && category !== "All") filter.category = category;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { handle: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const [communities, total] = await Promise.all([
      Community.find(filter)
        .sort({ membersCount: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("creator", "username name profileImage isverified")
        .lean(),
      Community.countDocuments(filter),
    ]);

    // Check membership status for authenticated user
    let userMemberships = new Set();
    if (req.id) {
      const mems = await CommunityMember.find({ user: req.id, status: "active" }).select("community role").lean();
      userMemberships = new Map(mems.map((m) => [m.community.toString(), m.role]));
    }

    const enriched = communities.map((c) => ({
      ...c,
      isMember: userMemberships.has(c._id.toString()),
      myRole: userMemberships.get(c._id.toString()) || null,
    }));

    return res.status(200).json({
      success: true,
      communities: enriched,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error fetching communities." });
  }
};

/**
 * GET /community/by-handle/:handle
 */
export const getCommunityByHandle = async (req, res) => {
  try {
    const { handle } = req.params;
    const community = await Community.findOne({ handle: handle.toLowerCase(), isSuspended: false })
      .populate("creator", "username name profileImage isverified reputationScore")
      .lean();

    if (!community) {
      return res.status(404).json({ success: false, message: "Community not found." });
    }

    let userMembership = null;
    let pendingRequest = false;

    if (req.id) {
      const [member, joinReq] = await Promise.all([
        CommunityMember.findOne({ community: community._id, user: req.id }).lean(),
        CommunityJoinRequest.findOne({ community: community._id, user: req.id, status: "pending" }).lean(),
      ]);
      userMembership = member;
      pendingRequest = Boolean(joinReq);
    }

    return res.status(200).json({
      success: true,
      community: {
        ...community,
        isMember: userMembership && userMembership.status === "active",
        myRole: userMembership?.role || null,
        isPendingJoinRequest: pendingRequest,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error fetching community details." });
  }
};

/**
 * POST /community/:id/join
 */
export const joinCommunity = async (req, res) => {
  try {
    const userId = req.id;
    const { id } = req.params;

    const community = await Community.findById(id);
    if (!community || community.isSuspended) {
      return res.status(404).json({ success: false, message: "Community unavailable." });
    }

    const existingMember = await CommunityMember.findOne({ community: id, user: userId });
    if (existingMember && existingMember.status === "active") {
      return res.status(200).json({ success: true, message: "Already a member.", role: existingMember.role });
    }

    if (community.visibility === "restricted") {
      // Create Join Request
      const existingReq = await CommunityJoinRequest.findOne({ community: id, user: userId });
      if (existingReq && existingReq.status === "pending") {
        return res.status(200).json({ success: true, message: "Join request is already pending approval." });
      }

      await CommunityJoinRequest.findOneAndUpdate(
        { community: id, user: userId },
        { status: "pending", requestedAt: new Date() },
        { upsert: true, new: true }
      );

      return res.status(200).json({
        success: true,
        message: "Join request submitted to community moderators.",
        isPending: true,
      });
    }

    // Public community: Instant join
    await CommunityMember.findOneAndUpdate(
      { community: id, user: userId },
      { role: "member", status: "active", joinedAt: new Date() },
      { upsert: true, new: true }
    );

    community.membersCount = (community.membersCount || 0) + 1;
    await community.save();

    await User.findByIdAndUpdate(userId, {
      $addToSet: { communities: community._id },
    });

    awardReputation({
      userId,
      actionType: "community_contribution",
      reason: `Joined community @${community.handle}`,
      sourceType: "community",
      sourceId: community._id,
    });

    return res.status(200).json({
      success: true,
      message: `Welcome to @${community.handle}!`,
      isMember: true,
      membersCount: community.membersCount,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error joining community." });
  }
};

/**
 * POST /community/:id/leave
 */
export const leaveCommunity = async (req, res) => {
  try {
    const userId = req.id;
    const { id } = req.params;

    const member = await CommunityMember.findOne({ community: id, user: userId });
    if (!member) {
      return res.status(400).json({ success: false, message: "You are not a member of this community." });
    }

    if (member.role === "owner") {
      return res.status(400).json({
        success: false,
        message: "Community owners cannot leave without transferring ownership first.",
      });
    }

    await CommunityMember.deleteOne({ _id: member._id });
    await Community.findByIdAndUpdate(id, { $inc: { membersCount: -1 } });
    await User.findByIdAndUpdate(userId, { $pull: { communities: id } });

    return res.status(200).json({
      success: true,
      message: "You have left the community.",
      isMember: false,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error leaving community." });
  }
};

/**
 * GET /community/:id/feed
 */
export const getCommunityFeed = async (req, res) => {
  try {
    const { id } = req.params;
    const contentType = req.query.type || "all"; // all, posts, questions, debates, polls
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const skip = (page - 1) * limit;

    const community = await Community.findById(id).lean();
    if (!community) {
      return res.status(404).json({ success: false, message: "Community not found." });
    }

    // Privacy check
    if (community.visibility === "private") {
      if (!req.id) {
        return res.status(403).json({ success: false, message: "Private community. Authentication required." });
      }
      const member = await CommunityMember.findOne({ community: id, user: req.id, status: "active" });
      if (!member) {
        return res.status(403).json({ success: false, message: "Private community. You must be an approved member." });
      }
    }

    const promises = [];
    if (contentType === "all" || contentType === "posts") {
      promises.push(
        Post.find({ community: id, status: "active" })
          .sort({ createdAt: -1 })
          .limit(limit)
          .populate("author", "username profileImage isverified")
          .lean()
      );
    } else {
      promises.push(Promise.resolve([]));
    }

    if (contentType === "all" || contentType === "questions") {
      promises.push(
        Question.find({ community: id, status: "active" })
          .sort({ createdAt: -1 })
          .limit(limit)
          .populate("author", "username profileImage isverified")
          .lean()
      );
    } else {
      promises.push(Promise.resolve([]));
    }

    if (contentType === "all" || contentType === "debates") {
      promises.push(
        Debate.find({ community: id, status: { $in: ["active", "closed"] } })
          .sort({ createdAt: -1 })
          .limit(limit)
          .populate("author", "username profileImage isverified")
          .lean()
      );
    } else {
      promises.push(Promise.resolve([]));
    }

    if (contentType === "all" || contentType === "polls") {
      promises.push(
        Poll.find({ community: id, status: { $in: ["open", "closed"] } })
          .sort({ createdAt: -1 })
          .limit(limit)
          .populate("author", "username profileImage isverified")
          .lean()
      );
    } else {
      promises.push(Promise.resolve([]));
    }

    const [posts, questions, debates, polls] = await Promise.all(promises);

    const combined = [
      ...posts.map((p) => ({ ...p, feedType: "post" })),
      ...questions.map((q) => ({ ...q, feedType: "question" })),
      ...debates.map((d) => ({ ...d, feedType: "debate" })),
      ...polls.map((l) => ({ ...l, feedType: "poll" })),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const paginated = combined.slice(skip, skip + limit);

    return res.status(200).json({
      success: true,
      feed: paginated,
      pagination: {
        page,
        limit,
        total: combined.length,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error loading community feed." });
  }
};

/**
 * POST /community/:id/handle-request
 */
export const handleJoinRequest = async (req, res) => {
  try {
    const reviewerId = req.id;
    const { id } = req.params;
    const { requestId, action } = req.body; // 'approve' or 'reject'

    // Check reviewer is admin or owner
    const member = await CommunityMember.findOne({
      community: id,
      user: reviewerId,
      role: { $in: ["owner", "admin", "moderator"] },
      status: "active",
    });
    if (!member) {
      return res.status(403).json({ success: false, message: "Permission denied. Admin or moderator only." });
    }

    const joinReq = await CommunityJoinRequest.findOne({ _id: requestId, community: id, status: "pending" });
    if (!joinReq) {
      return res.status(404).json({ success: false, message: "Join request not found." });
    }

    if (action === "approve") {
      joinReq.status = "approved";
      joinReq.reviewedBy = reviewerId;
      joinReq.reviewedAt = new Date();
      await joinReq.save();

      await CommunityMember.findOneAndUpdate(
        { community: id, user: joinReq.user },
        { role: "member", status: "active", joinedAt: new Date() },
        { upsert: true, new: true }
      );

      await Community.findByIdAndUpdate(id, { $inc: { membersCount: 1 } });
      await User.findByIdAndUpdate(joinReq.user, { $addToSet: { communities: id } });

      await Notification.create({
        recipient: joinReq.user,
        sender: reviewerId,
        type: "community_approved",
        message: "Your request to join the community was approved!",
      });

      return res.status(200).json({ success: true, message: "Member approved!" });
    } else {
      joinReq.status = "rejected";
      joinReq.reviewedBy = reviewerId;
      joinReq.reviewedAt = new Date();
      await joinReq.save();
      return res.status(200).json({ success: true, message: "Request rejected." });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error handling join request." });
  }
};
