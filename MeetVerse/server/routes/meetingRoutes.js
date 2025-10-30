// routes/meetingRoutes.js
import express from 'express';
import { createMeeting } from '../controllers/meetingController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/create', protect, createMeeting);

export default router;

