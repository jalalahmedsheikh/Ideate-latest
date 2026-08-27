/**
 * Computes Ranking and Classification metrics for model evaluation
 */

/**
 * Normalized Discounted Cumulative Gain at K (NDCG@K)
 * @param {Array<number>} predictedScores Ranked prediction scores
 * @param {Array<number>} trueRelevance Ground truth relevance (1 or 0)
 * @param {number} k Top-K cutoff
 * @returns {number} NDCG@K score between 0.0 and 1.0
 */
export const computeNDCGatK = (predictedScores, trueRelevance, k = 10) => {
  const cutoff = Math.min(k, predictedScores.length);
  if (cutoff === 0) return 0.0;

  // Pair scores with ground truth
  const items = predictedScores.map((score, idx) => ({
    score,
    rel: trueRelevance[idx] || 0,
  }));

  // Sort by predicted score descending
  items.sort((a, b) => b.score - a.score);

  // Compute DCG
  let dcg = 0.0;
  for (let i = 0; i < cutoff; i++) {
    const rel = items[i].rel;
    dcg += (Math.pow(2, rel) - 1) / Math.log2(i + 2);
  }

  // Compute Ideal DCG (sort by true relevance)
  const idealItems = [...items].sort((a, b) => b.rel - a.rel);
  let idcg = 0.0;
  for (let i = 0; i < cutoff; i++) {
    const rel = idealItems[i].rel;
    idcg += (Math.pow(2, rel) - 1) / Math.log2(i + 2);
  }

  return idcg === 0 ? 0.0 : dcg / idcg;
};

/**
 * Computes Precision@K and Recall@K
 */
export const computePrecisionRecallAtK = (predictedScores, trueRelevance, k = 10) => {
  const cutoff = Math.min(k, predictedScores.length);
  if (cutoff === 0) return { precision: 0.0, recall: 0.0 };

  const items = predictedScores.map((score, idx) => ({
    score,
    rel: trueRelevance[idx] || 0,
  }));

  items.sort((a, b) => b.score - a.score);

  let relevantInTopK = 0;
  for (let i = 0; i < cutoff; i++) {
    if (items[i].rel > 0) relevantInTopK++;
  }

  const totalRelevant = trueRelevance.filter((r) => r > 0).length;

  const precision = relevantInTopK / cutoff;
  const recall = totalRelevant === 0 ? 0.0 : relevantInTopK / totalRelevant;

  return { precision, recall };
};
