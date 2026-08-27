import { Question } from "../models/question.model.js";
import { Answer } from "../models/answer.model.js";
import { User } from "../models/user.model.js";
import { Notification } from "../models/notification.model.js";
import { awardReputation } from "./reputation.controller.js";
import { evaluateUserBadges } from "./badge.controller.js";

/**
 * POST /question/create
 */
export const createQuestion = async (req, res) => {
  try {
    const authorId = req.id;
    const { title, description, topics, community, questionType, isAnonymous, visibility } = req.body;

    if (!title || title.trim().length < 5) {
      return res.status(400).json({ success: false, message: "Please provide a question title (at least 5 characters)." });
    }

    if (title.trim().length > 300) {
      return res.status(400).json({ success: false, message: "Question title cannot exceed 300 characters." });
    }

    // Check user account status
    const author = await User.findById(authorId);
    if (!author || author.isBanned) {
      return res.status(403).json({ success: false, message: "Your account is not permitted to ask questions." });
    }

    const newQuestion = await Question.create({
      title: title.trim(),
      description: description ? description.trim() : "",
      author: authorId,
      topics: Array.isArray(topics) ? topics : [],
      community: community || null,
      questionType: questionType || "general",
      isAnonymous: Boolean(isAnonymous),
      visibility: visibility || "public",
    });

    // Update user's question references
    await User.findByIdAndUpdate(authorId, {
      $push: { questions: newQuestion._id },
    });

    // Award reputation & evaluate badges
    awardReputation({
      userId: authorId,
      actionType: "quality_post",
      reason: "Asked a new question",
      sourceType: "question",
      sourceId: newQuestion._id,
    });
    evaluateUserBadges(authorId);

    const populated = await Question.findById(newQuestion._id)
      .populate("author", "username name profileImage isverified reputationScore reputationLevel")
      .populate("topics", "name icon");

    return res.status(201).json({
      success: true,
      message: "Question asked successfully!",
      question: populated,
    });
  } catch (error) {
    console.error("Error creating question:", error);
    return res.status(500).json({ success: false, message: "Server error creating question.", error: error.message });
  }
};

/**
 * POST /question/detect-duplicates
 */
export const detectDuplicates = async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || query.trim().length < 4) {
      return res.status(200).json({ success: true, duplicates: [] });
    }

    // Extract significant keywords
    const keywords = query
      .replace(/[^\w\s]/gi, "")
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .slice(0, 6);

    if (keywords.length === 0) {
      return res.status(200).json({ success: true, duplicates: [] });
    }

    const regexArray = keywords.map((k) => new RegExp(k, "i"));
    const matches = await Question.find({
      status: "active",
      $or: [
        { title: { $in: regexArray } },
        { description: { $in: regexArray } },
      ],
    })
      .select("title answersCount upvotes createdAt views acceptedAnswer")
      .populate("author", "username profileImage isverified")
      .limit(5)
      .lean();

    return res.status(200).json({
      success: true,
      duplicates: matches,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error detecting duplicate questions." });
  }
};

/**
 * GET /question/all
 */
