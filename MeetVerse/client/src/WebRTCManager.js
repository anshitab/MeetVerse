import { 
  WEBRTC_CONFIG, 
  CONNECTION_STATES, 
  ICE_GATHERING_STATES, 
  ICE_CONNECTION_STATES,
  SIGNALING_STATES,
  getConnectionQuality,
  RETRY_CONFIG,
  TIMEOUT_CONFIG
} from './webrtc-config';

class WebRTCManager {
  constructor(socket, meetingId, options = {}) {
    this.socket = socket;
    this.meetingId = meetingId;
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.connectionState = CONNECTION_STATES.NEW;
    this.retryCount = 0;
    this.connectionTimeout = null;
    this.iceGatheringTimeout = null;
    this.reconnectTimeout = null;
    this.statsInterval = null;
    this.isOfferer = !!options.isOfferer; // only one side should create offers
    this.makingOffer = false; // polite peer glare handling
    
    // Pending signaling (arrived before PC ready)
    this.pendingOffer = null;
    this.pendingAnswer = null;
    this.pendingIceCandidates = [];
    
    // Event callbacks
    this.onConnectionStateChange = null;
    this.onRemoteStream = null;
    this.onError = null;
    this.onStats = null;
    
    this.setupSocketListeners();
  }

  setupSocketListeners() {
    this.socket.on('offer', this.handleOffer.bind(this));
    this.socket.on('answer', this.handleAnswer.bind(this));
    this.socket.on('ice-candidate', this.handleIceCandidate.bind(this));
    this.socket.on('user-joined', this.handleUserJoined.bind(this));
    this.socket.on('user-left', this.handleUserLeft.bind(this));
  }

