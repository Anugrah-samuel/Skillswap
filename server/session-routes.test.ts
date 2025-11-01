import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { registerRoutes } from './routes';
import { storage } from './storage';
import { AuthService } from './auth';
import type { User, Skill, SkillMatch } from '@shared/schema';

describe('Session Routes', () => {
  let app: express.Application;
  let testUser1: User;
  let testUser2: User;
  let testSkill: Skill;
  let testMatch: SkillMatch;
  let authToken1: string;
  let authToken2: string;

  beforeEach(async () => {
    // Create Express app with routes
    app = express();
    app.use(express.json());
    await registerRoutes(app);

    // Create test users
    testUser1 = await storage.createUser({
      username: 'teacher',
      email: 'teacher@test.com',
      password: await AuthService.hashPassword('password123'),
      fullName: 'Test Teacher',
      creditBalance: 100
    });

    testUser2 = await storage.createUser({
      username: 'student',
      email: 'student@test.com',
      password: await AuthService.hashPassword('password123'),
      fullName: 'Test Student',
      creditBalance: 50
    });

    // Generate auth tokens
    authToken1 = AuthService.generateAccessToken(testUser1);
    authToken2 = AuthService.generateAccessToken(testUser2);

    // Create test skill
    testSkill = await storage.createSkill({
      userId: testUser1.id,
      title: 'JavaScript Programming',
      description: 'Learn JavaScript basics',
      category: 'Programming',
      level: 'Intermediate',
      type: 'teach'
    });

    // Create and accept test match
    testMatch = await storage.createMatch({
      userId: testUser2.id,
      matchedUserId: testUser1.id,
      userSkillId: testSkill.id,
      matchedSkillId: testSkill.id,
      status: 'pending'
    });

    testMatch = (await storage.updateMatch(testMatch.id, 'accepted'))!;
  });

  describe('POST /api/sessions/schedule', () => {
    it('should successfully schedule a session', async () => {
      const startTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour duration

      const sessionData = {
        matchId: testMatch.id,
        teacherId: testUser1.id,
        studentId: testUser2.id,
        skillId: testSkill.id,
        scheduledStart: startTime.toISOString(),
        scheduledEnd: endTime.toISOString(),
        creditsAmount: 10
      };

      const response = await request(app)
        .post('/api/sessions/schedule')
        .set('Authorization', `Bearer ${authToken1}`)
        .send(sessionData)
        .expect(201);

      expect(response.body).toMatchObject({
        matchId: testMatch.id,
        teacherId: testUser1.id,
        studentId: testUser2.id,
        skillId: testSkill.id,
        creditsAmount: 10,
        status: 'scheduled'
      });

      // Check that credits were deducted from student
      const updatedStudent = await storage.getUser(testUser2.id);
      expect(updatedStudent?.creditBalance).toBe(40); // 50 - 10
    });

    it('should reject scheduling by unauthorized user', async () => {
      const startTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

      // Create another user who is not part of the match
      const otherUser = await storage.createUser({
        username: 'other',
        email: 'other@test.com',
        password: await AuthService.hashPassword('password123'),
        fullName: 'Other User',
        creditBalance: 100
      });

      const otherToken = AuthService.generateAccessToken(otherUser);

      const sessionData = {
        matchId: testMatch.id,
        teacherId: testUser1.id,
        studentId: testUser2.id,
        skillId: testSkill.id,
        scheduledStart: startTime.toISOString(),
        scheduledEnd: endTime.toISOString(),
        creditsAmount: 10
      };

      const response = await request(app)
        .post('/api/sessions/schedule')
        .set('Authorization', `Bearer ${otherToken}`)
        .send(sessionData)
        .expect(403);

      expect(response.body.code).toBe('UNAUTHORIZED_SESSION_ACCESS');
    });

    it('should reject scheduling with insufficient credits', async () => {
      const startTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

      const sessionData = {
        matchId: testMatch.id,
        teacherId: testUser1.id,
        studentId: testUser2.id,
        skillId: testSkill.id,
        scheduledStart: startTime.toISOString(),
        scheduledEnd: endTime.toISOString(),
        creditsAmount: 100 // More than student's balance
      };

      const response = await request(app)
        .post('/api/sessions/schedule')
        .set('Authorization', `Bearer ${authToken2}`)
        .send(sessionData)
        .expect(400);

      expect(response.body.code).toBe('INSUFFICIENT_CREDITS');
    });

    it('should reject invalid session data', async () => {
      const sessionData = {
        matchId: testMatch.id,
        teacherId: testUser1.id,
        studentId: testUser2.id,
        skillId: testSkill.id,
        // Missing scheduledStart and scheduledEnd
        creditsAmount: 10
      };

      const response = await request(app)
        .post('/api/sessions/schedule')
        .set('Authorization', `Bearer ${authToken1}`)
        .send(sessionData)
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should require authentication', async () => {
      const startTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

      const sessionData = {
        matchId: testMatch.id,
        teacherId: testUser1.id,
        studentId: testUser2.id,
        skillId: testSkill.id,
        scheduledStart: startTime.toISOString(),
        scheduledEnd: endTime.toISOString(),
        creditsAmount: 10
      };

      await request(app)
        .post('/api/sessions/schedule')
        .send(sessionData)
        .expect(401);
    });
  });

  describe('POST /api/sessions/:id/start', () => {
    let scheduledSession: any;

    beforeEach(async () => {
      const startTime = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

      const sessionData = {
        matchId: testMatch.id,
        teacherId: testUser1.id,
        studentId: testUser2.id,
        skillId: testSkill.id,
        scheduledStart: startTime.toISOString(),
        scheduledEnd: endTime.toISOString(),
        creditsAmount: 10
      };

      const response = await request(app)
        .post('/api/sessions/schedule')
        .set('Authorization', `Bearer ${authToken1}`)
        .send(sessionData);

      scheduledSession = response.body;
    });

    it('should start a session and return video room details', async () => {
      // Mock current time to be within acceptable start window
      const originalNow = Date.now;
      Date.now = () => new Date(scheduledSession.scheduledStart).getTime();

      try {
        const response = await request(app)
          .post(`/api/sessions/${scheduledSession.id}/start`)
          .set('Authorization', `Bearer ${authToken1}`)
          .expect(200);

        expect(response.body).toHaveProperty('roomId');
        expect(response.body).toHaveProperty('token');
        expect(response.body.roomId).toContain('session_');
        expect(response.body.token).toContain('mock_token_');
      } finally {
        Date.now = originalNow;
      }
    });

    it('should reject starting by unauthorized user', async () => {
      const otherUser = await storage.createUser({
        username: 'other',
        email: 'other@test.com',
        password: await AuthService.hashPassword('password123'),
        fullName: 'Other User',
        creditBalance: 100
      });

      const otherToken = AuthService.generateAccessToken(otherUser);

      const response = await request(app)
        .post(`/api/sessions/${scheduledSession.id}/start`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);

      expect(response.body.code).toBe('UNAUTHORIZED_SESSION_ACCESS');
    });

    it('should reject starting non-existent session', async () => {
      const response = await request(app)
        .post('/api/sessions/nonexistent-id/start')
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(404);

      expect(response.body.code).toBe('SESSION_NOT_FOUND');
    });

    it('should require authentication', async () => {
      await request(app)
        .post(`/api/sessions/${scheduledSession.id}/start`)
        .expect(401);
    });
  });

  describe('PUT /api/sessions/:id/complete', () => {
    let inProgressSession: any;

    beforeEach(async () => {
      const startTime = new Date(Date.now() + 10 * 60 * 1000);
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

      // Schedule session
      const sessionData = {
        matchId: testMatch.id,
        teacherId: testUser1.id,
        studentId: testUser2.id,
        skillId: testSkill.id,
        scheduledStart: startTime.toISOString(),
        scheduledEnd: endTime.toISOString(),
        creditsAmount: 10
      };

      const scheduleResponse = await request(app)
        .post('/api/sessions/schedule')
        .set('Authorization', `Bearer ${authToken1}`)
        .send(sessionData);

      const scheduledSession = scheduleResponse.body;

      // Start session
      const originalNow = Date.now;
      Date.now = () => new Date(scheduledSession.scheduledStart).getTime();

      try {
        await request(app)
          .post(`/api/sessions/${scheduledSession.id}/start`)
          .set('Authorization', `Bearer ${authToken1}`);

        // Get updated session
        const sessionResponse = await request(app)
          .get(`/api/sessions/${scheduledSession.id}`)
          .set('Authorization', `Bearer ${authToken1}`);

        inProgressSession = sessionResponse.body;
      } finally {
        Date.now = originalNow;
      }
    });

    it('should complete a session successfully', async () => {
      const initialTeacherBalance = (await storage.getUser(testUser1.id))!.creditBalance;
      const initialStudentBalance = (await storage.getUser(testUser2.id))!.creditBalance;

      const response = await request(app)
        .put(`/api/sessions/${inProgressSession.id}/complete`)
        .set('Authorization', `Bearer ${authToken1}`)
        .send({ notes: 'Great session!' })
        .expect(200);

      expect(response.body.status).toBe('completed');
      expect(response.body.notes).toBe('Great session!');

      // Check that credits were processed
      const updatedTeacher = await storage.getUser(testUser1.id);
      const updatedStudent = await storage.getUser(testUser2.id);

      expect(updatedTeacher!.creditBalance).toBeGreaterThan(initialTeacherBalance);
      expect(updatedStudent!.creditBalance).toBeGreaterThan(initialStudentBalance);
    });

    it('should reject completion by unauthorized user', async () => {
      const otherUser = await storage.createUser({
        username: 'other',
        email: 'other@test.com',
        password: await AuthService.hashPassword('password123'),
        fullName: 'Other User',
        creditBalance: 100
      });

      const otherToken = AuthService.generateAccessToken(otherUser);

      const response = await request(app)
        .put(`/api/sessions/${inProgressSession.id}/complete`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ notes: 'Great session!' })
        .expect(403);

      expect(response.body.code).toBe('UNAUTHORIZED_SESSION_ACCESS');
    });

    it('should validate notes length', async () => {
      const longNotes = 'a'.repeat(2001); // Exceeds 2000 character limit

      const response = await request(app)
        .put(`/api/sessions/${inProgressSession.id}/complete`)
        .set('Authorization', `Bearer ${authToken1}`)
        .send({ notes: longNotes })
        .expect(400);

      expect(response.body.code).toBe('NOTES_TOO_LONG');
    });

    it('should require authentication', async () => {
      await request(app)
        .put(`/api/sessions/${inProgressSession.id}/complete`)
        .send({ notes: 'Great session!' })
        .expect(401);
    });
  });

  describe('PUT /api/sessions/:id/cancel', () => {
    let scheduledSession: any;

    beforeEach(async () => {
      const startTime = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours from now
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

      const sessionData = {
        matchId: testMatch.id,
        teacherId: testUser1.id,
        studentId: testUser2.id,
        skillId: testSkill.id,
        scheduledStart: startTime.toISOString(),
        scheduledEnd: endTime.toISOString(),
        creditsAmount: 10
      };

      const response = await request(app)
        .post('/api/sessions/schedule')
        .set('Authorization', `Bearer ${authToken1}`)
        .send(sessionData);

      scheduledSession = response.body;
    });

    it('should cancel a session successfully', async () => {
      const initialBalance = (await storage.getUser(testUser2.id))!.creditBalance;

      const response = await request(app)
        .put(`/api/sessions/${scheduledSession.id}/cancel`)
        .set('Authorization', `Bearer ${authToken1}`)
        .send({ reason: 'Schedule conflict' })
        .expect(200);

      expect(response.body.message).toBe('Session cancelled successfully');

      // Check that refund was processed (full refund for 24+ hours notice)
      const updatedStudent = await storage.getUser(testUser2.id);
      expect(updatedStudent!.creditBalance).toBe(initialBalance + 10);
    });

    it('should require cancellation reason', async () => {
      const response = await request(app)
        .put(`/api/sessions/${scheduledSession.id}/cancel`)
        .set('Authorization', `Bearer ${authToken1}`)
        .send({})
        .expect(400);

      expect(response.body.code).toBe('MISSING_REASON');
    });

    it('should validate reason length', async () => {
      const longReason = 'a'.repeat(501); // Exceeds 500 character limit

      const response = await request(app)
        .put(`/api/sessions/${scheduledSession.id}/cancel`)
        .set('Authorization', `Bearer ${authToken1}`)
        .send({ reason: longReason })
        .expect(400);

      expect(response.body.code).toBe('REASON_TOO_LONG');
    });

    it('should reject cancellation by unauthorized user', async () => {
      const otherUser = await storage.createUser({
        username: 'other',
        email: 'other@test.com',
        password: await AuthService.hashPassword('password123'),
        fullName: 'Other User',
        creditBalance: 100
      });

      const otherToken = AuthService.generateAccessToken(otherUser);

      const response = await request(app)
        .put(`/api/sessions/${scheduledSession.id}/cancel`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ reason: 'Schedule conflict' })
        .expect(403);

      expect(response.body.code).toBe('UNAUTHORIZED_SESSION_ACCESS');
    });

    it('should require authentication', async () => {
      await request(app)
        .put(`/api/sessions/${scheduledSession.id}/cancel`)
        .send({ reason: 'Schedule conflict' })
        .expect(401);
    });
  });

  describe('GET /api/sessions/upcoming', () => {
    it('should return upcoming sessions for authenticated user', async () => {
      const futureTime1 = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const futureTime2 = new Date(Date.now() + 48 * 60 * 60 * 1000);

      // Create two upcoming sessions
      const sessionData1 = {
        matchId: testMatch.id,
        teacherId: testUser1.id,
        studentId: testUser2.id,
        skillId: testSkill.id,
        scheduledStart: futureTime1.toISOString(),
        scheduledEnd: new Date(futureTime1.getTime() + 60 * 60 * 1000).toISOString(),
        creditsAmount: 10
      };

      const sessionData2 = {
        matchId: testMatch.id,
        teacherId: testUser1.id,
        studentId: testUser2.id,
        skillId: testSkill.id,
        scheduledStart: futureTime2.toISOString(),
        scheduledEnd: new Date(futureTime2.getTime() + 60 * 60 * 1000).toISOString(),
        creditsAmount: 10
      };

      await request(app)
        .post('/api/sessions/schedule')
        .set('Authorization', `Bearer ${authToken1}`)
        .send(sessionData1);

      await request(app)
        .post('/api/sessions/schedule')
        .set('Authorization', `Bearer ${authToken1}`)
        .send(sessionData2);

      const response = await request(app)
        .get('/api/sessions/upcoming')
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].status).toBe('scheduled');
      expect(response.body[1].status).toBe('scheduled');
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/sessions/upcoming')
        .expect(401);
    });
  });

  describe('GET /api/sessions/history', () => {
    it('should return session history for authenticated user', async () => {
      // Create a completed session
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

      const response = await request(app)
        .get('/api/sessions/history')
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].status).toBe('completed');
    });

    it('should respect limit parameter', async () => {
      // Create multiple completed sessions
      for (let i = 0; i < 3; i++) {
        await storage.createSkillSession({
          matchId: testMatch.id,
          teacherId: testUser1.id,
          studentId: testUser2.id,
          skillId: testSkill.id,
          scheduledStart: new Date(Date.now() - (48 + i) * 60 * 60 * 1000),
          scheduledEnd: new Date(Date.now() - (47 + i) * 60 * 60 * 1000),
          creditsAmount: 10,
          status: 'completed'
        });
      }

      const response = await request(app)
        .get('/api/sessions/history?limit=2')
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body).toHaveLength(2);
    });

    it('should validate limit parameter', async () => {
      const response = await request(app)
        .get('/api/sessions/history?limit=invalid')
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(400);

      expect(response.body.code).toBe('INVALID_LIMIT');
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/sessions/history')
        .expect(401);
    });
  });

  describe('GET /api/sessions/:id', () => {
    let testSession: any;

    beforeEach(async () => {
      const startTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

      const sessionData = {
        matchId: testMatch.id,
        teacherId: testUser1.id,
        studentId: testUser2.id,
        skillId: testSkill.id,
        scheduledStart: startTime.toISOString(),
        scheduledEnd: endTime.toISOString(),
        creditsAmount: 10
      };

      const response = await request(app)
        .post('/api/sessions/schedule')
        .set('Authorization', `Bearer ${authToken1}`)
        .send(sessionData);

      testSession = response.body;
    });

    it('should return session details for participant', async () => {
      const response = await request(app)
        .get(`/api/sessions/${testSession.id}`)
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: testSession.id,
        teacherId: testUser1.id,
        studentId: testUser2.id,
        status: 'scheduled'
      });
    });

    it('should reject access by non-participant', async () => {
      const otherUser = await storage.createUser({
        username: 'other',
        email: 'other@test.com',
        password: await AuthService.hashPassword('password123'),
        fullName: 'Other User',
        creditBalance: 100
      });

      const otherToken = AuthService.generateAccessToken(otherUser);

      const response = await request(app)
        .get(`/api/sessions/${testSession.id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);

      expect(response.body.code).toBe('UNAUTHORIZED_SESSION_ACCESS');
    });

    it('should return 404 for non-existent session', async () => {
      const response = await request(app)
        .get('/api/sessions/nonexistent-id')
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(404);

      expect(response.body.code).toBe('SESSION_NOT_FOUND');
    });

    it('should require authentication', async () => {
      await request(app)
        .get(`/api/sessions/${testSession.id}`)
        .expect(401);
    });
  });
});