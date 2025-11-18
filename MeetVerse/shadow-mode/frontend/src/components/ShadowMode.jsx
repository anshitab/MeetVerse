import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function ShadowMode({ meetingId, userId }) {
  const [enabled, setEnabled] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [command, setCommand] = useState('');
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (enabled && meetingId) {
      // Use WebSocket directly (FastAPI WebSocket, not Socket.IO)
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
            setTasks(prev => prev.map(t => 
              t.id === data.data.task_id ? { ...t, ...data.data } : t
            ));
          }
        } catch (e) {
          console.error('Error parsing WebSocket message:', e);
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
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
  }, [enabled, meetingId]);

  const loadTasks = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/tasks/meeting/${meetingId}`);
      setTasks(res.data);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    }
  };

  const submitCommand = async (e) => {
    e.preventDefault();
    if (!command.trim()) return;

    try {
      const res = await axios.post(`${API_BASE}/api/tasks/`, {
        meeting_id: meetingId,
        user_id: userId,
        command: command
      });
      setTasks(prev => [res.data, ...prev]);
      setCommand('');
    } catch (err) {
      console.error('Failed to submit command:', err);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      right: 20,
      width: 400,
      maxHeight: '80vh',
      background: 'linear-gradient(180deg, #11162a, #171d34)',
      border: '1px solid rgba(108, 140, 255, 0.3)',
      borderRadius: 16,
      boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{
        padding: 16,
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
          🤖 Shadow Mode
        </h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            style={{ width: 18, height: 18 }}
          />
          <span style={{ fontSize: 14 }}>Enable</span>
        </label>
      </div>

      {enabled && (
        <>
          <div style={{
            padding: 16,
            flex: 1,
            overflowY: 'auto',
            maxHeight: '400px'
          }}>
            <div style={{ marginBottom: 16 }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 600 }}>
                AI Commands
              </h4>
              <form onSubmit={submitCommand}>
                <input
                  type="text"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder="Ask AI to summarize, create proposal, etc..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    color: '#e7ecff',
                    fontSize: 14,
                    outline: 'none'
                  }}
                />
                <button
                  type="submit"
                  style={{
                    width: '100%',
                    marginTop: 8,
                    padding: '10px',
                    background: '#6c8cff',
                    border: 'none',
                    borderRadius: 8,
                    color: 'white',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Send Command
                </button>
              </form>
            </div>

            <div>
              <h4 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 600 }}>
                Tasks ({tasks.length})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tasks.map(task => (
                  <div
                    key={task.id}
                    style={{
                      padding: 12,
                      background: 'rgba(0,0,0,0.2)',
                      borderRadius: 8,
                      border: '1px solid rgba(255,255,255,0.1)'
                    }}
                  >
                    <div style={{ fontSize: 12, color: '#b4bdd6', marginBottom: 4 }}>
                      {task.command}
                    </div>
                    <div style={{
                      fontSize: 11,
                      padding: '4px 8px',
                      borderRadius: 4,
                      display: 'inline-block',
                      background: task.status === 'completed' ? 'rgba(40, 199, 111, 0.2)' :
                                 task.status === 'processing' ? 'rgba(255, 176, 32, 0.2)' :
                                 task.status === 'failed' ? 'rgba(255, 77, 109, 0.2)' :
                                 'rgba(108, 140, 255, 0.2)',
                      color: task.status === 'completed' ? '#28c76f' :
                            task.status === 'processing' ? '#ffb020' :
                            task.status === 'failed' ? '#ff4d6d' : '#6c8cff'
                    }}>
                      {task.status}
                    </div>
                    {task.result && (
                      <div style={{ marginTop: 8, fontSize: 13, color: '#e7ecff' }}>
                        {task.result}
                      </div>
                    )}
                    {task.documents && task.documents.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        {task.documents.map(doc => (
                          <a
                            key={doc.id}
                            href={`${API_BASE}${doc.path}`}
                            download
                            style={{
                              display: 'block',
                              fontSize: 12,
                              color: '#6c8cff',
                              textDecoration: 'none',
                              marginTop: 4
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
            </div>
          </div>
        </>
      )}
    </div>
  );
}

