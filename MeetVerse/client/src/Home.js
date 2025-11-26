import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";

import ScheduleMeeting from "./ScheduleMeeting";
import ScheduledMeetings from "./ScheduledMeetings";

function Home() {
  const [meetingLink, setMeetingLink] = useState("");
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [hostEmail, setHostEmail] = useState("");

  // Reminder WebSocket stored in a ref, not state (prevents ESLint warnings)
  const reminderWS = useRef(null);

  const navigate = useNavigate();

  // ==========================================================
  // REMINDER WEBSOCKET — triggers when user enters email
  // ==========================================================
  useEffect(() => {
    if (!hostEmail) return;

    const emailEncoded = encodeURIComponent(hostEmail);
    const roomId = `reminder-${emailEncoded}`;
    const username = emailEncoded;

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const wsURL = `${protocol}://127.0.0.1:5000/ws/${roomId}/${username}`;

    const ws = new WebSocket(wsURL);
    reminderWS.current = ws;

    ws.onopen = () => {
      console.log("🔔 Reminder WebSocket connected:", wsURL);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === "meeting-reminder") {
          if (Notification.permission === "granted") {
            new Notification("Meeting Reminder", {
              body: `${msg.title} is starting soon!`,
              tag: msg.meetingId || "meeting",
            });
          }

          // Fallback visual alert
          alert(`Meeting Reminder: ${msg.title}`);
        }
      } catch (err) {
        console.warn("WS non-JSON message:", event.data);
      }
    };

    ws.onclose = () => {
      console.log("🔌 Reminder WebSocket closed");
      reminderWS.current = null;
    };

    ws.onerror = (err) => {
      console.error("⚠️ WS Error:", err);
    };

    // Cleanup
    return () => {
      try {
        if (reminderWS.current) reminderWS.current.close();
      } catch (_) {}
      reminderWS.current = null;
    };
  }, [hostEmail]);

  // ==========================================================
  // CREATE MEETING
  // ==========================================================
  const createMeeting = async () => {
    const serverBase =
      process.env.REACT_APP_SERVER_URL ||
      `${window.location.protocol}//127.0.0.1:5000`;

    const res = await fetch(`${serverBase}/create-meet`, {
      method: "POST",
    });

    const data = await res.json();
    if (!data?.link) {
      alert("Server error creating meeting");
      return;
    }

    try {
      const createdURL = new URL(data.link);
      const hashPath = `#${createdURL.pathname}`;
      const full = `${window.location.origin}${window.location.pathname.replace(
        /\/?$/,
        "/"
      )}${hashPath}`;

      setMeetingLink(full);
    } catch {
      setMeetingLink(data.link);
    }
  };

  // ==========================================================
  // HANDLE MEETING SCHEDULED EVENT
  // ==========================================================
  const handleMeetingScheduled = () => {
    alert(
      "Meeting scheduled successfully! You will receive a reminder before the meeting."
    );
  };

  // ==========================================================
  // UI RENDER
  // ==========================================================
  return (
    <div className="container">
      {/* Header */}
      <header className="header card">
        <div className="brand">
          <div className="brand-mark" />
          <span>MeetVerse</span>
        </div>

        <div className="row">
          {(() => {
            try {
              return JSON.parse(localStorage.getItem("mv_user") || "null");
            } catch {
              return null;
            }
          })() ? (
            <>
              <span className="subtle">
                Hello,{" "}
                {(() => {
                  try {
                    return (
                      JSON.parse(localStorage.getItem("mv_user") || "null")
                        ?.username || "User"
                    );
                  } catch {
                    return "User";
                  }
                })()}
              </span>

              <button
                className="button secondary"
                onClick={() => {
                  localStorage.removeItem("mv_user");
                  window.location.reload();
                }}
              >
                Logout
              </button>
            </>
          ) : (
            <Link className="button secondary" to="/auth">
              Login / Signup
            </Link>
          )}
        </div>
      </header>

      {/* Main Body */}
      <main className="stack" style={{ marginTop: 32 }}>
        {/* HERO BANNER */}
        <section className="card" style={{ padding: 28 }}>
          <h1 className="heading-hero">Connect. Collaborate. Create.</h1>

          <p className="subtle" style={{ maxWidth: 720 }}>
            Crystal-clear video, real-time chat with instant language hints, and
            effortless meeting links.
          </p>

          <div
            style={{
              marginTop: 16,
              padding: "12px 16px",
              background:
                "linear-gradient(135deg, rgba(108, 140, 255, 0.15), rgba(108, 140, 255, 0.05))",
              border: "1px solid rgba(108, 140, 255, 0.3)",
              borderRadius: 12,
              display: "flex",
              gap: 12,
            }}
          >
            <span style={{ fontSize: 26 }}>🤖</span>
            <div>
              <strong style={{ color: "var(--primary)" }}>
                Shadow Mode AI Intern
              </strong>
              <p className="subtle" style={{ marginTop: 4, fontSize: 12 }}>
                AI meeting assistant to summarize, transcribe, and organize
                everything.
              </p>
            </div>
          </div>

          {/* Buttons */}
          <div className="row" style={{ marginTop: 16 }}>
            <button className="button" onClick={createMeeting}>
              Create a meeting
            </button>

            <button
              className="button secondary"
              onClick={() => setShowScheduleModal(true)}
            >
              Schedule a meeting
            </button>

            <a className="button secondary" href="#join">
              Join with a link
            </a>

            <Link className="button secondary" to="/history">
              Meeting History
            </Link>
          </div>
        </section>

        {/* SHOW MEETING LINK */}
        {meetingLink && (
          <section className="card" style={{ padding: 20 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div className="stack" style={{ flex: 1 }}>
                <span className="subtle">Share this link</span>
                <a className="mono" href={meetingLink}>
                  {meetingLink}
                </a>
              </div>

              <div className="row">
                <a className="button" href={meetingLink}>
                  Go to meeting
                </a>
              </div>
            </div>
          </section>
        )}

        {/* SCHEDULED MEETINGS */}
        <section className="card" style={{ padding: 20 }}>
          <h3 style={{ marginTop: 0 }}>View Scheduled Meetings</h3>

          <div className="chat-input" style={{ marginBottom: 16 }}>
            <input
              className="input"
              type="email"
              placeholder="Enter your email"
              value={hostEmail}
              onChange={(e) => setHostEmail(e.target.value)}
            />
            <button
              className="button secondary"
              onClick={() => setHostEmail(hostEmail)}
            >
              Load Meetings
            </button>
          </div>

          {hostEmail && <ScheduledMeetings hostEmail={hostEmail} />}
        </section>

        {/* JOIN A MEETING */}
        <section id="join" className="card" style={{ padding: 20 }}>
          <h3 style={{ marginTop: 0 }}>Join a Meeting</h3>

          <div className="chat-input">
            <input
              className="input"
              type="url"
              placeholder="Paste meeting link"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const val = e.target.value.trim();
                  if (!val) return;

                  try {
                    const u = new URL(val);
                    const match = u.pathname.match(/\/meet\/(.+)$/);
                    if (match) navigate(`/meet/${match[1]}`);
                    return;
                  } catch (_) {}

                  const simple = val.match(/^\/?meet\/(.+)$/);
                  if (simple) navigate(`/meet/${simple[1]}`);
                }
              }}
            />

            <button
              className="button secondary"
              onClick={() => {
                const input = document.querySelector("#join input");
                const val = input?.value.trim();
                if (!val) return;

                try {
                  const u = new URL(val);
                  const match = u.pathname.match(/\/meet\/(.+)$/);
                  if (match) navigate(`/meet/${match[1]}`);
                  return;
                } catch (_) {}

                const simple = val.match(/^\/?meet\/(.+)$/);
                if (simple) navigate(`/meet/${simple[1]}`);
              }}
            >
              Join
            </button>
          </div>
        </section>
      </main>

      {/* MODAL */}
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
