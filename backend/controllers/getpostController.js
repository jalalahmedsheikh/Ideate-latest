import { Post } from "../models/post.model.js";

// Get a post by its _id
const getPostById = async (req, res) => {
  const { id } = req.params; // Get the post _id from the URL

  try {
    const post = await Post.findById(id); // Fetch the post by its _id
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    return res.status(200).json(post); // Return the post data
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getPostById };
