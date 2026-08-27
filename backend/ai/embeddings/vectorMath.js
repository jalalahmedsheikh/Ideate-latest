import { tf, safeTidy } from "../core/tfEngine.js";

/**
 * Compute cosine similarity between two 1D numerical arrays or tensors.
 * Returns a value between -1.0 and 1.0 (clamped 0.0 to 1.0 for normalized vectors).
 */
export const cosineSimilarity = (vecA, vecB) => {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0.0;
  if (vecA.length !== vecB.length) return 0.0;

  return safeTidy(() => {
    const a = tf.tensor1d(vecA);
    const b = tf.tensor1d(vecB);
    const dotProduct = tf.sum(tf.mul(a, b));
    const normA = tf.norm(a);
    const normB = tf.norm(b);
    const denom = tf.mul(normA, normB);
    
    // Avoid division by zero
    const similarity = tf.div(dotProduct, tf.add(denom, 1e-7));
    return similarity.dataSync()[0];
  });
};

/**
 * Compute batch cosine similarity between a single query vector (1D) and multiple candidate vectors (2D).
 * @param {Array<number>} queryVec Query vector of dimension D
 * @param {Array<Array<number>>} candidateVecs Array of N candidate vectors of dimension D
 * @returns {Array<number>} Array of N similarity scores
 */
export const batchCosineSimilarity = (queryVec, candidateVecs) => {
  if (!queryVec || !candidateVecs || candidateVecs.length === 0) return [];
  const dim = queryVec.length;

  return safeTidy(() => {
    const q = tf.tensor1d(queryVec).reshape([1, dim]);
    const candidates = tf.tensor2d(candidateVecs);

    // Normalize query vector: q / ||q||
    const qNorm = tf.norm(q, "euclidean", 1, true);
    const qNormalized = tf.div(q, tf.add(qNorm, 1e-7));

    // Normalize candidate vectors: C / ||C||
    const cNorm = tf.norm(candidates, "euclidean", 1, true);
    const cNormalized = tf.div(candidates, tf.add(cNorm, 1e-7));

    // Matrix multiply: [1, D] x [D, N] = [1, N]
    const simMatrix = tf.matMul(qNormalized, cNormalized, false, true);
    return Array.from(simMatrix.dataSync());
  });
};

/**
 * Compute Euclidean distance between two vectors.
 */
export const euclideanDistance = (vecA, vecB) => {
  if (!vecA || !vecB || vecA.length !== vecB.length) return Infinity;

  return safeTidy(() => {
    const a = tf.tensor1d(vecA);
    const b = tf.tensor1d(vecB);
    const diff = tf.sub(a, b);
    const dist = tf.norm(diff);
    return dist.dataSync()[0];
  });
};

/**
 * L2 normalize a numerical array
 */
export const l2Normalize = (vector) => {
  if (!vector || vector.length === 0) return [];

  return safeTidy(() => {
    const t = tf.tensor1d(vector);
    const norm = tf.norm(t);
    const normalized = tf.div(t, tf.add(norm, 1e-7));
    return Array.from(normalized.dataSync());
  });
};
