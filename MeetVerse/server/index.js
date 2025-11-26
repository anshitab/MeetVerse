import dotenv from "dotenv";
import express from "express";
import http from "http";
import https from "https";
import fs from "fs";
import cors from "cors";
import { Server } from "socket.io";
import axios from "axios";
import cron from "node-cron";
import { v4 as uuidv4 } from "uuid";

import connectDB from "./config/database.js";
import Meeting from "./models/Meeting.js";
import User from "./models/User.js";
import meetingRoutes from "./routes/meetingRoutes.js";
import emailRoutes from "./routes/emailRoutes.js";
import bcrypt from "bcryptjs";
import { sendMeetingSummary } from "./services/emailService.js";

dotenv.config();
connectDB();

// -----------------------------
// EXPRESS + CORS
// -----------------------------
const app = express();
app.use(express.json());

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server)
      if (!origin) return callback(null, true);
      
      // Allow localhost and 127.0.0.1 on any port for development
      const allowedOrigins = [
        /^http:\/\/localhost(:\d+)?$/,
        /^http:\/\/127\.0\.0\.1(:\d+)?$/,
        /^https?:\/\/127\.\d+\.\d+\.\d+(:\d+)?$/,
      ];
      
      if (allowedOrigins.some(pattern => pattern.test(origin))) {
        callback(null, true);
      } else {
        callback(null, true); // Allow all origins in development, restrict in production
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

// -----------------------------
// HEALTH ENDPOINT
// -----------------------------
app.get("/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// -----------------------------
// DOWNLOAD PROXY
// -----------------------------
app.get("/proxy-download", async (req, res) => {
  try {
    const { url, name } = req.query;
    if (!url) return res.status(400).json({ error: "Missing url" });

    const streamResp = await axios.get(url, { responseType: "stream" });

    const filename = name || "document";
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );
    res.setHeader(
      "Content-Type",
      streamResp.headers["content-type"] || "application/octet-stream"
    );

    streamResp.data.pipe(res);
  } catch (e) {
    console.error("Proxy error:", e.message);
    res.status(500).json({ error: "Download failed" });
  }
});

// -----------------------------
// HTTP / HTTPS
// -----------------------------
let server;

if (process.env.HTTPS === "true") {
  try {
    const key = fs.readFileSync(process.env.SSL_KEY_FILE);
    const cert = fs.readFileSync(process.env.SSL_CERT_FILE);

    server = https.createServer({ key, cert }, app);
    console.log("🔒 HTTPS enabled");
  } catch (err) {
    console.log("⚠️ HTTPS failed. Falling back to HTTP:", err.message);
    server = http.createServer(app);
  }
} else {
  server = http.createServer(app);
}

// -----------------------------
// SOCKET.IO
// -----------------------------
const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or server-to-server)
      if (!origin) return callback(null, true);
      
      // Allow localhost and 127.0.0.1 on any port for development
      const allowedOrigins = [
        /^http:\/\/localhost(:\d+)?$/,
        /^http:\/\/127\.0\.0\.1(:\d+)?$/,
        /^https?:\/\/127\.\d+\.\d+\.\d+(:\d+)?$/,
      ];
      
      if (allowedOrigins.some(pattern => pattern.test(origin))) {
        callback(null, true);
      } else {
        callback(null, true); // Allow all origins in development, restrict in production
      }
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// -----------------------------
// TRANSLATION HELPER
// -----------------------------
async function translateToEnglish(text) {
  try {
    const endpoint =
      process.env.LIBRE_TRANSLATE_URL || "https://libretranslate.de";

    const resp = await axios.post(
      `${endpoint}/translate`,
      {
        q: text,
        source: "auto",
        target: "en",
      },
      { headers: { "Content-Type": "application/json" } }
    );

    return resp.data.translatedText || text;
  } catch {
    return text;
  }
}

// -----------------------------
// PUBLIC TRANSLATION ENDPOINT
// -----------------------------
app.post("/translate", async (req, res) => {
  try {
    const translatedTextEn = await translateToEnglish(req.body.text || "");
    res.json({ translatedTextEn });
  } catch {
    res.status(500).json({ error: "Translation failed" });
  }
});

// -----------------------------
// USER AUTH
// -----------------------------
function normalizeUsername(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .slice(0, 20);
}

app.post("/auth/signup", async (req, res) => {
  try {
    const { email, username, name, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: "Missing fields" });

    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail)
      return res.status(409).json({ error: "Email already used" });

    let uname = username ? normalizeUsername(username) : normalizeUsername(email.split("@")[0]);

    const existingUsername = await User.findOne({ username: uname });
    if (existingUsername)
      uname = uname + "_" + Math.floor(Math.random() * 9999);

    const hashed = await bcrypt.hash(password, 10);

    const user = await User.create({
      email: email.toLowerCase(),
      username: uname,
      name: name || "",
      passwordHash: hashed,
    });

    res.status(201).json({ id: user._id, email: user.email, username: user.username });
  } catch (e) {
    res.status(500).json({ error: "Signup failed" });
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    const { identifier, password } = req.body;

    const ident = identifier.toLowerCase();
    const user = await User.findOne({
      $or: [{ email: ident }, { username: ident }],
    });

    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    res.json({ id: user._id, email: user.email, username: user.username });
  } catch {
    res.status(500).json({ error: "Login failed" });
  }
});

