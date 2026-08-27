import mongoose from "mongoose";
import { User } from "../models/user.model.js";
import { Question } from "../models/question.model.js";
import { Answer } from "../models/answer.model.js";
import { Debate } from "../models/debate.model.js";
import { DebateArgument } from "../models/debateArgument.model.js";
import { Poll } from "../models/poll.model.js";
import { Community } from "../models/community.model.js";
import { CommunityMember } from "../models/communityMember.model.js";
import { Reputation } from "../models/reputation.model.js";
import { Badge } from "../models/badge.model.js";
import { UserBadge } from "../models/userBadge.model.js";
import { CreatorProfile } from "../models/creatorProfile.model.js";
import { initializeBadges, evaluateUserBadges } from "../controllers/badge.controller.js";
import { awardReputation } from "../controllers/reputation.controller.js";

async function runPhase3Tests() {
  console.log("==================================================");
  console.log("🚀 TESTING PHASE 3: IDEATE IDENTITY COMPLETE STACK");
  console.log("==================================================");

  const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/ideate";
  await mongoose.connect(MONGO_URI);
  console.log("✓ Connected to MongoDB test instance.");

  try {
    // ── 1. Badge System Initialization ──
    console.log("\n--- Testing 1: Badge Catalog & Seeding ---");
    await initializeBadges();
    const badgesCount = await Badge.countDocuments();
    console.log(`✓ Seeded Badges Count: ${badgesCount} (Expected >= 8)`);
    if (badgesCount < 8) throw new Error("Badge catalog seeding failed.");

    // ── 2. Create Test Users ──
    console.log("\n--- Testing 2: User Creation & Reputation Engine ---");
    const testTimestamp = Date.now();
    const userA = await User.create({
      username: `thinker_a_${testTimestamp}`,
      email: `thinker_a_${testTimestamp}@ideate.test`,
      password: "hashedpassword123",
      name: "Alex Dev",
    });

    const userB = await User.create({
      username: `debater_b_${testTimestamp}`,
      email: `debater_b_${testTimestamp}@ideate.test`,
      password: "hashedpassword123",
      name: "Sam Scholar",
    });

    console.log(`✓ Created test users: @${userA.username}, @${userB.username}`);

    // Award reputation to User A
    const repResult = await awardReputation({
      userId: userA._id,
      actionType: "quality_post",
      reason: "Published high quality thesis",
      sourceType: "post",
    });
    console.log(`✓ Reputation Awarded: Score = ${repResult.score}, Level = ${repResult.level}`);

    // ── 3. Questions & Answers Ecosystem ──
    console.log("\n--- Testing 3: Questions & Accepted Answers ---");
    const question = await Question.create({
      title: "What is the most effective concurrency pattern in modern backend architecture?",
      description: "Comparing Actor model vs CSP (Communicating Sequential Processes) for distributed systems.",
      author: userA._id,
      questionType: "technical",
    });
    console.log(`✓ Question created: "${question.title.substring(0, 45)}..."`);

    // User B answers question
    const answer = await Answer.create({
      question: question._id,
      author: userB._id,
      content: "CSP using channels provides explicit ownership and deterministic memory semantics.",
    });
    question.answersCount = 1;
    await question.save();
    console.log(`✓ User B answered question.`);

    // User A marks answer as Accepted
    question.acceptedAnswer = answer._id;
    answer.isAccepted = true;
    await Promise.all([question.save(), answer.save()]);

    await awardReputation({
      userId: userB._id,
      actionType: "accepted_answer",
      reason: "Answer accepted",
      sourceType: "answer",
      sourceId: answer._id,
    });
    console.log(`✓ Answer accepted and reputation awarded (+15 points to User B).`);

    // Check badge evaluation for User B
    const awarded = await evaluateUserBadges(userB._id);
    console.log(`✓ Badges evaluated for User B: Earned ${awarded.length} new badges.`);

    // ── 4. Structured Debate Mode ──
    console.log("\n--- Testing 4: Debate Mode (Side A vs Side B vs Neutral) ---");
    const debate = await Debate.create({
      title: "Monolith vs Microservices for Early Stage Startups",
      resolution: "Early stage startups should always start with a modular monolith.",
      author: userA._id,
      sideA: { label: "Modular Monolith", description: "Simpler deployments and lower overhead.", votesCount: 1, participantsCount: 1 },
      sideB: { label: "Microservices", description: "Independent scalability from day 1.", votesCount: 0, participantsCount: 0 },
      neutral: { enabled: true, label: "Depends on domain", votesCount: 0, participantsCount: 0 },
      durationHours: 48,
      participants: [{ user: userA._id, side: "sideA", hasVoted: true, votedSide: "sideA" }],
      totalVotes: 1,
      participantsCount: 1,
    });
    console.log(`✓ Debate created: "${debate.title}"`);

    // User B adds argument on Side A with evidence
    const argument = await DebateArgument.create({
      debate: debate._id,
      author: userB._id,
      side: "sideA",
      text: "Martin Fowler's MonolithFirst pattern demonstrates that premature decomposition increases coordination cost.",
      evidenceLinks: [{ title: "Monolith First", url: "https://martinfowler.com/bliki/MonolithFirst.html" }],
    });
    debate.argumentsCount = 1;
    await debate.save();
    console.log(`✓ Evidence-backed argument posted: "${argument.text.substring(0, 50)}..."`);

    // ── 5. Advanced Polls with Vote Changes & Concurrency ──
    console.log("\n--- Testing 5: Advanced Polls & Transactional Voting ---");
    const poll = await Poll.create({
      question: "Which database paradigm do you prefer for scalable graph topologies?",
      options: ["Relational (PostgreSQL/CTE)", "Native Graph (Neo4j)", "Document (MongoDB)", "Multi-Model (ArangoDB)"],
      pollType: "multiple_choice",
      author: userA._id,
      settings: { minSelections: 1, maxSelections: 2, allowVoteChange: true },
      votes: [0, 0, 0, 0],
    });

    // User B votes on Option 1 (Native Graph)
    await poll.recordVote(userB._id, { optionIndex: 1 });
    console.log(`✓ User B voted on option index 1. Votes: [${poll.votes.join(", ")}]`);

    // User B changes vote to Option 0 (Relational)
    await poll.recordVote(userB._id, { optionIndex: 0 });
    console.log(`✓ User B changed vote to option index 0. Votes: [${poll.votes.join(", ")}] (Option 1 decremented, Option 0 incremented)`);
    if (poll.votes[1] !== 0 || poll.votes[0] !== 1) {
      throw new Error("Poll vote change calculation failed.");
    }

    // ── 6. Communities & Role Authorization ──
    console.log("\n--- Testing 6: Communities & Memberships ---");
    const community = await Community.create({
      name: "Distributed Systems Architecture",
      handle: `dist_sys_${testTimestamp}`,
      description: "Discussions on consensus protocols, Raft, Paxos, and low-latency clustering.",
      creator: userA._id,
      category: "Technology",
      membersCount: 2,
    });

    await CommunityMember.create({
      community: community._id,
      user: userA._id,
      role: "owner",
    });

    await CommunityMember.create({
      community: community._id,
      user: userB._id,
      role: "member",
    });
    console.log(`✓ Community @${community.handle} created with Owner @${userA.username} and Member @${userB.username}`);

    // ── 7. Creator Mode & Creator Analytics ──
    console.log("\n--- Testing 7: Creator Profile & Analytics ---");
    userA.isCreator = true;
    await userA.save();

    const creatorProfile = await CreatorProfile.create({
      user: userA._id,
      isCreatorEnabled: true,
      intro: "Distributed Systems Engineer & Technical Writer.",
      expertise: ["Distributed Systems", "Database Internals", "TensorFlow"],
      socialLinks: { twitter: "https://x.com/alex_dev", github: "https://github.com/alex_dev" },
      featuredContent: [{ contentType: "debate", contentId: debate._id }],
    });
    console.log(`✓ Creator Profile initialized with ${creatorProfile.expertise.length} expertise topics.`);

    // ── 8. Cleanup Test Artifacts ──
    console.log("\n--- Cleanup ---");
    await Promise.all([
      User.deleteMany({ _id: { $in: [userA._id, userB._id] } }),
      Question.deleteOne({ _id: question._id }),
      Answer.deleteOne({ _id: answer._id }),
      Debate.deleteOne({ _id: debate._id }),
      DebateArgument.deleteOne({ _id: argument._id }),
      Poll.deleteOne({ _id: poll._id }),
      Community.deleteOne({ _id: community._id }),
      CommunityMember.deleteMany({ community: community._id }),
      Reputation.deleteMany({ user: { $in: [userA._id, userB._id] } }),
      UserBadge.deleteMany({ user: { $in: [userA._id, userB._id] } }),
      CreatorProfile.deleteOne({ user: userA._id }),
    ]);
    console.log("✓ Test records cleaned up successfully.");

    console.log("\n==================================================");
    console.log("🎉 ALL PHASE 3 BACKEND & DATABASE TESTS PASSED!");
    console.log("==================================================");
  } finally {
    await mongoose.disconnect();
  }
}

runPhase3Tests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});




// I want to implement login with google and facebook button and all its features so please guide me detailed what you need from me and how to settup firebase and if could be done using mongodb Atlas instead of firebase its good


