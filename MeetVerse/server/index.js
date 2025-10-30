import dotenv from 'dotenv';
import express from 'express';
import connectDB from './config/database.js';
import meetingRoutes from './routes/meetingRoutes.js';
import http from 'http';
import https from 'https';
import fs from 'fs';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import cron from 'node-cron';
import { Server } from 'socket.io';
import emailRoutes from './routes/emailRoutes.js';
import { sendMeetingSummary } from './services/emailService.js';

dotenv.config();
connectDB();


// const fs = require('fs');
// const cors = require('cors');
// const { v4: uuidv4 } = require('uuid');
// const axios = require('axios');
// const cron = require('node-cron');

// Database connection
// const connectDB = require('./config/database');
  // const Meeting = require('./models/Meeting');
  // const User = require('./models/User');
  import Meeting from './models/Meeting.js';
  import User from './models/User.js';

// Connect to MongoDB (already called above)

const app = express();

// Configure CORS with flexible origins (allow configured list or any origin in dev)
const allowedOrigins = (process.env.CLIENT_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const allowAllCors = (process.env.ALLOW_ALL_ORIGINS === 'true') || (process.env.NODE_ENV !== 'production');

app.use(cors({
  origin: allowAllCors ? true : (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (/^http:\/\/localhost:\d+/.test(origin)) return callback(null, true);
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Preflight is handled by the CORS middleware above

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

    // Heuristics: normalize Google Drive/Docs links to direct export for clean files
    const host = (urlObj.hostname || '').toLowerCase();
    let fetchUrl = urlObj.toString();
    let suggestedExt = '';
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    const maybeId = pathParts[2]; // /document/d/{id}/..., /spreadsheets/d/{id}/..., /presentation/d/{id}/...
    if (host.includes('docs.google.com')) {
      if (pathParts[0] === 'document' && pathParts[1] === 'd' && maybeId) {
        fetchUrl = `https://docs.google.com/document/d/${maybeId}/export?format=pdf`;
        suggestedExt = '.pdf';
      } else if (pathParts[0] === 'spreadsheets' && pathParts[1] === 'd' && maybeId) {
        // Prefer PDF for consistent rendering; pass through gid if present to select sheet
        const gid = urlObj.searchParams.get('gid');
        const pdfParams = new URLSearchParams({
          format: 'pdf',
          portrait: 'false',
          size: 'A4',
          gridlines: 'false',
          sheetnames: 'true',
          printtitle: 'false',
          pagenumbers: 'true',
          fzr: 'true'
        });
        if (gid) pdfParams.set('gid', gid);
        fetchUrl = `https://docs.google.com/spreadsheets/d/${maybeId}/export?${pdfParams.toString()}`;
        suggestedExt = '.pdf';
      } else if (pathParts[0] === 'presentation' && pathParts[1] === 'd' && maybeId) {
        fetchUrl = `https://docs.google.com/presentation/d/${maybeId}/export/pdf`;
        suggestedExt = '.pdf';
      }
    } else if (host.includes('drive.google.com')) {
      // Convert /file/d/{id}/view?usp=sharing → direct download
      if (pathParts[0] === 'file' && pathParts[1] === 'd' && pathParts[2]) {
        const id = pathParts[2];
        fetchUrl = `https://drive.google.com/uc?export=download&id=${id}`;
      }
    }

    // Fetch the resource as stream
    const headResp = await axios.get(fetchUrl, { responseType: 'stream' });

    // Infer filename
    const pathBase = (urlObj.pathname.split('/').filter(Boolean).pop() || 'document').split('?')[0];
    const fallbackName = pathBase || 'document';
    let filename = (name && String(name).trim()) || fallbackName;
    if (suggestedExt && !filename.toLowerCase().endsWith(suggestedExt)) {
      filename = `${filename}${suggestedExt}`;
    }

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
    const certPath = process.env.SSL_CERT_FILE || process.env.SSL_CERT_FILE;
    if (!keyPath || !certPath) {
      console.warn('HTTPS requested but SSL_KEY_FILE/SSL_CERT_FILE not set. Falling back to HTTP.');
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
    origin: allowAllCors ? true : (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (/^http:\/\/localhost:\d+/.test(origin)) return callback(null, true);
      return callback(null, false);
    },
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// (Email reminder feature removed per request)

app.get('/', (req, res) => {
  res.send('Socket.io server is running.');
});

// --- API ROUTES ---
app.use('/api/email', emailRoutes);

// --- LIBRETRANSLATE (Open-source Translation) ---
// Configure base URL with env LIBRE_TRANSLATE_URL, defaults to public instance
async function libreTranslateToEnglish(text) {
  try {
    if (!text || !String(text).trim()) return '';
    const defaultBase = process.env.LIBRE_TRANSLATE_URL || 'https://libretranslate.de';
    const candidates = [defaultBase, 'https://translate.argosopentech.com'];
    const headersJson = { 'Content-Type': 'application/json', Accept: 'application/json' };
    const headersForm = { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' };

    const tryOnce = async (base) => {
      try {
        // Detect source language first (improves accuracy over auto in some instances)
        let detected = 'auto';
        try {
          const det = await axios.post(`${base}/detect`, { q: String(text) }, { headers: headersJson, timeout: 6000 });
          const lang = Array.isArray(det?.data) ? det.data[0]?.language : det?.data?.language;
          if (lang && typeof lang === 'string') detected = lang;
        } catch (_) {
          try {
            const p = new URLSearchParams(); p.append('q', String(text));
            const det2 = await axios.post(`${base}/detect`, p, { headers: headersForm, timeout: 6000 });
            const lang = Array.isArray(det2?.data) ? det2.data[0]?.language : det2?.data?.language;
            if (lang && typeof lang === 'string') detected = lang;
          } catch (_) {}
        }
        if (detected === 'en') return String(text);

        // Try JSON first
        const r = await axios.post(`${base}/translate`, { q: String(text), source: detected || 'auto', target: 'en', format: 'text' }, { headers: headersJson, timeout: 8000 });
        return r.data?.translatedText || r.data?.[0]?.translatedText;
      } catch (_) {
        // Fallback to form-encoded
        const p = new URLSearchParams();
        p.append('q', String(text));
        p.append('source', 'en');
        try { // if detected set, prefer it
          p.set('source', detected || 'auto');
        } catch (_) {}
        p.append('target', 'en');
        p.append('format', 'text');
        const r2 = await axios.post(`${base}/translate`, p, { headers: headersForm, timeout: 8000 });
        return r2.data?.translatedText || r2.data?.[0]?.translatedText;
      }
    };

    for (const base of candidates) {
      try {
        const out = await tryOnce(base);
        if (out && String(out).trim()) return String(out);
      } catch (_) { /* try next */ }
    }
    return String(text);
  } catch (_) {
    return String(text);
  }
}

// Public translate endpoint used by client for live typing preview
app.post('/translate', async (req, res) => {
  try {
    const { text } = req.body || {};
    if (!text || !String(text).trim()) return res.json({ translatedTextEn: '' });
    const translatedTextEn = await libreTranslateToEnglish(String(text));
    res.json({ translatedTextEn });
  } catch (e) {
    res.status(500).json({ error: 'Translation failed' });
  }
});

// --- USER AUTH (LIGHTWEIGHT) ---
import bcrypt from 'bcryptjs';

// Generate a unique username when one isn't provided
function normalizeUsernameBase(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 20); // leave room for suffix
}

async function generateUniqueUsername(input) {
  const email = String(input?.email || '').toLowerCase();
  const name = String(input?.name || '').trim();

  const localPart = email.includes('@') ? email.split('@')[0] : '';
  const fromEmail = normalizeUsernameBase(localPart);
  const fromName = normalizeUsernameBase(name.replace(/\s+/g, '_'));

  const candidates = [fromEmail, fromName, 'user']
    .filter(Boolean)
    .map(b => (b.length < 3 ? `user_${b}` : b));

  // Ensure each candidate within limits
  const baseSet = Array.from(new Set(candidates.map(c => c.slice(0, 20))));

  // Try plain bases first
  for (const base of baseSet) {
    if (base && base.length >= 3 && /^[a-z0-9_]{3,24}$/.test(base)) {
      const exists = await User.findOne({ username: base });
      if (!exists) return base;
    }
  }

  // Try with numeric suffixes
  for (const base of baseSet) {
    for (let i = 1; i <= 9999; i++) {
      const suffix = String(i);
      const candidate = (base + '_' + suffix).slice(0, 24);
      if (!/^[a-z0-9_]{3,24}$/.test(candidate)) continue;
      const exists = await User.findOne({ username: candidate });
      if (!exists) return candidate;
    }
  }

  // Fallback: random
  while (true) {
    const rnd = Math.random().toString(36).slice(2, 8);
    const candidate = `user_${rnd}`;
    const exists = await User.findOne({ username: candidate });
    if (!exists) return candidate;
  }
}

// Check username availability
app.get('/auth/username-available/:username', async (req, res) => {
  try {
    const username = String(req.params.username || '').toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(username)) {
      return res.status(400).json({ available: false, reason: 'invalid' });
    }
    const existing = await User.findOne({ username });
    res.json({ available: !existing });
  } catch (e) {
    res.status(500).json({ error: 'Failed to check availability' });
  }
});

// Signup (email, username unique)
app.post('/auth/signup', async (req, res) => {
  try {
    const { email, username, name, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    // Enforce email uniqueness first
    const emailLc = String(email).toLowerCase();
    const existsE = await User.findOne({ email: emailLc });
    if (existsE) return res.status(409).json({ error: 'Email already registered' });

    // Use provided username if valid and available; otherwise auto-generate one
    let uname = String(username || '').toLowerCase().trim();
    if (uname) {
      if (!/^[a-z0-9_]{3,24}$/.test(uname)) {
        return res.status(400).json({ error: 'Invalid username format' });
      }
      const existsU = await User.findOne({ username: uname });
      if (existsU) return res.status(409).json({ error: 'Username already taken' });
    } else {
      uname = await generateUniqueUsername({ email: emailLc, name: name || '' });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);
    const user = await User.create({
      email: emailLc,
      username: uname,
      name: name || '',
      passwordHash
    });
    res.status(201).json({ id: user._id, email: user.email, username: user.username, name: user.name });
  } catch (e) {
    console.error('Signup error:', e);
    res.status(500).json({ error: 'Signup failed' });
  }
});

// Login (email or username + password)
app.post('/auth/login', async (req, res) => {
  try {
    const { identifier, password } = req.body || {};
    if (!identifier || !password) {
      return res.status(400).json({ error: 'identifier and password required' });
    }
    const ident = String(identifier).trim().toLowerCase();
    const user = await User.findOne({ $or: [{ email: ident }, { username: ident }] });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(String(password), user.passwordHash || '');
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    return res.json({ id: user._id, email: user.email, username: user.username, name: user.name });
  } catch (e) {
    console.error('Login error:', e);
    res.status(500).json({ error: 'Login failed' });
  }
});

// --- MEETING ENDPOINTS ---

// Handle preflight requests for create-meet endpoint
app.options('/create-meet', (req, res) => {
  res.status(200).end();
});

// Create meeting link endpoint
app.post('/create-meet', async (req, res) => {
  try {
    const meetingId = uuidv4().split('-')[0]; // shorter unique ID
    const origin = process.env.CLIENT_BASE_URL || req.headers.origin || `http://localhost:3000`;
    const base = String(origin).replace(/\/$/, '');
    const meetingLink = `${base}/meet/${meetingId}`;

    // Create meeting in database
    const meeting = new Meeting({
      meetingId,
      title: 'Instant Meeting',
      description: 'Quick meeting created on demand',
      meetingLink,
      hostEmail: 'guest@meetverse.com',
      hostName: 'Guest',
      scheduledTime: new Date(),
      startTime: new Date(),
      status: 'active'
    });

    // Save in background to reduce latency; meeting will be created shortly
    meeting.save().catch((error) => {
      console.error('Error saving meeting (background):', error);
    });

    // Respond immediately with the link
    res.json({ link: meetingLink, meetingId });
  } catch (error) {
    console.error('Error creating meeting:', error);
    res.status(500).json({ error: 'Failed to create meeting' });
  }
});

// Handle preflight requests for validate-meet endpoint
app.options('/validate-meet/:id', (req, res) => {
  res.status(200).end();
});

// Validate meeting
app.get('/validate-meet/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const meeting = await Meeting.findOne({ meetingId: id });
    res.json({ valid: !!meeting });
  } catch (error) {
    console.error('Error validating meeting:', error);
    res.status(500).json({ error: 'Failed to validate meeting' });
  }
});

// --- SCHEDULED MEETINGS ENDPOINTS ---

// Handle preflight requests for schedule-meet endpoint
app.options('/schedule-meet', (req, res) => {
  res.status(200).end();
});

// Schedule a meeting
app.post('/schedule-meet', async (req, res) => {
  try {
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

    const meeting = new Meeting({
      meetingId,
      title,
      description: description || '',
      meetingLink: `${base}/meet/${meetingId}`,
      hostEmail,
      hostName: hostName || 'Host',
      scheduledTime: scheduledDate,
      status: 'scheduled'
    });

    await meeting.save();

    // Schedule reminder 5 minutes before meeting
    const reminderTime = new Date(scheduledDate.getTime() - 5 * 60 * 1000);
    const cronExpression = `${reminderTime.getMinutes()} ${reminderTime.getHours()} ${reminderTime.getDate()} ${reminderTime.getMonth() + 1} *`;
    
    const job = cron.schedule(cronExpression, () => {
      sendMeetingReminder(meetingId);
    }, {
      scheduled: false,
      timezone: "UTC"
    });

    job.start();

    res.json(meeting);
  } catch (error) {
    console.error('Error scheduling meeting:', error);
    res.status(500).json({ error: 'Failed to schedule meeting' });
  }
});

// Get all scheduled meetings for a host
app.get('/scheduled-meetings/:hostEmail', async (req, res) => {
  try {
    const { hostEmail } = req.params;
    const meetings = await Meeting.find({ 
      hostEmail,
      status: { $in: ['scheduled', 'active', 'completed'] }
    })
    .sort({ scheduledTime: 1 });
    
    res.json(meetings);
  } catch (error) {
    console.error('Error fetching scheduled meetings:', error);
    res.status(500).json({ error: 'Failed to fetch meetings' });
  }
});

// Get a specific scheduled meeting
app.get('/scheduled-meeting/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const meeting = await Meeting.findOne({ meetingId: id });
    
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    
    res.json(meeting);
  } catch (error) {
    console.error('Error fetching meeting:', error);
    res.status(500).json({ error: 'Failed to fetch meeting' });
  }
});

// Update scheduled meeting
app.put('/scheduled-meeting/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, scheduledTime, hostName } = req.body;
    
    const meeting = await Meeting.findOne({ meetingId: id });
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // Update meeting details
    if (title) meeting.title = title;
    if (description !== undefined) meeting.description = description;
    if (scheduledTime) {
      const newScheduledTime = new Date(scheduledTime);
      if (newScheduledTime <= new Date()) {
        return res.status(400).json({ error: 'Scheduled time must be in the future' });
      }
      meeting.scheduledTime = newScheduledTime;
    }
    if (hostName) meeting.hostName = hostName;

    await meeting.save();
    res.json(meeting);
  } catch (error) {
    console.error('Error updating meeting:', error);
    res.status(500).json({ error: 'Failed to update meeting' });
  }
});

