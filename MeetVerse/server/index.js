const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const cors = require('cors');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const cron = require('node-cron');

const app = express();

// Configure CORS with flexible origins (allow configured list or any origin in dev)
const allowedOrigins = (process.env.CLIENT_ORIGINS || 'http://localhost:3000,http://localhost:3001')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const allowAllCors = (process.env.ALLOW_ALL_ORIGINS === 'true') || (process.env.NODE_ENV !== 'production');

app.use(cors({
  origin: (origin, callback) => {
    if (allowAllCors) return callback(null, true);
    if (!origin) return callback(null, true); // allow non-browser or same-origin
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    // allow any origin during local LAN testing if it matches localhost or current machine host
    if (/^http:\/\/localhost:\d+/.test(origin)) return callback(null, true);
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());

// Simple download proxy to serve external documents with clean filenames and CORS-safe headers
app.get('/proxy-download', async (req, res) => {
  try {
    const targetUrl = req.query.url;
    const name = req.query.name;
    if (!targetUrl) {
      return res.status(400).json({ error: 'Missing url parameter' });
    }
    // Validate URL
    let urlObj;
    try {
      urlObj = new URL(String(targetUrl));
    } catch (_) {
      return res.status(400).json({ error: 'Invalid url parameter' });
    }

    // Fetch the resource as stream
    const headResp = await axios.get(urlObj.toString(), { responseType: 'stream' });

    // Infer filename
    const pathBase = (urlObj.pathname.split('/').filter(Boolean).pop() || 'document').split('?')[0];
    const fallbackName = pathBase || 'document';
    const filename = (name && String(name).trim()) || fallbackName;

    // Propagate content type if present
    const contentType = headResp.headers['content-type'] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Pipe stream
    headResp.data.pipe(res);
  } catch (err) {
    console.error('Proxy download error:', err?.message || err);
    res.status(502).json({ error: 'Failed to fetch target file' });
  }
});

// Create HTTP or HTTPS server depending on env
let server;
if (process.env.HTTPS === 'true') {
  try {
    const keyPath = process.env.SSL_KEY_FILE;
    const certPath = process.env.SSL_CRT_FILE || process.env.SSL_CERT_FILE;
    if (!keyPath || !certPath) {
      console.warn('HTTPS requested but SSL_KEY_FILE/SSL_CRT_FILE not set. Falling back to HTTP.');
      server = http.createServer(app);
    } else {
      const options = {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath)
      };
      server = https.createServer(options, app);
      console.log('🔒 HTTPS mode enabled.');
    }
  } catch (e) {
    console.warn('Failed to initialize HTTPS. Falling back to HTTP:', e?.message || e);
    server = http.createServer(app);
  }
} else {
  server = http.createServer(app);
}

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      // mirror the express CORS logic
      if (allowAllCors) return callback(null, true);
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (/^http:\/\/localhost:\d+/.test(origin)) return callback(null, true);
      return callback(null, false);
    },
    methods: ['GET', 'POST'],
    credentials: true
  }
});
app.get('/', (req, res) => {
  res.send('Socket.io server is running.');
});

// No external API key setup needed for mock translation
let meetings = {}; // Store active meetings and room-scoped state
let scheduledMeetings = {}; // Store scheduled meetings
let reminderJobs = {}; // Store cron jobs for reminders

// Handle preflight requests for create-meet endpoint
app.options('/create-meet', (req, res) => {
  res.status(200).end();
});

// Create meeting link endpoint
app.post('/create-meet', (req, res) => {
  const meetingId = uuidv4().split('-')[0]; // shorter unique ID
  meetings[meetingId] = { createdAt: Date.now(), docs: [] };
  // Prefer explicit env, then request origin, then fallback to localhost
  const origin = process.env.CLIENT_BASE_URL || req.headers.origin || `http://localhost:3000`;
  const base = String(origin).replace(/\/$/, '');
  res.json({ link: `${base}/meet/${meetingId}` });
});