export const getAllQuestions = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const sort = req.query.sort || "newest"; // newest, top, most_discussed, unanswered
    const topicId = req.query.topic;
    const communityId = req.query.community;
    const skip = (page - 1) * limit;

    const filter = { status: "active" };
    if (topicId) filter.topics = topicId;
    if (communityId) filter.community = communityId;
    if (sort === "unanswered") filter.answersCount = 0;

    let sortOptions = { createdAt: -1 };
    if (sort === "top") sortOptions = { views: -1, createdAt: -1 };
    if (sort === "most_discussed") sortOptions = { answersCount: -1, createdAt: -1 };

    const [questions, totalQuestions] = await Promise.all([
      Question.find(filter)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .populate("author", "username name profileImage isverified reputationScore reputationLevel")
        .populate("topics", "name icon")
        .populate("community", "name handle profileImage")
        .populate("acceptedAnswer")
        .lean(),
      Question.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      questions,
      pagination: {
        page,
        limit,
        totalQuestions,
        totalPages: Math.ceil(totalQuestions / limit),
        hasNextPage: skip + questions.length < totalQuestions,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error fetching questions." });
  }
};

/**
 * GET /question/:id
 */
export const getQuestionById = async (req, res) => {
  try {
    const { id } = req.params;
    const question = await Question.findById(id)
      .populate("author", "username name profileImage isverified reputationScore reputationLevel bio")
      .populate("topics", "name icon")
      .populate("community", "name handle profileImage")
      .populate({
        path: "acceptedAnswer",
        populate: { path: "author", select: "username name profileImage isverified reputationScore" },
      });

    if (!question || question.status === "deleted") {
      return res.status(404).json({ success: false, message: "Question not found or deleted." });
    }

    // Increment views atomically
    question.views = (question.views || 0) + 1;
    await question.save();

    return res.status(200).json({
      success: true,
      question,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error fetching question details." });
  }
};

/**
 * POST /question/:id/answer
 */
export const addAnswer = async (req, res) => {
  try {
    const authorId = req.id;
    const { id } = req.params;
    const { content } = req.body;

    if (!content || content.trim().length < 2) {
      return res.status(400).json({ success: false, message: "Please enter a valid answer." });
    }

    const question = await Question.findById(id);
    if (!question || question.status !== "active") {
      return res.status(404).json({ success: false, message: "Question is no longer accepting answers." });
    }

    const answer = await Answer.create({
      question: id,
      author: authorId,
      content: content.trim(),
    });

    question.answersCount = (question.answersCount || 0) + 1;
    await question.save();

    // Reward reputation if author is answering another user's question
    if (question.author.toString() !== authorId.toString()) {
      awardReputation({
        userId: authorId,
        actionType: "helpful_answer",
        reason: "Provided an answer to a community question",
        sourceType: "answer",
        sourceId: answer._id,
        actorId: authorId,
      });

      // Send notification to question author
      await Notification.create({
        recipient: question.author,
        sender: authorId,
        type: "question_answered",
        message: `answered your question: "${question.title.substring(0, 60)}..."`,
      });
    }

    evaluateUserBadges(authorId);

    const populatedAnswer = await Answer.findById(answer._id)
      .populate("author", "username name profileImage isverified reputationScore reputationLevel");

    return res.status(201).json({
      success: true,
      message: "Answer published successfully!",
      answer: populatedAnswer,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error posting answer." });
  }
};

/**
 * GET /question/:id/answers
 */
export const getQuestionAnswers = async (req, res) => {
  try {
    const { id } = req.params;
    const sort = req.query.sort || "top"; // top, newest, most_discussed

    let sortOptions = { isAccepted: -1, upvotes: -1, createdAt: -1 };
    if (sort === "newest") {
      sortOptions = { isAccepted: -1, createdAt: -1 };
    } else if (sort === "most_discussed") {
      sortOptions = { isAccepted: -1, "replies.length": -1, createdAt: -1 };
    }

    const answers = await Answer.find({ question: id, status: "active" })
      .sort(sortOptions)
      .populate("author", "username name profileImage isverified reputationScore reputationLevel")
      .populate("replies.author", "username profileImage isverified")
      .lean();

    return res.status(200).json({
      success: true,
      answers,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error fetching answers." });
  }
};

/**
 * POST /question/:id/accept-answer
 */
export const acceptAnswer = async (req, res) => {
  try {
    const userId = req.id;
    const { id } = req.params;
    const { answerId } = req.body;

    const question = await Question.findById(id);
    if (!question) {
      return res.status(404).json({ success: false, message: "Question not found." });
    }

    if (question.author.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: "Only the question author can accept an answer." });
    }

    const answer = await Answer.findById(answerId);
    if (!answer || answer.question.toString() !== id) {
      return res.status(404).json({ success: false, message: "Answer not found for this question." });
    }

    // Reset previous accepted answer if any
    if (question.acceptedAnswer) {
      await Answer.findByIdAndUpdate(question.acceptedAnswer, { isAccepted: false });
    }

    // If tapping the already accepted answer, toggle off
    if (question.acceptedAnswer && question.acceptedAnswer.toString() === answerId) {
      question.acceptedAnswer = null;
      answer.isAccepted = false;
      await Promise.all([question.save(), answer.save()]);
      return res.status(200).json({ success: true, message: "Accepted answer unselected.", acceptedAnswer: null });
    }

    question.acceptedAnswer = answerId;
    answer.isAccepted = true;
    await Promise.all([question.save(), answer.save()]);

    // Award bonus reputation to the accepted answer's author
    if (answer.author.toString() !== userId.toString()) {
      await awardReputation({
        userId: answer.author,
        actionType: "accepted_answer",
        reason: `Answer accepted on: "${question.title.substring(0, 50)}"`,
        sourceType: "answer",
        sourceId: answer._id,
      });

      evaluateUserBadges(answer.author);

      await Notification.create({
        recipient: answer.author,
        sender: userId,
        type: "answer_accepted",
        message: `marked your answer as the Accepted Answer! (+15 Reputation)`,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Answer marked as Accepted!",
      acceptedAnswer: answerId,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error accepting answer." });
  }
};

/**
 * POST /question/:id/follow
 */
export const toggleFollowQuestion = async (req, res) => {
  try {
    const userId = req.id;
    const { id } = req.params;

    const question = await Question.findById(id);
    if (!question) {
      return res.status(404).json({ success: false, message: "Question not found." });
    }

    const isFollowing = question.followers.some((f) => f.toString() === userId.toString());
    if (isFollowing) {
      question.followers = question.followers.filter((f) => f.toString() !== userId.toString());
    } else {
      question.followers.push(userId);
    }
    await question.save();

    return res.status(200).json({
      success: true,
      isFollowing: !isFollowing,
      followersCount: question.followers.length,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error following question." });
  }
};

/**
 * POST /question/:id/vote
 */
export const voteQuestion = async (req, res) => {
  try {
    const userId = req.id;
    const { id } = req.params;
    const { voteType } = req.body; // 'upvote' or 'downvote'

    const question = await Question.findById(id);
    if (!question) {
      return res.status(404).json({ success: false, message: "Question not found." });
    }

    const isUpvoted = question.upvotes.some((u) => u.toString() === userId.toString());
    const isDownvoted = question.downvotes.some((d) => d.toString() === userId.toString());

    if (voteType === "upvote") {
      if (isUpvoted) {
        question.upvotes = question.upvotes.filter((u) => u.toString() !== userId.toString());
      } else {
        question.upvotes.push(userId);
        question.downvotes = question.downvotes.filter((d) => d.toString() !== userId.toString());
        // Reputation reward for question author
        awardReputation({
          userId: question.author,
          actionType: "upvote_received",
          reason: "Received upvote on question",
          sourceType: "question",
          sourceId: question._id,
          actorId: userId,
        });
      }
    } else if (voteType === "downvote") {
      if (isDownvoted) {
        question.downvotes = question.downvotes.filter((d) => d.toString() !== userId.toString());
      } else {
        question.downvotes.push(userId);
        question.upvotes = question.upvotes.filter((u) => u.toString() !== userId.toString());
      }
    }

    await question.save();

    return res.status(200).json({
      success: true,
      upvotesCount: question.upvotes.length,
      downvotesCount: question.downvotes.length,
      userVoted: question.upvotes.some((u) => u.toString() === userId.toString())
        ? "upvote"
        : question.downvotes.some((d) => d.toString() === userId.toString())
        ? "downvote"
        : null,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error voting on question." });
  }
};

/**
 * POST /question/answer/:answerId/vote
 */
export const voteAnswer = async (req, res) => {
  try {
    const userId = req.id;
    const { answerId } = req.params;
    const { voteType } = req.body; // 'upvote' or 'downvote'

    const answer = await Answer.findById(answerId);
    if (!answer) {
      return res.status(404).json({ success: false, message: "Answer not found." });
    }

    const isUpvoted = answer.upvotes.some((u) => u.toString() === userId.toString());
    const isDownvoted = answer.downvotes.some((d) => d.toString() === userId.toString());

    if (voteType === "upvote") {
      if (isUpvoted) {
        answer.upvotes = answer.upvotes.filter((u) => u.toString() !== userId.toString());
      } else {
        answer.upvotes.push(userId);
        answer.downvotes = answer.downvotes.filter((d) => d.toString() !== userId.toString());
        awardReputation({
          userId: answer.author,
          actionType: "upvote_received",
          reason: "Received upvote on helpful answer",
          sourceType: "answer",
          sourceId: answer._id,
          actorId: userId,
        });
      }
    } else if (voteType === "downvote") {
      if (isDownvoted) {
        answer.downvotes = answer.downvotes.filter((d) => d.toString() !== userId.toString());
      } else {
        answer.downvotes.push(userId);
        answer.upvotes = answer.upvotes.filter((u) => u.toString() !== userId.toString());
      }
    }

    await answer.save();

    return res.status(200).json({
      success: true,
      upvotesCount: answer.upvotes.length,
      downvotesCount: answer.downvotes.length,
      userVoted: answer.upvotes.some((u) => u.toString() === userId.toString())
        ? "upvote"
        : answer.downvotes.some((d) => d.toString() === userId.toString())
        ? "downvote"
        : null,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error voting on answer." });
  }
};
