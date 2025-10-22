#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting MeetVerse Development Environment...\n');

// Start backend
console.log('📡 Starting backend server...');
const backend = spawn('npm', ['run', 'dev'], {
  cwd: path.join(__dirname, 'server'),
  stdio: 'pipe',
  shell: true
});

backend.stdout.on('data', (data) => {
  console.log(`[BACKEND] ${data.toString().trim()}`);
});

backend.stderr.on('data', (data) => {
  console.error(`[BACKEND ERROR] ${data.toString().trim()}`);
});

// Start frontend after a short delay
setTimeout(() => {
  console.log('\n🌐 Starting frontend server...');
  const frontend = spawn('npm', ['start'], {
    cwd: path.join(__dirname, 'client'),
    stdio: 'pipe',
    shell: true
  });

  frontend.stdout.on('data', (data) => {
    console.log(`[FRONTEND] ${data.toString().trim()}`);
  });

  frontend.stderr.on('data', (data) => {
    console.error(`[FRONTEND ERROR] ${data.toString().trim()}`);
  });

  // Handle process termination
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down servers...');
    backend.kill();
    frontend.kill();
    process.exit(0);
  });

}, 3000);

// Handle backend process termination
backend.on('close', (code) => {
  console.log(`\n❌ Backend process exited with code ${code}`);
  process.exit(1);
});

console.log('\n✅ Development servers starting...');
console.log('📡 Backend: http://localhost:5000');
console.log('🌐 Frontend: http://localhost:3000');
console.log('\nPress Ctrl+C to stop all servers');
