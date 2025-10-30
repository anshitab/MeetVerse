import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error('MONGO_URI not set');

    // Fast-fail timeouts and stable pool sizing for dev
    const opts = {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 20000,
      maxPoolSize: 10,
      minPoolSize: 1,
      retryWrites: true
    };

    // Simple retry loop with backoff: 3 attempts
    let lastErr;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const conn = await mongoose.connect(uri, opts);
        console.log(`✅ MongoDB connected: ${conn.connection.host}`);
        return;
      } catch (e) {
        lastErr = e;
        console.warn(`MongoDB connect attempt ${attempt} failed:`, e?.message || e);
        if (attempt < 3) await new Promise(r => setTimeout(r, attempt * 1000));
      }
    }
    throw lastErr || new Error('MongoDB connect failed');
  } catch (error) {
    console.error(`❌ MongoDB connection error: ${error.message}`);
    // Don't crash the server; keep running and retry periodically
    try {
      setTimeout(() => {
        connectDB().catch(() => {});
      }, 5000);
    } catch (_) {}
  }
};

export default connectDB;

