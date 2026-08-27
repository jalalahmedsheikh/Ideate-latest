import { tf } from "../core/tfEngine.js";
import { modelRegistry } from "../core/modelRegistry.js";
import { Post } from "../../models/post.model.js";
import { User } from "../../models/user.model.js";
import { buildInteractionFeatures, INTERACTION_FEATURE_DIM } from "../features/interactionFeatures.js";
import { getUserInterestVector } from "../features/featureStore.js";

/**
 * Runs offline model retraining pipeline using historical interaction records.
 * @returns {Promise<Object>} Training summary results
 */
export const trainFeedRankerPipeline = async () => {
  console.log("🚀 Starting TensorFlow.js Feed Ranker Training Pipeline...");
  const startTime = Date.now();

  // 1. Fetch active users and recent posts
  const [users, posts] = await Promise.all([
    User.find({ isBanned: false }).limit(50).lean(),
    Post.find({ status: "active" }).sort({ createdAt: -1 }).limit(100).populate("topics").lean(),
  ]);

  if (users.length === 0 || posts.length === 0) {
    console.log("ℹ️ Insufficient data for retraining. Skipping.");
    return { success: false, reason: "insufficient_data" };
  }

  const featureRows = [];
  const labelRows = [];

  // Build training dataset (positive pairs: likes/bookmarks, negative pairs: non-interacted)
  for (const user of users) {
    const userVector = await getUserInterestVector(user._id.toString());
    const followedTopicIds = new Set((user.followedTopics || []).map((id) => id.toString()));
    const followingUserIds = new Set((user.followings || []).map((id) => id.toString()));
    const userContext = { followedTopicIds, followingUserIds };

    for (const post of posts) {
      const isLiked = post.likes && post.likes.some((id) => id.toString() === user._id.toString());
      const isBookmarked = user.bookmarks && user.bookmarks.some((id) => id.toString() === post._id.toString());

      const label = isLiked || isBookmarked ? 1.0 : 0.0;
      const features = buildInteractionFeatures(userVector, post, "post", userContext);

      featureRows.push(features);
      labelRows.push([label]);
    }
  }

  console.log(`📊 Generated ${featureRows.length} training examples.`);

  // 2. Train TensorFlow.js Model
  const xs = tf.tensor2d(featureRows);
  const ys = tf.tensor2d(labelRows);

  const model = modelRegistry.getModel("feed_ranker");
  if (!model) {
    throw new Error("Feed ranker model not found in registry.");
  }

  const history = await model.fit(xs, ys, {
    epochs: 10,
    batchSize: 32,
    validationSplit: 0.2,
    shuffle: true,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        if (epoch % 3 === 0 || epoch === 9) {
          console.log(`Epoch ${epoch + 1}: loss = ${logs.loss.toFixed(4)}, val_loss = ${(logs.val_loss || 0).toFixed(4)}`);
        }
      },
    },
  });

  // Dispose tensors
  xs.dispose();
  ys.dispose();

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  const finalLoss = history.history.loss[history.history.loss.length - 1];

  console.log(`✅ Model training finished in ${duration}s. Final loss: ${finalLoss.toFixed(4)}`);

  return {
    success: true,
    durationSeconds: parseFloat(duration),
    examples: featureRows.length,
    finalLoss,
    epochs: 10,
  };
};
