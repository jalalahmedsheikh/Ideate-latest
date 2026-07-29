import mongoose from "mongoose";

const pollSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    options: [{ type: String, required: true }],
    PostType: {
      type: String,
      default: "Poll", // Default value is "Poll"
    },
    votes: [{ type: Number, default: 0 }], // Track votes for each option
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Optional: Track creator
    start: { type: Date, default: Date.now }, // Default start time is now
    end: { type: Date }, // Optional: Set end date for the poll
    maxVotes: { type: Number, default: 1 }, // Optional: Limit the number of votes per user
    status: { 
      type: String, 
      enum: ["open", "closed", "archived"], 
      default: "open" // Poll status (open, closed, or archived)
    },
    votesHistory: [{ // Optional: Track user votes
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      optionIndex: { type: Number }
    }]
  },
  { timestamps: true }
);

pollSchema.index({ author: 1 });
pollSchema.index({ createdAt: -1 });

// Optional: You could add some custom methods to manage votes, like validating if a user has already voted.
pollSchema.methods.vote = function(userId, optionIndex) {
  // Check if the user has already voted
  if (this.votesHistory.some(vote => vote.user.toString() === userId.toString())) {
    throw new Error('User has already voted');
  }

  // Update the votes array (increment the selected option)
  this.votes[optionIndex]++;
  
  // Add to votes history
  this.votesHistory.push({ user: userId, optionIndex });
  
  return this.save();
};

export const Poll = mongoose.model("Poll", pollSchema);