// Cancel scheduled meeting
app.delete('/scheduled-meeting/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const meeting = await Meeting.findOne({ meetingId: id });
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    meeting.status = 'cancelled';
    await meeting.save();
    
    res.json({ message: 'Meeting cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling meeting:', error);
    res.status(500).json({ error: 'Failed to cancel meeting' });
  }
});

// Get meeting statistics
app.get('/meeting-stats/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const meeting = await Meeting.findOne({ meetingId: id });
    
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    const stats = {
      participantCount: meeting.participantCount,
      totalParticipants: meeting.participants.length,
      duration: meeting.duration,
      startTime: meeting.startTime,
      endTime: meeting.endTime,
      documentCount: meeting.documents.length,
      messageCount: meeting.chatMessages.length
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching meeting stats:', error);
    res.status(500).json({ error: 'Failed to fetch meeting statistics' });
  }
});

// Function to send meeting reminder
async function sendMeetingReminder(meetingId) {
  try {
    const meeting = await Meeting.findOne({ meetingId });
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
  } catch (error) {
    console.error('Error sending meeting reminder:', error);
  }
}

// Clean up expired meetings
setInterval(async () => {
  try {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // Clean up old completed/cancelled meetings
    await Meeting.deleteMany({
      scheduledTime: { $lt: oneDayAgo },
      status: { $in: ['completed', 'cancelled'] }
    });
  } catch (error) {
    console.error('Error cleaning up expired meetings:', error);
  }
}, 60 * 60 * 1000); // Run every hour


