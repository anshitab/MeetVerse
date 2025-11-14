# MeetVerse Docker Setup

This guide explains how to run MeetVerse and Shadow Mode using Docker for easy deployment and development.

## 🚀 Quick Start with Docker

### Prerequisites
- Docker and Docker Compose installed
- At least 4GB RAM available
- Copy `.env.example` to `.env` and configure your API keys

### 1. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your API keys (required for Shadow Mode)
# GEMINI_API_KEY=your_actual_gemini_key
# CHROMA_API_KEY=your_actual_chroma_key
# CHROMA_TENANT=your_actual_tenant_id
```

### 2. Start All Services

```bash
# Build and start all services
npm run docker:up

# Or manually:
docker-compose up -d
```

### 3. Access the Applications

- **MeetVerse Frontend**: http://localhost:3000
- **MeetVerse Backend API**: http://localhost:5000
- **Shadow Mode API**: http://localhost:8000
- **Shadow Mode Docs**: http://localhost:8000/docs
- **Shadow Mode Frontend**: http://localhost:3001

## 🏗️ Architecture

The Docker setup includes:

### MeetVerse Core Services
- **mongodb**: MongoDB database for MeetVerse data
- **backend**: Node.js backend server (port 5000)
- **frontend**: React frontend (port 3000)

### Shadow Mode AI Services
- **postgres**: PostgreSQL database for Shadow Mode
- **redis**: Redis for task queuing
- **shadow-backend**: FastAPI backend (port 8000)
- **shadow-worker**: Celery worker for AI tasks
- **shadow-frontend**: React frontend for Shadow Mode (port 3001)

## 📋 Available Commands

```bash
# Development (with live reload)
npm run docker:dev

# Production (detached)
npm run docker:up

# View logs
npm run docker:logs

# Stop all services
npm run docker:down

# Rebuild after code changes
npm run docker:build
```

## 🔧 Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```env
# MeetVerse Configuration
MONGODB_URI=mongodb://admin:password@localhost:27017/meetverse?authSource=admin

# Shadow Mode Configuration (Required)
GEMINI_API_KEY=your_gemini_api_key
CHROMA_API_KEY=your_chroma_api_key
CHROMA_TENANT=your_tenant_id
```

### Ports

- **3000**: MeetVerse React app
- **3001**: Shadow Mode React app
- **5000**: MeetVerse Node.js API
- **8000**: Shadow Mode FastAPI
- **27017**: MongoDB
- **5432**: PostgreSQL
- **6379**: Redis

## 🐛 Troubleshooting

### Common Issues

1. **Port conflicts**: Change ports in `docker-compose.yml` if needed
2. **Memory issues**: Ensure Docker has enough RAM (4GB+ recommended)
3. **API keys missing**: Shadow Mode requires valid Gemini and ChromaDB keys
4. **Database connection**: Wait for health checks to pass before accessing services

### Logs and Debugging

```bash
# View all logs
docker-compose logs

# View specific service logs
docker-compose logs backend
docker-compose logs shadow-backend

# Follow logs in real-time
docker-compose logs -f
```

### Reset Everything

```bash
# Stop and remove all containers, volumes, and networks
docker-compose down -v --remove-orphans

# Clean rebuild
docker-compose build --no-cache
```

## 🔄 Development Workflow

1. **Code changes**: Edit files locally (Docker volumes sync automatically)
2. **Rebuild services**: Run `npm run docker:build` for backend changes
3. **View logs**: Use `npm run docker:logs` to monitor services
4. **Database access**: Connect to MongoDB/PostgreSQL using localhost ports

## 📊 Data Persistence

- **MongoDB data**: Stored in `mongodb_data` volume
- **PostgreSQL data**: Stored in `postgres_data` volume
- **ChromaDB data**: Stored in `chroma_data` volume
- **Generated documents**: Stored in `document_data` volume

## 🚀 Production Deployment

For production:

1. Update environment variables for production URLs
2. Use proper SSL certificates
3. Configure reverse proxy (nginx)
4. Set up proper logging and monitoring
5. Use managed databases instead of local containers

## 🎯 Integration

Shadow Mode is automatically integrated into MeetVerse meetings. The ShadowMode component loads when you join a meeting and connects to the Shadow Mode backend for AI features.

---

**Happy Docker-ing! 🐳**
