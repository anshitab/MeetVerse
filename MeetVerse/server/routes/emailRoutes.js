import express from 'express';
import { sendTodoEmail, sendTodosForUser } from '../services/emailService.js';

const router = express.Router();

// POST /api/email/send-todos
// Body: { email: string, todos?: string[] }
router.post('/send-todos', async (req, res) => {
  try {
    const { email, todos } = req.body || {};
    const emailLc = String(email || '').toLowerCase();
    if (!emailLc) return res.status(400).json({ message: 'email required' });

    if (Array.isArray(todos) && todos.length) {
      await sendTodoEmail(emailLc, todos);
      return res.status(200).json({ message: 'To-do email sent successfully!' });
    }

    // If no explicit todos provided, pull from DB for this user
    await sendTodosForUser(emailLc);
    return res.status(200).json({ message: 'To-do email (from DB) sent successfully!' });
  } catch (error) {
    console.error('send-todos error:', error);
    res.status(500).json({ message: 'Failed to send email' });
  }
});

export default router;