// Handle preflight requests for validate-meet endpoint
app.options('/validate-meet/:id', (req, res) => {
  res.status(200).end();
});

// Validate meeting
app.get('/validate-meet/:id', (req, res) => {
  const { id } = req.params;
  res.json({ valid: !!meetings[id] });
});

// --- SCHEDULED MEETINGS ENDPOINTS ---

// Handle preflight requests for schedule-meet endpoint
app.options('/schedule-meet', (req, res) => {
  res.status(200).end();
});

// Schedule a meeting
app.post('/schedule-meet', (req, res) => {
  const { title, description, scheduledTime, hostEmail, hostName } = req.body;
  
  if (!title || !scheduledTime || !hostEmail) {
    return res.status(400).json({ error: 'Title, scheduled time, and host email are required' });
  }

  const meetingId = uuidv4().split('-')[0];
  const scheduledDate = new Date(scheduledTime);
  const now = new Date();

  if (scheduledDate <= now) {
    return res.status(400).json({ error: 'Scheduled time must be in the future' });
  }

  // Build meeting link using env or request origin
  const origin = process.env.CLIENT_BASE_URL || req.headers.origin || `http://localhost:3000`;
  const base = String(origin).replace(/\/$/, '');

  const scheduledMeeting = {
    id: meetingId,
    title,
    description: description || '',
    scheduledTime: scheduledDate.toISOString(),
    hostEmail,
    hostName: hostName || 'Host',
    createdAt: now.toISOString(),
    status: 'scheduled', // scheduled, active, completed, cancelled
    meetingLink: `${base}/meet/${meetingId}`
  };

  scheduledMeetings[meetingId] = scheduledMeeting;

  // Schedule reminder 5 minutes before meeting
  const reminderTime = new Date(scheduledDate.getTime() - 5 * 60 * 1000);
  const cronExpression = `${reminderTime.getMinutes()} ${reminderTime.getHours()} ${reminderTime.getDate()} ${reminderTime.getMonth() + 1} *`;
  
  const job = cron.schedule(cronExpression, () => {
    sendMeetingReminder(meetingId);
  }, {
    scheduled: false,
    timezone: "UTC"
  });

  reminderJobs[meetingId] = job;
  job.start();

  res.json(scheduledMeeting);
});

// Get all scheduled meetings for a host
app.get('/scheduled-meetings/:hostEmail', (req, res) => {
  const { hostEmail } = req.params;
  const hostMeetings = Object.values(scheduledMeetings)
    .filter(meeting => meeting.hostEmail === hostEmail)
    .sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime));
  
  res.json(hostMeetings);
});

// Get a specific scheduled meeting
app.get('/scheduled-meeting/:id', (req, res) => {
  const { id } = req.params;
  const meeting = scheduledMeetings[id];
  
  if (!meeting) {
    return res.status(404).json({ error: 'Meeting not found' });
  }
  
  res.json(meeting);
});

// Update scheduled meeting
app.put('/scheduled-meeting/:id', (req, res) => {
  const { id } = req.params;
  const { title, description, scheduledTime, hostName } = req.body;
  
  if (!scheduledMeetings[id]) {
    return res.status(404).json({ error: 'Meeting not found' });
  }

  const meeting = scheduledMeetings[id];
  
  // Cancel existing reminder job
  if (reminderJobs[id]) {
    reminderJobs[id].destroy();
    delete reminderJobs[id];
  }

  // Update meeting details
  if (title) meeting.title = title;
  if (description !== undefined) meeting.description = description;
  if (scheduledTime) {
    const newScheduledTime = new Date(scheduledTime);
    if (newScheduledTime <= new Date()) {
      return res.status(400).json({ error: 'Scheduled time must be in the future' });
    }
    meeting.scheduledTime = newScheduledTime.toISOString();
    
    // Schedule new reminder
    const reminderTime = new Date(newScheduledTime.getTime() - 5 * 60 * 1000);
    const cronExpression = `${reminderTime.getMinutes()} ${reminderTime.getHours()} ${reminderTime.getDate()} ${reminderTime.getMonth() + 1} *`;
    
    const job = cron.schedule(cronExpression, () => {
      sendMeetingReminder(id);
    }, {
      scheduled: false,
      timezone: "UTC"
    });

    reminderJobs[id] = job;
    job.start();
  }
  if (hostName) meeting.hostName = hostName;

  res.json(meeting);
});

