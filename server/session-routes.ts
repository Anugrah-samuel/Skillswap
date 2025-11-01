import { Router } from 'express';
import { z } from 'zod';
import { sessionService } from './services/sessions';
import { scheduleSessionSchema, updateSessionSchema } from '@shared/validation-schemas';
import { requireAuth } from './auth';

const router = Router();

// Schedule a new session
router.post('/schedule', requireAuth, async (req, res) => {
  try {
    const { matchId, ...sessionData } = scheduleSessionSchema.parse(req.body);
    
    // Validate that the user is either the teacher or student in the session
    const userId = req.user!.id;
    if (sessionData.teacherId !== userId && sessionData.studentId !== userId) {
      return res.status(403).json({ 
        error: 'You can only schedule sessions where you are either the teacher or student' 
      });
    }

    const session = await sessionService.scheduleSession(matchId, sessionData);
    res.status(201).json(session);
  } catch (error) {
    console.error('Error scheduling session:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start a session
router.post('/:id/start', requireAuth, async (req, res) => {
  try {
    const sessionId = req.params.id;
    const userId = req.user!.id;

    // Get session to verify user is a participant
    const session = await sessionService.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.teacherId !== userId && session.studentId !== userId) {
      return res.status(403).json({ 
        error: 'You can only start sessions where you are a participant' 
      });
    }

    const result = await sessionService.startSession(sessionId);
    res.json(result);
  } catch (error) {
    console.error('Error starting session:', error);
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Complete a session
router.put('/:id/complete', requireAuth, async (req, res) => {
  try {
    const sessionId = req.params.id;
    const userId = req.user!.id;
    const { notes } = req.body;

    // Get session to verify user is a participant
    const session = await sessionService.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.teacherId !== userId && session.studentId !== userId) {
      return res.status(403).json({ 
        error: 'You can only complete sessions where you are a participant' 
      });
    }

    // Validate notes if provided
    if (notes && typeof notes !== 'string') {
      return res.status(400).json({ error: 'Notes must be a string' });
    }

    if (notes && notes.length > 2000) {
      return res.status(400).json({ error: 'Notes cannot exceed 2000 characters' });
    }

    const updatedSession = await sessionService.endSession(sessionId, notes);
    res.json(updatedSession);
  } catch (error) {
    console.error('Error completing session:', error);
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Cancel a session
router.put('/:id/cancel', requireAuth, async (req, res) => {
  try {
    const sessionId = req.params.id;
    const userId = req.user!.id;
    const { reason } = req.body;

    // Get session to verify user is a participant
    const session = await sessionService.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.teacherId !== userId && session.studentId !== userId) {
      return res.status(403).json({ 
        error: 'You can only cancel sessions where you are a participant' 
      });
    }

    if (!reason || typeof reason !== 'string') {
      return res.status(400).json({ error: 'Cancellation reason is required' });
    }

    if (reason.length > 500) {
      return res.status(400).json({ error: 'Reason cannot exceed 500 characters' });
    }

    await sessionService.cancelSession(sessionId, reason);
    res.json({ message: 'Session cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling session:', error);
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get upcoming sessions for the authenticated user
router.get('/upcoming', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const sessions = await sessionService.getUpcomingSessions(userId);
    res.json(sessions);
  } catch (error) {
    console.error('Error fetching upcoming sessions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get session history for the authenticated user
router.get('/history', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    
    if (limit && (isNaN(limit) || limit < 1 || limit > 100)) {
      return res.status(400).json({ error: 'Limit must be a number between 1 and 100' });
    }

    let sessions = await sessionService.getSessionHistory(userId);
    
    if (limit) {
      sessions = sessions.slice(0, limit);
    }

    res.json(sessions);
  } catch (error) {
    console.error('Error fetching session history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a specific session by ID
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const sessionId = req.params.id;
    const userId = req.user!.id;

    const session = await sessionService.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Only allow participants to view session details
    if (session.teacherId !== userId && session.studentId !== userId) {
      return res.status(403).json({ 
        error: 'You can only view sessions where you are a participant' 
      });
    }

    res.json(session);
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;