import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { storage } from './storage';
import { AuthService } from './auth';
import { resetAllMocks, mockStripe, mockS3Client } from './test-setup';

// Create full application instance
const createApp = () => {
  const app = express();
  app.use(express.json());
  
  // Add all middleware and routes
  const authRoutes = require('./auth').router;
  const creditsRoutes = require('./credits-routes').default;
  const courseRoutes = require('./course-routes').default;
  const sessionRoutes = require('./session-routes').default;
  const subscriptionRoutes = require('./subscription-routes').default;
  const paymentRoutes = require('./payment-routes').default;
  const recommendationRoutes = require('./recommendations-routes').default;
  const analyticsRoutes = require('./analytics-routes').default;
  
  app.use('/api/auth', authRoutes);
  app.use('/api/credits', creditsRoutes);
  app.use('/api/courses', courseRoutes);
  app.use('/api/sessions', sessionRoutes);
  app.use('/api/subscriptions', subscriptionRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/recommendations', recommendationRoutes);
  app.use('/api/analytics', analyticsRoutes);
  
  return app;
};

describe('End-to-End User Workflows', () => {
  let app: express.Application;
  let teacher: any;
  let student: any;
  let teacherToken: string;
  let studentToken: string;

  beforeEach(async () => {
    resetAllMocks();
    app = createApp();
    
    // Clear all storage
    (storage as any).users.clear();
    (storage as any).skills.clear();
    (storage as any).courses.clear();
    (storage as any).courseLessons.clear();
    (storage as any).courseEnrollments.clear();
    (storage as any).skillSessions.clear();
    (storage as any).creditTransactions.clear();
    (storage as any).subscriptions.clear();
    (storage as any).paymentMethods.clear();
    (storage as any).notifications.clear();
    (storage as any).recommendationHistory.clear();
    
    // Mock external services
    mockStripe.customers.create.mockResolvedValue({ id: 'cus_test123' });
    mockStripe.paymentMethods.retrieve.mockResolvedValue({
      id: 'pm_test123',
      type: 'card',
      card: { last4: '4242', brand: 'visa' },
    });
    mockStripe.paymentIntents.create.mockResolvedValue({
      id: 'pi_test123',
      status: 'succeeded',
      amount: 5000,
    });
    mockS3Client.send.mockResolvedValue({ Location: 'https://s3.example.com/file.jpg' });
  });

  describe('Complete User Journey: Registration to Course Completion', () => {
    it('should handle complete user lifecycle', async () => {
      // 1. Teacher Registration
      const teacherData = {
        username: 'teacher_john',
        email: 'john@example.com',
        password: 'password123',
        fullName: 'John Teacher',
      };

      const teacherRegResponse = await request(app)
        .post('/api/auth/register')
        .send(teacherData)
        .expect(201);

      teacher = teacherRegResponse.body.user;
      teacherToken = teacherRegResponse.body.accessToken;

      // 2. Student Registration
      const studentData = {
        username: 'student_jane',
        email: 'jane@example.com',
        password: 'password123',
        fullName: 'Jane Student',
      };

      const studentRegResponse = await request(app)
        .post('/api/auth/register')
        .send(studentData)
        .expect(201);

      student = studentRegResponse.body.user;
      studentToken = studentRegResponse.body.accessToken;

      // 3. Teacher creates a skill
      const skillResponse = await request(app)
        .post('/api/skills')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'JavaScript Programming',
          description: 'Learn JavaScript fundamentals',
          category: 'Programming',
          level: 'intermediate',
          type: 'teach',
        })
        .expect(201);

      const skill = skillResponse.body;

      // 4. Teacher creates a course
      const courseResponse = await request(app)
        .post('/api/courses')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          skillId: skill.id,
          title: 'JavaScript Fundamentals',
          description: 'Complete JavaScript course for beginners',
          priceCredits: 50,
        })
        .expect(201);

      const course = courseResponse.body;

      // 5. Teacher adds lessons to course
      const lessonResponse = await request(app)
        .post(`/api/courses/${course.id}/lessons`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Introduction to JavaScript',
          description: 'Basic concepts and syntax',
          contentType: 'video',
          contentUrl: 'https://example.com/video1',
          duration: 30,
          orderIndex: 1,
        })
        .expect(201);

      // 6. Teacher publishes course
      await request(app)
        .put(`/api/courses/${course.id}/publish`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      // 7. Student purchases credits
      await request(app)
        .post('/api/credits/purchase')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          amount: 100,
          paymentMethodId: 'pm_test123',
        })
        .expect(200);

      // 8. Student enrolls in course
      const enrollmentResponse = await request(app)
        .post(`/api/courses/${course.id}/enroll`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ paymentMethod: 'credits' })
        .expect(200);

      const enrollment = enrollmentResponse.body;

      // 9. Student progresses through lesson
      await request(app)
        .put(`/api/courses/enrollments/${enrollment.id}/progress`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ lessonId: lessonResponse.body.id })
        .expect(200);

      // 10. Verify course completion
      const completedEnrollment = await request(app)
        .get(`/api/courses/enrollments/${enrollment.id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(completedEnrollment.body.progress).toBe(100);

      // 11. Generate certificate
      const certificateResponse = await request(app)
        .post(`/api/courses/enrollments/${enrollment.id}/certificate`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(certificateResponse.body.certificateUrl).toBeDefined();

      // 12. Check analytics
      const analyticsResponse = await request(app)
        .get('/api/analytics/dashboard')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(analyticsResponse.body.skillsCount).toBeGreaterThan(0);
    });
  });

  describe('Session Booking and Completion Workflow', () => {
    beforeEach(async () => {
      // Set up teacher and student
      teacher = await storage.createUser({
        username: 'teacher',
        email: 'teacher@example.com',
        password: await AuthService.hashPassword('password123'),
        fullName: 'Teacher User',
        creditBalance: 0,
      });

      student = await storage.createUser({
        username: 'student',
        email: 'student@example.com',
        password: await AuthService.hashPassword('password123'),
        fullName: 'Student User',
        creditBalance: 100,
      });

      teacherToken = AuthService.generateAccessToken(teacher);
      studentToken = AuthService.generateAccessToken(student);

      // Create skill
      await storage.createSkill({
        userId: teacher.id,
        title: 'JavaScript Programming',
        description: 'Learn JavaScript fundamentals',
        category: 'Programming',
        level: 'intermediate',
        type: 'teach',
      });
    });

    it('should handle complete session workflow', async () => {
      // 1. Student searches for teachers
      const searchResponse = await request(app)
        .get('/api/users/search?skill=JavaScript&type=teach')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(searchResponse.body.users).toHaveLength(1);

      // 2. Student books session
      const sessionData = {
        teacherId: teacher.id,
        skillId: searchResponse.body.users[0].skills[0].id,
        scheduledStart: new Date(Date.now() + 3600000).toISOString(),
        scheduledEnd: new Date(Date.now() + 7200000).toISOString(),
        creditsAmount: 20,
      };

      const sessionResponse = await request(app)
        .post('/api/sessions/schedule')
        .set('Authorization', `Bearer ${studentToken}`)
        .send(sessionData)
        .expect(201);

      const session = sessionResponse.body;

      // 3. Teacher starts session
      const startResponse = await request(app)
        .post(`/api/sessions/${session.id}/start`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(startResponse.body.videoRoomId).toBeDefined();

      // 4. Teacher completes session
      await request(app)
        .put(`/api/sessions/${session.id}/complete`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ notes: 'Great session, student learned well!' })
        .expect(200);

      // 5. Verify credit transfer
      const teacherBalance = await request(app)
        .get('/api/credits/balance')
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      const studentBalance = await request(app)
        .get('/api/credits/balance')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(teacherBalance.body.balance).toBe(20);
      expect(studentBalance.body.balance).toBe(84); // 100 - 20 + 4 (participation credits)

      // 6. Student leaves review
      await request(app)
        .post(`/api/sessions/${session.id}/review`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          rating: 5,
          comment: 'Excellent teacher, very helpful!',
        })
        .expect(201);

      // 7. Check updated teacher rating
      const teacherProfile = await request(app)
        .get(`/api/users/${teacher.id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(teacherProfile.body.rating).toBe(5);
      expect(teacherProfile.body.totalReviews).toBe(1);
    });
  });

  describe('Premium Subscription Workflow', () => {
    beforeEach(async () => {
      student = await storage.createUser({
        username: 'student',
        email: 'student@example.com',
        password: await AuthService.hashPassword('password123'),
        fullName: 'Student User',
        creditBalance: 50,
      });

      studentToken = AuthService.generateAccessToken(student);
    });

    it('should handle subscription lifecycle', async () => {
      // 1. Add payment method
      await request(app)
        .post('/api/payments/methods')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ stripePaymentMethodId: 'pm_test123' })
        .expect(201);

      // 2. Subscribe to premium
      mockStripe.subscriptions = {
        create: vi.fn().mockResolvedValue({
          id: 'sub_test123',
          status: 'active',
          current_period_start: Math.floor(Date.now() / 1000),
          current_period_end: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000),
        }),
      };

      const subscriptionResponse = await request(app)
        .post('/api/subscriptions')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          planType: 'premium',
          paymentMethodId: 'pm_test123',
        })
        .expect(201);

      expect(subscriptionResponse.body.planType).toBe('premium');
      expect(subscriptionResponse.body.status).toBe('active');

      // 3. Verify premium features access
      const statusResponse = await request(app)
        .get('/api/subscriptions/status')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(statusResponse.body.isActive).toBe(true);
      expect(statusResponse.body.planType).toBe('premium');

      // 4. Cancel subscription
      mockStripe.subscriptions.update = vi.fn().mockResolvedValue({
        id: 'sub_test123',
        status: 'canceled',
      });

      await request(app)
        .put('/api/subscriptions/cancel')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      // 5. Verify cancellation
      const canceledStatus = await request(app)
        .get('/api/subscriptions/status')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(canceledStatus.body.status).toBe('cancelled');
    });
  });

  describe('Recommendation System Workflow', () => {
    beforeEach(async () => {
      student = await storage.createUser({
        username: 'student',
        email: 'student@example.com',
        password: await AuthService.hashPassword('password123'),
        fullName: 'Student User',
      });

      studentToken = AuthService.generateAccessToken(student);

      // Create some skills for recommendations
      await storage.createSkill({
        userId: 'other-user',
        title: 'JavaScript Programming',
        description: 'Learn JavaScript fundamentals',
        category: 'Programming',
        level: 'intermediate',
        type: 'teach',
      });

      await storage.createSkill({
        userId: 'other-user',
        title: 'React Development',
        description: 'Build React applications',
        category: 'Programming',
        level: 'advanced',
        type: 'teach',
      });
    });

    it('should provide personalized recommendations', async () => {
      // 1. Get initial skill recommendations
      const skillRecsResponse = await request(app)
        .get('/api/recommendations/skills')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(skillRecsResponse.body.data).toHaveLength(2);

      // 2. Record interaction with recommendation
      await request(app)
        .post('/api/recommendations/feedback')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          recommendationType: 'skill',
          recommendedId: skillRecsResponse.body.data[0].skill.id,
          interactionType: 'click',
        })
        .expect(200);

      // 3. Update user preferences
      await request(app)
        .put('/api/recommendations/preferences')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          preferredCategories: ['Programming'],
          learningGoals: ['career advancement'],
          maxSessionDuration: 60,
        })
        .expect(200);

      // 4. Get updated recommendations
      const updatedRecsResponse = await request(app)
        .get('/api/recommendations/skills')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      // Should prioritize Programming skills
      expect(updatedRecsResponse.body.data[0].skill.category).toBe('Programming');

      // 5. Get recommendation history
      const historyResponse = await request(app)
        .get('/api/recommendations/history')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(historyResponse.body.data).toHaveLength(1);
      expect(historyResponse.body.data[0].clicked).toBe(true);

      // 6. Get recommendation analytics
      const analyticsResponse = await request(app)
        .get('/api/recommendations/analytics')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(analyticsResponse.body.data.totalRecommendations).toBe(1);
      expect(analyticsResponse.body.data.clickThroughRate).toBe(100);
    });
  });

  describe('Error Recovery and Edge Cases', () => {
    it('should handle payment failures gracefully', async () => {
      student = await storage.createUser({
        username: 'student',
        email: 'student@example.com',
        password: await AuthService.hashPassword('password123'),
        fullName: 'Student User',
      });

      studentToken = AuthService.generateAccessToken(student);

      // Mock payment failure
      mockStripe.paymentIntents.create.mockRejectedValue(
        new Error('Your card was declined')
      );

      const response = await request(app)
        .post('/api/credits/purchase')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          amount: 100,
          paymentMethodId: 'pm_test123',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('declined');

      // Verify no credits were added
      const balanceResponse = await request(app)
        .get('/api/credits/balance')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(balanceResponse.body.balance).toBe(0);
    });

    it('should handle concurrent session bookings', async () => {
      // Set up teacher and two students
      teacher = await storage.createUser({
        username: 'teacher',
        email: 'teacher@example.com',
        password: await AuthService.hashPassword('password123'),
        fullName: 'Teacher User',
      });

      const student1 = await storage.createUser({
        username: 'student1',
        email: 'student1@example.com',
        password: await AuthService.hashPassword('password123'),
        fullName: 'Student 1',
        creditBalance: 100,
      });

      const student2 = await storage.createUser({
        username: 'student2',
        email: 'student2@example.com',
        password: await AuthService.hashPassword('password123'),
        fullName: 'Student 2',
        creditBalance: 100,
      });

      const skill = await storage.createSkill({
        userId: teacher.id,
        title: 'JavaScript Programming',
        description: 'Learn JavaScript fundamentals',
        category: 'Programming',
        level: 'intermediate',
        type: 'teach',
      });

      const student1Token = AuthService.generateAccessToken(student1);
      const student2Token = AuthService.generateAccessToken(student2);

      const sessionData = {
        teacherId: teacher.id,
        skillId: skill.id,
        scheduledStart: new Date(Date.now() + 3600000).toISOString(),
        scheduledEnd: new Date(Date.now() + 7200000).toISOString(),
        creditsAmount: 20,
      };

      // Both students try to book the same time slot
      const [response1, response2] = await Promise.all([
        request(app)
          .post('/api/sessions/schedule')
          .set('Authorization', `Bearer ${student1Token}`)
          .send(sessionData),
        request(app)
          .post('/api/sessions/schedule')
          .set('Authorization', `Bearer ${student2Token}`)
          .send(sessionData),
      ]);

      // One should succeed, one should fail
      const responses = [response1, response2];
      const successCount = responses.filter(r => r.status === 201).length;
      const conflictCount = responses.filter(r => r.status === 409).length;

      expect(successCount).toBe(1);
      expect(conflictCount).toBe(1);
    });

    it('should handle system overload gracefully', async () => {
      student = await storage.createUser({
        username: 'student',
        email: 'student@example.com',
        password: await AuthService.hashPassword('password123'),
        fullName: 'Student User',
      });

      studentToken = AuthService.generateAccessToken(student);

      // Simulate many concurrent requests
      const requests = Array(50).fill(null).map(() =>
        request(app)
          .get('/api/analytics/dashboard')
          .set('Authorization', `Bearer ${studentToken}`)
      );

      const responses = await Promise.all(requests);

      // Most requests should succeed, some might be rate limited
      const successCount = responses.filter(r => r.status === 200).length;
      const rateLimitedCount = responses.filter(r => r.status === 429).length;

      expect(successCount + rateLimitedCount).toBe(50);
      expect(successCount).toBeGreaterThan(40); // At least 80% should succeed
    });
  });

  describe('Data Consistency and Integrity', () => {
    it('should maintain data consistency across operations', async () => {
      // Set up users
      teacher = await storage.createUser({
        username: 'teacher',
        email: 'teacher@example.com',
        password: await AuthService.hashPassword('password123'),
        fullName: 'Teacher User',
        creditBalance: 0,
      });

      student = await storage.createUser({
        username: 'student',
        email: 'student@example.com',
        password: await AuthService.hashPassword('password123'),
        fullName: 'Student User',
        creditBalance: 100,
      });

      teacherToken = AuthService.generateAccessToken(teacher);
      studentToken = AuthService.generateAccessToken(student);

      // Create and complete session
      const skill = await storage.createSkill({
        userId: teacher.id,
        title: 'JavaScript Programming',
        description: 'Learn JavaScript fundamentals',
        category: 'Programming',
        level: 'intermediate',
        type: 'teach',
      });

      const session = await storage.createSkillSession({
        matchId: 'match-123',
        teacherId: teacher.id,
        studentId: student.id,
        skillId: skill.id,
        scheduledStart: new Date(Date.now() - 3600000),
        scheduledEnd: new Date(Date.now() - 1800000),
        creditsAmount: 20,
        status: 'in_progress',
      });

      // Complete session
      await request(app)
        .put(`/api/sessions/${session.id}/complete`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      // Verify all related data is updated consistently
      const teacherData = await storage.getUser(teacher.id);
      const studentData = await storage.getUser(student.id);
      const sessionData = await storage.getSkillSession(session.id);
      const transactions = await storage.getCreditTransactionsByUser(teacher.id);

      expect(teacherData?.creditBalance).toBe(20);
      expect(teacherData?.totalSessionsTaught).toBe(1);
      expect(studentData?.creditBalance).toBe(84); // 100 - 20 + 4
      expect(studentData?.totalSessionsCompleted).toBe(1);
      expect(sessionData?.status).toBe('completed');
      expect(transactions).toHaveLength(1);
      expect(transactions[0].amount).toBe(20);
    });
  });
});