// Cancel scheduled meeting
app.delete('/scheduled-meeting/:id', (req, res) => {
  const { id } = req.params;
  
  if (!scheduledMeetings[id]) {
    return res.status(404).json({ error: 'Meeting not found' });
  }

  // Cancel reminder job
  if (reminderJobs[id]) {
    reminderJobs[id].destroy();
    delete reminderJobs[id];
  }

  // Mark as cancelled
  scheduledMeetings[id].status = 'cancelled';
  
  res.json({ message: 'Meeting cancelled successfully' });
});

// Function to send meeting reminder
function sendMeetingReminder(meetingId) {
  const meeting = scheduledMeetings[meetingId];
  if (!meeting || meeting.status !== 'scheduled') {
    return;
  }

  // Emit reminder to all connected clients
  io.emit('meeting-reminder', {
    meetingId,
    title: meeting.title,
    scheduledTime: meeting.scheduledTime,
    meetingLink: meeting.meetingLink,
    hostName: meeting.hostName
  });

  console.log(`📅 Meeting reminder sent for: ${meeting.title} at ${meeting.scheduledTime}`);
}

// Clean up expired meetings and completed reminders
setInterval(() => {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  // Clean up old scheduled meetings
  for (const [id, meeting] of Object.entries(scheduledMeetings)) {
    const meetingTime = new Date(meeting.scheduledTime);
    if (meetingTime < oneDayAgo && (meeting.status === 'completed' || meeting.status === 'cancelled')) {
      delete scheduledMeetings[id];
      if (reminderJobs[id]) {
        reminderJobs[id].destroy();
        delete reminderJobs[id];
      }
    }
  }
}, 60 * 60 * 1000); // Run every hour

