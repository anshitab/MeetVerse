# MeetVerse - Complete Setup Guide

MeetVerse is a modern video conferencing application with real-time chat, document sharing, and meeting scheduling capabilities, now powered by MongoDB for persistent data storage.

## 🚀 Quick Start

### Prerequisites
- **Node.js** (v14 or higher)
- **MongoDB** (local installation or MongoDB Atlas)
- **Git** (for cloning the repository)

### 1. Clone and Setup

```bash
# Clone the repository (if not already done)
git clone <your-repo-url>
cd MeetVerse

# Install root dependencies
npm install
```

### 2. Backend Setup (MongoDB)

```bash
# Navigate to server directory
cd MeetVerse/server

# Install backend dependencies and setup
npm run install-deps

# Test MongoDB connection
npm run test-db

# Start the backend server
npm run dev
```

The backend will run on `http://localhost:5000`

### 3. Frontend Setup

```bash
# Navigate to client directory (in a new terminal)
cd MeetVerse/client

# Install frontend dependencies
npm install

# Start the React development server
npm start
```

The frontend will run on `http://localhost:3000`

## 📊 Database Configuration

### Local MongoDB Setup

1. **Install MongoDB Community Edition**
   - [Windows](https://docs.mongodb.com/manual/tutorial/install-mongodb-on-windows/)
   - [macOS](https://docs.mongodb.com/manual/tutorial/install-mongodb-on-os-x/)
   - [Linux](https://docs.mongodb.com/manual/administration/install-on-linux/)

2. **Start MongoDB Service**
   ```bash
   # Windows
   net start MongoDB
   
   # macOS/Linux
   sudo systemctl start mongod
   # or
   mongod
   ```

3. **Verify Installation**
   ```bash
   mongosh
   ```

### MongoDB Atlas (Cloud)

1. Create a free account at [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create a new cluster
3. Get your connection string
4. Update `.env` file:
   ```env
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/meetverse
   ```

## 🔧 Environment Configuration

### Backend (.env)
```env
# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/meetverse

# Server Configuration
PORT=5000
NODE_ENV=development

# Client Configuration
CLIENT_BASE_URL=http://localhost:3000
CLIENT_ORIGINS=http://localhost:3000,http://localhost:3001
ALLOW_ALL_ORIGINS=true

# Translation Services
LIBRE_TRANSLATE_URL=https://libretranslate.de

# STT Services (Optional)
VLLM_BASE=http://localhost:8000/v1
VOXTRAL_MODEL=mistralai/Voxtral-Small-24B-2507
```

### Frontend (.env)
```env
REACT_APP_SERVER_URL=http://localhost:5000
```

## 🏗️ Project Structure

```
MeetVerse/
├── client/                 # React frontend
│   ├── src/
│   │   ├── App.js         # Main app component
│   │   ├── Home.js        # Landing page
│   │   ├── MeetingPage.js # Video meeting interface
│   │   └── ...
│   └── package.json
├── server/                 # Node.js backend
│   ├── models/
│   │   └── Meeting.js     # MongoDB schema
│   ├── config/
│   │   └── database.js    # DB connection
│   ├── index.js           # Main server file
│   ├── install.js         # Setup script
│   ├── test-db.js         # Database test
│   └── package.json
└── package.json           # Root package.json
```

## 🎯 Features

### Core Features
- **Video Conferencing**: WebRTC-based video calls
- **Real-time Chat**: Socket.io powered messaging
- **Document Sharing**: Share and sync documents
- **Meeting Scheduling**: Schedule meetings with reminders
- **Live Translation**: Real-time chat translation
- **Meeting Recording**: Record video meetings
- **Screen Sharing**: Share your screen

### Database Features
- **Persistent Storage**: All meeting data stored in MongoDB
- **Meeting Analytics**: Track participants, duration, engagement
- **Document History**: Keep track of shared documents
- **Chat History**: Store all chat messages with translations
- **User Management**: Track meeting participants

## 🚀 Running the Application

### Option 1: Docker Setup (Recommended)

The easiest way to run MeetVerse with Shadow Mode is using Docker:

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your API keys for Shadow Mode
# Then start all services
npm run docker:up

# Access:
# MeetVerse: http://localhost:3000
# Shadow Mode API: http://localhost:8000
```

See [DOCKER_README.md](DOCKER_README.md) for detailed Docker instructions.

### Option 2: Manual Development Setup

1. **Start MongoDB** (if using local installation)
2. **Start Backend**:
   ```bash
   cd MeetVerse/server
   npm run dev
   ```
3. **Start Frontend** (in new terminal):
   ```bash
   cd MeetVerse/client
   npm start
   ```

### Option 3: Production Mode

1. **Build Frontend**:
   ```bash
   cd MeetVerse/client
   npm run build
   ```

2. **Start Backend**:
   ```bash
   cd MeetVerse/server
   npm start
   ```

## 🧪 Testing

### Database Connection Test
```bash
cd MeetVerse/server
npm run test-db
```

### API Testing
Use tools like Postman or curl to test the API endpoints:

```bash
# Create a meeting
curl -X POST http://localhost:5000/create-meet

# Schedule a meeting
curl -X POST http://localhost:5000/schedule-meet \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Team Meeting",
    "description": "Weekly team sync",
    "scheduledTime": "2024-01-15T10:00:00Z",
    "hostEmail": "host@example.com",
    "hostName": "John Doe"
  }'
```

## 🔍 Troubleshooting

### Common Issues

1. **MongoDB Connection Failed**
   - Ensure MongoDB is running
   - Check connection string in `.env`
   - Verify network connectivity

2. **Port Already in Use**
   - Change PORT in `.env` file
   - Kill existing processes using the port

3. **CORS Errors**
   - Update `CLIENT_ORIGINS` in backend `.env`
   - Set `ALLOW_ALL_ORIGINS=true` for development

4. **Socket.io Connection Issues**
   - Check `REACT_APP_SERVER_URL` in frontend `.env`
   - Ensure backend is running before frontend

### Logs and Debugging

- Backend logs: Check terminal where `npm run dev` is running
- Frontend logs: Check browser console
- Database logs: Check MongoDB logs

## 📚 API Documentation

### Meeting Endpoints
- `POST /create-meet` - Create instant meeting
- `GET /validate-meet/:id` - Validate meeting
- `GET /meeting-stats/:id` - Get meeting statistics

### Scheduled Meetings
- `POST /schedule-meet` - Schedule meeting
- `GET /scheduled-meetings/:hostEmail` - Get host meetings
- `PUT /scheduled-meeting/:id` - Update meeting
- `DELETE /scheduled-meeting/:id` - Cancel meeting

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Check the troubleshooting section
- Review the API documentation
- Open an issue on GitHub

---

**Happy Video Conferencing! 🎉**
