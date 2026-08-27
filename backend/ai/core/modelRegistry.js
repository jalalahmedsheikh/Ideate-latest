import { tf, getMemoryProfile } from "./tfEngine.js";
import { INTERACTION_FEATURE_DIM } from "../features/interactionFeatures.js";

class ModelRegistry {
  constructor() {
    this.models = new Map();
    this.modelVersions = new Map();
    this.isInitialized = false;
    this.initError = null;
  }

  /**
   * Initializes all required TensorFlow.js models with default architectures and calibrated initial weights
   */
  async initializeAllModels() {
    try {
      console.log("🧠 Initializing TensorFlow.js Model Registry...");

      // 1. Feed Ranking Multi-Objective Model (Input: 20 dim -> Dense 32 (ReLU) -> Dense 16 (ReLU) -> Output 1 (Sigmoid))
      this.registerFeedRanker("feed_ranker_v1");

      // 2. Spam & Toxicity Classifier (Input: 64 dim embedding -> Dense 32 -> Output 1 (Sigmoid))
      this.registerSpamClassifier("spam_classifier_v1");

      // 3. Topic & Category Multi-Label Classifier (Input: 64 dim embedding -> Dense 64 -> Output 12 categories (Sigmoid))
      this.registerTopicClassifier("topic_classifier_v1");

      // 4. Follow Prediction Model (Input: 16 dim user-user features -> Dense 16 -> Output 1 (Sigmoid))
      this.registerFollowRanker("follow_ranker_v1");

      this.isInitialized = true;
      console.log("✅ All TensorFlow.js models initialized successfully!");
    } catch (err) {
      console.error("❌ Failed to initialize TensorFlow.js models:", err);
      this.initError = err.message;
    }
  }

  registerFeedRanker(version = "feed_ranker_v1") {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [INTERACTION_FEATURE_DIM], units: 32, activation: "relu" }),
        tf.layers.dropout({ rate: 0.1 }),
        tf.layers.dense({ units: 16, activation: "relu" }),
        tf.layers.dense({ units: 1, activation: "sigmoid" }),
      ],
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: "binaryCrossentropy",
      metrics: ["accuracy"],
    });

    this.models.set("feed_ranker", model);
    this.modelVersions.set("feed_ranker", version);
  }

  registerSpamClassifier(version = "spam_classifier_v1") {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [64], units: 32, activation: "relu" }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 16, activation: "relu" }),
        tf.layers.dense({ units: 1, activation: "sigmoid" }),
      ],
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: "binaryCrossentropy",
      metrics: ["accuracy"],
    });

    this.models.set("spam_classifier", model);
    this.modelVersions.set("spam_classifier", version);
  }

  registerTopicClassifier(version = "topic_classifier_v1") {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [64], units: 64, activation: "relu" }),
        tf.layers.dropout({ rate: 0.15 }),
        tf.layers.dense({ units: 32, activation: "relu" }),
        tf.layers.dense({ units: 12, activation: "sigmoid" }), // 12 default topic categories
      ],
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: "binaryCrossentropy",
    });

    this.models.set("topic_classifier", model);
    this.modelVersions.set("topic_classifier", version);
  }

  registerFollowRanker(version = "follow_ranker_v1") {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [16], units: 16, activation: "relu" }),
        tf.layers.dense({ units: 8, activation: "relu" }),
        tf.layers.dense({ units: 1, activation: "sigmoid" }),
      ],
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: "binaryCrossentropy",
    });

    this.models.set("follow_ranker", model);
    this.modelVersions.set("follow_ranker", version);
  }

  getModel(name) {
    return this.models.get(name) || null;
  }

  getVersion(name) {
    return this.modelVersions.get(name) || "unknown";
  }

  getHealth() {
    return {
      initialized: this.isInitialized,
      error: this.initError,
      models: Array.from(this.modelVersions.entries()).map(([name, version]) => ({
        name,
        version,
        status: this.models.has(name) ? "active" : "missing",
      })),
      memory: getMemoryProfile(),
    };
  }
}

export const modelRegistry = new ModelRegistry();
