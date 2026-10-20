import mongoose from "mongoose";
import dns from "node:dns"

export async function connectToDatabase() {
    try {
        // Use reliable DNS servers for MongoDB SRV lookup
        dns.setServers(["8.8.8.8", "1.1.1.1"]);

        await mongoose.connect(process.env.MONGODB_URI);

        console.log("Successfully connected to MongoDB.");
    } catch (error) {
        console.error("MongoDB connection failed:", error.message);
        process.exit(1);
    }
}