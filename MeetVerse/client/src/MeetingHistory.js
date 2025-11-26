import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';


function MeetingHistory() {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [expandedMeeting, setExpandedMeeting] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    try {
      const storedUser = JSON.parse(localStorage.getItem('mv_user') || 'null');
      const email = storedUser?.email || '';
      setUserEmail(email);
      if (email) {
        fetchMeetingHistory(email);
      } else {
        setError('Please login to view meeting history');
        setLoading(false);
      }
    } catch (e) {
      setError('Failed to load user data');
      setLoading(false);
    }
  }, []);

  const fetchMeetingHistory = async (email) => {
    try {
      setLoading(true);
      setError('');
      const serverBase = process.env.REACT_APP_SERVER_URL || 'http://127.0.0.1:5000';
      
      // First check if server is reachable
      try {
        const healthCheck = await fetch(`${serverBase}/health`, { 
          method: 'GET',
          signal: AbortSignal.timeout(5000)
        });
        if (!healthCheck.ok) {
          throw new Error('Server health check failed');
        }
      } catch (healthErr) {
        setError('Server is not reachable. Please make sure the server is running on port 5000.');
        setLoading(false);
        return;
      }
      
      // Fetch meeting history
      const res = await fetch(`${serverBase}/api/meetings/history?email=${encodeURIComponent(email)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(10000)
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Server returned ${res.status}`);
      }
      
      const data = await res.json();
      setMeetings(data);
      setError('');
    } catch (err) {
      console.error('Error fetching meeting history:', err);
      if (err.name === 'AbortError' || err.name === 'TypeError') {
        setError('Cannot connect to server. Please ensure the server is running on port 5000.');
      } else {
        setError(err.message || 'Failed to load meeting history');
      }
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  const formatDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return 'N/A';
    try {
      const start = new Date(startTime);
      const end = new Date(endTime);
      const diffMs = end - start;
      const minutes = Math.floor(diffMs / 60000);
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      if (hours > 0) return `${hours}h ${mins}m`;
      return `${mins}m`;
    } catch {
      return 'N/A';
    }
  };

  const formatShortDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'N/A';
    }
  };

  const toggleExpanded = (meetingId) => {
    setExpandedMeeting(expandedMeeting === meetingId ? null : meetingId);
  };

  return (
    <div className="container">
      <header className="header card">
        <div className="brand">
          <div className="brand-mark" />
          <span>MeetVerse</span>
        </div>
        <div className="row">
          <Link className="button secondary" to="/">← Back to Home</Link>
          {(() => { try { return JSON.parse(localStorage.getItem('mv_user')||'null'); } catch { return null; } })() ? (
            <button className="button secondary" onClick={() => { localStorage.removeItem('mv_user'); window.location.reload(); }}>Logout</button>
          ) : (
            <Link className="button secondary" to="/auth">Login / Signup</Link>
          )}
        </div>
      </header>

      <main className="stack" style={{ marginTop: 32 }}>
        <section className="card" style={{ padding: 28 }}>
          <h1 className="heading-hero">Meeting History</h1>
          <p className="subtle">
            View all your past meetings, participants, documents, and chat messages.
          </p>
        </section>

        {loading && (
          <section className="card" style={{ padding: 20 }}>
            <p className="subtle">Loading meeting history...</p>
          </section>
        )}

        {error && (
          <section className="card" style={{ padding: 20, backgroundColor: '#ff4d6d20', border: '1px solid #ff4d6d' }}>
            <p style={{ color: '#ff4d6d' }}>{error}</p>
          </section>
        )}

        {!loading && !error && meetings.length === 0 && (
          <section className="card" style={{ padding: 20 }}>
            <p className="subtle">No meeting history found.</p>
          </section>
        )}

        {!loading && !error && meetings.length > 0 && (
          <section className="card" style={{ padding: 0, overflowX: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Meeting History ({meetings.length})</h2>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
              <thead>
                <tr style={{ 
                  background: 'linear-gradient(180deg, rgba(108, 140, 255, 0.15), rgba(108, 140, 255, 0.08))',
                  borderBottom: '2px solid rgba(108, 140, 255, 0.3)'
                }}>
                  <th style={{ padding: '16px 12px', textAlign: 'left', fontWeight: 700, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--primary)' }}>Title</th>
                  <th style={{ padding: '16px 12px', textAlign: 'left', fontWeight: 700, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--primary)' }}>Status</th>
                  <th style={{ padding: '16px 12px', textAlign: 'left', fontWeight: 700, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--primary)' }}>Host</th>
                  <th style={{ padding: '16px 12px', textAlign: 'left', fontWeight: 700, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--primary)' }}>Start Time</th>
                  <th style={{ padding: '16px 12px', textAlign: 'left', fontWeight: 700, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--primary)' }}>Duration</th>
                  <th style={{ padding: '16px 12px', textAlign: 'center', fontWeight: 700, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--primary)' }}>Participants</th>
                  <th style={{ padding: '16px 12px', textAlign: 'center', fontWeight: 700, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--primary)' }}>Docs</th>
                  <th style={{ padding: '16px 12px', textAlign: 'center', fontWeight: 700, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--primary)' }}>Messages</th>
                  <th style={{ padding: '16px 12px', textAlign: 'center', fontWeight: 700, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--primary)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {meetings.map((meeting, idx) => (
                  <React.Fragment key={meeting._id || meeting.meetingId}>
                    <tr 
                      style={{ 
                        borderBottom: '1px solid rgba(255,255,255,0.08)',
                        cursor: 'pointer',
                        backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(108, 140, 255, 0.08)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)'}
                      onClick={() => toggleExpanded(meeting.meetingId)}
                    >
                      <td style={{ padding: '16px 12px' }}>
                        <div>
                          <strong style={{ fontSize: '15px', display: 'block', marginBottom: '4px' }}>{meeting.title || 'Untitled Meeting'}</strong>
                          {meeting.description && (
                            <div className="subtle" style={{ fontSize: '0.85em', lineHeight: '1.4' }}>
                              {meeting.description.length > 60 ? meeting.description.substring(0, 60) + '...' : meeting.description}
                            </div>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '16px 12px' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: 600,
                          backgroundColor: meeting.status === 'completed' ? 'rgba(40, 199, 111, 0.15)' :
                                         meeting.status === 'cancelled' ? 'rgba(255, 77, 109, 0.15)' :
                                         meeting.status === 'active' ? 'rgba(108, 140, 255, 0.15)' : 'rgba(255, 176, 32, 0.15)',
                          color: meeting.status === 'completed' ? '#28c76f' :
                                 meeting.status === 'cancelled' ? '#ff4d6d' :
                                 meeting.status === 'active' ? '#6c8cff' : '#ffb020'
                        }}>
                          {meeting.status === 'completed' ? '✅ Completed' : 
                           meeting.status === 'cancelled' ? '❌ Cancelled' : 
                           meeting.status === 'active' ? '🟢 Active' : '📅 Scheduled'}
                        </span>
                      </td>
                      <td style={{ padding: '16px 12px', fontSize: '14px' }}>{meeting.hostName || meeting.hostEmail || 'N/A'}</td>
                      <td style={{ padding: '16px 12px', fontSize: '0.9em', color: 'var(--text-dim)' }}>
                        {meeting.startTime ? formatShortDate(meeting.startTime) : formatShortDate(meeting.scheduledTime)}
                      </td>
                      <td style={{ padding: '16px 12px', fontSize: '14px', fontWeight: 500 }}>
                        {meeting.startTime && meeting.endTime 
                          ? formatDuration(meeting.startTime, meeting.endTime)
                          : 'N/A'}
                      </td>
                      <td style={{ padding: '16px 12px', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          backgroundColor: 'rgba(108, 140, 255, 0.1)',
                          fontSize: '13px',
                          fontWeight: 600
                        }}>
                          {meeting.participantCount || meeting.participants?.length || 0}
                        </span>
                      </td>
                      <td style={{ padding: '16px 12px', textAlign: 'center', fontSize: '14px', fontWeight: 500 }}>
                        {meeting.documents?.length || 0}
                      </td>
                      <td style={{ padding: '16px 12px', textAlign: 'center', fontSize: '14px', fontWeight: 500 }}>
                        {meeting.chatMessages?.length || 0}
                      </td>
                      <td style={{ padding: '16px 12px', textAlign: 'center' }}>
                        <button 
                          className="button secondary" 
                          style={{ 
                            fontSize: '0.85em', 
                            padding: '6px 12px',
                            transition: 'all 0.2s ease'
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpanded(meeting.meetingId);
                          }}
                        >
                          {expandedMeeting === meeting.meetingId ? '▼ Hide' : '▶ Details'}
                        </button>
                      </td>
                    </tr>
                    {expandedMeeting === meeting.meetingId && (
                      <tr>
                        <td colSpan="9" style={{ 
                          padding: '24px', 
                          background: 'linear-gradient(180deg, rgba(0,0,0,0.3), rgba(17, 22, 42, 0.4))',
                          borderTop: '1px solid rgba(108, 140, 255, 0.2)',
                          borderBottom: '1px solid rgba(255,255,255,0.08)'
                        }}>
                          <div className="stack" style={{ gap: 20 }}>
                            <div>
                              <strong>Meeting ID:</strong> <span className="mono">{meeting.meetingId}</span>
                            </div>
                            
                            {meeting.participants && meeting.participants.length > 0 && (
                              <div>
                                <strong>Participants ({meeting.participants.length}):</strong>
                                <div className="row" style={{ flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                                  {meeting.participants.map((p, idx) => (
                                    <span key={idx} className="subtle" style={{ 
                                      padding: '4px 8px', 
                                      backgroundColor: 'rgba(108, 140, 255, 0.1)', 
                                      borderRadius: 4,
                                      fontSize: '0.9em'
                                    }}>
                                      {p.name || p.email || 'Participant'}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {meeting.documents && meeting.documents.length > 0 && (
                              <div>
                                <strong>Documents ({meeting.documents.length}):</strong>
                                <div className="stack" style={{ gap: 8, marginTop: 8 }}>
                                  {meeting.documents.map((doc, idx) => (
                                    <a 
                                      key={idx} 
                                      href={doc.url} 
                                      target="_blank" 
                                      rel="noreferrer"
                                      className="mono"
                                      style={{ 
                                        fontSize: '0.9em',
                                        color: '#6c8cff',
                                        textDecoration: 'underline',
                                        display: 'block'
                                      }}
                                    >
                                      {doc.url}
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}

                            {meeting.chatMessages && meeting.chatMessages.length > 0 && (
                              <div>
                                <strong>Chat Messages ({meeting.chatMessages.length}):</strong>
                                <div className="stack" style={{ gap: 8, marginTop: 8, maxHeight: '200px', overflowY: 'auto', padding: 12, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 8 }}>
                                  {meeting.chatMessages.map((msg, idx) => (
                                    <div key={idx} style={{ fontSize: '0.9em' }}>
                                      <strong>{msg.username || msg.name || (msg.id?.substring(0, 8) || 'User')}</strong> ({msg.timestamp || 'N/A'}): {msg.text}
                                      {msg.translatedTextEn && (
                                        <div className="subtle" style={{ fontSize: '0.85em', marginTop: 2 }}>
                                          [EN]: {msg.translatedTextEn}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {meeting.todos && meeting.todos.length > 0 && (
                              <div>
                                <strong>To-Dos ({meeting.todos.filter(t => !t.done).length} open, {meeting.todos.filter(t => t.done).length} done):</strong>
                                <div className="stack" style={{ gap: 8, marginTop: 8 }}>
                                  {meeting.todos.map((todo, idx) => (
                                    <div key={idx} style={{ 
                                      padding: 8, 
                                      backgroundColor: todo.done ? 'rgba(40, 199, 111, 0.1)' : 'rgba(108, 140, 255, 0.1)',
                                      borderRadius: 4,
                                      borderLeft: `3px solid ${todo.color || '#6c8cff'}`
                                    }}>
                                      <div className="row" style={{ alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: '0.9em' }}>{todo.done ? '✅' : '⭕'}</span>
                                        <span style={{ textDecoration: todo.done ? 'line-through' : 'none' }}>{todo.text}</span>
                                        {todo.assignedToEmail && (
                                          <span className="subtle" style={{ fontSize: '0.85em' }}>({todo.assignedToEmail})</span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="row" style={{ gap: 8 }}>
                              <button 
                                className="button"
                                style={{ fontSize: '0.9em' }}
                                onClick={() => {
                                  navigate(`/meet/${meeting.meetingId}`);
                                }}
                              >
                                Join Meeting
                              </button>
                              <a 
                                href={meeting.meetingLink} 
                                className="button secondary"
                                style={{ fontSize: '0.9em' }}
                                target="_blank"
                                rel="noreferrer"
                              >
                                View Meeting Link
                              </a>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </main>
    </div>
  );
}

export default MeetingHistory;

