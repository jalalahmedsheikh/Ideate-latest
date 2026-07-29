import { Post } from "../models/post.model.js";
import { Poll } from "../models/poll.model.js";
import { User } from "../models/user.model.js";
import { calculateSimilarityScore } from "../utils/recommendationUtils.js"; // A helper for ML recommendations

export const getPersonalizedFeed = async (req, res) => {
    try {
        const userId = req.id;

        // Step 1: Fetch user preferences (e.g., tags or categories)
        const user = await User.findById(userId).lean();
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const userPreferences = user.preferences || []; // Example: ['technology', 'sports', 'music']

        // Step 2: Fetch all posts and polls, excluding the user's own
        const posts = await Post.find({ author: { $ne: userId } }).lean();
        const polls = await Poll.find({ author: { $ne: userId } }).lean();

        // Step 3: Combine posts and polls
        const combinedContent = [...posts, ...polls];

        // Step 4: Score each item based on user preferences
        const scoredContent = combinedContent.map((item) => {
            const score = calculateSimilarityScore(userPreferences, item.tags || []); // Example scoring logic
            return { item, score };
        });

        // Step 5: Sort content by score in descending order
        const personalizedFeed = scoredContent
            .sort((a, b) => b.score - a.score)
            .map(({ item }) => item);

        // Step 6: Return the personalized feed
        return res.status(200).json({
            success: true,
            feed: personalizedFeed,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch personalized feed.",
        });
    }
};
