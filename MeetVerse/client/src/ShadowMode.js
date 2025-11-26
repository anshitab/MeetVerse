import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_SHADOW_API_URL || 'http://127.0.0.1:8000';

export default function ShadowMode({ meetingId, userId }) {
  const [enabled, setEnabled] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [command, setCommand] = useState('');
  const [socket, setSocket] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [backendAvailable, setBackendAvailable] = useState(null);

  // Check backend availability
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const res = await fetch(`${API_BASE}/health`, { 
          method: 'GET',
          signal: AbortSignal.timeout(3000)
        });
        setBackendAvailable(res.ok);
      } catch (e) {
        setBackendAvailable(false);
      }
    };
    checkBackend();
    const interval = setInterval(checkBackend, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (enabled && meetingId && backendAvailable) {
      const wsUrl = API_BASE.replace('http', 'ws').replace('https', 'wss');
      const ws = new WebSocket(`${wsUrl}/ws/${meetingId}`);
      
      ws.onopen = () => {
        console.log('Shadow Mode WebSocket connected');
        setSocket(ws);
        loadTasks();
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'task_update') {
            setTasks(prev => {
              const existing = prev.find(t => t.id === data.data.task_id);
              if (existing) {
                return prev.map(t => 
                  t.id === data.data.task_id ? { ...t, ...data.data } : t
                );
              } else {
                return [data.data, ...prev];
              }
            });
          }
        } catch (e) {
          console.error('Error parsing WebSocket message:', e);
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setBackendAvailable(false);
      };
      
      ws.onclose = () => {
        console.log('Shadow Mode WebSocket disconnected');
        setSocket(null);
      };
      
      return () => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      };
    }
  }, [enabled, meetingId, backendAvailable]);

  const loadTasks = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/tasks/meeting/${meetingId}`);
      setTasks(res.data || []);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    }
  };

  const submitCommand = async (e) => {
    e.preventDefault();
    if (!command.trim()) return;
    
    if (!backendAvailable) {
      alert('Shadow Mode backend is not available. Please start the backend server first.\n\nSee shadow-mode/QUICK_START.md for instructions.');
      return;
    }

    try {
      const res = await axios.post(`${API_BASE}/api/tasks/`, {
        meeting_id: meetingId,
        user_id: userId || 'guest',
        command: command
      });
      setTasks(prev => [res.data, ...prev]);
      setCommand('');
    } catch (err) {
      console.error('Failed to submit command:', err);
      setBackendAvailable(false);
      alert('Failed to submit command. Make sure Shadow Mode backend is running on port 5000.');
    }
  };

  if (!enabled) {
    return (
      <button
        className="button"
        onClick={() => setEnabled(true)}
        style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          zIndex: 1000,
          boxShadow: '0 8px 24px rgba(108, 140, 255, 0.4)',
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}
      >
        <span>🤖</span>
        <span>Shadow AI</span>
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: isMinimized ? 20 : 20,
      right: 20,
      width: isMinimized ? 'auto' : 420,
      maxHeight: isMinimized ? 'auto' : '75vh',
      background: 'linear-gradient(180deg, var(--surface), var(--elevated))',
      border: '1px solid rgba(108, 140, 255, 0.3)',
      borderRadius: 16,
      boxShadow: '0 10px 40px rgba(0,0,0,0.5), 0 0 20px rgba(108, 140, 255, 0.2)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      transition: 'all 0.3s ease'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'linear-gradient(135deg, rgba(108, 140, 255, 0.2), rgba(108, 140, 255, 0.1))'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 24 }}>🤖</span>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--primary)' }}>
              Shadow AI Intern
            </h3>
            <span className="subtle" style={{ fontSize: 11 }}>
              {backendAvailable === false ? '⚠️ Backend offline' : backendAvailable ? '🟢 Online' : '🟡 Checking...'}
            </span>
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button
            className="button secondary"
            onClick={() => setIsMinimized(!isMinimized)}
            style={{ padding: '6px 12px', fontSize: 12 }}
          >
            {isMinimized ? '▲' : '▼'}
          </button>
          <button
            className="button secondary"
            onClick={() => setEnabled(false)}
            style={{ padding: '6px 12px', fontSize: 12 }}
          >
            ✕
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Command Input */}
          <div style={{
            padding: 16,
            borderBottom: '1px solid rgba(255,255,255,0.1)'
          }}>
            {backendAvailable === false && (
              <div style={{
                padding: 12,
                marginBottom: 12,
                background: 'rgba(255, 77, 109, 0.1)',
                border: '1px solid rgba(255, 77, 109, 0.3)',
                borderRadius: 8,
                fontSize: 12,
                color: '#ff4d6d'
              }}>
                ⚠️ Backend not available. Please start Shadow Mode backend.
                <div style={{ marginTop: 8, fontSize: 11 }}>
                  Run: <code style={{ background: 'rgba(0,0,0,0.2)', padding: '2px 6px', borderRadius: 4 }}>cd shadow-mode && start-simple.bat</code>
                  <div style={{ marginTop: 4, fontSize: 10, opacity: 0.8 }}>
                    Or: <code style={{ background: 'rgba(0,0,0,0.2)', padding: '2px 6px', borderRadius: 4 }}>start.bat</code>
                  </div>
                </div>
              </div>
            )}
            <form onSubmit={submitCommand}>
              <input
                type="text"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="Ask AI: 'Summarize meeting', 'Create proposal', etc..."
                className="input"
                disabled={!backendAvailable}
                style={{
                  width: '100%',
                  marginBottom: 8,
                  fontSize: 13,
                  opacity: backendAvailable ? 1 : 0.5
                }}
              />
              <button
                type="submit"
                className="button"
                disabled={!backendAvailable}
                style={{
                  width: '100%',
                  fontSize: 13,
                  padding: '10px',
                  opacity: backendAvailable ? 1 : 0.5,
                  cursor: backendAvailable ? 'pointer' : 'not-allowed'
                }}
              >
                Send Command
              </button>
            </form>
          </div>

          {/* Tasks List */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: 16,
            minHeight: 200
          }}>
            <div style={{ marginBottom: 12 }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: 13, fontWeight: 600 }}>
                Tasks ({tasks.length})
              </h4>
            </div>
            {tasks.length === 0 ? (
              <div className="subtle" style={{ textAlign: 'center', padding: 20, fontSize: 13 }}>
                No tasks yet. Send a command to get started!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {tasks.map(task => (
                  <div
                    key={task.id}
                    style={{
                      padding: 12,
                      background: 'rgba(0,0,0,0.2)',
                      borderRadius: 10,
                      border: '1px solid rgba(255,255,255,0.1)',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(108, 140, 255, 0.4)'}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
                  >
                    <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 6, lineHeight: 1.4 }}>
                      "{task.command}"
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: task.result ? 8 : 0 }}>
                      <span style={{
                        fontSize: 11,
                        padding: '4px 10px',
                        borderRadius: 12,
                        display: 'inline-block',
                        fontWeight: 600,
                        background: task.status === 'completed' ? 'rgba(40, 199, 111, 0.2)' :
                                   task.status === 'processing' ? 'rgba(255, 176, 32, 0.2)' :
                                   task.status === 'failed' ? 'rgba(255, 77, 109, 0.2)' :
                                   'rgba(108, 140, 255, 0.2)',
                        color: task.status === 'completed' ? '#28c76f' :
                              task.status === 'processing' ? '#ffb020' :
                              task.status === 'failed' ? '#ff4d6d' : '#6c8cff'
                      }}>
                        {task.status === 'processing' && '⏳ '}
                        {task.status === 'completed' && '✅ '}
                        {task.status === 'failed' && '❌ '}
                        {task.status}
                      </span>
                    </div>
                    {task.result && (
                      <div style={{
                        marginTop: 8,
                        fontSize: 12,
                        color: 'var(--text)',
                        lineHeight: 1.5,
                        padding: 8,
                        background: 'rgba(108, 140, 255, 0.05)',
                        borderRadius: 6
                      }}>
                        {task.result}
                      </div>
                    )}
                    {task.error && (
                      <div style={{
                        marginTop: 8,
                        fontSize: 11,
                        color: '#ff4d6d',
                        padding: 8,
                        background: 'rgba(255, 77, 109, 0.1)',
                        borderRadius: 6
                      }}>
                        Error: {task.error}
                      </div>
                    )}
                    {task.documents && task.documents.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        {task.documents.map((doc, idx) => (
                          <a
                            key={idx}
                            href={`${API_BASE}${doc.path}`}
                            download
                            className="button secondary"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              fontSize: 11,
                              padding: '6px 10px',
                              marginRight: 6,
                              marginTop: 4,
                              textDecoration: 'none'
                            }}
                          >
                            📄 {doc.filename}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

