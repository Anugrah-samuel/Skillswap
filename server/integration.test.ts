import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { storage } from './storage';
import { AuthService } from './auth';
import { resetAllMocks, createMockUser, mockStripe } from './test-setup';

// Create test app with all routes
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  
  // Import and use all route modules
  const authRoutes = require('./auth').router;
  const creditsRoutes = require('./credits-routes').default;
  const courseRoutes = require('./course-routes').default;
  const sessionRoutes = require('./session-routes').default;
  const subscriptionRoutes = require('./subscription-routes').default;
  const paymentRoutes = require('./payment-routes').default;
  const recommendationRoutes = require('./recommendations-routes').default;
  const analyticsRoutes = require('./analytics-routes').default;
  const mediaRoutes = require('./media-routes').default;
  const mobileRoutes = require('./mobile-routes').default;
  
  app.use('/api/auth', authRoutes);
  app.use('/api/credits', creditsRoutes);
  app.use('/api/courses', courseRoutes);
  app.use('/api/sessions', sessionRoutes);
  app.use('/api/subscriptions', subscriptionRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/recommendations', recommendationRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/media', mediaRoutes);
  app.use('/api/mobile', mobileRoutes);
  
  return app;
};

describe('API Integration Tests', () => {
  let app: express.Application;
  let testUser: any;
  let authToken: string;

  beforeEach(async () => {
    resetAllMocks();
    app = createTestApp();
    
    // Clear storage
    (storage as any).users.clear();
    (storage as any).skills.clear();
    (storage as any).courses.clear();
    (storage as any).creditTransactions.clear();
    (storage as any).skillSessions.clear();
    (storage as any).subscriptions.clear();
    
    // Create test user
    testUser = await storage.createUser({
      username: 'testuser',
      email: 'test@example.com',
      password: await AuthService.hashPassword('password123'),
      fullName: 'Test User',
      creditBalance: 100,
    });
    
    // Generate auth token
    authToken = AuthService.generateAccessToken(testUser);
  });

  describe('Authentication Flow', () => {
    it('should register a new user', async () => {
      const userData = {
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'password123',
        fullName: 'New User',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.user.email).toBe(userData.email);
    });

    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
        })
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.user.id).toBe(testUser.id);
    });

    it('should reject invalid credentials', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword',
        })
        .expect(401);
    });

    it('should protect authenticated routes', async () => {
      await request(app)
        .get('/api/credits/balance')
        .expect(401);

      await request(app)
        .get('/api/credits/balance')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
    });
  });

  describe('Credits System Integration', () => {
    it('should get user credit balance', async () => {
      const response = await request(app)
        .get('/api/credits/balance')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.balance).toBe(100);
    });

    it('should purchase credits with valid payment', async () => {
      // Mock Stripe payment success
      mockStripe.paymentIntents.create.mockResolvedValue({
        id: 'pi_test123',
        status: 'succeeded',
        amount: 5000, // $50.00
      });

      const response = await request(app)
        .post('/api/credits/purchase')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 100,
          paymentMethodId: 'pm_test123',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.transaction.amount).toBe(100);
      
      // Verify balance updated
      const balanceResponse = await request(app)
        .get('/api/credits/balance')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(balanceResponse.body.balance).toBe(200);
    });

    it('should get transaction history', async () => {
      // Create some transactions
      await storage.createCreditTransaction({
        userId: testUser.id,
        amount: 50,
        type: 'earned',
        description: 'Session completion',
      });

      const response = await request(app)
        .get('/api/credits/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.transactions).toHaveLength(1);
      expect(response.body.transactions[0].amount).toBe(50);
    });
  });

  describe('Course System Integration', () => {
    let testSkill: any;

    beforeEach(async () => {
      testSkill = await storage.createSkill({
        userId: testUser.id,
        title: 'JavaScript Programming',
        description: 'Learn JavaScript fundamentals',
        category: 'Programming',
        level: 'intermediate',
        type: 'teach',
      });
    });

    it('should create a new course', async () => {
      const courseData = {
        skillId: testSkill.id,
        title: 'JavaScript Fundamentals',
        description: 'Learn the basics of JavaScript',
        priceCredits: 50,
      };

      const response = await request(app)
        .post('/api/courses')
        .set('Authorization', `Bearer ${authToken}`)
        .send(courseData)
        .expect(201);

      expect(response.body.title).toBe(courseData.title);
      expect(response.body.creatorId).toBe(testUser.id);
      expect(response.body.status).toBe('draft');
    });

    it('should publish a course with lessons', async () => {
      // Create course
      const course = await storage.createCourse({
        creatorId: testUser.id,
        skillId: testSkill.id,
        title: 'Test Course',
        description: 'Test Description',
        priceCredits: 30,
      });

      // Add lesson
      await storage.createCourseLesson({
        courseId: course.id,
        title: 'Lesson 1',
        description: 'First lesson',
        contentType: 'video',
        orderIndex: 1,
      });

      const response = await request(app)
        .put(`/api/courses/${course.id}/publish`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('published');
    });

    it('should enroll in a course', async () => {
      // Create and publish course
      const course = await storage.createCourse({
        creatorId: testUser.id,
        skillId: testSkill.id,
        title: 'Test Course',
        description: 'Test Description',
        priceCredits: 30,
      });

      await storage.createCourseLesson({
        courseId: course.id,
        title: 'Lesson 1',
        description: 'First lesson',
        contentType: 'video',
        orderIndex: 1,
      });

      await storage.updateCourse(course.id, { status: 'published' });

      // Create another user to enroll
      const student = await storage.createUser({
        username: 'student',
        email: 'student@example.com',
        password: await AuthService.hashPassword('password123'),
        fullName: 'Student User',
        creditBalance: 100,
      });

      const studentToken = AuthService.generateAccessToken(student);

      const response = await request(app)
        .post(`/api/courses/${course.id}/enroll`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ paymentMethod: 'credits' })
        .expect(200);

      expect(response.body.courseId).toBe(course.id);
      expect(response.body.userId).toBe(student.id);
    });

    it('should search courses', async () => {
      // Create published course
      const course = await storage.createCourse({
        creatorId: testUser.id,
        skillId: testSkill.id,
        title: 'JavaScript Fundamentals',
        description: 'Learn JavaScript basics',
        priceCredits: 30,
        status: 'published',
      });

      const response = await request(app)
        .get('/api/courses/search?q=JavaScript')
        .expect(200);

      expect(response.body.courses).toHaveLength(1);
      expect(response.body.courses[0].title).toContain('JavaScript');
    });
  });

  describe('Session Management Integration', () => {
    let testTeacher: any;
    let testStudent: any;
    let testSkill: any;

    beforeEach(async () => {
      testTeacher = testUser;
      
      testStudent = await storage.createUser({
        username: 'student',
        email: 'student@example.com',
        password: await AuthService.hashPassword('password123'),
        fullName: 'Student User',
        creditBalance: 50,
      });

      testSkill = await storage.createSkill({
        userId: testTeacher.id,
        title: 'JavaScript Programming',
        description: 'Learn JavaScript fundamentals',
        category: 'Programming',
        level: 'intermediate',
        type: 'teach',
      });
    });

    it('should schedule a session', async () => {
      const sessionData = {
        teacherId: testTeacher.id,
        skillId: testSkill.id,
        scheduledStart: new Date(Date.now() + 3600000).toISOString(),
        scheduledEnd: new Date(Date.now() + 7200000).toISOString(),
        creditsAmount: 20,
      };

      const studentToken = AuthService.generateAccessToken(testStudent);

      const response = await request(app)
        .post('/api/sessions/schedule')
        .set('Authorization', `Bearer ${studentToken}`)
        .send(sessionData)
        .expect(201);

      expect(response.body.teacherId).toBe(testTeacher.id);
      expect(response.body.studentId).toBe(testStudent.id);
      expect(response.body.status).toBe('scheduled');
    });

    it('should get upcoming sessions', async () => {
      // Create a session
      await storage.createSkillSession({
        matchId: 'match-123',
        teacherId: testTeacher.id,
        studentId: testStudent.id,
        skillId: testSkill.id,
        scheduledStart: new Date(Date.now() + 3600000),
        scheduledEnd: new Date(Date.now() + 7200000),
        creditsAmount: 20,
      });

      const response = await request(app)
        .get('/api/sessions/upcoming')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.sessions).toHaveLength(1);
      expect(response.body.sessions[0].teacherId).toBe(testTeacher.id);
    });

    it('should complete a session and process credits', async () => {
      const session = await storage.createSkillSession({
        matchId: 'match-123',
        teacherId: testTeacher.id,
        studentId: testStudent.id,
        skillId: testSkill.id,
        scheduledStart: new Date(Date.now() - 3600000),
        scheduledEnd: new Date(Date.now() - 1800000),
        creditsAmount: 20,
        status: 'in_progress',
      });

      const response = await request(app)
        .put(`/api/sessions/${session.id}/complete`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ notes: 'Great session!' })
        .expect(200);

      expect(response.body.status).toBe('completed');
      
      // Verify credits were processed
      const teacherBalance = await request(app)
        .get('/api/credits/balance')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(teacherBalance.body.balance).toBe(120); // 100 + 20
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: '',
          email: 'invalid-email',
          password: '123',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should handle not found errors', async () => {
      await request(app)
        .get('/api/courses/nonexistent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should handle unauthorized access', async () => {
      await request(app)
        .post('/api/courses')
        .send({
          title: 'Test Course',
          description: 'Test Description',
        })
        .expect(401);
    });

    it('should handle server errors gracefully', async () => {
      // Mock storage to throw error
      vi.spyOn(storage, 'getUser').mockRejectedValue(new Error('Database error'));

      await request(app)
        .get('/api/credits/balance')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(500);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on sensitive endpoints', async () => {
      // Make multiple rapid requests to login endpoint
      const promises = Array(10).fill(null).map(() =>
        request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'wrongpassword',
          })
      );

      const responses = await Promise.all(promises);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Data Validation', () => {
    it('should validate input data types', async () => {
      await request(app)
        .post('/api/credits/purchase')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 'invalid',
          paymentMethodId: 123,
        })
        .expect(400);
    });

    it('should sanitize user input', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: '<script>alert("xss")</script>',
          email: 'test2@example.com',
          password: 'password123',
          fullName: 'Test User 2',
        })
        .expect(201);

      expect(response.body.user.username).not.toContain('<script>');
    });
  });
});