app.use('/api/meetings', meetingRoutes);

// Socket.io connection handling
io.on('connection', async (socket) => {
  console.log('✅ New client connected:', socket.id);

  // --- CHAT MESSAGE HANDLING with Translation (LibreTranslate) ---
  socket.on('message', async (data) => {
    try {
      console.log('Received message:', data);

      const translatedTextEn = await libreTranslateToEnglish(data.text || '');

      const messageWithTranslationInfo = {
        ...data,
        translatedTextEn,
      };

      // Save message to database
      const meeting = await Meeting.findOne({ meetingId: data.meetingId });
      if (meeting) {
        await meeting.addChatMessage(messageWithTranslationInfo);
      }

      const room = data.meetingId;
      if (room) {
        io.to(room).emit('messageResponse', messageWithTranslationInfo);
      } else {
        socket.emit('messageResponse', messageWithTranslationInfo);
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  });

  socket.on('join-room', async (meetingId, userName, userEmail) => {
    try {
      socket.join(meetingId);
      socket.data.currentMeetingId = meetingId;
      socket.data.userName = userName;
      socket.data.userEmail = userEmail;
      console.log(`${userName} joined room: ${meetingId}`);

      // Enforce login: require a valid user record by email
      const emailLc = String(userEmail || '').toLowerCase();
      const userRec = await User.findOne({ email: emailLc });
      if (!userRec) {
        socket.emit('auth-required', { error: 'Login required' });
        try { socket.leave(meetingId); } catch (_) {}
        return;
      }

      // Find or create meeting
      let meeting = await Meeting.findOne({ meetingId });
      if (!meeting) {
        // Create instant meeting if it doesn't exist
        const origin = process.env.CLIENT_BASE_URL || 'http://localhost:3000';
        const base = String(origin).replace(/\/$/, '');
        meeting = new Meeting({
          meetingId,
          title: 'Instant Meeting',
          description: 'Quick meeting created on demand',
          meetingLink: `${base}/meet/${meetingId}`,
          hostEmail: 'guest@meetverse.com',
          hostName: 'Guest',
          scheduledTime: new Date(),
          startTime: new Date(),
          status: 'active'
        });
        await meeting.save();
      }

      // Only-one-host logic: first join becomes host (if none yet)
      if (!meeting.hostSocketId) {
        await meeting.assignHostIfNone(socket.id, userName);
      }

      // Add participant to meeting
      await meeting.addParticipant(socket.id, userName, emailLc);

      // Start meeting if it's scheduled
      if (meeting.status === 'scheduled') {
        await meeting.startMeeting();
      }

      // Send current documents to the newly joined client
      socket.emit('docs-init', meeting.documents || []);

      // Notify others in the room
      socket.to(meetingId).emit('user-joined', { id: socket.id, name: userName });
      // Tell the joiner whether they are host
      const isHost = meeting.hostSocketId === socket.id;
      socket.emit('room-role', { meetingId, isHost, hostName: meeting.hostName });
    } catch (error) {
      console.error('Error joining room:', error);
    }
  });

  // --- WEBRTC SIGNALING HANDLERS ---
  socket.on('offer', ({ meetingId, offer }) => {
    console.log(`📡 Offer received for meeting ${meetingId} from ${socket.id}`);
    socket.to(meetingId).emit('offer', offer);
  });

  socket.on('answer', ({ meetingId, answer }) => {
    console.log(`📡 Answer received for meeting ${meetingId} from ${socket.id}`);
    socket.to(meetingId).emit('answer', answer);
  });

  socket.on('ice-candidate', ({ meetingId, candidate }) => {
    console.log(`🧊 ICE candidate received for meeting ${meetingId} from ${socket.id}`);
    socket.to(meetingId).emit('ice-candidate', candidate);
  });

  // Connection monitoring
  socket.on('connection-stats', ({ meetingId, stats }) => {
    console.log(`📊 Connection stats for meeting ${meetingId}:`, stats);
    // Store stats in database if needed
  });

  // Connection quality reporting
  socket.on('connection-quality', ({ meetingId, quality, rtt, packetLoss }) => {
    console.log(`📈 Connection quality for meeting ${meetingId}: ${quality} (RTT: ${rtt}ms, Loss: ${packetLoss}%)`);
  });


  // --- HOST END MEETING MANUALLY ---
  socket.on('meeting-end', async ({ meetingId }) => {
    try {
      if (!meetingId) return;
      const meeting = await Meeting.findOne({ meetingId });
      if (!meeting) return;
      if (meeting.hostSocketId !== socket.id) {
        console.warn('Non-host attempted to end meeting');
        return;
      }
      await meeting.endMeeting();
      try {
        await sendMeetingSummary(meeting);
      } catch (e) {
        console.warn('Follow-up email failed:', e?.message || e);
      }
      io.to(meetingId).emit('meeting-ended', { meetingId });
      try { io.in(meetingId).socketsLeave(meetingId); } catch (_) {}
    } catch (e) {
      console.error('Error ending meeting:', e);
    }
  });

  // --- ROOM-SCOPED DOCUMENT SYNC ---
  socket.on('doc-add', async ({ meetingId, doc }) => {
    try {
      if (!meetingId || !doc) return;
      
      const meeting = await Meeting.findOne({ meetingId });
      if (meeting) {
        await meeting.addDocument(doc.id, doc.url, socket.id);
        io.to(meetingId).emit('docs-updated', meeting.documents);
      }
    } catch (error) {
      console.error('Error adding document:', error);
    }
  });

  socket.on('doc-remove', async ({ meetingId, id }) => {
    try {
      if (!meetingId || !id) return;
      
      const meeting = await Meeting.findOne({ meetingId });
      if (meeting) {
        await meeting.removeDocument(id);
        io.to(meetingId).emit('docs-updated', meeting.documents);
      }
    } catch (error) {
      console.error('Error removing document:', error);
    }
  });
  // (To-do email and sync feature removed per request)

  // --- LIVE STT + TRANSLATE (Voxtral scaffold) ---
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
    try {
      const chunks = liveBuffers.get(socket.id) || [];
      liveBuffers.delete(socket.id);
      const meetingId = socket.data.sttMeetingId;
      const sourceLang = socket.data.sttSourceLang || 'auto';
      if (!chunks.length || !meetingId) return;

      // POST to a vLLM server running Voxtral transcription (configure VLLM_BASE)
      const VLLM_BASE = process.env.VLLM_BASE || 'http://localhost:8000/v1';
      const buf = Buffer.concat(chunks);
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

  socket.on('disconnect', async () => {
    try {
      console.log('❌ Client disconnected:', socket.id);
      
      // Remove participant from all meetings
      const meetings = await Meeting.find({ 'participants.socketId': socket.id });
      for (const meeting of meetings) {
        await meeting.removeParticipant(socket.id);
        // If host left, clear host to allow re-assignment
        await meeting.clearHostIf(socket.id);

        // If everyone left, end meeting and send summary emails
        if ((meeting.participantCount || 0) === 0 && meeting.status !== 'completed') {
          await meeting.endMeeting();
          try {
            await sendMeetingSummary(meeting);
          } catch (e) {
            console.warn('Follow-up email failed:', e?.message || e);
          }
        }
      }

      // Inform peers in the room
      const roomId = socket.data.currentMeetingId;
      if (roomId) {
        socket.to(roomId).emit('user-left', { id: socket.id, name: socket.data.userName || 'User' });
      }
    } catch (error) {
      console.error('Error handling disconnect:', error);
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  const proto = process.env.HTTPS === 'true' ? 'https' : 'http';
  console.log(`🚀 Server is running on ${proto}://localhost:${PORT}`);
}); 