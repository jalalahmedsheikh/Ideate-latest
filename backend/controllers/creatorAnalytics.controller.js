import { Post } from "../models/post.model.js";
import { Question } from "../models/question.model.js";
import { Debate } from "../models/debate.model.js";
import { Poll } from "../models/poll.model.js";
import { User } from "../models/user.model.js";

/**
 * GET /creator/analytics?period=28d
 */
export const getCreatorAnalytics = async (req, res) => {
  try {
    const userId = req.id;
    const period = req.query.period || "28d"; // 7d, 28d, 90d, all

    let days = 28;
    if (period === "7d") days = 7;
    else if (period === "90d") days = 90;
    else if (period === "all") days = 365;

    const cutoffDate = new Date(Date.now() - days * 24 * 3600 * 1000);

    const user = await User.findById(userId).select("followers followings createdAt").lean();
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const [posts, questions, debates, polls] = await Promise.all([
      Post.find({ author: userId, createdAt: { $gte: cutoffDate }, status: "active" }).lean(),
      Question.find({ author: userId, createdAt: { $gte: cutoffDate }, status: "active" }).lean(),
      Debate.find({ author: userId, createdAt: { $gte: cutoffDate }, status: { $in: ["active", "closed"] } }).lean(),
      Poll.find({ author: userId, createdAt: { $gte: cutoffDate }, status: { $in: ["open", "closed"] } }).lean(),
    ]);

    // ── Metric Aggregations ─────────────────────────────────────────
    let postLikes = 0, postComments = 0, postSaves = 0, postShares = 0, postViews = 0;
    for (const p of posts) {
      postLikes += p.likes?.length || 0;
      postComments += p.comments?.length || 0;
      postShares += p.shareCount || 0;
      postViews += p.views || (p.likes?.length || 0) * 3 + 1; // estimate if views tracking is fresh
    }

    let questionAnswers = 0, questionUpvotes = 0, questionSaves = 0, questionViews = 0;
    for (const q of questions) {
      questionAnswers += q.answersCount || 0;
      questionUpvotes += q.upvotes?.length || 0;
      questionSaves += q.saves?.length || 0;
      questionViews += q.views || 0;
    }

    let debateVotes = 0, debateArgs = 0, debateParticipants = 0, debateViews = 0;
    for (const d of debates) {
      debateVotes += d.totalVotes || 0;
      debateArgs += d.argumentsCount || 0;
      debateParticipants += d.participantsCount || 0;
      debateViews += d.views || 0;
    }

    let pollVotes = 0, pollShares = 0, pollViews = 0;
    for (const pl of polls) {
      pollVotes += pl.voterCount || (pl.votes?.reduce((a, b) => a + b, 0) || 0);
      pollShares += pl.shareCount || 0;
      pollViews += pl.views || pollVotes * 2;
    }

    const totalViews = postViews + questionViews + debateViews + pollViews;
    const totalInteractions =
      postLikes + postComments + postSaves + postShares +
      questionAnswers + questionUpvotes + questionSaves +
      debateVotes + debateArgs + debateParticipants +
      pollVotes + pollShares;

    const overallEngagementRate = totalViews > 0
      ? Math.min(100, parseFloat(((totalInteractions / totalViews) * 100).toFixed(2)))
      : 0;

    // Content Type Breakdown
    const postEngagementRate = postViews > 0
      ? parseFloat((((postLikes + postComments + postSaves + postShares) / postViews) * 100).toFixed(1))
      : 0;
    const questionEngagementRate = questionViews > 0
      ? parseFloat((((questionAnswers + questionUpvotes + questionSaves) / questionViews) * 100).toFixed(1))
      : 0;
    const debateEngagementRate = debateViews > 0
      ? parseFloat((((debateVotes + debateArgs) / debateViews) * 100).toFixed(1))
      : 0;
    const pollEngagementRate = pollViews > 0
      ? parseFloat(((pollVotes / pollViews) * 100).toFixed(1))
      : 0;

    // Deterministic Data-Driven Insights
    const insights = [];
    if (questions.length > 0 && questionEngagementRate > postEngagementRate) {
      const diff = Math.round(questionEngagementRate - postEngagementRate);
      insights.push(`Your Questions generated ${diff}% higher engagement than standard posts during this period.`);
    }
    if (debates.length > 0 && debateVotes > 0) {
      insights.push(`Your Debates mobilized ${debateVotes} community votes and ${debateArgs} arguments.`);
    }
    if (polls.length > 0) {
      insights.push(`Polls are converting ${pollEngagementRate}% of viewers into active participants.`);
    }
    if (insights.length === 0) {
      insights.push("Publish more questions and debates to unlock deeper comparative insights.");
    }

    return res.status(200).json({
      success: true,
      period,
      overview: {
        totalFollowers: user.followers?.length || 0,
        totalCreations: posts.length + questions.length + debates.length + polls.length,
        totalViews,
        totalInteractions,
        overallEngagementRate,
      },
      contentBreakdown: {
        posts: { count: posts.length, views: postViews, engagementRate: postEngagementRate },
        questions: { count: questions.length, views: questionViews, engagementRate: questionEngagementRate },
        debates: { count: debates.length, views: debateViews, engagementRate: debateEngagementRate },
        polls: { count: polls.length, views: pollViews, engagementRate: pollEngagementRate },
      },
      insights,
    });
  } catch (error) {
    console.error("Error generating creator analytics:", error);
    return res.status(500).json({ success: false, message: "Error calculating analytics." });
  }
};

/**
 * GET /creator/analytics/export?format=json
 */
export const exportCreatorAnalytics = async (req, res) => {
  try {
    const userId = req.id;
    const [posts, questions, debates, polls] = await Promise.all([
      Post.find({ author: userId }).select("caption likes comments shareCount views createdAt").lean(),
      Question.find({ author: userId }).select("title answersCount upvotes views createdAt").lean(),
      Debate.find({ author: userId }).select("title totalVotes argumentsCount views createdAt").lean(),
      Poll.find({ author: userId }).select("question votes voterCount views createdAt").lean(),
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      userId,
      summary: {
        totalPosts: posts.length,
        totalQuestions: questions.length,
        totalDebates: debates.length,
        totalPolls: polls.length,
      },
      data: {
        posts,
        questions,
        debates,
        polls,
      },
    };

    return res.status(200).json({
      success: true,
      export: exportData,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error exporting analytics." });
  }
};
