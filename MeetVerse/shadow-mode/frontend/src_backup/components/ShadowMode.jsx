import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_SHADOW_API_URL || "http://localhost:8001";

console.log("Shadow API BASE:", API_BASE);


export default function ShadowMode({ meetingId, userId }) {
  const [enabled, setEnabled] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [command, setCommand] = useState('');
  const socketRef = useRef(null);

  // ---------------------------------------------------------
  // CONNECT WEBSOCKET WHEN SHADOW MODE IS ENABLED
  // ---------------------------------------------------------
  useEffect(() => {
    if (!enabled || !meetingId) return;

    const wsUrl = API_BASE.startsWith("https")
      ? API_BASE.replace("https", "wss")
      : API_BASE.replace("http", "ws");

    const ws = new WebSocket(`${wsUrl}/ws/${meetingId}`);
    socketRef.current = ws;

    ws.onopen = () => {
      console.log("Shadow Mode WebSocket connected");
      loadTasks();
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "task_update") {
          const update = message.data;
          setTasks((prev) =>
            prev.map((t) =>
              t.id === update.task_id ? { ...t, ...update } : t
            )
          );
        }
      } catch (err) {
        console.error("WebSocket parse error:", err);
      }
    };

    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
    };

    ws.onclose = () => {
      console.warn("Shadow Mode WebSocket disconnected");
      socketRef.current = null;
    };

    // Cleanup
    return () => {
      if (ws.readyState === WebSocket.OPEN) ws.close();
    };
  }, [enabled, meetingId]);

  // ---------------------------------------------------------
  // LOAD TASKS FROM BACKEND
  // ---------------------------------------------------------
  const loadTasks = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/tasks/meeting/${meetingId}`);
      setTasks(res.data);
    } catch (err) {
      console.error("Failed to load tasks:", err);
    }
  };

  // ---------------------------------------------------------
  // SUBMIT NEW AI COMMAND
  // ---------------------------------------------------------
  const submitCommand = async (e) => {
    e.preventDefault();
    if (!command.trim()) return;

    try {
      const res = await axios.post(`${API_BASE}/api/tasks/`, {
        meeting_id: meetingId,
        user_id: userId,
        command: command,
      });

      setTasks((prev) => [res.data, ...prev]);
      setCommand("");
    } catch (err) {
      console.error("Failed to submit command:", err);
    }
  };

  // ---------------------------------------------------------
  // UI BELOW (Fix task.result + docs)
  // ---------------------------------------------------------
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        width: 400,
        maxHeight: "80vh",
        background: "linear-gradient(135deg, #0f1419 0%, #1a1f2e 50%, #0f1419 100%)",
        border: "1px solid rgba(108, 140, 255, 0.4)",
        borderRadius: 20,
        boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* HEADER */}
      <motion.div
        style={{
          padding: 20,
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 800,
            color: "#6c8cff",
          }}
        >
          🤖 Shadow Mode
        </h3>

        <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            style={{ width: 20, height: 20 }}
          />
          <span style={{ color: enabled ? "#6c8cff" : "#b4bdd6" }}>
            {enabled ? "Active" : "Enable"}
          </span>
        </label>
      </motion.div>

      {/* BODY */}
      <AnimatePresence>
        {enabled && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <div style={{ padding: 20, overflowY: "auto", maxHeight: 400 }}>
              {/* COMMAND INPUT */}
              <form onSubmit={submitCommand}>
                <input
                  type="text"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder="Ask AI to summarize or generate docs..."
                  style={{
                    width: "100%",
                    padding: 12,
                    background: "#111827",
                    border: "1px solid #3b82f6",
                    color: "white",
                    borderRadius: 8,
                  }}
                />
                <button
                  type="submit"
                  style={{
                    width: "100%",
                    marginTop: 10,
                    padding: 12,
                    background: "#6c8cff",
                    color: "white",
                    border: "none",
                    borderRadius: 8,
                  }}
                >
                  🚀 Send
                </button>
              </form>

              {/* TASK LIST */}
              <div style={{ marginTop: 20 }}>
                {tasks.map((task) => (
                  <motion.div
                    key={task.id}
                    style={{
                      background: "#1f2937",
                      padding: 12,
                      borderRadius: 10,
                      marginBottom: 12,
                      border: "1px solid #374151",
                    }}
                  >
                    <div style={{ color: "#d1d5db" }}>{task.command}</div>

                    <div
                      style={{
                        marginTop: 8,
                        color:
                          task.status === "completed"
                            ? "#22c55e"
                            : task.status === "failed"
                            ? "#ef4444"
                            : "#f59e0b",
                      }}
                    >
                      {task.status}
                    </div>

                    {/* FIXED RESULT DISPLAY */}
                    {task.result?.content && (
                      <div style={{ color: "white", marginTop: 8 }}>
                        {task.result.content}
                      </div>
                    )}

                    {/* DOCUMENTS */}
                    {task.documents?.length > 0 && (
                      <div style={{ marginTop: 10 }}>
                        {task.documents.map((doc) => (
                          <a
                            key={doc.id}
                            href={`${API_BASE}${doc.path}`}
                            target="_blank"
                            style={{ color: "#60a5fa", display: "block" }}
                          >
                            📄 {doc.filename}
                          </a>
                        ))}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
