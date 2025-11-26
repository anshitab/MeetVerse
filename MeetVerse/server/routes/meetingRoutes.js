// routes/meetingRoutes.js
import express from 'express';
import { createMeeting, getMeetingHistory } from '../controllers/meetingController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/create', protect, createMeeting);
router.get('/history', getMeetingHistory);

export default router;

