import nodemailer from 'nodemailer';
import Meeting from '../models/Meeting.js';
import User from '../models/User.js';

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  const secure = typeof process.env.SMTP_SECURE === 'string'
    ? (process.env.SMTP_SECURE === 'true')
    : (port === 465);
  return nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
}

const transporter = createTransport();

async function resolveHostEmail(meeting) {
  try {
    const direct = String(meeting?.hostEmail || '').toLowerCase();
    if (direct) return direct;
    // Try map from host socket
    const bySocket = (meeting?.participants || []).find(p => p.socketId && meeting?.hostSocketId && p.socketId === meeting.hostSocketId && p.email);
    if (bySocket && bySocket.email) return String(bySocket.email).toLowerCase();
    // Try participant whose name matches hostName
    const hostName = String(meeting?.hostName || '').trim();
    if (hostName) {
      const byName = (meeting?.participants || []).find(p => (p.name || '').trim().toLowerCase() === hostName.toLowerCase() && p.email);
      if (byName && byName.email) return String(byName.email).toLowerCase();
    }
    // Try resolve via User model using hostName as username or name
    if (hostName) {
      const userByUsername = await User.findOne({ username: hostName.toLowerCase() }).lean();
      if (userByUsername?.email) return String(userByUsername.email).toLowerCase();
      const userByName = await User.findOne({ name: hostName }).lean();
      if (userByName?.email) return String(userByName.email).toLowerCase();
    }
  } catch (_) {}
  return '';
}

async function sendTodoEmail(to, todos) {
  if (!transporter) { console.log('📭 Mailer not configured; skipping email to', to); return; }
  const items = (todos || []).map((t, i) => `<li>${i + 1}. ${t}</li>`).join('');
  const fromAddr = process.env.MAIL_FROM || process.env.SMTP_USER;
  const mailOptions = {
    from: `MeetVerse <${fromAddr}>`,
    to,
    subject: 'Your To-Do List for Today 🗒️',
    html: `
      <div style="font-family: Arial, sans-serif;">
        <h2>Hi there 👋</h2>
        <p>Here’s your to-do list:</p>
        <ul>${items}</ul>
        <p>Stay productive,<br/>Team MeetVerse</p>
      </div>
    `
  };
  await transporter.sendMail(mailOptions);
}

async function getTodosForEmailFromDB(email) {
  const emailLc = String(email || '').toLowerCase();
  // Include meetings where the user is the host OR has assigned todos
  const meetings = await Meeting.find({
    $or: [
      { hostEmail: emailLc },
      { 'todos.assignedToEmail': emailLc }
    ]
  });
  const todos = [];
  for (const m of meetings) {
    const hostEmailResolved = (await resolveHostEmail(m)) || String(m.hostEmail || '').toLowerCase();
    for (const t of (m.todos || [])) {
      const assignedLc = String(t.assignedToEmail || '').toLowerCase();
      // If explicitly assigned to the user, include it; if unassigned, include for host
      const isAssignedToUser = assignedLc && assignedLc === emailLc;
      const isHostUnassigned = !assignedLc && hostEmailResolved === emailLc;
      if (!t.done && (isAssignedToUser || isHostUnassigned)) {
        todos.push(t.text);
      }
    }
  }
  return todos;
}

async function sendTodosForUser(email) {
  const todos = await getTodosForEmailFromDB(email);
  if (!todos.length) return;
  await sendTodoEmail(email, todos);
}

async function sendTodosForAllUsers() {
  const users = await User.find({}, { email: 1 }).lean();
  for (const u of users) {
    try { await sendTodosForUser(u.email); } catch (_) {}
  }
}

function fmtDate(d) {
  try {
    if (!d) return '';
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return '';
    return dt.toLocaleString();
  } catch {
    return '';
  }
}

async function sendMeetingSummary(meeting) {
  if (!meeting) return;
  // Gather recipients: host + participants with emails
  const emails = new Set();
  const hostResolved = await resolveHostEmail(meeting);
  if (hostResolved) emails.add(hostResolved);
  for (const p of (meeting.participants || [])) {
    if (p && p.email) emails.add(String(p.email).toLowerCase());
  }
  if (!emails.size) return;

  // Build optional sections
  const notes = (meeting.description || '').trim();
  const durationMs = meeting.startTime && meeting.endTime ? (new Date(meeting.endTime) - new Date(meeting.startTime)) : null;
  const durationMin = durationMs != null ? Math.max(1, Math.round(durationMs/60000)) : null;
  const docCount = Array.isArray(meeting.documents) ? meeting.documents.length : 0;
  const msgCount = Array.isArray(meeting.chatMessages) ? meeting.chatMessages.length : 0;
  const openTodos = (meeting.todos || []).filter(t => !t.done).map(t => `• ${t.text}`);

  const html = `
    <div style="font-family: Arial, sans-serif;">
      <h2>Meeting summary: ${meeting.title || meeting.meetingId}</h2>
      <p><strong>Status:</strong> ${meeting.status || 'completed'}</p>
      <p><strong>Started:</strong> ${fmtDate(meeting.startTime)}${meeting.endTime?`<br/><strong>Ended:</strong> ${fmtDate(meeting.endTime)}`:''}${durationMin?`<br/><strong>Duration:</strong> ~${durationMin} min`:''}</p>
      ${notes ? `<p><strong>Notes:</strong><br/>${notes}</p>` : ''}
      <p><strong>Documents shared:</strong> ${docCount} | <strong>Messages:</strong> ${msgCount}</p>
      ${openTodos.length ? `<p><strong>Open To‑dos:</strong><br/>${openTodos.join('<br/>')}</p>` : ''}
      <p>Thanks for using MeetVerse.</p>
    </div>
  `;

  const fromAddr = (process.env.MAIL_FROM || process.env.SMTP_USER || '').toLowerCase();
  // Exclude sender address if it appears in recipients
  const recipients = Array.from(emails).filter(e => e && e.toLowerCase() !== fromAddr);
  for (const to of recipients) {
    try {
      await sendWithTransport({
        from: `MeetVerse <${process.env.MAIL_FROM || process.env.SMTP_USER}>`,
        to,
        subject: `Meeting summary: ${meeting.title || meeting.meetingId}`,
        html
      });
    } catch (_) {}
  }
}

async function sendWithTransport(opts) {
  if (!transporter) { console.log('📭 Mailer not configured; skipping email to', opts?.to); return; }
  await transporter.sendMail(opts);
}

async function sendMail(to, subject, text, html) {
  if (!transporter) { console.log('📭 Mailer not configured; skipping email to', to); return; }
  try {
    const info = await transporter.sendMail({
      from: `MeetVerse <${process.env.MAIL_FROM || process.env.SMTP_USER}>`,
      to,
      subject,
      text,
      html
    });
    console.log('✅ Email sent:', info?.messageId || info);
  } catch (error) {
    console.error('❌ Email error:', error);
  }
}

export { sendTodoEmail, sendTodosForUser, sendTodosForAllUsers, sendMeetingSummary, sendMail };
 


