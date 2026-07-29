import { Poll } from "../models/poll.model.js";

// Get a poll by its _id
const getPollById = async (req, res) => {
  const { id } = req.params; // Get the poll _id from the URL

  try {
    const poll = await Poll.findById(id); // Fetch the poll by its _id
    if (!poll) {
      return res.status(404).json({ message: 'Poll not found' });
    }
    return res.status(200).json(poll); // Return the poll data
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getPollById };
