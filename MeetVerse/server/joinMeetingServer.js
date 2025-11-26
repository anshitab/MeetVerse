import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import http from "http";
import https from "https";
import url from "url";
import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import WebSocket from "ws";

const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

// ----------------------------
// AssemblyAI (unchanged)
// ----------------------------
const ASSEMBLY_KEY = process.env.ASSEMBLYAI_API_KEY;
if (!ASSEMBLY_KEY) {
  console.error("❌ Missing ASSEMBLYAI_API_KEY in .env");
  process.exit(1);
}

const assemblySessions = new Map(); // roomId -> { ws, isReady: boolean }

function createAssemblySession(roomId) {
  return new Promise((resolve) => {
    console.log(`🎙️ Creating AssemblyAI session for room ${roomId}`);

    const aaiWs = new WebSocket("wss://streaming.assemblyai.com/v3/ws", {
      headers: { Authorization: ASSEMBLY_KEY },
    });

    const session = { ws: aaiWs, isReady: false };

    aaiWs.on("open", () => {
      console.log(`🎧 [AssemblyAI] Connected for room ${roomId}`);
      session.isReady = true;
      resolve(session);
    });

    aaiWs.on("message", (msg) => {
      let json;
      try {
        json = JSON.parse(msg);
      } catch {
        return;
      }
      if (json.type === "partial" || json.type === "final") {
        broadcast(roomId, {
          type: "transcript",
          roomId,
          text: json.text || "",
          isFinal: json.type === "final",
          at: Date.now(),
        });
      }
    });

    aaiWs.on("close", () => {
      console.log(`🔌 AssemblyAI socket closed for room ${roomId}`);
      assemblySessions.delete(roomId);
    });

    aaiWs.on("error", (err) => {
      console.error(`❌ AssemblyAI error in ${roomId}:`, err?.message || err);
    });
  });
}

// ----------------------------
// ROOM MANAGEMENT + broadcast
// ----------------------------
const rooms = new Map(); // roomId -> Set<{ ws, username }>

function getRoom(roomId) {
  if (!rooms.has(roomId)) rooms.set(roomId, new Set());
  return rooms.get(roomId);
}

function broadcast(roomId, payload) {
  const room = rooms.get(roomId);
  if (!room) return;
  const data = typeof payload === "string" ? payload : JSON.stringify(payload);
  for (const client of room) {
    if (client.ws.readyState === 1) {
      try { client.ws.send(data); } catch (_) {}
    }
  }
}

