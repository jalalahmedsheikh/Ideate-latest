import "dotenv/config";
import mongoose from "mongoose";
import dns from "dns";
import { Topic } from "../models/topic.model.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (_) {}

const DEFAULT_TOPICS = [
  { name: "Technology", slug: "technology", category: "Technology", icon: "💻", description: "All things technology, software, and gadgets" },
  { name: "Programming", slug: "programming", category: "Programming", icon: "👨‍💻", description: "Coding, development, algorithms, and web dev" },
  { name: "Artificial Intelligence", slug: "artificial-intelligence", category: "Artificial Intelligence", icon: "🤖", description: "Machine learning, neural networks, and AI trends" },
  { name: "Business", slug: "business", category: "Business", icon: "💼", description: "Startups, strategy, leadership, and markets" },
  { name: "Design", slug: "design", category: "Design", icon: "🎨", description: "UI/UX, graphic design, and creative work" },
  { name: "Science", slug: "science", category: "Science", icon: "🔬", description: "Discoveries, research, space, and exploration" },
  { name: "Education", slug: "education", category: "Education", icon: "📚", description: "Learning, tutorials, academic research" },
  { name: "Startups", slug: "startups", category: "Startups", icon: "🚀", description: "Building, launching, and scaling ventures" },
  { name: "Productivity", slug: "productivity", category: "Productivity", icon: "⚡", description: "Workflows, time management, and habits" },
  { name: "Finance", slug: "finance", category: "Finance", icon: "💰", description: "Investing, fintech, and personal finance" },
  { name: "Philosophy", slug: "philosophy", category: "Philosophy", icon: "🤔", description: "Deep thinking, ethics, and worldviews" },
  { name: "General", slug: "general", category: "General", icon: "💡", description: "General discussion and open ideas" },
];

const seedTopicsIfEmpty = async () => {
  try {
    const count = await Topic.countDocuments();
    if (count === 0) {
      await Topic.insertMany(DEFAULT_TOPICS);
      console.log("✅ Seeded default topics in database.");
    }
  } catch (err) {
    console.warn("Topic seeding notice:", err.message);
  }
};

const database = async () => {
    try {
        try {
            dns.setServers(["8.8.8.8", "1.1.1.1"]);
        } catch (_) {}
        const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/Ideate";
        if (!process.env.MONGO_URI) {
            console.warn("⚠️ MONGO_URI not found in environment. Falling back to local mongodb://127.0.0.1:27017/Ideate");
        }
        await mongoose.connect(mongoUri);
        console.log(`Database connected successfully`);
        await seedTopicsIfEmpty();
    } catch (error) {
        console.error("❌ Database connection error:", error.message);
    }
}
export default database;