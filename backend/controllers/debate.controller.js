import { Debate } from "../models/debate.model.js";
import { DebateArgument } from "../models/debateArgument.model.js";
import { User } from "../models/user.model.js";
import { Notification } from "../models/notification.model.js";
import { awardReputation } from "./reputation.controller.js";
import { evaluateUserBadges } from "./badge.controller.js";

/**
 * POST /debate/create
 */
export const createDebate = async (req, res) => {
  try {
    const authorId = req.id;
    const {
      title,
      resolution,
      context,
      topic,
      topics,
      sideALabel,
      sideBLabel,
      sideADescription,
      sideBDescription,
      enableNeutral,
      neutralLabel,
      debateType,
      durationHours,
      community,
      rules,
    } = req.body;

    if (!title || title.trim().length < 5) {
      return res.status(400).json({ success: false, message: "Please provide a debate title (at least 5 characters)." });
    }

    if (!resolution || resolution.trim().length < 5) {
      return res.status(400).json({ success: false, message: "Please provide a clear debate resolution/statement." });
    }

    const hours = typeof durationHours === "number" && durationHours > 0 ? durationHours : 72;
    const deadline = hours > 0 ? new Date(Date.now() + hours * 3600 * 1000) : null;

    const debate = await Debate.create({
      title: title.trim(),
      resolution: resolution.trim(),
      context: context ? context.trim() : "",
      author: authorId,
      topic: topic || (Array.isArray(topics) && topics.length ? topics[0] : null),
      topics: Array.isArray(topics) ? topics : [],
      debateType: debateType || "two_sided",
      sideA: {
        label: sideALabel ? sideALabel.trim() : "Side A (Yes/Pro)",
        description: sideADescription ? sideADescription.trim() : "",
        votesCount: 0,
        participantsCount: 0,
      },
      sideB: {
        label: sideBLabel ? sideBLabel.trim() : "Side B (No/Con)",
        description: sideBDescription ? sideBDescription.trim() : "",
        votesCount: 0,
        participantsCount: 0,
      },
      neutral: {
        enabled: enableNeutral !== false,
        label: neutralLabel ? neutralLabel.trim() : "Neutral / Undecided",
        votesCount: 0,
        participantsCount: 0,
      },
      community: community || null,
      durationHours: hours,
      deadline,
      rules: {
        maxArgumentLength: rules?.maxArgumentLength || 3000,
        allowSideSwitch: rules?.allowSideSwitch !== false,
        maxSwitches: rules?.maxSwitches || 2,
        requireEvidence: Boolean(rules?.requireEvidence),
      },
      participants: [],
    });

    await User.findByIdAndUpdate(authorId, {
      $push: { debates: debate._id },
    });

    awardReputation({
      userId: authorId,
      actionType: "constructive_debate",
      reason: "Initiated a new structured debate",
      sourceType: "debate",
      sourceId: debate._id,
    });
    evaluateUserBadges(authorId);

    const populated = await Debate.findById(debate._id)
      .populate("author", "username name profileImage isverified reputationScore reputationLevel")
      .populate("topic", "name icon");

    return res.status(201).json({
      success: true,
      message: "Debate opened successfully!",
      debate: populated,
    });
  } catch (error) {
    console.error("Error creating debate:", error);
    return res.status(500).json({ success: false, message: "Error creating debate.", error: error.message });
  }
};

/**
 * GET /debate/all
 */