// ----------------------------
// SERVER INITIALIZATION
// ----------------------------
function createServer() {
  const app = express();

  // IMPORTANT: explicit allowed origins (credentials: true requires exact origin)
  app.use(cors({
    origin: (origin, cb) => {
      // allow requests with no origin (eg. curl, server-to-server)
      if (!origin) return cb(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET","POST","PUT","DELETE","OPTIONS"]
  }));

  // extra safeguard: remove any CSP header in case something sets it upstream
  app.use((req, res, next) => {
    res.removeHeader("Content-Security-Policy");
    next();
  });

  app.use(express.json());

  app.get('/', (req, res) => res.json({ status: 'ok', service: 'joinMeeting-ws' }));

  // Simple test endpoint for emitting reminders from server/test scripts
  // POST { roomId, title, meetingId }
  app.post('/emit-reminder', (req, res) => {
    const { roomId, title, meetingId } = req.body || {};
    if (!roomId || !title) return res.status(400).json({ error: 'roomId and title required' });

    broadcast(roomId, {
      type: 'meeting-reminder',
      meetingId,
      title,
      at: Date.now()
    });

    return res.json({ ok: true });
  });

  // Informational endpoint
  app.get('/ws/:roomId/:username', (req, res) => {
    res.status(200).send('WebSocket endpoint. Connect using native WebSocket to /ws/:roomId/:username');
  });

  const isProd = process.env.NODE_ENV === 'production';
  let server;
  if (isProd && process.env.SSL_KEY_FILE && process.env.SSL_CERT_FILE) {
    try {
      const options = {
        key: fs.readFileSync(process.env.SSL_KEY_FILE),
        cert: fs.readFileSync(process.env.SSL_CERT_FILE),
      };
      server = https.createServer(options, app);
      console.log('🔒 HTTPS enabled (production).');
    } catch (e) {
      console.warn('Failed to initialize HTTPS, falling back to HTTP:', e?.message || e);
      server = http.createServer(app);
    }
  } else {
    server = http.createServer(app);
  }

  // ----------------------------
  // MAIN WEBSOCKET SERVER (ws)
  // ----------------------------
  const wss = new WebSocketServer({ noServer: true });

  function heartbeat() { this.isAlive = true; }
  setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      try { ws.ping(); } catch (_) {}
    });
  }, 30000);

  wss.on('connection', async (ws, request, clientInfo) => {
    const { roomId, username } = clientInfo;
    ws.isAlive = true;
    ws.on('pong', heartbeat);

    const room = getRoom(roomId);
    const member = { ws, username };
    room.add(member);

    console.log(`✅ ${username} connected to room ${roomId}. Members: ${room.size}`);
    broadcast(roomId, { type: 'system', event: 'user-joined', roomId, username, at: Date.now() });

    // ensure AssemblyAI session when audio streaming happens
    if (!assemblySessions.has(roomId)) {
      assemblySessions.set(roomId, await createAssemblySession(roomId));
    }
    const assembly = assemblySessions.get(roomId);

    ws.on('message', (raw) => {
      let text = raw.toString();
      let parsed;
      try { parsed = JSON.parse(text); } catch { parsed = { type: 'chat', text }; }

      if (parsed.type === 'audio' && parsed.audio) {
        if (assembly?.isReady) {
          assembly.ws.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: parsed.audio }));
        }
        return;
      }

      const message = {
        type: parsed.type || 'chat',
        from: username,
        roomId,
        text: parsed.text ?? text,
        at: Date.now()
      };
      broadcast(roomId, message);
    });

    ws.on('close', () => {
      try {
        const r = rooms.get(roomId);
        if (r) {
          r.delete(member);
          if (r.size === 0) {
            rooms.delete(roomId);

            // cleanup AssemblyAI
            if (assemblySessions.has(roomId)) {
              const as = assemblySessions.get(roomId);
              try { as.ws.close(); } catch (_) {}
              assemblySessions.delete(roomId);
            }
          }
        }
      } catch (_) {}
      console.log(`❌ ${username} disconnected from room ${roomId}.`);
      broadcast(roomId, { type: 'system', event: 'user-left', roomId, username, at: Date.now() });
    });

    ws.on('error', (err) => {
      console.error(`⚠️ WebSocket error for ${username} in room ${roomId}:`, err?.message || err);
    });
  });

  server.on('upgrade', (request, socket, head) => {
    try {
      const { pathname } = url.parse(request.url);
      const match = pathname && pathname.match(/^\/ws\/([^\/]+)\/([^\/]+)$/);
      if (!match) {
        socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
        socket.destroy();
        return;
      }
      const roomId = decodeURIComponent(match[1]);
      const username = decodeURIComponent(match[2]);

      // ensure room exists
      getRoom(roomId);

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request, { roomId, username });
      });
    } catch (e) {
      try { socket.destroy(); } catch (_) {}
    }
  });

  return { app, server, wss };
}

// ----------------------------
// START SERVER
// ----------------------------
export function startServer(port = 5000) {
  const { server } = createServer();
  const finalPort = Number(process.env.PORT) || Number(port) || 5000;

  server.listen(finalPort, () => {
    const isHttps = server instanceof https.Server;
    const proto = isHttps ? 'wss' : 'ws';
    const httpProto = isHttps ? 'https' : 'http';
    console.log(`🚀 joinMeeting server running on ${httpProto}://localhost:${finalPort}`);
    console.log(`👉 WebSocket path: ${proto}://<host>:${finalPort}/ws/:roomId/:username`);
  });

  return server;
}

startServer();
