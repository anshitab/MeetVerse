#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import Meeting from './models/Meeting.js';

async function testDatabase() {
  try {
    console.log('🔌 Testing MongoDB connection...');
    
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/meetverse';
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ MongoDB connected successfully');
    
    // Test creating a sample meeting
    console.log('📝 Testing meeting creation...');
    const testMeeting = new Meeting({
      meetingId: 'test-' + Date.now(),
      title: 'Test Meeting',
      description: 'This is a test meeting',
      meetingLink: 'http://localhost:3000/meet/test',
      hostEmail: 'test@example.com',
      hostName: 'Test User',
      scheduledTime: new Date(),
      status: 'active'
    });
    
    await testMeeting.save();
    console.log('✅ Test meeting created successfully');
    
    // Test querying meetings
    console.log('🔍 Testing meeting queries...');
    const meetings = await Meeting.find({ hostEmail: 'test@example.com' });
    console.log(`✅ Found ${meetings.length} meeting(s) for test user`);
    
    // Clean up test data
    await Meeting.deleteOne({ meetingId: testMeeting.meetingId });
    console.log('🧹 Test data cleaned up');
    
    console.log('\n🎉 Database test completed successfully!');
    console.log('Your MongoDB setup is working correctly.');
    
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
    console.log('\nTroubleshooting:');
    console.log('1. Make sure MongoDB is running');
    console.log('2. Check your MONGODB_URI in .env file');
    console.log('3. Ensure MongoDB is accessible from your network');
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

testDatabase();
