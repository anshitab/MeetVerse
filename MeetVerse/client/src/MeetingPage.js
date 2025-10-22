import React, { useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useParams } from 'react-router-dom';
import WebRTCManager from './WebRTCManager';
import { CONNECTION_STATES } from './webrtc-config';

function MeetingPage() {
  const { meetingId } = useParams();
  const [message, setMessage] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [translatedPreview, setTranslatedPreview] = useState('');
  const previewTimerRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [split, setSplit] = useState(() => {
    try { return Number(localStorage.getItem('mv_split')) || 65; } catch { return 65; }
  }); // percentage for left panel width
  const [notes, setNotes] = useState(() => localStorage.getItem('mv_notes') || '');
  const [docUrl, setDocUrl] = useState('');
  const [docValid, setDocValid] = useState(true);
  const [docError, setDocError] = useState('');
  const [docs, setDocs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('mv_docs') || '[]'); } catch { return []; }
  });
  const [todoInput, setTodoInput] = useState('');
  const [todos, setTodos] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`mv_todos_${meetingId}`) || '[]'); } catch { return []; }
  });
  const [isRecording, setIsRecording] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  // Text-to-Speech disabled per request: translation will only display in chat

  // --- WEBRTC STATES AND REFS ---
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [connectionState, setConnectionState] = useState(CONNECTION_STATES.NEW);
  const [connectionQuality, setConnectionQuality] = useState('unknown');
  const [connectionError, setConnectionError] = useState(null);
  const webrtcManager = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const canvasRef = useRef(null);
  const recorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const rafRef = useRef(null);
  const originalVideoTrackRef = useRef(null);
  const screenStreamRef = useRef(null);
  // Removed TTS speech tracking
  const mediaRecorderRef = useRef(null);

  const revertToCamera = useCallback(async () => {
    try {
      const pc = webrtcManager.current?.peerConnection;
      const camTrack = (originalVideoTrackRef.current) || (localStreamRef.current || localStream)?.getVideoTracks()?.[0] || null;
      if (pc && camTrack) {
        const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender) {
          await sender.replaceTrack(camTrack);
        }
      }
      if (localVideoRef.current) {
        const camStream = localStreamRef.current || localStream;
        if (camStream) {
          localVideoRef.current.srcObject = camStream;
          try { await localVideoRef.current.play(); } catch (_) {}
        }
      }
    } finally {
      if (screenStreamRef.current) {
        try { screenStreamRef.current.getTracks().forEach(t => t.stop()); } catch (_) {}
        screenStreamRef.current = null;
      }
      setIsScreenSharing(false);
    }
  }, [localStream]);
  // --- END WEBRTC STATES AND REFS ---

  // --- Helpers ---
  const isValidHttpUrl = useCallback((value) => {
    try {
      const u = new URL(value);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  }, []);

  const downloadDocument = useCallback(async (doc) => {
    try {
      const serverBase = process.env.REACT_APP_SERVER_URL || `${window.location.protocol}//${window.location.hostname}:5000`;
      const urlObj = new URL(doc.url);
      const pathname = urlObj.pathname || '/document';
      const baseName = pathname.split('/').filter(Boolean).pop() || 'document';
      const proxied = `${serverBase}/proxy-download?url=${encodeURIComponent(doc.url)}&name=${encodeURIComponent(baseName)}`;
      const resp = await fetch(proxied);
      if (!resp.ok) throw new Error('Proxy download failed');
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = baseName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      alert('Download failed. Opening the document in a new tab.');
      window.open(doc.url, '_blank', 'noopener,noreferrer');
    }
  }, []);

  // Main useEffect for Socket.io connection and cleanup
  useEffect(() => {
    console.log('Main App useEffect triggered: Initializing socket.');
    const serverBase = process.env.REACT_APP_SERVER_URL || `${window.location.protocol}//${window.location.hostname}:5000`;
    const newSocket = io(serverBase); // Ensure this matches your backend
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('✅ Connected to server:', newSocket.id);
      if (meetingId) {
        const storedUser = (()=>{ try { return JSON.parse(localStorage.getItem('mv_user')||'null'); } catch { return null; } })();
        const username = (storedUser && storedUser.username) || (storedUser && storedUser.name) || 'Guest';
        newSocket.emit('join-room', meetingId, username);
      }
    });

    newSocket.on('messageResponse', (data) => {
      setChatMessages((prevMessages) => {
        // Reconcile optimistic message by clientKey if present
        if (data.clientKey) {
          const idx = prevMessages.findIndex(m => m.clientKey === data.clientKey);
          if (idx !== -1) {
            const next = prevMessages.slice();
            next[idx] = { ...prevMessages[idx], ...data, pending: false };
            return next;
          }
        }
        return [...prevMessages, data];
      });
      // Increment unread if chat is not open
      if (!isChatOpen) setUnreadChatCount(c => c + 1);
    });

    // --- Room-scoped documents sync ---
    newSocket.on('docs-init', (docsFromServer) => {
      try {
        setDocs(Array.isArray(docsFromServer) ? docsFromServer : []);
      } catch {
        setDocs([]);
      }
    });
    newSocket.on('docs-updated', (docsFromServer) => {
      try {
        setDocs(Array.isArray(docsFromServer) ? docsFromServer : []);
      } catch {
        setDocs([]);
      }
    });

    // Receive live speech translation results
    newSocket.on('stt-result', (payload) => {
      const ts = new Date().toLocaleTimeString();
      setChatMessages(prev => [...prev, {
        id: payload.from,
        text: payload.text,
        translatedTextEn: payload.translatedTextEn,
        timestamp: ts,
        meetingId
      }]);
      if (!isChatOpen) setUnreadChatCount(c => c + 1);
    });

    // WebRTC signaling is now handled by WebRTCManager

    // Cleanup function for socket and media streams
    return () => {
      console.log('App cleanup function running.');
      if (newSocket) {
        newSocket.disconnect();
        console.log('❌ Client disconnected: (on unmount)');
      }
      const ls = localStreamRef.current;
      if (ls) {
        ls.getTracks().forEach(track => track.stop()); // Stop camera/mic
        console.log('Local stream tracks stopped.');
      }
      if (webrtcManager.current) {
        webrtcManager.current.cleanup(); // Cleanup WebRTC connection
        console.log('WebRTC connection cleaned up.');
      }
    };
  }, [meetingId]); // Reconnect if meeting changes


  // Dedicated useEffect to handle setting local video stream to ref
  // This runs whenever localStream state changes.
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      console.log("Dedicated useEffect for localVideoRef: Setting srcObject and playing.");
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(e => console.error("Error playing local video (dedicated useEffect):", e));
      // Sync UI toggles with actual track states
      try {
        const a = localStream.getAudioTracks()[0];
        if (a) setIsMicOn(a.enabled);
      } catch (_) {}
      try {
        const v = localStream.getVideoTracks()[0];
        if (v) setIsCamOn(v.enabled);
      } catch (_) {}
    } else if (localVideoRef.current && !localStream) {
      // If localStream becomes null (e.g., on cleanup/error), clear the video
      console.log("Dedicated useEffect for localVideoRef: Clearing srcObject as localStream is null.");
      localVideoRef.current.srcObject = null;
    }
  }, [localStream]); // Dependency array: only re-run when localStream changes

  // keep ref in sync for cleanup without effect dependency churn
  useEffect(() => { localStreamRef.current = localStream; }, [localStream]);

  // Dedicated useEffect to handle setting remote video stream to ref
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      try {
        remoteVideoRef.current.srcObject = remoteStream;
        const p = remoteVideoRef.current.play();
        if (p && typeof p.catch === 'function') p.catch(e => console.error('Error playing remote video (dedicated useEffect):', e));
      } catch (e) {
        console.error('Error attaching remote stream:', e);
      }
    } else if (remoteVideoRef.current && !remoteStream) {
      remoteVideoRef.current.srcObject = null;
    }
  }, [remoteStream]);

  // TTS removed: no speech side-effects


  // Robust media acquisition with fallbacks for NotReadableError (busy device)
  const getMediaWithFallbacks = useCallback(async () => {
    const defaultConstraints = {
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 }
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    };

    // 1) Try default constraints
    try {
      return await navigator.mediaDevices.getUserMedia(defaultConstraints);
    } catch (e) {
      if (e && e.name !== 'NotReadableError') throw e;
    }

    // 2) Enumerate devices and try specific camera/mic pairs
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices.filter(d => d.kind === 'videoinput');
      const mics = devices.filter(d => d.kind === 'audioinput');
      for (const cam of cams) {
        for (const mic of (mics.length ? mics : [null])) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({
              video: { deviceId: { exact: cam.deviceId } },
              audio: mic ? { deviceId: { exact: mic.deviceId } } : true
            });
            return stream;
          } catch (_) {}
        }
      }
    } catch (_) {}

    // 3) Audio-only fallback
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (_) {}

    // 4) Video-only fallback (pick any camera if possible)
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices.filter(d => d.kind === 'videoinput');
      if (cams.length) {
        return await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: cams[0].deviceId } } });
      }
      // If no cameras listed, try generic video: true
      return await navigator.mediaDevices.getUserMedia({ video: true });
    } catch (e) {
      throw e; // still failing -> likely OS/device lock
    }
  }, []);

  // --- WEBRTC INITIALIZATION useEffect  ---
  const setupWebRTC = useCallback(async () => {
    console.log('setupWebRTC function started.');
    try {
      // Guard: getUserMedia requires a secure context (HTTPS or localhost)
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const reason = window.isSecureContext ? 'Your browser does not expose mediaDevices.' : 'This page is not served over HTTPS or localhost.';
        alert('Could not access camera/microphone: ' + reason + '\n\nOpen the app via HTTPS or localhost, or start Chrome with "unsafely-treat-insecure-origin-as-secure" for your LAN IP.');
        setLocalStream(null);
        return;
      }
      
      console.log('Attempting to get user media (camera/mic)...');
      const stream = await getMediaWithFallbacks();
      console.log('User media stream obtained successfully:', stream);

      setLocalStream(stream);

      // Initialize WebRTC Manager
      webrtcManager.current = new WebRTCManager(socket, meetingId);
      
      // Set up event handlers
      webrtcManager.current.setOnConnectionStateChange((state) => {
        console.log('Connection state changed:', state);
        setConnectionState(state);
      });

      webrtcManager.current.setOnRemoteStream((stream) => {
        console.log('Remote stream received:', stream);
        setRemoteStream(stream);
      });

      webrtcManager.current.setOnError((error) => {
        console.error('WebRTC Error:', error);
        setConnectionError(error.message);
      });

      webrtcManager.current.setOnStats((stats) => {
        setConnectionQuality(stats.quality);
        console.log('Connection stats:', stats);
      });

      // Initialize the connection
      const success = await webrtcManager.current.initialize(stream);
      if (!success) {
        throw new Error('Failed to initialize WebRTC connection');
      }

    } catch (error) {
      console.error('FATAL ERROR: Error accessing media devices or setting up WebRTC:', error);
      alert(`Could not access camera/microphone: ${error.name || error.message}. Please ensure they are not in use and permissions are granted in your browser and OS settings.`);
      setLocalStream(null);
      setConnectionError(error.message);
    }
  }, [socket, meetingId]);

  useEffect(() => {
    if (socket && !webrtcManager.current) {
      console.log('WebRTC setup useEffect: Socket ready and WebRTCManager not yet initialized. Calling setupWebRTC...');
      setupWebRTC();
    } else if (!socket) {
      console.log('WebRTC setup useEffect: Socket not ready yet.');
    } else if (webrtcManager.current) {
      console.log('WebRTC setup useEffect: WebRTCManager already established, skipping setupWebRTC.');
    }
  }, [socket, setupWebRTC]);


  const sendMessage = () => {
    if (socket && message.trim()) {
      const timestamp = new Date().toLocaleTimeString();
      const clientKey = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const messageData = {
        id: socket.id,
        text: message,
        timestamp: timestamp,
        senderLanguage: selectedLanguage,
        meetingId,
        clientKey
      };
  
      // Optimistically render message immediately, mark as pending
      const optimistic = {
        ...messageData,
        pending: true,
        translatedTextEn: undefined
      };
      setChatMessages(prev => [...prev, optimistic]);

      // Emit to server; reconciliation happens when echoed back with same clientKey
      socket.emit('message', messageData);

      // Clear input
      setMessage('');
      setTranslatedPreview('');
    }
  };
  const endMeeting = () => {
    if (socket) {
        socket.disconnect();
      }
    
      // Stop local media tracks
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    
      // Cleanup WebRTC connection
      if (webrtcManager.current) {
        webrtcManager.current.cleanup();
      }
    
      // Redirect to home
      window.location.href = '/';
  
    alert("Meeting has ended!");
  };
  
  const getDisplayMessage = (msg) => {
    // Updated to use the corrected mocked translation keys from server/index.js
    if (selectedLanguage === 'en') {
      return msg.translatedTextEn || msg.text;
    } else if (selectedLanguage === 'hi') {
      return msg.translatedTextHi || msg.text;
    }
    return msg.text;
  };

  // --- Sidebar local persistence ---
  useEffect(() => { localStorage.setItem('mv_notes', notes); }, [notes]);
  useEffect(() => { localStorage.setItem('mv_docs', JSON.stringify(docs)); }, [docs]);
  useEffect(() => { localStorage.setItem(`mv_todos_${meetingId}`, JSON.stringify(todos)); }, [todos, meetingId]);
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(`mv_todos_${meetingId}`) || '[]');
      setTodos(stored);
    } catch {
      setTodos([]);
    }
  }, [meetingId]);
  useEffect(() => { localStorage.setItem('mv_split', String(split)); }, [split]);

  return (
    <div className="container" style={{ paddingTop: 12 }}>
      <header className="header card">
        <div className="brand">
          <div className="brand-mark" />
          <span>MeetVerse</span>
        </div>
        <div className="row">
          <span className="subtle mono">Room: {meetingId}</span>
          <div className="row" style={{ gap: '8px', alignItems: 'center' }}>
            <div className={`connection-status ${connectionState}`} style={{
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '0.8em',
              fontWeight: 'bold',
              backgroundColor: 
                connectionState === CONNECTION_STATES.CONNECTED ? '#28c76f' :
                connectionState === CONNECTION_STATES.CONNECTING ? '#ffb020' :
                connectionState === CONNECTION_STATES.FAILED ? '#ff4d6d' : '#6c8cff',
              color: 'white'
            }}>
              {connectionState === CONNECTION_STATES.CONNECTED ? '🟢 Connected' :
               connectionState === CONNECTION_STATES.CONNECTING ? '🟡 Connecting' :
               connectionState === CONNECTION_STATES.FAILED ? '🔴 Failed' : '⚪ Connecting'}
            </div>
            {connectionQuality !== 'unknown' && (
              <span className="subtle" style={{ fontSize: '0.8em' }}>
                Quality: {connectionQuality}
              </span>
            )}
          </div>
          <button className="button" onClick={() => { setIsChatOpen(true); setUnreadChatCount(0); }}>
            Chat {unreadChatCount > 0 ? `(${unreadChatCount})` : ''}
          </button>
          <button className="button secondary" onClick={() => setIsSidebarOpen(s => !s)}>
            {isSidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'}
          </button>
          <button className="button danger" onClick={endMeeting}>End</button>
        </div>
      </header>

      <div className="split" style={{ marginTop: 16 }}>
        <section className="card" style={{ padding: 12, width: `${split}%` }}>
          <div className="meet-tile" style={{ width: '100%' }}>
            {localStream ? (
              <video ref={localVideoRef} autoPlay playsInline muted onLoadedMetadata={() => {
                try { if (localVideoRef.current) localVideoRef.current.play(); } catch(e) { console.error('Local video play error:', e); }
              }} />
            ) : (
              <div className="center" style={{ height: '100%' }}><span className="subtle">You</span></div>
            )}
            <span className="meet-name">You</span>
          </div>
          <div className="filmstrip" style={{ marginTop: 12 }}>
            <div className="thumb">
              {remoteStream ? (
                <video ref={remoteVideoRef} autoPlay playsInline onLoadedMetadata={() => {
                  try { if (remoteVideoRef.current) remoteVideoRef.current.play(); } catch(e) { console.error('Remote video play error:', e); }
                }} />
              ) : <div className="center" style={{ height: '100%' }}><span className="subtle">Remote</span></div>}
              <span className="thumb-name">Remote</span>
            </div>
            <div className="thumb" />
          </div>
          <canvas ref={canvasRef} width={1280} height={720} style={{ display: 'none' }} />
        </section>

        {isSidebarOpen && (
          <div
            className="resizer-v"
            onMouseDown={(e) => {
              const startX = e.clientX;
              const start = split;
              const onMove = (ev) => {
                const dx = ev.clientX - startX;
                const container = document.querySelector('.container');
                if (!container) return;
                const width = container.getBoundingClientRect().width;
                const next = Math.min(85, Math.max(40, start + (dx / width) * 100));
                setSplit(next);
              };
              const onUp = () => {
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
              };
              window.addEventListener('mousemove', onMove);
              window.addEventListener('mouseup', onUp);
            }}
          />
        )}

        {isSidebarOpen && (
          <aside className="card stack" style={{ padding: 16, width: `${100 - split}%` }}>
            <div className="stack">
              <h3 style={{ margin: 0 }}>Documents</h3>
              <div className="chat-input">
                <input className="input" type="url" placeholder="Paste document link" value={docUrl} onChange={(e)=>{
                  const v = e.target.value;
                  setDocUrl(v);
                  const ok = isValidHttpUrl(v.trim());
                  setDocValid(!v || ok);
                  setDocError(v && !ok ? 'Enter a valid http(s) URL' : '');
                }} />
                <button className="button" onClick={() => {
                  const v = docUrl.trim();
                  const ok = isValidHttpUrl(v);
                  if (!v || !ok) { setDocValid(false); setDocError('Enter a valid http(s) URL'); return; }
                  const newDoc = { id: Date.now(), url: v };
                  setDocs(prev=>[...prev, newDoc]);
                  if (socket && meetingId) {
                    socket.emit('doc-add', { meetingId, doc: newDoc });
                  }
                  setDocUrl('');
                  setDocValid(true);
                  setDocError('');
                }}>Add</button>
              </div>
              {!docValid && docError && (<span className="subtle" style={{ color: '#ff4d6d' }}>{docError}</span>)}
              <div className="doc-list">
                {docs.map(d => (
                  <div key={d.id} className="doc-card">
                    <div className="doc-left">
                      <span className="doc-favicon" />
                      <a className="mono doc-url" title={d.url} href={d.url} target="_blank" rel="noreferrer">{d.url}</a>
                    </div>
                    <div className="row" style={{ gap: 8 }}>
                      <button className="button" onClick={() => downloadDocument(d)}>Download</button>
                      <button className="button secondary" onClick={() => {
                        setDocs(prev => prev.filter(x => x.id !== d.id));
                        if (socket && meetingId) {
                          socket.emit('doc-remove', { meetingId, id: d.id });
                        }
                      }}>Remove</button>
                    </div>
                  </div>
                ))}
                {!docs.length && (<span className="subtle">No documents yet.</span>)}
              </div>
            </div>
            <div className="stack">
              <h3 style={{ margin: 0 }}>To‑do</h3>
              <div className="chat-input">
                <input className="input" value={todoInput} onChange={(e) => setTodoInput(e.target.value)} placeholder="Add a reminder" />
                <button className="button" onClick={() => {
                  const v = todoInput.trim(); if (!v) return;
                  const palette = ['#6c8cff','#28c76f','#ffb020','#ff4d6d','#a78bfa'];
                  const color = palette[Math.floor(Math.random()*palette.length)];
                  setTodos(prev => [...prev, { id: Date.now(), text: v, done: false, color }]); setTodoInput('');
                }}>Add</button>
              </div>
              <div className="reminder-list">
                {todos.map(t => (
                  <div key={t.id} className="reminder-card" style={{ borderColor: t.color, background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(0,0,0,0.1))' }}>
                    <div className="reminder-left">
                      <span className="dot" style={{ background: t.color }} />
                      <input type="checkbox" checked={t.done} onChange={() => setTodos(prev => prev.map(x => x.id===t.id?{...x, done:!x.done}:x))} />
                      <span style={{ textDecoration: t.done ? 'line-through' : 'none' }}>{t.text}</span>
                    </div>
                    <div className="row">
                      <div className="picker">
                        {['#6c8cff','#28c76f','#ffb020','#ff4d6d','#a78bfa'].map(c => (
                          <span key={c} className="swatch" style={{ background: c }} onClick={() => setTodos(prev => prev.map(x => x.id===t.id?{...x, color:c}:x))} />
                        ))}
                      </div>
                      <button className="button secondary" onClick={() => setTodos(prev => prev.filter(x => x.id!==t.id))}>Remove</button>
                    </div>
                  </div>
                ))}
                {!todos.length && (<span className="subtle">No reminders yet.</span>)}
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Removed Display Language section per request */}

      <div className="controls" style={{ marginTop: 12 }}>
        <button className={`control-btn ${isMicOn ? 'active' : ''}`} disabled={!localStream && !localStreamRef.current} onClick={() => {
          const ls = localStreamRef.current || localStream;
          if (!ls) return;
          const next = !isMicOn;
          ls.getAudioTracks().forEach(t => { t.enabled = next; });
          setIsMicOn(next);
        }} aria-label={isMicOn ? 'Mute microphone' : 'Unmute microphone'}>{isMicOn ? '🎤' : '🔇'}</button>
        <button className={`control-btn ${isCamOn ? 'active' : ''}`} disabled={!localStream && !localStreamRef.current} onClick={() => {
          const ls = localStreamRef.current || localStream;
          if (!ls) return;
          const next = !isCamOn;
          ls.getVideoTracks().forEach(t => { t.enabled = next; });
          setIsCamOn(next);
        }} aria-label={isCamOn ? 'Turn camera off' : 'Turn camera on'}>{isCamOn ? '🎥' : '📷'}</button>
        {/* TTS toggle removed */}
        <button className={`control-btn ${isScreenSharing ? 'active' : ''}`} onClick={async () => {
          try {
            if (!isScreenSharing) {
              // Start screen share
              const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
              const screenTrack = screenStream.getVideoTracks()[0];
              screenStreamRef.current = screenStream;
              // Find current video sender
              const pc = webrtcManager.current?.peerConnection;
              if (pc) {
                const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
                const currentVideoTrack = (localStreamRef.current || localStream)?.getVideoTracks()[0] || null;
                originalVideoTrackRef.current = currentVideoTrack;
                if (sender && screenTrack) {
                  await sender.replaceTrack(screenTrack);
                }
              }
              // Show screen locally
              if (localVideoRef.current) {
                localVideoRef.current.srcObject = screenStream;
                localVideoRef.current.play().catch(()=>{});
              }
              // When screen share stops, revert automatically
              screenTrack.onended = async () => { await revertToCamera(); };
              setIsScreenSharing(true);
            } else {
              // Stop share manually and revert
              await revertToCamera();
            }
          } catch (e) {
            console.error('Screen share error:', e);
            setIsScreenSharing(false);
          }
        }} aria-label={isScreenSharing ? 'Stop sharing screen' : 'Share screen'}>{isScreenSharing ? '🖥️' : '🖥️'}</button>
        <button className="control-btn" onClick={async () => {
          if (!socket) return;
          if (!mediaRecorderRef.current) {
            try {
              const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
              const mr = new MediaRecorder(mic, { mimeType: 'audio/webm' });
              socket.emit('stt-start', { meetingId, sourceLang: 'auto' });
              mr.ondataavailable = async (e) => {
                if (!e.data || e.data.size === 0) return;
                const buf = await e.data.arrayBuffer();
                const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
                socket.emit('stt-chunk', { chunkBase64: b64 });
              };
              mr.onstop = () => {
                socket.emit('stt-stop');
              };
              mr.start(500); // send chunk every 500ms
              mediaRecorderRef.current = mr;
            } catch (e) {
              console.error('Live translate mic error:', e);
            }
          } else {
            try { mediaRecorderRef.current.stop(); } catch {}
            mediaRecorderRef.current = null;
          }
        }} aria-label="Toggle live speech translation">🌐</button>
        <button className="control-btn" onClick={async () => {
          if (isRecording) {
            setIsRecording(false);
            if (recorderRef.current) recorderRef.current.stop();
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
          } else {
            // Compose videos into canvas and record with audio mix from local/remote
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            const draw = () => {
              ctx.fillStyle = '#000';
              ctx.fillRect(0,0,canvas.width,canvas.height);
              const v1 = localVideoRef.current; const v2 = remoteVideoRef.current;
              const w = canvas.width; const h = canvas.height;
              const halfW = w / 2;
              if (v1) ctx.drawImage(v1, 0, 0, halfW, h);
              if (v2) ctx.drawImage(v2, halfW, 0, halfW, h);
              rafRef.current = requestAnimationFrame(draw);
            };
            draw();

            const canvasStream = canvas.captureStream(30);
            // Mix audio: take from localStream + remoteStream if available
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const dest = audioCtx.createMediaStreamDestination();
            if (localStream) {
              const src1 = audioCtx.createMediaStreamSource(localStream);
              src1.connect(dest);
            }
            if (remoteStream) {
              const src2 = audioCtx.createMediaStreamSource(remoteStream);
              src2.connect(dest);
            }
            dest.stream.getAudioTracks().forEach(t => canvasStream.addTrack(t));

            recordedChunksRef.current = [];
            let options;
            try {
              if (window.MediaRecorder && MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
                options = { mimeType: 'video/webm;codecs=vp9,opus' };
              } else if (window.MediaRecorder && MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
                options = { mimeType: 'video/webm;codecs=vp8,opus' };
              } else if (window.MediaRecorder && MediaRecorder.isTypeSupported('video/webm')) {
                options = { mimeType: 'video/webm' };
              } else {
                options = undefined; // Let browser pick
              }
            } catch (e) {
              options = undefined;
            }
            const rec = new MediaRecorder(canvasStream, options);
            rec.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
            rec.onstop = () => {
              const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
              const url = URL.createObjectURL(blob);
              setDownloadUrl(url);
              cancelAnimationFrame(rafRef.current);
            };
            rec.start();
            recorderRef.current = rec;
            setIsRecording(true);
          }
        }}>{isRecording ? '⏺ Stop' : '⏺ Record'}</button>
        <button className="control-btn" onClick={() => {
          if (!downloadUrl) { alert('No recording ready to download yet. Start and stop a recording first.'); return; }
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = `meetverse-recording-${Date.now()}.webm`;
          document.body.appendChild(a);
          a.click();
          a.remove();
        }} aria-label="Download meeting recording">⬇️</button>
        <button className="control-btn danger" onClick={endMeeting}>⏹</button>
      </div>
      {downloadUrl && (
        <div className="center" style={{ marginTop: 8 }}>
          <a className="button" href={downloadUrl} download={`meetverse-recording-${Date.now()}.webm`}>Download recording</a>
        </div>
      )}
  
  {/* Chat Popup Overlay */}
  {isChatOpen && (
    <div
      className="chat-overlay"
      style={{
        position: 'fixed',
        right: 16,
        top: 72,
        width: 360,
        maxWidth: '90vw',
        height: '70vh',
        maxHeight: '80vh',
        background: 'rgba(20,20,20,0.98)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        boxShadow: '0 8px 28px rgba(0,0,0,0.45)',
        backdropFilter: 'blur(6px)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column'
      }}
      role="dialog"
      aria-label="Chat"
    >
      <div className="row" style={{ padding: 12, borderBottom: '1px solid rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <span style={{ fontWeight: 600 }}>Chat</span>
          <span className="subtle" style={{ fontSize: '0.85em' }}>{chatMessages.length} messages</span>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="button secondary" onClick={() => { setIsChatOpen(false); setUnreadChatCount(0); }}>Close</button>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {chatMessages.map((msg, index) => (
          <div key={index} style={{ margin: '8px 0', fontSize: '0.95em' }}>
            <div>
              <strong>{msg.id ? msg.id.substring(0, 5) : 'User'} ({msg.timestamp}):</strong>{' '}
              <span>{msg.text}</span>
            </div>
            {msg.translatedTextEn && (
              <div className="subtle" style={{ fontSize: '0.88em', marginTop: 2 }}>
                [EN]: {msg.translatedTextEn}
              </div>
            )}
          </div>
        ))}
        {!chatMessages.length && (<span className="subtle">No messages yet.</span>)}
      </div>
      <div className="row" style={{ padding: 12, borderTop: '1px solid rgba(255,255,255,0.06)', gap: 8 }}>
        <input
          className="input"
          type="text"
          value={message}
          onChange={(e) => {
            const v = e.target.value;
            setMessage(v);
            try { if (previewTimerRef.current) clearTimeout(previewTimerRef.current); } catch(_) {}
            if (!v.trim()) { setTranslatedPreview(''); return; }
            previewTimerRef.current = setTimeout(async () => {
              try {
                const serverBase = process.env.REACT_APP_SERVER_URL || `${window.location.protocol}//${window.location.hostname}:5000`;
                const resp = await fetch(`${serverBase}/translate`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ text: v })
                });
                if (resp.ok) {
                  const data = await resp.json();
                  setTranslatedPreview(String(data.translatedTextEn || ''));
                }
              } catch(_) {}
            }, 350);
          }}
          onKeyDown={(e) => { if (e.key === 'Enter') sendMessage(); }}
          placeholder="Type your message…"
          style={{ flex: 1 }}
        />
        <button className="button" onClick={sendMessage}>Send</button>
      </div>
      {translatedPreview && (
        <div className="subtle" style={{ fontSize: '0.88em', padding: '0 12px 12px 12px' }}>
          [EN preview]: {translatedPreview}
        </div>
      )}
    </div>
  )}
      
      {/* Connection Error Display */}
      {connectionError && (
        <div className="card" style={{ 
          marginTop: 16, 
          padding: 16, 
          backgroundColor: '#ff4d6d', 
          color: 'white',
          borderRadius: '8px'
        }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong>Connection Error:</strong> {connectionError}
            </div>
            <button 
              className="button" 
              style={{ backgroundColor: 'white', color: '#ff4d6d' }}
              onClick={() => {
                setConnectionError(null);
                if (webrtcManager.current) {
                  webrtcManager.current.reconnect();
                }
              }}
            >
              Retry
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default MeetingPage;