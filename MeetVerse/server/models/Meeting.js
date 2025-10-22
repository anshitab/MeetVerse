const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema({
  meetingId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: '',
    trim: true
  },
  meetingLink: {
    type: String,
    required: true
  },
  hostEmail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  hostName: {
    type: String,
    required: true,
    trim: true
  },
  scheduledTime: {
    type: Date,
    required: true,
    index: true
  },
  startTime: {
    type: Date,
    default: null
  },
  endTime: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['scheduled', 'active', 'completed', 'cancelled'],
    default: 'scheduled',
    index: true
  },
  participants: [{
    socketId: {
      type: String,
      required: true
    },
    userId: {
      type: String,
      default: ''
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    leftAt: {
      type: Date,
      default: null
    }
  }],
  participantCount: {
    type: Number,
    default: 0,
    min: 0
  },
  documents: [{
    id: {
      type: String,
      required: true
    },
    url: {
      type: String,
      required: true
    },
    addedBy: {
      type: String,
      required: true
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  chatMessages: [{
    id: {
      type: String,
      required: true
    },
    text: {
      type: String,
      required: true
    },
    translatedTextEn: {
      type: String,
      default: ''
    },
    translatedTextHi: {
      type: String,
      default: ''
    },
    timestamp: {
      type: String,
      required: true
    },
    senderLanguage: {
      type: String,
      default: 'en'
    },
    clientKey: {
      type: String,
      default: ''
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient queries
meetingSchema.index({ hostEmail: 1, scheduledTime: 1 });
meetingSchema.index({ status: 1, scheduledTime: 1 });
meetingSchema.index({ createdAt: 1 });

// Virtual for meeting duration
meetingSchema.virtual('duration').get(function() {
  if (this.startTime && this.endTime) {
    return this.endTime - this.startTime;
  }
  return null;
});

// Method to add participant
meetingSchema.methods.addParticipant = function(socketId, name) {
  const existingParticipant = this.participants.find(p => p.socketId === socketId);
  if (!existingParticipant) {
    this.participants.push({
      socketId,
      name,
      joinedAt: new Date()
    });
    this.participantCount = this.participants.filter(p => !p.leftAt).length;
  }
  return this.save();
};

// Method to remove participant
meetingSchema.methods.removeParticipant = function(socketId) {
  const participant = this.participants.find(p => p.socketId === socketId);
  if (participant) {
    participant.leftAt = new Date();
    this.participantCount = this.participants.filter(p => !p.leftAt).length;
  }
  return this.save();
};

// Method to start meeting
meetingSchema.methods.startMeeting = function() {
  this.status = 'active';
  this.startTime = new Date();
  return this.save();
};

// Method to end meeting
meetingSchema.methods.endMeeting = function() {
  this.status = 'completed';
  this.endTime = new Date();
  return this.save();
};

// Method to add document
meetingSchema.methods.addDocument = function(docId, url, addedBy) {
  const existingDoc = this.documents.find(d => d.id === docId);
  if (!existingDoc) {
    this.documents.push({
      id: docId,
      url,
      addedBy,
      addedAt: new Date()
    });
  }
  return this.save();
};

// Method to remove document
meetingSchema.methods.removeDocument = function(docId) {
  this.documents = this.documents.filter(d => d.id !== docId);
  return this.save();
};

// Method to add chat message
meetingSchema.methods.addChatMessage = function(messageData) {
  this.chatMessages.push({
    ...messageData,
    timestamp: new Date().toLocaleTimeString()
  });
  return this.save();
};

module.exports = mongoose.model('Meeting', meetingSchema);
