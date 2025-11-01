import { describe, it, expect, beforeEach } from 'vitest';
import { SessionService } from './sessions';
import { storage } from '../storage';
import { 
  type User, 
  type Skill, 
  type SkillMatch, 
  type SkillSession 
} from '@shared/schema';

describe('SessionService', () => {
  let sessionService: SessionService;
  let testUser1: User;
  let testUser2: User;
  let testSkill: Skill;
  let testMatch: SkillMatch;

  beforeEach(async () => {
    sessionService = new SessionService();

    // Create test users
    testUser1 = await storage.createUser({
      username: 'teacher',
      email: 'teacher@test.com',
      password: 'hashedpassword',
      fullName: 'Test Teacher',
      creditBalance: 100
    });

    testUser2 = await storage.createUser({
      username: 'student',
      email: 'student@test.com',
      password: 'hashedpassword',
      fullName: 'Test Student',
      creditBalance: 50
    });

    // Create test skill
    testSkill = await storage.createSkill({
      userId: testUser1.id,
      title: 'JavaScript Programming',
      description: 'Learn JavaScript basics',
      category: 'Programming',
      level: 'Intermediate',
      type: 'teach'
    });

    // Create test match
    testMatch = await storage.createMatch({
      userId: testUser2.id,
      matchedUserId: testUser1.id,
      userSkillId: testSkill.id,
      matchedSkillId: testSkill.id,
      status: 'pending'
    });

    // Accept the match
    testMatch = (await storage.updateMatch(testMatch.id, 'accepted'))!;
  });

  describe('scheduleSession', () => {
    it('should successfully schedule a session', async () => {
      const startTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour duration

      const sessionData = {
        teacherId: testUser1.id,
        studentId: testUser2.id,
        skillId: testSkill.id,
        scheduledStart: startTime,
        scheduledEnd: endTime,
        creditsAmount: 10
      };

      const session = await sessionService.scheduleSession(testMatch.id, sessionData);

      expect(session).toBeDefined();
      expect(session.matchId).toBe(testMatch.id);
      expect(session.teacherId).toBe(testUser1.id);
      expect(session.studentId).toBe(testUser2.id);
      expect(session.status).toBe('scheduled');
      expect(session.creditsAmount).toBe(10);

      // Check that credits were deducted from student
      const updatedStudent = await storage.getUser(testUser2.id);
      expect(updatedStudent?.creditBalance).toBe(40); // 50 - 10
    });

    it('should throw error if match not found', async () => {
      const startTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

      const sessionData = {
        teacherId: testUser1.id,
        studentId: testUser2.id,
        skillId: testSkill.id,
        scheduledStart: startTime,
        scheduledEnd: endTime,
        creditsAmount: 10
      };

      await expect(
        sessionService.scheduleSession('nonexistent-match', sessionData)
      ).rejects.toThrow('Match not found');
    });

    it('should throw error if match is not accepted', async () => {
      // Create a pending match
      const pendingMatch = await storage.createMatch({
        userId: testUser2.id,
        matchedUserId: testUser1.id,
        userSkillId: testSkill.id,
        matchedSkillId: testSkill.id,
        status: 'pending'
      });

      const startTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

      const sessionData = {
        teacherId: testUser1.id,
        studentId: testUser2.id,
        skillId: testSkill.id,
        scheduledStart: startTime,
        scheduledEnd: endTime,
        creditsAmount: 10
      };

      await expect(
        sessionService.scheduleSession(pendingMatch.id, sessionData)
      ).rejects.toThrow('Match must be accepted before scheduling a session');
    });

    it('should throw error if student has insufficient credits', async () => {
      const startTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

      const sessionData = {
        teacherId: testUser1.id,
        studentId: testUser2.id,
        skillId: testSkill.id,
        scheduledStart: startTime,
        scheduledEnd: endTime,
        creditsAmount: 100 // More than student's balance of 50
      };

      await expect(
        sessionService.scheduleSession(testMatch.id, sessionData)
      ).rejects.toThrow('Student has insufficient credits for this session');
    });

    it('should detect scheduling conflicts', async () => {
      const startTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

      // Schedule first session
      const sessionData1 = {
        teacherId: testUser1.id,
        studentId: testUser2.id,
        skillId: testSkill.id,
        scheduledStart: startTime,
        scheduledEnd: endTime,
        creditsAmount: 10
      };

      await sessionService.scheduleSession(testMatch.id, sessionData1);

      // Try to schedule overlapping session
      const overlappingStart = new Date(startTime.getTime() + 30 * 60 * 1000); // 30 minutes into first session
      const overlappingEnd = new Date(overlappingStart.getTime() + 60 * 60 * 1000);

      const sessionData2 = {
        teacherId: testUser1.id,
        studentId: testUser2.id,
        skillId: testSkill.id,
        scheduledStart: overlappingStart,
        scheduledEnd: overlappingEnd,
        creditsAmount: 10
      };

      await expect(
        sessionService.scheduleSession(testMatch.id, sessionData2)
      ).rejects.toThrow('Teacher has a scheduling conflict at the requested time');
    });
  });

  describe('startSession', () => {
    let scheduledSession: SkillSession;

    beforeEach(async () => {
      const startTime = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now (within start window)
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

      scheduledSession = await sessionService.scheduleSession(testMatch.id, {
        teacherId: testUser1.id,
        studentId: testUser2.id,
        skillId: testSkill.id,
        scheduledStart: startTime,
        scheduledEnd: endTime,
        creditsAmount: 10
      });
    });

    it('should start a session and return video room details', async () => {
      // Mock current time to be within acceptable start window
      const originalNow = Date.now;
      Date.now = () => scheduledSession.scheduledStart.getTime();

      try {
        const result = await sessionService.startSession(scheduledSession.id);

        expect(result).toBeDefined();
        expect(result.roomId).toContain('session_');
        expect(result.token).toContain('mock_token_');

        // Check session status was updated
        const updatedSession = await storage.getSkillSession(scheduledSession.id);
        expect(updatedSession?.status).toBe('in_progress');
        expect(updatedSession?.actualStart).toBeDefined();
        expect(updatedSession?.videoRoomId).toBe(result.roomId);
      } finally {
        Date.now = originalNow;
      }
    });

    it('should throw error if session not found', async () => {
      await expect(
        sessionService.startSession('nonexistent-session')
      ).rejects.toThrow('Session not found');
    });

    it('should throw error if session is not scheduled', async () => {
      // Update session to completed status
      await storage.updateSkillSession(scheduledSession.id, { status: 'completed' });

      await expect(
        sessionService.startSession(scheduledSession.id)
      ).rejects.toThrow('Session is not in scheduled status');
    });

    it('should throw error if trying to start too early', async () => {
      // Create a new session scheduled for the future
      const futureStartTime = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now
      const futureEndTime = new Date(futureStartTime.getTime() + 60 * 60 * 1000);

      const futureSession = await sessionService.scheduleSession(testMatch.id, {
        teacherId: testUser1.id,
        studentId: testUser2.id,
        skillId: testSkill.id,
        scheduledStart: futureStartTime,
        scheduledEnd: futureEndTime,
        creditsAmount: 10
      });

      // Mock current time to be too early (more than 15 minutes before scheduled start)
      const originalNow = Date.now;
      Date.now = () => futureStartTime.getTime() - 20 * 60 * 1000; // 20 minutes early

      try {
        await expect(
          sessionService.startSession(futureSession.id)
        ).rejects.toThrow('Session can only be started within 15 minutes before to 30 minutes after scheduled time');
      } finally {
        Date.now = originalNow;
      }
    });
  });

  describe('endSession', () => {
    let inProgressSession: SkillSession;

    beforeEach(async () => {
      const startTime = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

      // Schedule and start a session
      const scheduledSession = await sessionService.scheduleSession(testMatch.id, {
        teacherId: testUser1.id,
        studentId: testUser2.id,
        skillId: testSkill.id,
        scheduledStart: startTime,
        scheduledEnd: endTime,
        creditsAmount: 10
      });

      // Mock time and start session
      const originalNow = Date.now;
      Date.now = () => startTime.getTime();
      
      try {
        await sessionService.startSession(scheduledSession.id);
        inProgressSession = (await storage.getSkillSession(scheduledSession.id))!;
      } finally {
        Date.now = originalNow;
      }
    });

    it('should end a session and process credits', async () => {
      const initialTeacherBalance = (await storage.getUser(testUser1.id))!.creditBalance;
      const initialStudentBalance = (await storage.getUser(testUser2.id))!.creditBalance;

      const result = await sessionService.endSession(inProgressSession.id, 'Great session!');

      expect(result.status).toBe('completed');
      expect(result.actualEnd).toBeDefined();
      expect(result.notes).toBe('Great session!');

      // Check that credits were processed
      const updatedTeacher = await storage.getUser(testUser1.id);
      const updatedStudent = await storage.getUser(testUser2.id);

      expect(updatedTeacher!.creditBalance).toBeGreaterThan(initialTeacherBalance);
      expect(updatedStudent!.creditBalance).toBeGreaterThan(initialStudentBalance);
    });

    it('should throw error if session not found', async () => {
      await expect(
        sessionService.endSession('nonexistent-session')
      ).rejects.toThrow('Session not found');
    });

    it('should throw error if session is not in progress', async () => {
      // Update session to completed status
      await storage.updateSkillSession(inProgressSession.id, { status: 'completed' });

      await expect(
        sessionService.endSession(inProgressSession.id)
      ).rejects.toThrow('Session is not in progress');
    });
  });

  describe('cancelSession', () => {
    let scheduledSession: SkillSession;

    beforeEach(async () => {
      const startTime = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours from now
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

      scheduledSession = await sessionService.scheduleSession(testMatch.id, {
        teacherId: testUser1.id,
        studentId: testUser2.id,
        skillId: testSkill.id,
        scheduledStart: startTime,
        scheduledEnd: endTime,
        creditsAmount: 10
      });
    });

    it('should cancel session with full refund when cancelled 24+ hours in advance', async () => {
      const initialBalance = (await storage.getUser(testUser2.id))!.creditBalance;

      await sessionService.cancelSession(scheduledSession.id, 'Schedule conflict');

      const updatedSession = await storage.getSkillSession(scheduledSession.id);
      expect(updatedSession?.status).toBe('cancelled');
      expect(updatedSession?.notes).toContain('Schedule conflict');

      // Check full refund was processed
      const updatedStudent = await storage.getUser(testUser2.id);
      expect(updatedStudent!.creditBalance).toBe(initialBalance + 10); // Full refund
    });

    it('should cancel session with partial refund when cancelled 2-24 hours in advance', async () => {
      // Update session to be 12 hours from now
      const nearFutureStart = new Date(Date.now() + 12 * 60 * 60 * 1000);
      await storage.updateSkillSession(scheduledSession.id, {
        scheduledStart: nearFutureStart
      });

      const initialBalance = (await storage.getUser(testUser2.id))!.creditBalance;

      await sessionService.cancelSession(scheduledSession.id, 'Emergency');

      // Check partial refund (50%)
      const updatedStudent = await storage.getUser(testUser2.id);
      expect(updatedStudent!.creditBalance).toBe(initialBalance + 5); // 50% refund
    });

    it('should throw error if session not found', async () => {
      await expect(
        sessionService.cancelSession('nonexistent-session', 'reason')
      ).rejects.toThrow('Session not found');
    });

    it('should throw error if trying to cancel completed session', async () => {
      await storage.updateSkillSession(scheduledSession.id, { status: 'completed' });

      await expect(
        sessionService.cancelSession(scheduledSession.id, 'reason')
      ).rejects.toThrow('Cannot cancel a session that is already completed or cancelled');
    });
  });

  describe('getUpcomingSessions', () => {
    it('should return upcoming sessions for a user', async () => {
      const futureTime1 = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const futureTime2 = new Date(Date.now() + 48 * 60 * 60 * 1000);

      // Create two upcoming sessions
      await sessionService.scheduleSession(testMatch.id, {
        teacherId: testUser1.id,
        studentId: testUser2.id,
        skillId: testSkill.id,
        scheduledStart: futureTime2,
        scheduledEnd: new Date(futureTime2.getTime() + 60 * 60 * 1000),
        creditsAmount: 10
      });

      await sessionService.scheduleSession(testMatch.id, {
        teacherId: testUser1.id,
        studentId: testUser2.id,
        skillId: testSkill.id,
        scheduledStart: futureTime1,
        scheduledEnd: new Date(futureTime1.getTime() + 60 * 60 * 1000),
        creditsAmount: 10
      });

      const upcomingSessions = await sessionService.getUpcomingSessions(testUser1.id);

      expect(upcomingSessions).toHaveLength(2);
      // Should be sorted by scheduled start time (earliest first)
      expect(new Date(upcomingSessions[0].scheduledStart).getTime())
        .toBeLessThan(new Date(upcomingSessions[1].scheduledStart).getTime());
    });

    it('should not return past or completed sessions', async () => {
      const pastTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      // Create a past session
      const pastSession = await storage.createSkillSession({
        matchId: testMatch.id,
        teacherId: testUser1.id,
        studentId: testUser2.id,
        skillId: testSkill.id,
        scheduledStart: pastTime,
        scheduledEnd: new Date(pastTime.getTime() + 60 * 60 * 1000),
        creditsAmount: 10,
        status: 'completed'
      });

      const upcomingSessions = await sessionService.getUpcomingSessions(testUser1.id);
      expect(upcomingSessions).toHaveLength(0);
    });
  });

  describe('getSessionHistory', () => {
    it('should return completed and cancelled sessions', async () => {
      // Create completed session
      const completedSession = await storage.createSkillSession({
        matchId: testMatch.id,
        teacherId: testUser1.id,
        studentId: testUser2.id,
        skillId: testSkill.id,
        scheduledStart: new Date(Date.now() - 48 * 60 * 60 * 1000),
        scheduledEnd: new Date(Date.now() - 47 * 60 * 60 * 1000),
        creditsAmount: 10,
        status: 'completed'
      });

      // Create cancelled session
      const cancelledSession = await storage.createSkillSession({
        matchId: testMatch.id,
        teacherId: testUser1.id,
        studentId: testUser2.id,
        skillId: testSkill.id,
        scheduledStart: new Date(Date.now() - 24 * 60 * 60 * 1000),
        scheduledEnd: new Date(Date.now() - 23 * 60 * 60 * 1000),
        creditsAmount: 10,
        status: 'cancelled'
      });

      const history = await sessionService.getSessionHistory(testUser1.id);

      expect(history).toHaveLength(2);
      expect(history.some(s => s.status === 'completed')).toBe(true);
      expect(history.some(s => s.status === 'cancelled')).toBe(true);
    });
  });

  describe('checkSessionConflicts', () => {
    it('should detect overlapping sessions', async () => {
      const startTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

      // Create existing session
      await sessionService.scheduleSession(testMatch.id, {
        teacherId: testUser1.id,
        studentId: testUser2.id,
        skillId: testSkill.id,
        scheduledStart: startTime,
        scheduledEnd: endTime,
        creditsAmount: 10
      });

      // Check for conflict with overlapping time
      const conflictStart = new Date(startTime.getTime() + 30 * 60 * 1000);
      const conflictEnd = new Date(conflictStart.getTime() + 60 * 60 * 1000);

      const hasConflict = await sessionService.checkSessionConflicts(
        testUser1.id,
        conflictStart,
        conflictEnd
      );

      expect(hasConflict).toBe(true);
    });

    it('should not detect conflicts with non-overlapping sessions', async () => {
      const startTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

      // Create existing session
      await sessionService.scheduleSession(testMatch.id, {
        teacherId: testUser1.id,
        studentId: testUser2.id,
        skillId: testSkill.id,
        scheduledStart: startTime,
        scheduledEnd: endTime,
        creditsAmount: 10
      });

      // Check for conflict with non-overlapping time (after existing session)
      const noConflictStart = new Date(endTime.getTime() + 60 * 60 * 1000);
      const noConflictEnd = new Date(noConflictStart.getTime() + 60 * 60 * 1000);

      const hasConflict = await sessionService.checkSessionConflicts(
        testUser1.id,
        noConflictStart,
        noConflictEnd
      );

      expect(hasConflict).toBe(false);
    });
  });

  describe('validateSessionData', () => {
    it('should validate valid session data', () => {
      const validData = {
        teacherId: testUser1.id,
        studentId: testUser2.id,
        skillId: testSkill.id,
        scheduledStart: new Date(Date.now() + 24 * 60 * 60 * 1000),
        scheduledEnd: new Date(Date.now() + 25 * 60 * 60 * 1000),
        creditsAmount: 10
      };

      expect(() => sessionService.validateSessionData(validData)).not.toThrow();
    });

    it('should throw error for same teacher and student', () => {
      const invalidData = {
        teacherId: testUser1.id,
        studentId: testUser1.id, // Same as teacher
        skillId: testSkill.id,
        scheduledStart: new Date(Date.now() + 24 * 60 * 60 * 1000),
        scheduledEnd: new Date(Date.now() + 25 * 60 * 60 * 1000),
        creditsAmount: 10
      };

      expect(() => sessionService.validateSessionData(invalidData))
        .toThrow('Teacher and student cannot be the same person');
    });

    it('should throw error for past start time', () => {
      const invalidData = {
        teacherId: testUser1.id,
        studentId: testUser2.id,
        skillId: testSkill.id,
        scheduledStart: new Date(Date.now() - 60 * 60 * 1000), // Past time
        scheduledEnd: new Date(Date.now() + 60 * 60 * 1000),
        creditsAmount: 10
      };

      expect(() => sessionService.validateSessionData(invalidData))
        .toThrow('Session cannot be scheduled in the past');
    });

    it('should throw error for end time before start time', () => {
      const startTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const invalidData = {
        teacherId: testUser1.id,
        studentId: testUser2.id,
        skillId: testSkill.id,
        scheduledStart: startTime,
        scheduledEnd: new Date(startTime.getTime() - 60 * 60 * 1000), // Before start
        creditsAmount: 10
      };

      expect(() => sessionService.validateSessionData(invalidData))
        .toThrow('End time must be after start time');
    });

    it('should throw error for session too short', () => {
      const startTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const invalidData = {
        teacherId: testUser1.id,
        studentId: testUser2.id,
        skillId: testSkill.id,
        scheduledStart: startTime,
        scheduledEnd: new Date(startTime.getTime() + 10 * 60 * 1000), // 10 minutes
        creditsAmount: 10
      };

      expect(() => sessionService.validateSessionData(invalidData))
        .toThrow('Session must be at least 15 minutes long');
    });

    it('should throw error for session too long', () => {
      const startTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const invalidData = {
        teacherId: testUser1.id,
        studentId: testUser2.id,
        skillId: testSkill.id,
        scheduledStart: startTime,
        scheduledEnd: new Date(startTime.getTime() + 5 * 60 * 60 * 1000), // 5 hours
        creditsAmount: 10
      };

      expect(() => sessionService.validateSessionData(invalidData))
        .toThrow('Session cannot be longer than 4 hours');
    });
  });
});