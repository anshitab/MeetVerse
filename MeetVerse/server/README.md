# MeetVerse Backend

A MongoDB-powered backend for the MeetVerse video conferencing application.

## Features

- **Persistent Meeting Storage**: Store meeting data in MongoDB
- **Real-time Communication**: Socket.io for live chat and video calls
- **Meeting Scheduling**: Schedule meetings with reminders
- **Document Sharing**: Share and sync documents in real-time
- **Live Translation**: Real-time chat translation using LibreTranslate
- **Meeting Analytics**: Track participants, duration, and engagement

## Database Schema

### Meeting Model
- `meetingId`: Unique meeting identifier
- `title`: Meeting title
- `description`: Meeting description
- `meetingLink`: URL to join the meeting
- `hostEmail`: Host's email address
- `hostName`: Host's display name
- `scheduledTime`: When the meeting is scheduled
- `startTime`: When the meeting actually started
- `endTime`: When the meeting ended
- `status`: Meeting status (scheduled, active, completed, cancelled)
- `participants`: Array of participant objects with join/leave times
- `participantCount`: Current number of active participants
- `documents`: Array of shared documents
- `chatMessages`: Array of chat messages with translations
- `createdAt`: When the meeting was created
- `updatedAt`: When the meeting was last updated

## Setup Instructions

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (local or cloud instance)

### Installation

1. **Install Dependencies**
   ```bash
   cd MeetVerse/server
   npm install
   ```

2. **Environment Configuration**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` file with your configuration:
   ```env
   MONGODB_URI=mongodb://localhost:27017/meetverse
   PORT=5000
   NODE_ENV=development
   CLIENT_BASE_URL=http://localhost:3000
   ```

3. **Start MongoDB**
   - Local: `mongod`
   - Or use MongoDB Atlas (cloud)

4. **Run the Server**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## API Endpoints

### Meeting Management
- `POST /create-meet` - Create instant meeting
- `GET /validate-meet/:id` - Validate meeting exists
- `GET /meeting-stats/:id` - Get meeting statistics

### Scheduled Meetings
- `POST /schedule-meet` - Schedule a meeting
- `GET /scheduled-meetings/:hostEmail` - Get host's meetings
- `GET /scheduled-meeting/:id` - Get specific meeting
- `PUT /scheduled-meeting/:id` - Update meeting
- `DELETE /scheduled-meeting/:id` - Cancel meeting

### Utilities
- `POST /translate` - Translate text
- `GET /proxy-download` - Download external documents

## Socket.io Events

### Client to Server
- `join-room` - Join a meeting room
- `message` - Send chat message
- `doc-add` - Add document to meeting
- `doc-remove` - Remove document from meeting
- `stt-start` - Start speech-to-text
- `stt-chunk` - Send audio chunk
- `stt-stop` - Stop speech-to-text

### Server to Client
- `messageResponse` - Receive chat message
- `docs-init` - Initialize documents
- `docs-updated` - Documents updated
- `stt-result` - Speech-to-text result
- `meeting-reminder` - Meeting reminder notification
- `user-joined` - User joined notification

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/meetverse` |
| `PORT` | Server port | `5000` |
| `NODE_ENV` | Environment | `development` |
| `CLIENT_BASE_URL` | Frontend URL | `http://localhost:3000` |
| `CLIENT_ORIGINS` | Allowed CORS origins | `http://localhost:3000` |
| `ALLOW_ALL_ORIGINS` | Allow all CORS origins | `true` (dev) |
| `LIBRE_TRANSLATE_URL` | Translation service URL | `https://libretranslate.de` |
| `VLLM_BASE` | STT service URL | `http://localhost:8000/v1` |
| `VOXTRAL_MODEL` | STT model | `mistralai/Voxtral-Small-24B-2507` |

## Development

The server uses nodemon for development with hot reloading:
```bash
npm run dev
```

## Production

For production deployment:
1. Set `NODE_ENV=production`
2. Configure proper MongoDB URI
3. Set up SSL certificates if needed
4. Use PM2 or similar process manager

## Database Indexes

The following indexes are automatically created for optimal performance:
- `meetingId` (unique)
- `hostEmail` + `scheduledTime`
- `status` + `scheduledTime`
- `createdAt`

## Error Handling

All endpoints include proper error handling and return appropriate HTTP status codes:
- `200` - Success
- `400` - Bad Request
- `404` - Not Found
- `500` - Internal Server Error