// -----------------------------
// MEETING ROUTES
// -----------------------------
app.use("/api/meetings", meetingRoutes);
app.use("/api/email", emailRoutes);

// -----------------------------
// CREATE MEETING (Instant)
// -----------------------------
app.post("/create-meet", async (req, res) => {
  try {
    const meetingId = uuidv4().slice(0, 8);
    const base = process.env.CLIENT_BASE_URL || "http://localhost:5173";
    const now = new Date();

    const meeting = new Meeting({
      meetingId,
      title: "Instant Meeting",
      meetingLink: `${base}/meet/${meetingId}`,
      hostEmail: "guest@meetverse.com",
      hostName: "Guest",
      status: "active",
      scheduledTime: now,
      startTime: now,
    });

    await meeting.save();

    res.json({ meetingId, link: meeting.meetingLink });
  } catch (e) {
    console.error("Create meeting error:", e.message);
    res.status(500).json({ error: "Failed to create meeting", details: e.message });
  }
});

// -----------------------------
// SOCKET.IO LOGIC
// -----------------------------
io.on("connection", (socket) => {
  console.log("🟢 Client connected:", socket.id);

  // JOIN ROOM
  socket.on("join-room", async (meetingId, userName, userEmail) => {
    try {
      socket.join(meetingId);

      const meeting = await Meeting.findOne({ meetingId });
      if (!meeting) return;

      await meeting.addParticipant(socket.id, userName, userEmail);

      // Assign host if no host exists (first user becomes host)
      await meeting.assignHostIfNone(socket.id, userName);

      socket.to(meetingId).emit("user-joined", {
        id: socket.id,
        name: userName,
      });

      // Role (host for first user or if already assigned)
      const isHost = meeting.hostSocketId === socket.id;
      socket.emit("room-role", { meetingId, isHost });
    } catch (e) {
      console.error("join-room error:", e.message);
    }
  });

  // CHAT
  socket.on("message", async (data) => {
    try {
      const translated = await translateToEnglish(data.text);

      // If username is missing, try to get it from meeting participants
      let username = data.username || data.name;
      if (!username && data.meetingId) {
        try {
          const meeting = await Meeting.findOne({ meetingId: data.meetingId });
          if (meeting && data.id) {
            const participant = meeting.participants.find(p => p.socketId === data.id && !p.leftAt);
            if (participant) {
              username = participant.name;
            }
          }
        } catch (e) {
          console.error("Error looking up participant:", e.message);
        }
      }

      io.to(data.meetingId).emit("messageResponse", {
        ...data,
        username: username || data.username || data.name || 'User',
        name: username || data.username || data.name || 'User',
        translatedTextEn: translated,
      });
    } catch {}
  });

  // WEBRTC SIGNALING
  socket.on("offer", ({ meetingId, offer }) =>
    socket.to(meetingId).emit("offer", offer)
  );

  socket.on("answer", ({ meetingId, answer }) =>
    socket.to(meetingId).emit("answer", answer)
  );

  socket.on("ice-candidate", ({ meetingId, candidate }) =>
    socket.to(meetingId).emit("ice-candidate", candidate)
  );

  // END MEETING (Host only)
  socket.on("end-meeting", async (data) => {
    try {
      const { meetingId } = data;
      const meeting = await Meeting.findOne({ meetingId });
      if (!meeting) return;

      // Check if the user is the host
      if (meeting.hostSocketId !== socket.id) {
        socket.emit("end-meeting-error", { message: "Only the host can end the meeting" });
        return;
      }

      // Mark all active participants as left
      const now = new Date();
      meeting.participants.forEach(participant => {
        if (!participant.leftAt) {
          participant.leftAt = now;
        }
      });
      meeting.participantCount = 0;

      // End the meeting in database
      const endedMeeting = await meeting.endMeeting();

      // Notify all participants that the meeting has ended
      io.to(meetingId).emit("meeting-ended", { meetingId });

      console.log(`🔴 Meeting ${meetingId} ended by host ${socket.id}`);

      // Send meeting summary email asynchronously
      sendMeetingSummary(endedMeeting).catch((emailErr) => {
        console.error("sendMeetingSummary error:", emailErr?.message || emailErr);
      });
    } catch (e) {
      console.error("end-meeting error:", e.message);
      socket.emit("end-meeting-error", { message: "Failed to end meeting" });
    }
  });

  // DISCONNECT
  socket.on("disconnect", async () => {
    try {
      console.log("🔴 Client disconnected:", socket.id);

      const meetings = await Meeting.find({
        "participants.socketId": socket.id,
      });

      for (const meeting of meetings) {
        await meeting.removeParticipant(socket.id);
      }
    } catch (e) {
      console.error("disconnect error:", e.message);
    }
  });
});

// -----------------------------
// START SERVER
// -----------------------------
const PORT = process.env.PORT || 5000;

server.listen(PORT, "0.0.0.0", () => {
  const proto = process.env.HTTPS === "true" ? "https" : "http";
  console.log(`🚀 MeetVerse Backend running on ${proto}://localhost:${PORT}`);
});
