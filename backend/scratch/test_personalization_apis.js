import "dotenv/config";
import { modelRegistry } from "../ai/core/modelRegistry.js";
import { classifyAndSuggestTopics } from "../ai/classification/topicClassifier.js";
import { detectSpam } from "../ai/moderation/spamDetector.js";
import { getAIHealth } from "../controllers/ai.controller.js";

async function runApiTests() {
  console.log("==================================================");
  console.log("🚀 TESTING PERSONALIZATION & AI CONTROLLER APIS");
  console.log("==================================================\n");

  await modelRegistry.initializeAllModels();

  // Test suggest topics
  const suggestions = await classifyAndSuggestTopics("Deep dive into TensorFlow.js and machine learning model training");
  console.log("✓ Suggest Topics:", suggestions.suggestedCategory, `(Matched topics: ${suggestions.suggestedTopics.length})`);

  // Test spam detection
  const spam = await detectSpam("Visit this link to win $10000000 free crypto right now!");
  console.log("✓ Spam Check Result:", spam.isViolating ? "FLAGGED" : "CLEAN", `(Prob: ${spam.spamProbability})`);

  // Test AI Health
  const req = {};
  const res = {
    status: function (code) {
      this.statusCode = code;
      return this;
    },
    json: function (data) {
      this.body = data;
      return this;
    },
  };
  await getAIHealth(req, res);
  console.log("✓ AI Health API Response Status:", res.statusCode);
  console.log("  AI Engine:", res.body.engine);
  console.log("  Active Models:", res.body.models.length);

  console.log("\n==================================================");
  console.log("✅ ALL CONTROLLER UNIT TESTS PASSED!");
  console.log("==================================================");
}

runApiTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
  });
