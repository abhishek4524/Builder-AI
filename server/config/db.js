import mongoose from "mongoose";
import dns from "node:dns"

export async function connectToDatabase() {
    try {
        // Use Windows DNS server for MongoDB SRV lookup
        dns.setServers(["192.168.1.1"]);

        await mongoose.connect(process.env.MONGODB_URI);

        console.log("Successfully connected to MongoDB.");
    } catch (error) {
        console.error("MongoDB connection failed:", error.message);
        process.exit(1);
    }
}