export const getAllDebates = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const sort = req.query.sort || "active"; // active, newest, top, concluded
    const topicId = req.query.topic;
    const communityId = req.query.community;
    const skip = (page - 1) * limit;

    const filter = {};
    if (sort === "active") filter.status = "active";
    if (sort === "concluded") filter.status = "closed";
    if (topicId) filter.topics = topicId;
    if (communityId) filter.community = communityId;

    let sortOptions = { createdAt: -1 };
    if (sort === "top") sortOptions = { totalVotes: -1, argumentsCount: -1 };

    const [debates, totalDebates] = await Promise.all([
      Debate.find(filter)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .populate("author", "username name profileImage isverified reputationScore reputationLevel")
        .populate("topic", "name icon")
        .populate("community", "name handle profileImage")
        .lean(),
      Debate.countDocuments(filter),
    ]);

    // Format debate calculations
    const formatted = debates.map((d) => calculateDebateStats(d));

    return res.status(200).json({
      success: true,
      debates: formatted,
      pagination: {
        page,
        limit,
        totalDebates,
        totalPages: Math.ceil(totalDebates / limit),
        hasNextPage: skip + debates.length < totalDebates,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error fetching debates." });
  }
};

/**
 * GET /debate/:id
 */
export const getDebateById = async (req, res) => {
  try {
    const { id } = req.params;
    const debate = await Debate.findById(id)
      .populate("author", "username name profileImage isverified reputationScore reputationLevel bio")
      .populate("topic", "name icon")
      .populate("community", "name handle profileImage");

    if (!debate) {
      return res.status(404).json({ success: false, message: "Debate not found." });
    }

    // Auto close if past deadline
    if (debate.status === "active" && debate.deadline && new Date() > new Date(debate.deadline)) {
      debate.status = "closed";
      await debate.save();
    }

    debate.views = (debate.views || 0) + 1;
    await debate.save();

    const stats = calculateDebateStats(debate.toObject());

    // Check current user participant state if authenticated
    let userState = null;
    if (req.id) {
      const p = debate.participants.find((item) => item.user?.toString() === req.id.toString());
      if (p) {
        userState = {
          side: p.side,
          switchesCount: p.switchesCount,
          hasVoted: p.hasVoted,
          votedSide: p.votedSide,
        };
      }
    }

    return res.status(200).json({
      success: true,
      debate: {
        ...stats,
        userState,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error fetching debate details." });
  }
};

/**
 * POST /debate/:id/join-side
 */
export const joinSide = async (req, res) => {
  try {
    const userId = req.id;
    const { id } = req.params;
    const { side } = req.body; // 'sideA', 'sideB', 'neutral'

    if (!["sideA", "sideB", "neutral"].includes(side)) {
      return res.status(400).json({ success: false, message: "Invalid debate side." });
    }

    const debate = await Debate.findById(id);
    if (!debate || debate.status !== "active") {
      return res.status(400).json({ success: false, message: "This debate is not accepting side registrations." });
    }

    let participant = debate.participants.find((p) => p.user?.toString() === userId.toString());

    if (participant) {
      // User is already in the debate — check if switching sides
      if (participant.side === side) {
        return res.status(200).json({ success: true, message: `You are already on ${side}.`, side });
      }

      if (!debate.rules.allowSideSwitch) {
        return res.status(400).json({ success: false, message: "Side switching is disabled for this debate." });
      }

      if (participant.switchesCount >= (debate.rules.maxSwitches || 2)) {
        return res.status(400).json({ success: false, message: "Maximum side switches limit reached." });
      }

      // Decrement previous side participant count
      if (participant.side === "sideA" && debate.sideA.participantsCount > 0) debate.sideA.participantsCount--;
      if (participant.side === "sideB" && debate.sideB.participantsCount > 0) debate.sideB.participantsCount--;
      if (participant.side === "neutral" && debate.neutral.participantsCount > 0) debate.neutral.participantsCount--;

      // Increment new side
      if (side === "sideA") debate.sideA.participantsCount++;
      if (side === "sideB") debate.sideB.participantsCount++;
      if (side === "neutral") debate.neutral.participantsCount++;

      participant.side = side;
      participant.switchesCount++;
    } else {
      // New participant
      debate.participants.push({
        user: userId,
        side,
        switchesCount: 0,
        hasVoted: false,
        votedSide: null,
      });

      if (side === "sideA") debate.sideA.participantsCount++;
      if (side === "sideB") debate.sideB.participantsCount++;
      if (side === "neutral") debate.neutral.participantsCount++;
      debate.participantsCount = (debate.participantsCount || 0) + 1;
    }

    await debate.save();

    return res.status(200).json({
      success: true,
      message: `Joined ${side}!`,
      side,
      switchesCount: participant ? participant.switchesCount : 0,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error joining side." });
  }
};

/**
 * POST /debate/:id/vote
 */
export const voteDebateSide = async (req, res) => {
  try {
    const userId = req.id;
    const { id } = req.params;
    const { side } = req.body; // 'sideA', 'sideB', 'neutral'

    if (!["sideA", "sideB", "neutral"].includes(side)) {
      return res.status(400).json({ success: false, message: "Invalid debate side for voting." });
    }

    const debate = await Debate.findById(id);
    if (!debate || debate.status !== "active") {
      return res.status(400).json({ success: false, message: "Voting is closed for this debate." });
    }

    let participant = debate.participants.find((p) => p.user?.toString() === userId.toString());

    if (!participant) {
      // Automatically register as participant on that side
      debate.participants.push({
        user: userId,
        side,
        switchesCount: 0,
        hasVoted: true,
        votedSide: side,
      });
      if (side === "sideA") {
        debate.sideA.votesCount++;
        debate.sideA.participantsCount++;
      } else if (side === "sideB") {
        debate.sideB.votesCount++;
        debate.sideB.participantsCount++;
      } else if (side === "neutral") {
        debate.neutral.votesCount++;
        debate.neutral.participantsCount++;
      }
      debate.totalVotes = (debate.totalVotes || 0) + 1;
      debate.participantsCount = (debate.participantsCount || 0) + 1;
    } else {
      if (participant.hasVoted && participant.votedSide === side) {
        return res.status(200).json({ success: true, message: "Vote already recorded.", votedSide: side });
      }

      // Decrement previous vote if switching vote
      if (participant.votedSide === "sideA" && debate.sideA.votesCount > 0) debate.sideA.votesCount--;
      if (participant.votedSide === "sideB" && debate.sideB.votesCount > 0) debate.sideB.votesCount--;
      if (participant.votedSide === "neutral" && debate.neutral.votesCount > 0) debate.neutral.votesCount--;

      // Increment new vote
      if (side === "sideA") debate.sideA.votesCount++;
      if (side === "sideB") debate.sideB.votesCount++;
      if (side === "neutral") debate.neutral.votesCount++;

      if (!participant.hasVoted) {
        debate.totalVotes = (debate.totalVotes || 0) + 1;
      }
      participant.hasVoted = true;
      participant.votedSide = side;
    }

    await debate.save();

    awardReputation({
      userId,
      actionType: "poll_participation",
      reason: "Voted in a structured debate",
      sourceType: "debate",
      sourceId: debate._id,
    });

    const stats = calculateDebateStats(debate.toObject());

    return res.status(200).json({
      success: true,
      message: "Vote recorded successfully!",
      votedSide: side,
      stats,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error voting in debate." });
  }
};

/**
 * POST /debate/:id/argument
 */
export const addArgument = async (req, res) => {
  try {
    const authorId = req.id;
    const { id } = req.params;
    const { side, text, evidenceLinks } = req.body;

    if (!text || text.trim().length < 5) {
      return res.status(400).json({ success: false, message: "Argument text must be at least 5 characters." });
    }

    if (!["sideA", "sideB", "neutral"].includes(side)) {
      return res.status(400).json({ success: false, message: "Must specify a valid side for your argument." });
    }

    const debate = await Debate.findById(id);
    if (!debate || debate.status !== "active") {
      return res.status(400).json({ success: false, message: "This debate is not accepting new arguments." });
    }

    if (text.length > (debate.rules.maxArgumentLength || 3000)) {
      return res.status(400).json({
        success: false,
        message: `Argument exceeds the maximum length of ${debate.rules.maxArgumentLength || 3000} characters.`,
      });
    }

    const argument = await DebateArgument.create({
      debate: id,
      author: authorId,
      side,
      text: text.trim(),
      evidenceLinks: Array.isArray(evidenceLinks) ? evidenceLinks : [],
    });

    debate.argumentsCount = (debate.argumentsCount || 0) + 1;
    await debate.save();

    // Reward constructive debater
    awardReputation({
      userId: authorId,
      actionType: "constructive_debate",
      reason: "Submitted an evidence-backed argument to a debate",
      sourceType: "argument",
      sourceId: argument._id,
    });
    evaluateUserBadges(authorId);

    // Notify debate author if not self
    if (debate.author.toString() !== authorId.toString()) {
      await Notification.create({
        recipient: debate.author,
        sender: authorId,
        type: "debate_argument",
        message: `posted a new argument on your debate: "${debate.title.substring(0, 50)}..."`,
      });
    }

    const populated = await DebateArgument.findById(argument._id)
      .populate("author", "username name profileImage isverified reputationScore reputationLevel");

    return res.status(201).json({
      success: true,
      message: "Argument posted!",
      argument: populated,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error posting argument." });
  }
};

/**
 * GET /debate/:id/arguments
 */
export const getDebateArguments = async (req, res) => {
  try {
    const { id } = req.params;
    const side = req.query.side; // 'all', 'sideA', 'sideB', 'neutral'
    const sort = req.query.sort || "top"; // top, newest

    const filter = { debate: id, status: "active" };
    if (side && side !== "all") {
      filter.side = side;
    }

    let sortOptions = { upvotes: -1, createdAt: -1 };
    if (sort === "newest") {
      sortOptions = { createdAt: -1 };
    }

    const args = await DebateArgument.find(filter)
      .sort(sortOptions)
      .populate("author", "username name profileImage isverified reputationScore reputationLevel")
      .populate("replies.author", "username profileImage isverified")
      .lean();

    return res.status(200).json({
      success: true,
      arguments: args,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error fetching arguments." });
  }
};

/**
 * POST /debate/argument/:argumentId/react
 */
export const reactArgument = async (req, res) => {
  try {
    const userId = req.id;
    const { argumentId } = req.params;
    const { reactionType } = req.body; // 'compelling', 'factual', 'wellReasoned', or 'upvote'

    const argument = await DebateArgument.findById(argumentId);
    if (!argument) {
      return res.status(404).json({ success: false, message: "Argument not found." });
    }

    if (reactionType === "upvote") {
      const hasUpvoted = argument.upvotes.some((u) => u.toString() === userId.toString());
      if (hasUpvoted) {
        argument.upvotes = argument.upvotes.filter((u) => u.toString() !== userId.toString());
      } else {
        argument.upvotes.push(userId);
      }
    } else if (["compelling", "factual", "wellReasoned"].includes(reactionType)) {
      const list = argument.reactions[reactionType] || [];
      const hasReacted = list.some((u) => u.toString() === userId.toString());
      if (hasReacted) {
        argument.reactions[reactionType] = list.filter((u) => u.toString() !== userId.toString());
      } else {
        list.push(userId);
        argument.reactions[reactionType] = list;
      }
    }

    await argument.save();

    return res.status(200).json({
      success: true,
      upvotesCount: argument.upvotes.length,
      reactions: {
        compelling: argument.reactions.compelling?.length || 0,
        factual: argument.reactions.factual?.length || 0,
        wellReasoned: argument.reactions.wellReasoned?.length || 0,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error reacting to argument." });
  }
};

// Calculation helper for percentages and most supported position
const calculateDebateStats = (debate) => {
  const total = (debate.sideA?.votesCount || 0) + (debate.sideB?.votesCount || 0) + (debate.neutral?.votesCount || 0);
  const sideAPct = total > 0 ? Math.round(((debate.sideA?.votesCount || 0) / total) * 100) : 0;
  const sideBPct = total > 0 ? Math.round(((debate.sideB?.votesCount || 0) / total) * 100) : 0;
  const neutralPct = total > 0 ? 100 - sideAPct - sideBPct : 0;

  let mostSupported = "Evenly Split";
  if (sideAPct > sideBPct && sideAPct > neutralPct) {
    mostSupported = debate.sideA?.label || "Side A";
  } else if (sideBPct > sideAPct && sideBPct > neutralPct) {
    mostSupported = debate.sideB?.label || "Side B";
  }

  return {
    ...debate,
    stats: {
      totalVotes: total,
      sideAPercentage: sideAPct,
      sideBPercentage: sideBPct,
      neutralPercentage: neutralPct,
      mostSupportedPosition: mostSupported,
      isConcluded: debate.status === "closed" || (debate.deadline && new Date() > new Date(debate.deadline)),
    },
  };
};
