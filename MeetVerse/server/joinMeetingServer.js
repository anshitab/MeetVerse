require('dotenv').config();
const fs = require('fs');
const http = require('http');
const https = require('https');
const url = require('url');
const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');

// In-memory room store: roomId -> Set<{ ws, username }>
const rooms = new Map();

function getRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set());
  }
  return rooms.get(roomId);
}

function broadcast(roomId, payload) {
  const room = rooms.get(roomId);
  if (!room) return;
  const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
  for (const client of room) {
    if (client.ws.readyState === 1) {
      try { client.ws.send(data); } catch (_) {}
    }
  }
}

function createServer() {
  const app = express();

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());

 
  app.get('/', (req, res) => res.json({ status: 'ok', service: 'joinMeeting-ws' }));

  
  app.get('/ws/:roomId/:username', (req, res) => {
    res.status(200).send('WebSocket endpoint. Please connect via WebSocket protocol.');
  });

  const isProd = process.env.NODE_ENV === 'production';
  let server;
  if (isProd && process.env.SSL_KEY_FILE && process.env.SSL_CERT_FILE) {
    try {
      const options = {
        key: fs.readFileSync(process.env.SSL_KEY_FILE),
        cert: fs.readFileSync(process.env.SSL_CERT_FILE)
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

  
  const wss = new WebSocketServer({ noServer: true });

  function heartbeat() { this.isAlive = true; }
  setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      try { ws.ping(); } catch (_) {}
    });
  }, 30000);

  wss.on('connection', (ws, request, clientInfo) => {
    const { roomId, username } = clientInfo;
    ws.isAlive = true;
    ws.on('pong', heartbeat);

    const room = getRoom(roomId);
    const member = { ws, username };
    room.add(member);

    console.log(`✅ ${username} connected to room ${roomId}. Members: ${room.size}`);
    broadcast(roomId, { type: 'system', event: 'user-joined', roomId, username, at: Date.now() });

    ws.on('message', (raw) => {
      try {
        let text = String(raw);
        // If binary or Buffer, convert cleanly
        if (Buffer.isBuffer(raw)) text = raw.toString('utf8');

        let parsed;
        try { parsed = JSON.parse(text); } catch (_) { parsed = { type: 'chat', text }; }
        const message = {
          type: parsed.type || 'chat',
          from: username,
          roomId,
          text: parsed.text || text,
          at: Date.now()
        };
        broadcast(roomId, message);
      } catch (e) {
        console.error('Message handling error:', e?.message || e);
      }
    });

    ws.on('close', () => {
      try {
        const r = rooms.get(roomId);
        if (r) {
          r.delete(member);
          if (r.size === 0) rooms.delete(roomId);
        }
      } catch (_) {}
      console.log(`❌ ${username} disconnected from room ${roomId}.`);
      broadcast(roomId, { type: 'system', event: 'user-left', roomId, username, at: Date.now() });
    });

    ws.on('error', (err) => {
      console.error(`WebSocket error for ${username} in room ${roomId}:`, err?.message || err);
    });
  });

  // Handle HTTP Upgrade requests and route them by pathname
  server.on('upgrade', (request, socket, head) => {
    try {
      const { pathname } = url.parse(request.url);
      const match = pathname && pathname.match(/^\/ws\/([^\/]+)\/([^\/]+)$/);
      if (!match) {
        // Not our WS route; reject upgrade cleanly
        socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
        socket.destroy();
        return;
      }
      const roomId = decodeURIComponent(match[1]);
      const username = decodeURIComponent(match[2]);

      // Auto-create room by touching the map
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

function startServer(port = 8000) {
  const { server } = createServer();
  const finalPort = Number(process.env.PORT) || Number(port) || 8000;
  server.listen(finalPort, () => {
    const isHttps = server instanceof https.Server;
    const proto = isHttps ? 'wss' : 'ws';
    const httpProto = isHttps ? 'https' : 'http';
    console.log(`🚀 joinMeeting server running on ${httpProto}://localhost:${finalPort}`);
    console.log(`👉 WebSocket path: ${proto}://<host>:${finalPort}/ws/:roomId/:username`);
  });
  return server;
}

module.exports = { startServer };


