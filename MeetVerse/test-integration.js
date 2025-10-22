#!/usr/bin/env node

const axios = require('axios');

const SERVER_URL = 'http://localhost:5000';

async function testIntegration() {
  console.log('🧪 Testing MeetVerse Backend Integration...\n');

  try {
    // Test 1: Server Health Check
    console.log('1️⃣ Testing server health...');
    const healthResponse = await axios.get(`${SERVER_URL}/`);
    console.log('✅ Server is running:', healthResponse.data);

    // Test 2: Create Instant Meeting
    console.log('\n2️⃣ Testing instant meeting creation...');
    const createResponse = await axios.post(`${SERVER_URL}/create-meet`);
    const meetingId = createResponse.data.meetingId;
    console.log('✅ Meeting created:', createResponse.data);

    // Test 3: Validate Meeting
    console.log('\n3️⃣ Testing meeting validation...');
    const validateResponse = await axios.get(`${SERVER_URL}/validate-meet/${meetingId}`);
    console.log('✅ Meeting validation:', validateResponse.data);

    // Test 4: Schedule Meeting
    console.log('\n4️⃣ Testing meeting scheduling...');
    const scheduleData = {
      title: 'Integration Test Meeting',
      description: 'This is a test meeting for integration testing',
      scheduledTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
      hostEmail: 'test@example.com',
      hostName: 'Test User'
    };
    const scheduleResponse = await axios.post(`${SERVER_URL}/schedule-meet`, scheduleData);
    const scheduledMeetingId = scheduleResponse.data.meetingId;
    console.log('✅ Meeting scheduled:', scheduleResponse.data.title);

    // Test 5: Get Scheduled Meetings
    console.log('\n5️⃣ Testing scheduled meetings retrieval...');
    const meetingsResponse = await axios.get(`${SERVER_URL}/scheduled-meetings/test@example.com`);
    console.log(`✅ Found ${meetingsResponse.data.length} scheduled meeting(s)`);

    // Test 6: Get Meeting Stats
    console.log('\n6️⃣ Testing meeting statistics...');
    const statsResponse = await axios.get(`${SERVER_URL}/meeting-stats/${meetingId}`);
    console.log('✅ Meeting stats:', statsResponse.data);

    // Test 7: Translation Service
    console.log('\n7️⃣ Testing translation service...');
    const translateResponse = await axios.post(`${SERVER_URL}/translate`, {
      text: 'Hello, this is a test message'
    });
    console.log('✅ Translation service:', translateResponse.data);

    console.log('\n🎉 All integration tests passed!');
    console.log('\n📋 Summary:');
    console.log('✅ Server health check');
    console.log('✅ Instant meeting creation');
    console.log('✅ Meeting validation');
    console.log('✅ Meeting scheduling');
    console.log('✅ Meeting retrieval');
    console.log('✅ Meeting statistics');
    console.log('✅ Translation service');
    
    console.log('\n🚀 Your MeetVerse backend is ready for production!');
    console.log('\nNext steps:');
    console.log('1. Start the frontend: cd MeetVerse/client && npm start');
    console.log('2. Open http://localhost:3000 in your browser');
    console.log('3. Create or join a meeting to test the full application');

  } catch (error) {
    console.error('❌ Integration test failed:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n🔧 Troubleshooting:');
      console.log('1. Make sure the backend server is running:');
      console.log('   cd MeetVerse/server && npm run dev');
      console.log('2. Check if MongoDB is running');
      console.log('3. Verify the server is running on port 5000');
    }
    
    process.exit(1);
  }
}

// Check if axios is available
try {
  require.resolve('axios');
} catch (e) {
  console.log('📦 Installing axios for testing...');
  const { execSync } = require('child_process');
  execSync('npm install axios', { stdio: 'inherit' });
}

testIntegration();