  async initialize(localStream) {
    try {
      this.localStream = localStream;
      this.connectionState = CONNECTION_STATES.CONNECTING;
      this.emitConnectionStateChange();

      // Create peer connection with enhanced configuration
      this.peerConnection = new RTCPeerConnection(WEBRTC_CONFIG);
      this.setupPeerConnectionListeners();

      // Add local tracks
      localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, localStream);
        console.log(`Added ${track.kind} track to peer connection`);
      });

      // Start ICE gathering
      this.startIceGathering();
      
      // Apply any pending remote description (offer/answer) and ICE candidates
      await this.flushPendingSignaling();
      
      return true;
    } catch (error) {
      console.error('Failed to initialize WebRTC:', error);
      this.handleError(error);
      return false;
    }
  }

  async flushPendingSignaling() {
    try {
      if (!this.peerConnection) return;
      // If we received an offer before init, answer it now
      if (this.pendingOffer) {
        const offer = this.pendingOffer; this.pendingOffer = null;
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
        this.socket.emit('answer', { meetingId: this.meetingId, answer });
      }
      // If we received an answer before init (rare), apply it
      if (this.pendingAnswer) {
        const answer = this.pendingAnswer; this.pendingAnswer = null;
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        await this.drainPendingIceCandidates();
      }
      // Add any buffered ICE candidates
      if (this.pendingIceCandidates.length) {
        await this.drainPendingIceCandidates();
      }
    } catch (e) {
      console.error('Error flushing pending signaling:', e);
      this.handleError(e);
    }
  }

  async drainPendingIceCandidates() {
    try {
      if (!this.peerConnection || !this.peerConnection.remoteDescription) return;
      if (!this.pendingIceCandidates.length) return;
      const toApply = this.pendingIceCandidates.slice();
      this.pendingIceCandidates = [];
      for (const c of toApply) {
        try { await this.peerConnection.addIceCandidate(new RTCIceCandidate(c)); }
        catch (e) { console.debug('Ignoring ICE candidate apply error:', e?.message || e); }
      }
    } catch (_) {}
  }

  setupPeerConnectionListeners() {
    // Handle remote tracks
    this.peerConnection.ontrack = (event) => {
      console.log('Remote track received:', event.streams[0]);
      this.remoteStream = event.streams[0];
      if (this.onRemoteStream) {
        this.onRemoteStream(this.remoteStream);
      }
    };

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Sending ICE candidate:', event.candidate);
        this.socket.emit('ice-candidate', { 
          meetingId: this.meetingId, 
          candidate: event.candidate 
        });
      } else {
        console.log('ICE gathering complete');
        this.clearIceGatheringTimeout();
      }
    };

    // Handle ICE connection state changes
    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection.iceConnectionState;
      console.log('ICE connection state changed:', state);
      
      if (state === ICE_CONNECTION_STATES.CONNECTED || 
          state === ICE_CONNECTION_STATES.COMPLETED) {
        this.connectionState = CONNECTION_STATES.CONNECTED;
        this.emitConnectionStateChange();
        this.startStatsCollection();
      } else if (state === ICE_CONNECTION_STATES.FAILED) {
        this.handleConnectionFailure();
      } else if (state === ICE_CONNECTION_STATES.DISCONNECTED) {
        this.connectionState = CONNECTION_STATES.DISCONNECTED;
        this.emitConnectionStateChange();
        this.scheduleReconnection();
      }
    };

    // Handle ICE gathering state changes
    this.peerConnection.onicegatheringstatechange = () => {
      const state = this.peerConnection.iceGatheringState;
      console.log('ICE gathering state changed:', state);
      
      if (state === ICE_GATHERING_STATES.COMPLETE) {
        this.clearIceGatheringTimeout();
      }
    };

    // Handle signaling state changes
    this.peerConnection.onsignalingstatechange = () => {
      const state = this.peerConnection.signalingState;
      console.log('Signaling state changed:', state);
      
      if (state === SIGNALING_STATES.STABLE) {
        console.log('Signaling is stable');
      }
    };

    // Handle negotiation needed
    this.peerConnection.onnegotiationneeded = async () => {
      try {
        if (!this.isOfferer) {
          return; // only designated side creates offers
        }
        this.makingOffer = true;
        console.log('Negotiation needed, creating offer...');
        await this.createOffer();
      } catch (e) {
        console.error('onnegotiationneeded error:', e);
      } finally {
        this.makingOffer = false;
      }
    };
  }

  async createOffer() {
    try {
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
        voiceActivityDetection: true
      });
      
      await this.peerConnection.setLocalDescription(offer);
      console.log('Sending offer:', offer);
      
      this.socket.emit('offer', { 
        meetingId: this.meetingId, 
        offer: offer 
      });
      
      // Set timeout for offer/answer exchange
      this.setOfferAnswerTimeout();
      
    } catch (error) {
      console.error('Error creating offer:', error);
      this.handleError(error);
    }
  }

  async handleOffer(offer) {
    try {
      console.log('Received offer:', offer);
      
      if (!this.peerConnection) {
        console.debug('Peer connection not ready, buffering offer');
        this.pendingOffer = offer;
        return;
      }

      const offerDesc = new RTCSessionDescription(offer);
      const isStable = this.peerConnection.signalingState === 'stable';
      // Polite peer glare handling
      if (!isStable || this.makingOffer) {
        // If we're not offerer, roll back and accept remote
        if (this.isOfferer) {
          console.warn('Glare detected (offerer). Ignoring remote offer.');
          return; // ignore as impolite peer
        } else {
          try { await this.peerConnection.setLocalDescription({ type: 'rollback' }); } catch (_) {}
        }
      }

      await this.peerConnection.setRemoteDescription(offerDesc);
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      
      console.log('Sending answer:', answer);
      this.socket.emit('answer', { 
        meetingId: this.meetingId, 
        answer: answer 
      });
      await this.drainPendingIceCandidates();
      
    } catch (error) {
      console.error('Error handling offer:', error);
      this.handleError(error);
    }
  }

  async handleAnswer(answer) {
    try {
      console.log('Received answer:', answer);
      
      if (!this.peerConnection) {
        console.debug('Peer connection not ready, buffering answer');
        this.pendingAnswer = answer;
        return;
      }

      if (this.peerConnection.signalingState !== 'have-local-offer') {
        console.warn('Unexpected answer in state', this.peerConnection.signalingState);
        return;
      }
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      this.clearOfferAnswerTimeout();
      await this.drainPendingIceCandidates();
      
    } catch (error) {
      console.error('Error handling answer:', error);
      this.handleError(error);
    }
  }

  async handleIceCandidate(candidate) {
    try {
      console.log('Received ICE candidate:', candidate);
      
      if (!this.peerConnection || !this.peerConnection.remoteDescription) {
        console.debug('Peer not ready or no remoteDescription yet, buffering ICE');
        this.pendingIceCandidates.push(candidate);
        return;
      }

      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
      // Don't treat ICE candidate errors as fatal
    }
  }

  handleUserJoined(user) {
    console.log('User joined:', user);
    // Connection will be established through offer/answer exchange
  }

  handleUserLeft(user) {
    console.log('User left:', user);
    this.cleanup();
  }

  startIceGathering() {
    // Set timeout for ICE gathering
    this.iceGatheringTimeout = setTimeout(() => {
      console.warn('ICE gathering timeout');
      this.handleConnectionFailure();
    }, TIMEOUT_CONFIG.iceGatheringTimeout);
  }

  clearIceGatheringTimeout() {
    if (this.iceGatheringTimeout) {
      clearTimeout(this.iceGatheringTimeout);
      this.iceGatheringTimeout = null;
    }
  }

  setOfferAnswerTimeout() {
    this.offerAnswerTimeout = setTimeout(() => {
      console.warn('Offer/Answer exchange timeout');
      this.handleConnectionFailure();
    }, TIMEOUT_CONFIG.offerAnswerTimeout);
  }

  clearOfferAnswerTimeout() {
    if (this.offerAnswerTimeout) {
      clearTimeout(this.offerAnswerTimeout);
      this.offerAnswerTimeout = null;
    }
  }

  handleConnectionFailure() {
    console.log('Connection failed, attempting to reconnect...');
    this.connectionState = CONNECTION_STATES.FAILED;
    this.emitConnectionStateChange();

    // Strategy: try ICE restart first, then rebuild PC, and finally relay-only fallback
    const attempt = this.retryCount + 1;
    const delay = RETRY_CONFIG.retryDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, this.retryCount);
    const max = RETRY_CONFIG.maxRetries;

    console.log(`Recovery plan: attempt ${attempt}/${max}`);

    this.reconnectTimeout = setTimeout(async () => {
      try {
        if (this.peerConnection && attempt <= max - 1) {
          // Try ICE restart on existing connection for the first retries
          console.log('Trying ICE restart...');
          const ok = await this.performIceRestart();
          if (ok) {
            this.retryCount++;
            return;
          }
        }

        // Rebuild peer connection (same config)
        console.log('Rebuilding RTCPeerConnection...');
        await this.reconnect();
        this.retryCount++;

        // If this is the last attempt, try relay-only fallback by creating a fresh PC
        if (this.retryCount >= max) {
          console.warn('Falling back to TURN-only (relay) transport');
          await this.reconnectWithRelayOnly();
          this.retryCount++;
        }
      } catch (e) {
        console.error('Recovery step failed:', e);
        this.retryCount++;
        if (this.retryCount >= max) {
          console.error('Max retry attempts reached, connection failed');
          this.handleError(new Error('Connection failed after maximum retries'));
        } else {
          this.handleConnectionFailure();
        }
      }
    }, delay);
  }

  scheduleReconnection() {
    if (this.reconnectTimeout) return;
    
    this.reconnectTimeout = setTimeout(() => {
      this.reconnect();
    }, TIMEOUT_CONFIG.reconnectionTimeout);
  }

  async reconnect() {
    try {
      console.log('Attempting to reconnect...');
      
      if (this.peerConnection) {
        this.peerConnection.close();
      }
      
      this.peerConnection = new RTCPeerConnection(WEBRTC_CONFIG);
      this.setupPeerConnectionListeners();
      
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => {
          this.peerConnection.addTrack(track, this.localStream);
        });
      }
      
      this.startIceGathering();
      await this.flushPendingSignaling();
      
    } catch (error) {
      console.error('Reconnection failed:', error);
      this.handleError(error);
    }
  }

  async performIceRestart() {
    try {
      if (!this.peerConnection) return false;
      const offer = await this.peerConnection.createOffer({ iceRestart: true });
      await this.peerConnection.setLocalDescription(offer);
      this.socket.emit('offer', { meetingId: this.meetingId, offer });

      // Wait briefly to allow new ICE to gather
      await new Promise(res => setTimeout(res, 1000));
      return true;
    } catch (e) {
      console.error('ICE restart failed:', e);
      return false;
    }
  }

  async reconnectWithRelayOnly() {
    try {
      if (this.peerConnection) {
        this.peerConnection.close();
      }

      const relayConfig = {
        ...WEBRTC_CONFIG,
        iceTransportPolicy: 'relay' // force TURN-only
      };

      this.peerConnection = new RTCPeerConnection(relayConfig);
      this.setupPeerConnectionListeners();

      if (this.localStream) {
        this.localStream.getTracks().forEach(track => {
          this.peerConnection.addTrack(track, this.localStream);
        });
      }

      this.startIceGathering();
      await this.createOffer();
      return true;
    } catch (e) {
      console.error('Relay-only reconnect failed:', e);
      this.handleError(e);
      return false;
    }
  }

  startStatsCollection() {
    if (this.statsInterval) return;
    
    this.statsInterval = setInterval(async () => {
      try {
        if (this.peerConnection && this.connectionState === CONNECTION_STATES.CONNECTED) {
          const stats = await this.peerConnection.getStats();
          const connectionStats = this.parseConnectionStats(stats);
          
          if (this.onStats) {
            this.onStats(connectionStats);
          }
        }
      } catch (error) {
        console.error('Error collecting stats:', error);
      }
    }, 5000); // Collect stats every 5 seconds
  }

  parseConnectionStats(stats) {
    const connectionStats = {
      rtt: 0,
      packetLoss: 0,
      bytesReceived: 0,
      bytesSent: 0,
      packetsReceived: 0,
      packetsSent: 0,
      quality: 'unknown'
    };

    stats.forEach(report => {
      if (report.type === 'candidate-pair' && report.state === 'succeeded') {
        connectionStats.rtt = report.currentRoundTripTime * 1000; // Convert to ms
      } else if (report.type === 'inbound-rtp') {
        connectionStats.bytesReceived = report.bytesReceived || 0;
        connectionStats.packetsReceived = report.packetsReceived || 0;
        connectionStats.packetLoss = report.packetsLost / (report.packetsReceived + report.packetsLost) || 0;
      } else if (report.type === 'outbound-rtp') {
        connectionStats.bytesSent = report.bytesSent || 0;
        connectionStats.packetsSent = report.packetsSent || 0;
      }
    });

    connectionStats.quality = getConnectionQuality(connectionStats);
    return connectionStats;
  }

  emitConnectionStateChange() {
    if (this.onConnectionStateChange) {
      this.onConnectionStateChange(this.connectionState);
    }
  }

  handleError(error) {
    console.error('WebRTC Error:', error);
    if (this.onError) {
      this.onError(error);
    }
  }

  cleanup() {
    console.log('Cleaning up WebRTC connection...');
    
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
    
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
    
    if (this.iceGatheringTimeout) {
      clearTimeout(this.iceGatheringTimeout);
      this.iceGatheringTimeout = null;
    }
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.offerAnswerTimeout) {
      clearTimeout(this.offerAnswerTimeout);
      this.offerAnswerTimeout = null;
    }
    
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    
    this.connectionState = CONNECTION_STATES.CLOSED;
    this.emitConnectionStateChange();
  }

  // Public methods
  getConnectionState() {
    return this.connectionState;
  }

  getRemoteStream() {
    return this.remoteStream;
  }

  isConnected() {
    return this.connectionState === CONNECTION_STATES.CONNECTED;
  }

  // Event setters
  setOnConnectionStateChange(callback) {
    this.onConnectionStateChange = callback;
  }

  setOnRemoteStream(callback) {
    this.onRemoteStream = callback;
  }

  setOnError(callback) {
    this.onError = callback;
  }

  setOnStats(callback) {
    this.onStats = callback;
  }
}

export default WebRTCManager;
