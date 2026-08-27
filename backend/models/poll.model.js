import mongoose from "mongoose";

const pollSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true },
    options: [{ type: String, required: true }],
    optionDetails: [{
      text: { type: String, required: true },
      imageUrl: { type: String, default: null },
      voteCount: { type: Number, default: 0 },
    }],
    PostType: {
      type: String,
      default: "Poll",
    },
    pollType: {
      type: String,
      enum: ["single_choice", "multiple_choice", "yes_no", "rating", "scale", "ranked_choice", "image_poll"],
      default: "single_choice",
    },
    settings: {
      minSelections: { type: Number, default: 1 },
      maxSelections: { type: Number, default: 1 },
      isAnonymous: { type: Boolean, default: false },
      allowVoteChange: { type: Boolean, default: true },
      showResultsBeforeVote: { type: Boolean, default: false },
      hideVoteCounts: { type: Boolean, default: false },
      communityOnly: { type: Boolean, default: false },
      followersOnly: { type: Boolean, default: false },
      scaleMin: { type: Number, default: 1 },
      scaleMax: { type: Number, default: 5 },
    },
    votes: [{ type: Number, default: 0 }], // Track votes for each option
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    start: { type: Date, default: Date.now },
    end: { type: Date, index: true },
    status: { 
      type: String, 
      enum: ["open", "closed", "archived"], 
      default: "open",
      index: true,
    },
    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
      default: null,
      index: true,
    },
    topics: [{ type: mongoose.Schema.Types.ObjectId, ref: "Topic" }],
    comments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Comment" }],
    shareCount: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    voterCount: { type: Number, default: 0 },
    votesHistory: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      optionIndex: { type: Number },
      selectedIndices: [{ type: Number }], // For multi-choice
      rankedOrder: [{ type: Number }],     // For ranked choice
      ratingValue: { type: Number },       // For rating/scale
      updatedAt: { type: Date, default: Date.now },
    }],
  },
  { timestamps: true }
);

pollSchema.index({ author: 1, createdAt: -1 });
pollSchema.index({ status: 1, createdAt: -1 });
pollSchema.index({ topics: 1 });
pollSchema.index({ question: "text" });

pollSchema.methods.recordVote = function(userId, votePayload) {
  const userIdStr = userId.toString();
  const allowChange = this.settings?.allowVoteChange ?? true;

  if (this.status !== "open" || (this.end && new Date(this.end) < new Date())) {
    throw new Error("This poll has ended and is no longer accepting votes.");
  }

  // Ensure votes array matches options length
  while (this.votes.length < this.options.length) {
    this.votes.push(0);
  }

  const existingVoteIndex = this.votesHistory.findIndex(
    (v) => v.user && v.user.toString() === userIdStr
  );

  let selectedIndices = [];
  if (Array.isArray(votePayload.selectedIndices)) {
    selectedIndices = votePayload.selectedIndices;
  } else if (typeof votePayload.optionIndex === "number") {
    selectedIndices = [votePayload.optionIndex];
  } else if (typeof votePayload === "number") {
    selectedIndices = [votePayload];
  }

  // Validate bounds
  for (const idx of selectedIndices) {
    if (idx < 0 || idx >= this.options.length) {
      throw new Error(`Invalid option index: ${idx}`);
    }
  }

  if (existingVoteIndex !== -1) {
    if (!allowChange) {
      throw new Error("Vote changes are not permitted on this poll.");
    }

    const prevVote = this.votesHistory[existingVoteIndex];
    const prevIndices = prevVote.selectedIndices?.length
      ? prevVote.selectedIndices
      : [prevVote.optionIndex];

    // Decrement previous votes
    for (const pIdx of prevIndices) {
      if (this.votes[pIdx] !== undefined && this.votes[pIdx] > 0) {
        this.votes[pIdx]--;
      }
    }

    // Increment new votes
    for (const nIdx of selectedIndices) {
      this.votes[nIdx] = (this.votes[nIdx] || 0) + 1;
    }

    // Update history
    prevVote.optionIndex = selectedIndices[0];
    prevVote.selectedIndices = selectedIndices;
    prevVote.rankedOrder = votePayload.rankedOrder || [];
    prevVote.ratingValue = votePayload.ratingValue || null;
    prevVote.updatedAt = new Date();
  } else {
    // New vote
    for (const nIdx of selectedIndices) {
      this.votes[nIdx] = (this.votes[nIdx] || 0) + 1;
    }
    this.votesHistory.push({
      user: userId,
      optionIndex: selectedIndices[0],
      selectedIndices,
      rankedOrder: votePayload.rankedOrder || [],
      ratingValue: votePayload.ratingValue || null,
      updatedAt: new Date(),
    });
    this.voterCount = (this.voterCount || 0) + 1;
  }

  this.markModified("votes");
  this.markModified("votesHistory");
  return this.save();
};

export const Poll = mongoose.model("Poll", pollSchema);
