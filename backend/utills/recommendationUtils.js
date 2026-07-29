// backend/utills/recommendationUtils.js

/**
 * Calculates similarity score based on tag overlap
 * @param {Array<string>} userPreferences 
 * @param {Array<string>} itemTags 
 * @returns {number} intersection count
 */
export const calculateSimilarityScore = (userPreferences, itemTags) => {
    if (!userPreferences || !itemTags || !Array.isArray(userPreferences) || !Array.isArray(itemTags)) {
        return 0;
    }
    const userPrefsLower = userPreferences.map(tag => tag.toLowerCase());
    const itemTagsLower = itemTags.map(tag => tag.toLowerCase());
    const intersection = userPrefsLower.filter(tag => itemTagsLower.includes(tag));
    return intersection.length;
};
