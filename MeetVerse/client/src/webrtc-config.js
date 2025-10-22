// WebRTC Configuration for better remote connections
export const WEBRTC_CONFIG = {
  iceServers: [
    // Google STUN servers
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    
    // Additional STUN servers for better connectivity
    { urls: 'stun:stun.ekiga.net' },
    { urls: 'stun:stun.ideasip.com' },
    { urls: 'stun:stun.schlund.de' },
    { urls: 'stun:stun.stunprotocol.org:3478' },
    { urls: 'stun:stun.voiparound.com' },
    { urls: 'stun:stun.voipbuster.com' },
    { urls: 'stun:stun.voipstunt.com' },
    { urls: 'stun:stun.counterpath.com' },
    { urls: 'stun:stun.1und1.de' },
    { urls: 'stun:stun.gmx.net' },
    
    // Free TURN servers (for NAT traversal)
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    
    // Additional free TURN servers
    {
      urls: 'turn:relay1.expressturn.com:3478',
      username: 'efJBc8V4Z8Y7b3Qj',
      credential: 'YVnNq3rQj8JBc9V4'
    },
    {
      urls: 'turn:relay2.expressturn.com:3478',
      username: 'efJBc8V4Z8Y7b3Qj',
      credential: 'YVnNq3rQj8JBc9V4'
    }
  ],
  
  // ICE gathering policy for better connectivity
  iceCandidatePoolSize: 10,
  
  // Bundle policy for better performance
  bundlePolicy: 'max-bundle',
  
  // RTCP mux policy
  rtcpMuxPolicy: 'require',
  
  // ICE transport policy
  iceTransportPolicy: 'all'
};

// Connection states
export const CONNECTION_STATES = {
  NEW: 'new',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  FAILED: 'failed',
  CLOSED: 'closed'
};

// ICE gathering states
export const ICE_GATHERING_STATES = {
  NEW: 'new',
  GATHERING: 'gathering',
  COMPLETE: 'complete'
};

// ICE connection states
export const ICE_CONNECTION_STATES = {
  NEW: 'new',
  CHECKING: 'checking',
  CONNECTED: 'connected',
  COMPLETED: 'completed',
  FAILED: 'failed',
  DISCONNECTED: 'disconnected',
  CLOSED: 'closed'
};

// Signaling states
export const SIGNALING_STATES = {
  STABLE: 'stable',
  HAVE_LOCAL_OFFER: 'have-local-offer',
  HAVE_REMOTE_OFFER: 'have-remote-offer',
  HAVE_LOCAL_PRANSWER: 'have-local-pranswer',
  HAVE_REMOTE_PRANSWER: 'have-remote-pranswer',
  CLOSED: 'closed'
};

// Helper function to get connection quality
export const getConnectionQuality = (stats) => {
  if (!stats) return 'unknown';
  
  const rtt = stats.rtt || 0;
  const packetLoss = stats.packetLoss || 0;
  
  if (rtt < 100 && packetLoss < 0.01) return 'excellent';
  if (rtt < 200 && packetLoss < 0.03) return 'good';
  if (rtt < 500 && packetLoss < 0.05) return 'fair';
  return 'poor';
};

// Helper function to check if we're in a restrictive network
export const isRestrictiveNetwork = (iceGatheringState, iceConnectionState) => {
  return iceGatheringState === ICE_GATHERING_STATES.COMPLETE && 
         iceConnectionState === ICE_CONNECTION_STATES.CHECKING;
};

// Helper function to get network type
export const getNetworkType = () => {
  if ('connection' in navigator) {
    const connection = navigator.connection;
    return {
      effectiveType: connection.effectiveType,
      downlink: connection.downlink,
      rtt: connection.rtt,
      saveData: connection.saveData
    };
  }
  return null;
};

// Retry configuration
export const RETRY_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000,
  backoffMultiplier: 2
};

// Timeout configuration
export const TIMEOUT_CONFIG = {
  offerAnswerTimeout: 10000, // 10 seconds
  iceGatheringTimeout: 15000, // 15 seconds
  connectionTimeout: 30000, // 30 seconds
  reconnectionTimeout: 5000 // 5 seconds
};
