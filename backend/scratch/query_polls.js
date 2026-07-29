import mongoose from "mongoose";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env
import dotenvLib from "dotenv";
dotenvLib.config({ path: path.join(__dirname, "..", ".env") });

import { Poll } from "../models/poll.model.js";
import { User } from "../models/user.model.js";

async function run() {
  try {
    const mongoUri = process.env.MONGO_URI;
    console.log("Connecting to:", mongoUri);
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB!");

    const polls = await Poll.find().populate("author");
    console.log(`Found ${polls.length} polls:`);
    polls.forEach((p, idx) => {
      console.log(`Poll ${idx + 1}:`);
      console.log(`  ID: ${p._id}`);
      console.log(`  Question: ${p.question}`);
      console.log(`  Author ID: ${p.author?._id || "NULL"}`);
      console.log(`  Author Username: ${p.author?.username || "NULL"}`);
    });

    const users = await User.find({}, "username category name");
    console.log(`Found ${users.length} users:`);
    users.forEach((u) => {
      console.log(`  User: ID=${u._id}, Username=${u.username}, Category=${u.category}, Name=${u.name}`);
    });

  } catch (error) {
    console.error(error);
  } finally {
    await mongoose.disconnect();
  }
}

run();
