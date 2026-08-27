/**
 * Generates transparent explanation metadata for why an item was recommended.
 * @param {Object} item Scored item with metadata
 * @param {Object} userContext Context containing followedTopicIds, followingUserIds
 * @returns {Object} { signal: string, reasonType: string }
 */
export const generateExplanationSignal = (item, userContext = {}) => {
  const authorId = item.author?._id?.toString() || item.author?.toString();
  const isFollowingAuthor = userContext.followingUserIds && authorId && userContext.followingUserIds.has(authorId);

  // 1. Followed Author
  if (isFollowingAuthor) {
    const authorName = item.author?.username ? `@${item.author.username}` : "a creator you follow";
    return {
      signal: `From ${authorName}`,
      reasonType: "followed_author",
    };
  }

  // 2. Matching Followed Topic
  if (item.topics && item.topics.length > 0 && userContext.followedTopicIds) {
    const matchedTopic = item.topics.find((t) => {
      const tid = typeof t === "object" ? t._id?.toString() : t.toString();
      return userContext.followedTopicIds.has(tid);
    });

    if (matchedTopic) {
      const topicName = typeof matchedTopic === "object" ? matchedTopic.name : "your topic";
      return {
        signal: `Because you follow #${topicName}`,
        reasonType: "followed_topic",
      };
    }
  }

  // 3. High Semantic Similarity to User's Interest Profile
  if (item.semanticSim && item.semanticSim > 0.45) {
    return {
      signal: "Matches your reading interests",
      reasonType: "interest_similarity",
    };
  }

  // 4. Trending or Exploration
  if (item.candidateChannel === "trending") {
    return {
      signal: "Trending on Ideate",
      reasonType: "trending",
    };
  }

  if (item.candidateChannel === "exploration") {
    return {
      signal: "Fresh discussion you might like",
      reasonType: "exploration",
    };
  }

  return {
    signal: "Recommended for you",
    reasonType: "general",
  };
};
