import mongoose from 'mongoose';

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
  hostSocketId: {
    type: String,
    default: '',
    index: true
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
    email: {
      type: String,
      default: '',
      lowercase: true,
      trim: true
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
  todos: [{
    id: {
      type: String,
      required: true
    },
    text: {
      type: String,
      required: true,
      trim: true
    },
    done: {
      type: Boolean,
      default: false
    },
    color: {
      type: String,
      default: '#6c8cff'
    },
    assignedToEmail: {
      type: String,
      default: ''
    },
    createdBy: {
      type: String,
      default: ''
    },
    createdAt: {
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

// Virtual for meeting duration
meetingSchema.virtual('duration').get(function() {
  if (this.startTime && this.endTime) {
    return this.endTime - this.startTime;
  }
  return null;
});

// Method to add participant
meetingSchema.methods.addParticipant = function(socketId, name, email) {
  const existingParticipant = this.participants.find(p => p.socketId === socketId);
  if (!existingParticipant) {
    this.participants.push({
      socketId,
      email: (email || '').toLowerCase(),
      name,
      joinedAt: new Date()
    });
    this.participantCount = this.participants.filter(p => !p.leftAt).length;
  }
  return this.save();
};

// Ensure only one host per meeting
meetingSchema.methods.assignHostIfNone = function(socketId, name) {
  if (!this.hostSocketId) {
    this.hostSocketId = socketId;
    if (!this.hostName || this.hostName === 'Guest') this.hostName = name || this.hostName;
  }
  return this.save();
};

meetingSchema.methods.clearHostIf = function(socketId) {
  if (this.hostSocketId && this.hostSocketId === socketId) {
    this.hostSocketId = '';
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

// --- TODOS ---
meetingSchema.methods.addTodo = function(todo) {
  const exists = this.todos.find(t => t.id === todo.id);
  if (!exists) {
    this.todos.push({
      id: todo.id,
      text: todo.text,
      done: !!todo.done,
      color: todo.color || '#6c8cff',
      assignedToEmail: todo.assignedToEmail || '',
      createdBy: todo.createdBy || '',
      createdAt: new Date()
    });
  }
  return this.save();
};

meetingSchema.methods.toggleTodo = function(id) {
  const t = this.todos.find(x => x.id === id);
  if (t) {
    t.done = !t.done;
  }
  return this.save();
};

meetingSchema.methods.removeTodo = function(id) {
  this.todos = this.todos.filter(x => x.id !== id);
  return this.save();
};

const Meeting = mongoose.model('Meeting', meetingSchema);

// --- Helpers ---
// Create a scheduled meeting document with normalized fields
meetingSchema.statics.createScheduled = async function(payload) {
  const MeetingModel = this;
  const meetingId = String(payload.meetingId || new mongoose.Types.ObjectId().toHexString().slice(0, 8));
  const title = String(payload.title || 'Scheduled Meeting').trim();
  const description = String(payload.description || '').trim();
  const hostEmail = String(payload.hostEmail || '').toLowerCase();
  const hostName = String(payload.hostName || 'Host').trim();
  const scheduledTime = new Date(payload.scheduledTime || Date.now());
  const meetingLink = String(payload.meetingLink || `${payload.baseUrl || 'http://localhost:3000'}/meet/${meetingId}`);

  const doc = await MeetingModel.create({
    meetingId,
    title,
    description,
    meetingLink,
    hostEmail,
    hostName,
    scheduledTime,
    status: 'scheduled'
  });
  return doc;
};

// Add a document URL to the meeting with a generated id if not provided
meetingSchema.methods.addDocumentUrl = function(url, addedBy, id) {
  const docId = id || new mongoose.Types.ObjectId().toHexString();
  return this.addDocument(docId, String(url), String(addedBy || 'system'));
};

// Update an existing todo's text and done state
meetingSchema.methods.updateTodo = function(id, updates) {
  const t = this.todos.find(x => x.id === id);
  if (t) {
    if (typeof updates.text === 'string') t.text = updates.text;
    if (typeof updates.done === 'boolean') t.done = updates.done;
    if (typeof updates.color === 'string') t.color = updates.color;
    if (typeof updates.assignedToEmail === 'string') t.assignedToEmail = updates.assignedToEmail;
  }
  return this.save();
};

export default Meeting;
