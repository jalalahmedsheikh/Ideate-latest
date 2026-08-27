import mongoose from "mongoose";

const questionSchema = new mongoose.Schema(
  {
    title: { 
      type: String, 
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 300,
    },
    description: { 
      type: String, 
      default: "",
      maxlength: 5000,
    },
    author: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true,
      index: true,
    },
    PostType: {
      type: String,
      default: "Question",
    },
    questionType: {
      type: String,
      enum: ["general", "advice", "technical", "opinion"],
      default: "general",
    },
    topics: [{ 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Topic" 
    }],
    community: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Community",
      default: null,
      index: true,
    },
    visibility: {
      type: String,
      enum: ["public", "community", "private"],
      default: "public",
    },
    isAnonymous: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["active", "closed", "deleted", "archived"],
      default: "active",
      index: true,
    },
    acceptedAnswer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Answer",
      default: null,
    },
    followers: [{ 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User" 
    }],
    upvotes: [{ 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User" 
    }],
    downvotes: [{ 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User" 
    }],
    saves: [{ 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User" 
    }],
    shareCount: { 
      type: Number, 
      default: 0 
    },
    views: { 
      type: Number, 
      default: 0 
    },
    answersCount: { 
      type: Number, 
      default: 0 
    },
  },
  { timestamps: true }
);

questionSchema.index({ author: 1, createdAt: -1 });
questionSchema.index({ topics: 1 });
questionSchema.index({ status: 1, createdAt: -1 });
questionSchema.index({ title: "text", description: "text" });

export const Question = mongoose.model("Question", questionSchema);