io.on('connection', (socket) => {
  console.log('✅ New client connected:', socket.id);

  // --- CHAT MESSAGE HANDLING with Translation ---
  // Helper: translate text to English using only external services; parallel fast path
  async function translateToEnglish(text) {
    const defaultBase = process.env.LIBRE_TRANSLATE_URL || 'https://libretranslate.de';
    const ltBases = [defaultBase, 'https://translate.argosopentech.com'];
    const headersJson = { 'Content-Type': 'application/json', Accept: 'application/json' };
    const headersForm = { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' };

    const ltTranslate = (baseUrl) => (
      axios.post(`${baseUrl}/translate`, { q: text, source: 'auto', target: 'en', format: 'text' }, { headers: headersJson, timeout: 7000 })
        .then(r => r.data?.translatedText || r.data?.[0]?.translatedText)
        .catch(async () => {
          const p = new URLSearchParams(); p.append('q', text); p.append('source', 'auto'); p.append('target', 'en'); p.append('format', 'text');
          const r2 = await axios.post(`${baseUrl}/translate`, p, { headers: headersForm, timeout: 7000 });
          return r2.data?.translatedText || r2.data?.[0]?.translatedText;
        })
    );

    const myMemory = () => (
      axios.get('https://api.mymemory.translated.net/get', { params: { q: text, langpair: 'auto|en' }, timeout: 7000 })
        .then(r => r.data?.responseData?.translatedText)
    );

    // Kick off all requests in parallel and pick the first good translation
    const candidates = [myMemory(), ...ltBases.map(ltTranslate)];
    try {
      const result = await Promise.any(candidates.map(p => p.then(t => (t && String(t).trim()) ? String(t).trim() : Promise.reject('empty'))));
      return result;
    } catch (_) {
      // If all rejected, try sequentially to surface any that succeed later
      for (const p of candidates) {
        try {
          const t = await p; if (t && String(t).trim()) return String(t).trim();
        } catch {}
      }
      return text;
    }
  }

  socket.on('message', async (data) => {
    console.log('Received message:', data);

    const translatedTextEn = await translateToEnglish(data.text || '');

    const messageWithTranslationInfo = {
      ...data,
      translatedTextEn,
    };
    const room = data.meetingId;
    if (room) {
      io.to(room).emit('messageResponse', messageWithTranslationInfo);
    } else {
      socket.emit('messageResponse', messageWithTranslationInfo);
    }
  });
  // --- END CHAT MESSAGE HANDLING ---
    socket.on('join-room', (meetingId, userName) => {
    socket.join(meetingId);
    console.log(`${userName} joined room: ${meetingId}`);
    // Initialize room state container if missing
    if (!meetings[meetingId]) {
      meetings[meetingId] = { createdAt: Date.now(), docs: [] };
    }

    // Send current documents to the newly joined client
    socket.emit('docs-init', meetings[meetingId].docs || []);

    setInterval(() => {
      const now = Date.now();
      for (let id in meetings) {
        if (now - meetings[id].createdAt > 2 * 60 * 60 * 1000) {
          delete meetings[id];
        }
      }
    }, 60000);
    
    
    // Notify others in the room
    socket.to(meetingId).emit('user-joined', { id: socket.id, name: userName });
  });

  // --- WEBRTC SIGNALING HANDLERS (UNCHANGED) ---
  // socket.on('offer', (offer) => {
  //   console.log('Received offer from', socket.id);
  //   socket.broadcast.emit('offer', offer);
  // });

  // socket.on('answer', (answer) => {
  //   console.log('Received answer from', socket.id);
  //   socket.broadcast.emit('answer', answer);
  // });

  // socket.on('ice-candidate', (candidate) => {
  //   console.log('Received ICE candidate from', socket.id);
  //   socket.broadcast.emit('ice-candidate', candidate);
  // });
  // // --- END NEW WEBRTC SIGNALING HANDLERS ---

  // socket.on('disconnect', () => {
  //   console.log('❌ Client disconnected:', socket.id);
  // });
  socket.on('offer', ({ meetingId, offer }) => {
    socket.to(meetingId).emit('offer', offer);
  });

  socket.on('answer', ({ meetingId, answer }) => {
    socket.to(meetingId).emit('answer', answer);
  });

  socket.on('ice-candidate', ({ meetingId, candidate }) => {
    socket.to(meetingId).emit('ice-candidate', candidate);
  });

  // --- ROOM-SCOPED DOCUMENT SYNC ---
  socket.on('doc-add', ({ meetingId, doc }) => {
    if (!meetingId || !doc) return;
    if (!meetings[meetingId]) meetings[meetingId] = { createdAt: Date.now(), docs: [] };
    const roomDocs = meetings[meetingId].docs || [];
    // Avoid duplicates by id
    if (!roomDocs.find(d => d.id === doc.id)) {
      roomDocs.push(doc);
      meetings[meetingId].docs = roomDocs;
      io.to(meetingId).emit('docs-updated', roomDocs);
    }
  });

  // --- LIVE STT + TRANSLATE (Voxtral scaffold) ---
  // Events: 'stt-start' (meetingId, sourceLang?), 'stt-chunk' (Float32Array PCM base64), 'stt-stop'
  // Server aggregates audio, runs STT (placeholder), translates to English, and emits 'stt-result'
  const liveBuffers = new Map(); // key: socket.id -> Float32Array chunks

  socket.on('stt-start', ({ meetingId, sourceLang }) => {
    socket.data.sttMeetingId = meetingId;
    socket.data.sttSourceLang = sourceLang || 'auto';
    liveBuffers.set(socket.id, []);
  });

  socket.on('stt-chunk', ({ chunkBase64 }) => {
    const list = liveBuffers.get(socket.id);
    if (!list) return;
    try {
      const raw = Buffer.from(chunkBase64, 'base64');
      list.push(raw);
    } catch (_) {}
  });

  async function translateToEnglish(text) {
    const defaultBase = process.env.LIBRE_TRANSLATE_URL || 'https://libretranslate.de';
    const fallbacks = [defaultBase, 'https://translate.argosopentech.com'];
    const headersJson = { 'Content-Type': 'application/json', Accept: 'application/json' };
    const headersForm = { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' };
    const tryDetect = async (baseUrl) => {
      try { return (await axios.post(`${baseUrl}/detect`, { q: text }, { headers: headersJson, timeout: 8000 })).data; }
      catch { const p = new URLSearchParams(); p.append('q', text); return (await axios.post(`${baseUrl}/detect`, p, { headers: headersForm, timeout: 8000 })).data; }
    };
    const tryTranslate = async (baseUrl, source) => {
      try { return (await axios.post(`${baseUrl}/translate`, { q: text, source: source || 'auto', target: 'en', format: 'text' }, { headers: headersJson, timeout: 10000 })).data?.translatedText; }
      catch { const p = new URLSearchParams(); p.append('q', text); p.append('source', source || 'auto'); p.append('target', 'en'); p.append('format', 'text'); return (await axios.post(`${baseUrl}/translate`, p, { headers: headersForm, timeout: 10000 })).data?.translatedText; }
    };
    for (const base of fallbacks) {
      try {
        const det = await tryDetect(base);
        const lang = Array.isArray(det) ? det[0]?.language || 'auto' : (det?.language || 'auto');
        if (lang === 'en') return text;
        const tr = await tryTranslate(base, lang);
        if (tr && tr.trim()) return tr;
      } catch { continue; }
    }
    return text;
  }

  socket.on('stt-stop', async () => {
    const chunks = liveBuffers.get(socket.id) || [];
    liveBuffers.delete(socket.id);
    const meetingId = socket.data.sttMeetingId;
    const sourceLang = socket.data.sttSourceLang || 'auto';
    if (!chunks.length || !meetingId) return;
    try {
      // POST to a vLLM server running Voxtral transcription (configure VLLM_BASE)
      // The server should expose OpenAI-compatible /v1/audio/transcriptions or a custom endpoint.
      const VLLM_BASE = process.env.VLLM_BASE || 'http://localhost:8000/v1';
      const buf = Buffer.concat(chunks);
      // Send as base64 WAV/WEBM blob depending on what we captured; here we send binary as octet-stream
      const resp = await axios.post(`${VLLM_BASE}/audio/transcriptions`, buf, {
        headers: { 'Content-Type': 'application/octet-stream' },
        params: { model: process.env.VOXTRAL_MODEL || 'mistralai/Voxtral-Small-24B-2507', language: 'auto' },
        timeout: 20000
      });
      const sttText = resp.data?.text || resp.data?.transcription || '';
      const translated = await translateToEnglish(sttText || '');
      io.to(meetingId).emit('stt-result', {
        from: socket.id,
        text: sttText,
        translatedTextEn: translated,
        at: Date.now(),
      });
    } catch (e) {
      console.error('STT pipeline error:', e?.message || e);
    }
  });

  socket.on('doc-remove', ({ meetingId, id }) => {
    if (!meetingId || !id) return;
    if (!meetings[meetingId]) return;
    const roomDocs = (meetings[meetingId].docs || []).filter(d => d.id !== id);
    meetings[meetingId].docs = roomDocs;
    io.to(meetingId).emit('docs-updated', roomDocs);
  });

  socket.on('disconnect', () => {
    console.log('❌ Client disconnected:', socket.id);
  });
  
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  const proto = process.env.HTTPS === 'true' ? 'https' : 'http';
  console.log(`🚀 Server is running on ${proto}://localhost:${PORT}`);
});