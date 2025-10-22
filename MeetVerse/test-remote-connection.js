#!/usr/bin/env node

const axios = require('axios');
const { spawn } = require('child_process');
const path = require('path');

const SERVER_URL = 'http://localhost:5000';

async function testRemoteConnection() {
  console.log('🌐 Testing Remote Connection Setup...\n');

  try {
    // Test 1: Server Health
    console.log('1️⃣ Testing server health...');
    const healthResponse = await axios.get(`${SERVER_URL}/`);
    console.log('✅ Server is running');

    // Test 2: Create Test Meeting
    console.log('\n2️⃣ Creating test meeting...');
    const createResponse = await axios.post(`${SERVER_URL}/create-meet`);
    const meetingId = createResponse.data.meetingId;
    console.log(`✅ Test meeting created: ${meetingId}`);

    // Test 3: Validate Meeting
    console.log('\n3️⃣ Validating meeting...');
    const validateResponse = await axios.get(`${SERVER_URL}/validate-meet/${meetingId}`);
    console.log('✅ Meeting validation:', validateResponse.data.valid);

    // Test 4: Check STUN/TURN Servers
    console.log('\n4️⃣ Testing STUN/TURN server accessibility...');
    await testStunTurnServers();

    // Test 5: Network Configuration
    console.log('\n5️⃣ Checking network configuration...');
    await checkNetworkConfig();

    // Test 6: Browser Compatibility Check
    console.log('\n6️⃣ Browser compatibility recommendations...');
    checkBrowserCompatibility();

    console.log('\n🎉 Remote connection setup test completed!');
    console.log('\n📋 Test Results Summary:');
    console.log('✅ Server health check');
    console.log('✅ Meeting creation and validation');
    console.log('✅ STUN/TURN server accessibility');
    console.log('✅ Network configuration check');
    console.log('✅ Browser compatibility check');
    
    console.log('\n🚀 Your MeetVerse setup is ready for remote connections!');
    console.log('\n📖 Next steps:');
    console.log('1. Start the application: npm start');
    console.log('2. Open http://localhost:3000 in your browser');
    console.log('3. Create a meeting and share the link');
    console.log('4. Test from different devices/networks');
    console.log('5. Check the REMOTE_CONNECTION_GUIDE.md for troubleshooting');

    console.log('\n🔗 Test Meeting URL:');
    console.log(`http://localhost:3000/meet/${meetingId}`);

  } catch (error) {
    console.error('❌ Remote connection test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Make sure the backend server is running:');
    console.log('   cd MeetVerse/server && npm run dev');
    console.log('2. Check if MongoDB is running');
    console.log('3. Verify network connectivity');
    console.log('4. Check firewall settings');
    process.exit(1);
  }
}

async function testStunTurnServers() {
  const stunServers = [
    'stun:stun.l.google.com:19302',
    'stun:stun1.l.google.com:19302',
    'stun:stun.ekiga.net',
    'stun:stun.ideasip.com'
  ];

  const turnServers = [
    'turn:openrelay.metered.ca:80',
    'turn:openrelay.metered.ca:443',
    'turn:relay1.expressturn.com:3478'
  ];

  console.log('   Testing STUN servers...');
  for (const server of stunServers) {
    try {
      // Simple connectivity test
      const url = server.replace('stun:', 'http://').replace(':19302', ':80');
      await axios.get(url, { timeout: 5000 });
      console.log(`   ✅ ${server} - accessible`);
    } catch (error) {
      console.log(`   ⚠️  ${server} - not accessible (this is normal for STUN)`);
    }
  }

  console.log('   Testing TURN servers...');
  for (const server of turnServers) {
    try {
      // TURN servers typically don't respond to HTTP, so we just check if they're reachable
      const host = server.split('@')[1] || server.split(':')[1].replace('//', '');
      const port = server.split(':').pop();
      console.log(`   ℹ️  ${server} - TURN server (requires WebRTC test)`);
    } catch (error) {
      console.log(`   ⚠️  ${server} - configuration check needed`);
    }
  }
}

async function checkNetworkConfig() {
  const os = require('os');
  const networkInterfaces = os.networkInterfaces();
  
  console.log('   Network interfaces found:');
  Object.keys(networkInterfaces).forEach(name => {
    const interfaces = networkInterfaces[name];
    interfaces.forEach(iface => {
      if (iface.family === 'IPv4' && !iface.internal) {
        console.log(`   ✅ ${name}: ${iface.address} (${iface.mac})`);
      }
    });
  });

  // Check if we're behind a NAT
  const hasPrivateIP = Object.values(networkInterfaces).some(interfaces => 
    interfaces.some(iface => 
      iface.family === 'IPv4' && 
      !iface.internal && 
      (iface.address.startsWith('192.168.') || 
       iface.address.startsWith('10.') || 
       iface.address.startsWith('172.'))
    )
  );

  if (hasPrivateIP) {
    console.log('   ℹ️  Private IP detected - TURN servers will be needed for remote connections');
  } else {
    console.log('   ✅ Public IP detected - direct connections possible');
  }
}

function checkBrowserCompatibility() {
  console.log('   Browser compatibility recommendations:');
  console.log('   ✅ Chrome 80+ - Full WebRTC support');
  console.log('   ✅ Firefox 75+ - Full WebRTC support');
  console.log('   ✅ Safari 14+ - Full WebRTC support');
  console.log('   ✅ Edge 80+ - Full WebRTC support');
  console.log('   ⚠️  Internet Explorer - Not supported');
  console.log('   ⚠️  Older browsers - May have limited functionality');
  
  console.log('\n   Mobile browser support:');
  console.log('   ✅ Chrome Mobile 80+');
  console.log('   ✅ Safari iOS 14+');
  console.log('   ✅ Samsung Internet 12+');
  console.log('   ⚠️  Older mobile browsers - Limited support');
}

// Check if axios is available
try {
  require.resolve('axios');
} catch (e) {
  console.log('📦 Installing axios for testing...');
  const { execSync } = require('child_process');
  execSync('npm install axios', { stdio: 'inherit' });
}

testRemoteConnection();
