import "dotenv/config";
import mongoose from "mongoose";
import { User } from "../models/user.model.js";
import { Topic } from "../models/topic.model.js";
import { Post } from "../models/post.model.js";
import { Poll } from "../models/poll.model.js";
import { Comment } from "../models/comment.model.js";
import { Message } from "../models/message.model.js";
import { Report } from "../models/report.model.js";

async function runTests() {
  try {
    console.log("Connecting to database...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB successfully.");

    // 1. Topic Tests
    console.log("\n--- Testing Topic Model & Operations ---");
    const testSlug = "tech-phase2-test-" + Date.now();
    let topic = await Topic.create({
      name: "Tech Test " + Date.now(),
      slug: testSlug,
      description: "A topic for testing phase 2",
      icon: "💻",
      category: "Technology",
    });
    console.log("✓ Created Topic:", topic.name, `(ID: ${topic._id})`);

    // 2. User & Relations
    console.log("\n--- Testing User Topic Follow & Safety ---");
    let userA = await User.findOne({ username: "test_user_a" });
    if (!userA) {
      userA = await User.create({
        username: "test_user_a",
        email: "test_user_a@ideate.app",
        password: "hashedpassword123",
        messagePrivacy: "following",
      });
    }

    let userB = await User.findOne({ username: "test_user_b" });
    if (!userB) {
      userB = await User.create({
        username: "test_user_b",
        email: "test_user_b@ideate.app",
        password: "hashedpassword123",
        messagePrivacy: "everyone",
      });
    }

    // Toggle Topic Follow
    await User.findByIdAndUpdate(userA._id, { $addToSet: { followedTopics: topic._id } });
    await Topic.findByIdAndUpdate(topic._id, { $inc: { followerCount: 1 } });
    const updatedTopic = await Topic.findById(topic._id);
    console.log("✓ User A followed Topic. New followerCount:", updatedTopic.followerCount);

    // 3. Post & Comments Threading
    console.log("\n--- Testing Post with Topic & 2-Level Comment Threading ---");
    const testPost = await Post.create({
      author: userA._id,
      caption: "Testing Phase 2 Social & Threading",
      topics: [topic._id],
    });
    await Topic.findByIdAndUpdate(topic._id, { $inc: { postCount: 1 } });
    console.log("✓ Created Post with Topic reference:", testPost._id);

    // Top-level comment
    const topComment = await Comment.create({
      post: testPost._id,
      author: userB._id,
      text: "This is a top-level comment!",
    });
    await Post.findByIdAndUpdate(testPost._id, { $push: { comments: topComment._id } });
    console.log("✓ Created Top-Level Comment:", topComment._id);

    // Reply comment (Level 2)
    const replyComment = await Comment.create({
      post: testPost._id,
      author: userA._id,
      parentCommentId: topComment._id,
      text: "This is a direct reply to userB!",
    });
    await Comment.findByIdAndUpdate(topComment._id, {
      $push: { replies: replyComment._id },
      $inc: { replyCount: 1 },
    });
    console.log("✓ Created 2nd-Level Reply Comment:", replyComment._id);

    // Like comment
    await Comment.findByIdAndUpdate(replyComment._id, {
      $addToSet: { likes: userB._id },
    });
    const likedReply = await Comment.findById(replyComment._id);
    console.log("✓ Liked Reply Comment. Total likes:", likedReply.likes.length);

    // 4. Message Request & Sharing
    console.log("\n--- Testing Direct Message & Post Sharing ---");
    const sharedMsg = await Message.create({
      senderId: userA._id,
      receiverId: userB._id,
      messageType: "shared_post",
      sharedPost: testPost._id,
      message: "Check out this idea!",
      isRequest: false,
      requestStatus: "accepted",
    });
    console.log("✓ Created Shared Post Message:", sharedMsg._id);

    // 5. Reporting
    console.log("\n--- Testing Multi-Entity Report System ---");
    const report = await Report.create({
      reporter: userA._id,
      targetType: "Post",
      targetId: testPost._id,
      reason: "spam",
      description: "Automated test report",
    });
    console.log("✓ Created Multi-Entity Report:", report._id, `(Target: ${report.targetType})`);

    // Clean up test records
    console.log("\n--- Cleaning up test artifacts ---");
    await Report.findByIdAndDelete(report._id);
    await Message.findByIdAndDelete(sharedMsg._id);
    await Comment.findByIdAndDelete(replyComment._id);
    await Comment.findByIdAndDelete(topComment._id);
    await Post.findByIdAndDelete(testPost._id);
    await Topic.findByIdAndDelete(topic._id);
    console.log("✓ Test records cleaned up successfully.");

    console.log("\n==========================================");
    console.log("ALL PHASE 2 BACKEND VERIFICATIONS PASSED!");
    console.log("==========================================");

    process.exit(0);
  } catch (err) {
    console.error("Test failed with error:", err);
    process.exit(1);
  }
}

runTests();
