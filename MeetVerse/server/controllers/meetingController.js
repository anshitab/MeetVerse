import { v4 as uuidv4 } from 'uuid';
import Meeting from '../models/Meeting.js';
import asyncHandler from 'express-async-handler';

// @desc    Create a new meeting
// @route   POST /api/meetings/create
// @access  Private
export const createMeeting = asyncHandler(async (req, res) => {
  try {
    const meetingId = uuidv4().split('-')[0];
    const origin =
      process.env.CLIENT_BASE_URL ||
      req.headers.origin ||
      `http://localhost:3000`;
    const base = String(origin).replace(/\/$/, '');
    const meetingLink = `${base}/meet/${meetingId}`;

    const meeting = new Meeting({
      meetingId,
      title: req.body.title || 'New Meeting',
      description: req.body.description || '',
      hostEmail: req.user.email, // from protect middleware
      hostName: req.user.name || 'Host',
      meetingLink,
      scheduledTime: new Date(),
      status: 'active',
    });

    await meeting.save();

    res.status(201).json({ success: true, meeting });
  } catch (err) {
    console.error('Error creating meeting:', err);
    res
      .status(500)
      .json({ success: false, message: 'Failed to create meeting' });
  }
});

// @desc    Get all meetings for the logged-in user
// @route   GET /api/meetings
// @access  Private
export const getMeetings = asyncHandler(async (req, res) => {
  try {
    const meetings = await Meeting.find({ hostEmail: req.user.email });
    res.json({ success: true, meetings });
  } catch (err) {
    console.error('Error fetching meetings:', err);
    res
      .status(500)
      .json({ success: false, message: 'Failed to fetch meetings' });
  }
});
