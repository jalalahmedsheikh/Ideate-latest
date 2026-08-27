/**
 * Applies diversity penalties and interleaving to ranked feed items.
 * @param {Array<Object>} rankedItems Items sorted by ranking score
 * @returns {Array<Object>} Diversified feed stream
 */
export const applyDiversityFilter = (rankedItems) => {
  if (!rankedItems || rankedItems.length <= 1) return rankedItems || [];

  const diversified = [];
  const authorCounts = new Map();
  const recentCategories = [];

  const remaining = [...rankedItems];

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestScore = -Infinity;

    // Look at top 10 candidates in remaining pool to pick the best diversified choice
    const candidatePoolSize = Math.min(remaining.length, 10);

    for (let i = 0; i < candidatePoolSize; i++) {
      const item = remaining[i];
      let adjustedScore = item.rankingScore || 0.5;

      const authorId = item.author?._id?.toString() || item.author?.toString() || "unknown";
      const authorFrequency = authorCounts.get(authorId) || 0;

      // 1. Author repetition penalty
      if (authorFrequency > 0) {
        adjustedScore *= Math.pow(0.70, authorFrequency); // -30% per past appearance
      }

      // 2. Category clustering penalty
      const itemCategory = (item.topics && item.topics[0]?.category) || item.category || "General";
      const sameCategoryRecent = recentCategories.slice(-3).filter((c) => c === itemCategory).length;
      if (sameCategoryRecent >= 2) {
        adjustedScore *= 0.80; // Penalty if 2 of last 3 items had same category
      }

      // 3. Content type balance bonus
      const lastItem = diversified[diversified.length - 1];
      if (lastItem && lastItem.feedType === item.feedType) {
        // slight penalty for 3 identical types in a row
        const sameTypeRecent = diversified.slice(-3).filter((d) => d.feedType === item.feedType).length;
        if (sameTypeRecent >= 3) {
          adjustedScore *= 0.85;
        }
      }

      if (adjustedScore > bestScore) {
        bestScore = adjustedScore;
        bestIdx = i;
      }
    }

    const selected = remaining.splice(bestIdx, 1)[0];
    diversified.push(selected);

    // Update state tracking
    const authorId = selected.author?._id?.toString() || selected.author?.toString() || "unknown";
    authorCounts.set(authorId, (authorCounts.get(authorId) || 0) + 1);

    const itemCat = (selected.topics && selected.topics[0]?.category) || selected.category || "General";
    recentCategories.push(itemCat);
    if (recentCategories.length > 10) recentCategories.shift();
  }

  return diversified;
};
