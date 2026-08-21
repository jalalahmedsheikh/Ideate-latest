import mongoose from "mongoose";
import dns from "dns";

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
    } catch (error) {
        console.error("❌ Database connection error:", error.message);
    }
}
export default database;