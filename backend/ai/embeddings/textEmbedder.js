import { tf, safeTidy } from "../core/tfEngine.js";
import { l2Normalize } from "./vectorMath.js";

const EMBEDDING_DIM = 64;
const VOCAB_SIZE = 5000;

// Deterministic Murmur-like 32-bit hash function for vocabulary projection
const hashToken = (str) => {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return Math.abs(hash % VOCAB_SIZE);
};

// Deterministic seedable pseudo-random matrix for consistent embeddings
const createEmbeddingMatrix = (vocabSize, dim) => {
  const matrix = [];
  for (let i = 0; i < vocabSize; i++) {
    const row = [];
    for (let j = 0; j < dim; j++) {
      // Deterministic pseudo-random generation based on index
      const val = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453;
      row.push((val - Math.floor(val)) * 2 - 1);
    }
    matrix.push(row);
  }
  return matrix;
};

// Pre-computed embedding matrix
const embeddingWeights = createEmbeddingMatrix(VOCAB_SIZE, EMBEDDING_DIM);

/**
 * Tokenizes text into words and subword character tri-grams
 */
export const tokenizeText = (text) => {
  if (!text || typeof text !== "string") return [];

  const cleaned = text
    .toLowerCase()
    .replace(/[^\w\s#]/g, " ")
    .trim();

  const words = cleaned.split(/\s+/).filter((w) => w.length > 1);
  const tokens = [...words];

  // Extract character n-grams for out-of-vocabulary robustness
  for (const word of words) {
    if (word.length >= 3 && word.length <= 10) {
      for (let i = 0; i <= word.length - 3; i++) {
        tokens.push(word.substring(i, i + 3));
      }
    }
  }

  return tokens;
};

/**
 * Embeds a text string into a normalized 64-dimensional dense vector
 * @param {string} text Input text (post caption, poll question, bio, topic title)
 * @returns {Array<number>} 64-dim normalized vector
 */
export const embedText = (text) => {
  const tokens = tokenizeText(text);
  if (tokens.length === 0) {
    return new Array(EMBEDDING_DIM).fill(0);
  }

  const tokenIndices = tokens.map(hashToken);

  return safeTidy(() => {
    // Gather embedding vectors for tokens
    const vectors = tokenIndices.map((idx) => embeddingWeights[idx]);
    const tensor = tf.tensor2d(vectors); // [numTokens, EMBEDDING_DIM]

    // Average pooling across all tokens
    const pooled = tf.mean(tensor, 0); // [EMBEDDING_DIM]
    const norm = tf.norm(pooled);
    const normalized = tf.div(pooled, tf.add(norm, 1e-7));

    return Array.from(normalized.dataSync());
  });
};

/**
 * Embeds a batch of texts into an array of normalized 64-dim vectors
 */
export const batchEmbedTexts = (texts) => {
  return texts.map(embedText);
};

export { EMBEDDING_DIM };
