import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import ScheduleMeeting from './ScheduleMeeting';
import ScheduledMeetings from './ScheduledMeetings';

function Home() {
  const [meetingLink, setMeetingLink] = useState('');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [hostEmail, setHostEmail] = useState('');
  const [socket, setSocket] = useState(null);
  const [scheduledMeetings, setScheduledMeetings] = useState([]);
  const navigate = useNavigate();

  // Initialize socket connection for meeting reminders
  useEffect(() => {
    const serverBase = process.env.REACT_APP_SERVER_URL || 'http://127.0.0.1:5000';
    // Force polling and explicitly set path for cross-browser stability
    const newSocket = io(serverBase, {
      transports: ['polling'],
      path: '/socket.io',
      withCredentials: true,
      timeout: 10000,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000
    });
    setSocket(newSocket);

    newSocket.on('meeting-reminder', (reminderData) => {
      try {
        if (Notification.permission === 'granted') {
          new Notification('Meeting Reminder', {
            body: `${reminderData.title} is starting in 5 minutes!`,
            icon: '/favicon.ico',
            tag: reminderData.meetingId
          });
        }
      } catch (_) {}
      // Always show an in-page fallback
      alert(`Meeting Reminder: ${reminderData.title} is starting in 5 minutes!`);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Notification permission is requested only in response to user actions elsewhere

  const createMeeting = async () => {
    const serverBase = process.env.REACT_APP_SERVER_URL || 'http://127.0.0.1:5000';
    const res = await fetch(`${serverBase}/create-meet`, { method: 'POST' });
    const data = await res.json();
    try {
      const createdUrl = new URL(data.link);
      const hashPath = `#${createdUrl.pathname}`;
      const clientOrigin = window.location.origin;
      const clientBasePath = window.location.pathname.replace(/\/?$/, '/');
      const hashedUrl = `${clientOrigin}${clientBasePath}${hashPath}`;
      setMeetingLink(hashedUrl);
    } catch (_) {
      // Fallback: assume path "/meet/:id"
      const pathOnly = (data.link || '').split(window.location.origin)[1] || '/';
      const hashedUrl = `${window.location.origin}${window.location.pathname.replace(/\/?$/, '/') }#${pathOnly}`;
      setMeetingLink(hashedUrl);
    }
  };

  const handleMeetingScheduled = (meeting) => {
    setScheduledMeetings(prev => [...prev, meeting]);
    alert('Meeting scheduled successfully! You will receive a reminder 5 minutes before the meeting starts.');
  };

  return (
    <div className="container">
      <header className="header card">
        <div className="brand">
          <div className="brand-mark" />
          <span>MeetVerse</span>
        </div>
        <div className="row">
          {(() => { try { return JSON.parse(localStorage.getItem('mv_user')||'null'); } catch { return null; } })() ? (
            <>
              <span className="subtle">Hello, {(() => { try { return (JSON.parse(localStorage.getItem('mv_user')||'null')||{}).username; } catch { return ''; } })() || 'User'}</span>
              <button className="button secondary" onClick={() => { localStorage.removeItem('mv_user'); window.location.reload(); }}>Logout</button>
            </>
          ) : (
            <Link className="button secondary" to="/auth">Login / Signup</Link>
          )}
        </div>
      </header>

      <main className="stack" style={{ marginTop: 32 }}>
        <section className="card" style={{ padding: 28 }}>
          <h1 className="heading-hero">Connect. Collaborate. Create.</h1>
          <p className="subtle" style={{ maxWidth: 720 }}>
            Crystal‑clear video, real‑time chat with instant language hints, and effortless meeting links.
          </p>

          <div className="row" style={{ marginTop: 16 }}>
            <button className="button" onClick={createMeeting}>Create a meeting</button>
            <button className="button secondary" onClick={() => setShowScheduleModal(true)}>Schedule a meeting</button>
            <a className="button secondary" href="#join">Join with a link</a>
          </div>
        </section>

        {meetingLink && (
          <section className="card" style={{ padding: 20 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div className="stack" style={{ flex: 1 }}>
                <span className="subtle">Share this link</span>
                <a className="mono" href={meetingLink}>{meetingLink}</a>
              </div>
              <div className="row">
                <a className="button" href={meetingLink}>Go to meeting</a>
              </div>
            </div>
          </section>
        )}

        <section className="card" style={{ padding: 20 }}>
          <h3 style={{ marginTop: 0 }}>View Scheduled Meetings</h3>
          <div className="chat-input" style={{ marginBottom: 16 }}>
            <input
              className="input"
              type="email"
              placeholder="Enter your email to view scheduled meetings"
              value={hostEmail}
              onChange={(e) => setHostEmail(e.target.value)}
            />
            <button
              className="button secondary"
              onClick={() => setHostEmail(hostEmail)}
            >Load Meetings</button>
          </div>
          {hostEmail && <ScheduledMeetings hostEmail={hostEmail} />}
        </section>

        <section id="join" className="card" style={{ padding: 20 }}>
          <h3 style={{ marginTop: 0 }}>Join a Meeting</h3>
          <div className="chat-input">
            <input
              className="input"
              type="url"
              placeholder="Paste meeting link (e.g. http://localhost:3000/meet/abcd)"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const value = String(e.target.value || '').trim();
                  if (!value) return;
                  try {
                    const u = new URL(value);
                    // Support both path-based and hash-based meeting URLs
                    const pathMatch = u.pathname.match(/\/meet\/(.+)$/);
                    if (pathMatch) { navigate(`/meet/${pathMatch[1]}`); return; }
                    const hash = String(u.hash || '');
                    const hashMatch = hash.match(/#\/?meet\/(.+)$/) || hash.match(/#\/?[^#]*#\/?meet\/(.+)$/);
                    if (hashMatch) { navigate(`/meet/${hashMatch[1]}`); return; }
                  } catch (_) {
                    // not a full URL; maybe they pasted just an id
                  }
                  // If they pasted an id or relative path
                  const m2 = value.match(/^\/?meet\/(.+)$/) || value.match(/^([A-Za-z0-9_-]+)$/);
                  const id = m2 ? (m2[1] || m2[0]) : '';
                  if (id) navigate(`/meet/${id}`);
                }
              }}
            />
            <button
              className="button secondary"
              onClick={() => {
                const input = document.querySelector('#join input');
                const value = String(input?.value || '').trim();
                if (!value) return;
                try {
                  const u = new URL(value);
                  const pathMatch = u.pathname.match(/\/meet\/(.+)$/);
                  if (pathMatch) { navigate(`/meet/${pathMatch[1]}`); return; }
                  const hash = String(u.hash || '');
                  const hashMatch = hash.match(/#\/?meet\/(.+)$/) || hash.match(/#\/?[^#]*#\/?meet\/(.+)$/);
                  if (hashMatch) { navigate(`/meet/${hashMatch[1]}`); return; }
                } catch (_) {}
                const m2 = value.match(/^\/?meet\/(.+)$/) || value.match(/^([A-Za-z0-9_-]+)$/);
                const id = m2 ? (m2[1] || m2[0]) : '';
                if (id) navigate(`/meet/${id}`);
              }}
            >Join</button>
          </div>
        </section>
      </main>

      {showScheduleModal && (
        <ScheduleMeeting
          onClose={() => setShowScheduleModal(false)}
          onMeetingScheduled={handleMeetingScheduled}
        />
      )}
    </div>
  );
}

export default Home;
