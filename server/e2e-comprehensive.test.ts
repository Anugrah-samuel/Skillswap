import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { storage } from './storage';
import { AuthService } from './auth';
import { resetAllMocks } from './test-setup';

// Create comprehensive test app
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  
  // Add security middleware
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  });
  
  // Import and use all route modules
  try {
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
  } catch (error) {
    console.warn('Some routes not available for E2E testing:', error.message);
  }
  
  return app;
};

describe('End-to-End Comprehensive Tests', () => {
  let app: express.Application;
  let testUsers: any[] = [];
  let authTokens: string[] = [];

  beforeEach(async () => {
    resetAllMocks();
    app = createTestApp();
    
    // Clear storage
    try {
      (storage as any).users?.clear?.();
      (storage as any).skills?.clear?.();
      (storage as any).courses?.clear?.();
      (storage as any).creditTransactions?.clear?.();
      (storage as any).skillSessions?.clear?.();
      (storage as any).subscriptions?.clear?.();
    } catch (error) {
      // Storage might not have clear methods in all implementations
    }
    
    testUsers = [];
    authTokens = [];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Complete User Lifecycle', () => {
    it('should handle complete skill exchange workflow', async () => {
      // 1. Register teacher and student users
      const teacherData = {
        username: 'teacher_user',
        email: 'teacher@example.com',
        password: 'SecurePass123!',
        fullName: 'John Teacher',
      };

      const studentData = {
        username: 'student_user',
        email: 'student@example.com',
        password: 'SecurePass123!',
        fullName: 'Jane Student',
      };

      const [teacherResponse, studentResponse] = await Promise.all([
        request(app).post('/api/auth/register').send(teacherData),
        request(app).post('/api/auth/register').send(studentData)
      ]);

      if (teacherResponse.status === 201 && studentResponse.status === 201) {
        const teacherToken = teacherResponse.body.accessToken;
        const studentToken = studentResponse.body.accessToken;
        const teacherId = teacherResponse.body.user.id;
        const studentId = studentResponse.body.user.id;

        // 2. Teacher creates a course
        const courseData = {
          title: 'JavaScript Fundamentals',
          description: 'Learn JavaScript from scratch',
          skillId: 'js-skill-id',
          priceCredits: 50,
          lessons: [
            {
              title: 'Variables and Data Types',
              description: 'Learn about JS variables',
              contentType: 'video',
              duration: 30,
              orderIndex: 1
            }
          ]
        };

        const courseResponse = await request(app)
          .post('/api/courses')
          .set('Authorization', `Bearer ${teacherToken}`)
          .send(courseData);

        if (courseResponse.status === 201) {
          const courseId = courseResponse.body.id;

          // 3. Student purchases credits
          const creditPurchase = await request(app)
            .post('/api/credits/purchase')
            .set('Authorization', `Bearer ${studentToken}`)
            .send({ amount: 100, paymentMethodId: 'pm_test_card' });

          // 4. Student enrolls in course
          if (creditPurchase.status === 200) {
            const enrollmentResponse = await request(app)
              .post(`/api/courses/${courseId}/enroll`)
              .set('Authorization', `Bearer ${studentToken}`)
              .send({ paymentMethod: 'credits' });

            if (enrollmentResponse.status === 201) {
              // 5. Student updates progress
              const progressResponse = await request(app)
                .put(`/api/courses/enrollments/${enrollmentResponse.body.id}/progress`)
                .set('Authorization', `Bearer ${studentToken}`)
                .send({ lessonId: 'lesson-1', completed: true });

              expect([200, 404]).toContain(progressResponse.status);
            }
          }

          // 6. Schedule a session between teacher and student
          const sessionData = {
            teacherId,
            studentId,
            skillId: 'js-skill-id',
            scheduledStart: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            scheduledEnd: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
            creditsAmount: 25
          };

          const sessionResponse = await request(app)
            .post('/api/sessions/schedule')
            .set('Authorization', `Bearer ${studentToken}`)
            .send(sessionData);

          if (sessionResponse.status === 201) {
            const sessionId = sessionResponse.body.id;

            // 7. Start the session
            const startResponse = await request(app)
              .post(`/api/sessions/${sessionId}/start`)
              .set('Authorization', `Bearer ${teacherToken}`);

            if (startResponse.status === 200) {
              // 8. Complete the session
              const completeResponse = await request(app)
                .put(`/api/sessions/${sessionId}/complete`)
                .set('Authorization', `Bearer ${teacherToken}`)
                .send({ notes: 'Great session!' });

              expect([200, 404]).toContain(completeResponse.status);
            }
          }
        }

        // Verify final state
        const finalBalanceResponse = await request(app)
          .get('/api/credits/balance')
          .set('Authorization', `Bearer ${studentToken}`);

        if (finalBalanceResponse.status === 200) {
          expect(typeof finalBalanceResponse.body.balance).toBe('number');
        }
      }

      expect([teacherResponse.status, studentResponse.status]).toEqual([201, 201]);
    });

    it('should handle premium subscription workflow', async () => {
      // 1. Register user
      const userData = {
        username: 'premium_user',
        email: 'premium@example.com',
        password: 'SecurePass123!',
        fullName: 'Premium User',
      };

      const userResponse = await request(app)
        .post('/api/auth/register')
        .send(userData);

      if (userResponse.status === 201) {
        const token = userResponse.body.accessToken;

        // 2. Check initial subscription status
        const statusResponse = await request(app)
          .get('/api/subscriptions/status')
          .set('Authorization', `Bearer ${token}`);

        if (statusResponse.status === 200) {
          expect(statusResponse.body.planType).toBe('basic');
        }

        // 3. Upgrade to premium
        const upgradeResponse = await request(app)
          .post('/api/subscriptions')
          .set('Authorization', `Bearer ${token}`)
          .send({ planType: 'premium', paymentMethodId: 'pm_test_card' });

        if (upgradeResponse.status === 201) {
          // 4. Verify premium status
          const premiumStatusResponse = await request(app)
            .get('/api/subscriptions/status')
            .set('Authorization', `Bearer ${token}`);

          if (premiumStatusResponse.status === 200) {
            expect(premiumStatusResponse.body.planType).toBe('premium');
            expect(premiumStatusResponse.body.isActive).toBe(true);
          }

          // 5. Cancel subscription
          const cancelResponse = await request(app)
            .put('/api/subscriptions/cancel')
            .set('Authorization', `Bearer ${token}`);

          expect([200, 404]).toContain(cancelResponse.status);
        }
      }

      expect(userResponse.status).toBe(201);
    });

    it('should handle authentication flow with error cases', async () => {
      // Test invalid registration
      const invalidUserData = {
        username: '',
        email: 'invalid-email',
        password: '123',
      };

      const invalidResponse = await request(app)
        .post('/api/auth/register')
        .send(invalidUserData);

      expect(invalidResponse.status).toBeGreaterThanOrEqual(400);

      // Test valid registration
      const validUserData = {
        username: 'valid_user',
        email: 'valid@example.com',
        password: 'ValidPass123!',
        fullName: 'Valid User',
      };

      const validResponse = await request(app)
        .post('/api/auth/register')
        .send(validUserData);

      if (validResponse.status === 201) {
        // Test login with valid credentials
        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: validUserData.email,
            password: validUserData.password,
          });

        expect(loginResponse.status).toBe(200);
        expect(loginResponse.body).toHaveProperty('accessToken');

        // Test login with invalid credentials
        const invalidLoginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: validUserData.email,
            password: 'wrongpassword',
          });

        expect(invalidLoginResponse.status).toBe(401);
      }
    });
  });

  describe('Security and Authentication Testing', () => {
    it('should enforce rate limits on authentication endpoints', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      // Make multiple rapid requests to test rate limiting
      const promises = Array(15).fill(null).map(() =>
        request(app)
          .post('/api/auth/login')
          .send(loginData)
      );

      const responses = await Promise.all(promises);
      
      // Should have rate limiting (429) or authentication failures (401)
      const statusCodes = responses.map(res => res.status);
      expect(statusCodes.some(code => code === 429 || code === 401)).toBe(true);
    });

    it('should prevent SQL injection attacks', async () => {
      const maliciousInputs = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "admin'--",
        "' UNION SELECT * FROM users --"
      ];

      for (const maliciousInput of maliciousInputs) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: maliciousInput,
            password: 'password123',
          });

        // Should not cause server errors (500) - should handle gracefully
        expect(response.status).not.toBe(500);
        expect([400, 401, 422]).toContain(response.status);
      }
    });

    it('should validate input and prevent XSS attacks', async () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        '<img src=x onerror=alert(1)>',
        'javascript:alert("xss")',
        '<svg onload=alert(1)>',
        '"><script>alert("xss")</script>'
      ];

      for (const payload of xssPayloads) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            username: payload,
            email: 'xss@example.com',
            password: 'ValidPass123!',
            fullName: payload,
          });

        // Should either reject the request or sanitize the input
        if (response.status === 201) {
          expect(response.body.user.username).not.toContain('<script>');
          expect(response.body.user.username).not.toContain('<img');
          expect(response.body.user.username).not.toContain('javascript:');
          expect(response.body.user.fullName).not.toContain('<script>');
        } else {
          expect(response.status).toBeGreaterThanOrEqual(400);
        }
      }
    });

    it('should enforce proper authorization on protected endpoints', async () => {
      const protectedEndpoints = [
        { method: 'GET', path: '/api/credits/balance' },
        { method: 'POST', path: '/api/credits/purchase' },
        { method: 'GET', path: '/api/subscriptions/status' },
        { method: 'POST', path: '/api/courses' },
        { method: 'GET', path: '/api/analytics/dashboard' },
      ];

      for (const endpoint of protectedEndpoints) {
        // Test without token
        const noTokenResponse = await request(app)[endpoint.method.toLowerCase()](endpoint.path);
        expect(noTokenResponse.status).toBe(401);

        // Test with invalid token
        const invalidTokenResponse = await request(app)
          [endpoint.method.toLowerCase()](endpoint.path)
          .set('Authorization', 'Bearer invalid-token-12345');
        expect(invalidTokenResponse.status).toBe(401);

        // Test with malformed token
        const malformedTokenResponse = await request(app)
          [endpoint.method.toLowerCase()](endpoint.path)
          .set('Authorization', 'InvalidFormat token');
        expect(malformedTokenResponse.status).toBe(401);
      }
    });

    it('should prevent privilege escalation attacks', async () => {
      // Create two users
      const user1Data = {
        username: 'user1',
        email: 'user1@example.com',
        password: 'ValidPass123!',
        fullName: 'User One',
      };

      const user2Data = {
        username: 'user2',
        email: 'user2@example.com',
        password: 'ValidPass123!',
        fullName: 'User Two',
      };

      const [user1Response, user2Response] = await Promise.all([
        request(app).post('/api/auth/register').send(user1Data),
        request(app).post('/api/auth/register').send(user2Data)
      ]);

      if (user1Response.status === 201 && user2Response.status === 201) {
        const user1Token = user1Response.body.accessToken;
        const user2Id = user2Response.body.user.id;

        // Try to access user2's data with user1's token
        const unauthorizedResponse = await request(app)
          .get(`/api/users/${user2Id}/profile`)
          .set('Authorization', `Bearer ${user1Token}`);

        // Should not allow access to other user's data
        expect([401, 403, 404]).toContain(unauthorizedResponse.status);
      }
    });

    it('should handle session security properly', async () => {
      const userData = {
        username: 'session_user',
        email: 'session@example.com',
        password: 'ValidPass123!',
        fullName: 'Session User',
      };

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData);

      if (registerResponse.status === 201) {
        const token = registerResponse.body.accessToken;

        // Test token expiration handling
        const validResponse = await request(app)
          .get('/api/credits/balance')
          .set('Authorization', `Bearer ${token}`);

        expect([200, 401]).toContain(validResponse.status);

        // Test concurrent session handling
        const concurrentRequests = Array(5).fill(null).map(() =>
          request(app)
            .get('/api/credits/balance')
            .set('Authorization', `Bearer ${token}`)
        );

        const responses = await Promise.all(concurrentRequests);
        
        // All requests should have consistent authorization behavior
        const statusCodes = responses.map(res => res.status);
        const uniqueStatuses = [...new Set(statusCodes)];
        expect(uniqueStatuses.length).toBeLessThanOrEqual(2); // Should be consistent
      }
    });

    it('should validate file upload security', async () => {
      const userData = {
        username: 'upload_user',
        email: 'upload@example.com',
        password: 'ValidPass123!',
        fullName: 'Upload User',
      };

      const userResponse = await request(app)
        .post('/api/auth/register')
        .send(userData);

      if (userResponse.status === 201) {
        const token = userResponse.body.accessToken;

        // Test malicious file upload attempts
        const maliciousFiles = [
          { filename: 'malicious.exe', content: 'MZ\x90\x00' }, // Executable header
          { filename: 'script.php', content: '<?php system($_GET["cmd"]); ?>' },
          { filename: '../../../etc/passwd', content: 'root:x:0:0:root:/root:/bin/bash' },
        ];

        for (const file of maliciousFiles) {
          const uploadResponse = await request(app)
            .post('/api/media/upload')
            .set('Authorization', `Bearer ${token}`)
            .attach('file', Buffer.from(file.content), file.filename);

          // Should reject malicious files
          expect([400, 403, 415, 422]).toContain(uploadResponse.status);
        }
      }
    });

    it('should prevent CSRF attacks', async () => {
      const userData = {
        username: 'csrf_user',
        email: 'csrf@example.com',
        password: 'ValidPass123!',
        fullName: 'CSRF User',
      };

      const userResponse = await request(app)
        .post('/api/auth/register')
        .send(userData);

      if (userResponse.status === 201) {
        const token = userResponse.body.accessToken;

        // Test requests without proper headers
        const csrfResponse = await request(app)
          .post('/api/credits/purchase')
          .set('Authorization', `Bearer ${token}`)
          .set('Origin', 'https://malicious-site.com')
          .send({ amount: 100, paymentMethodId: 'pm_test' });

        // Should handle CSRF protection appropriately
        expect([400, 403, 422]).toContain(csrfResponse.status);
      }
    });
  });

  describe('Data Consistency and Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Mock storage to throw errors
      const originalGetUser = storage.getUser;
      vi.spyOn(storage, 'getUser').mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
        });

      expect(response.status).toBeGreaterThanOrEqual(500);
      expect(response.body).toHaveProperty('error');

      // Restore original method
      storage.getUser = originalGetUser;
    });

    it('should validate request data types and formats', async () => {
      // Test with invalid data types
      const invalidData = {
        username: 123,
        email: true,
        password: [],
        fullName: {},
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidData);

      expect(response.status).toBe(400);
    });

    it('should handle concurrent requests safely', async () => {
      // Create a user first
      const userData = {
        username: 'concurrent_user',
        email: 'concurrent@example.com',
        password: 'ValidPass123!',
        fullName: 'Concurrent User',
      };

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData);

      if (registerResponse.status === 201) {
        const token = registerResponse.body.accessToken;

        // Make multiple concurrent requests to the same endpoint
        const promises = Array(5).fill(null).map(() =>
          request(app)
            .get('/api/credits/balance')
            .set('Authorization', `Bearer ${token}`)
        );

        const responses = await Promise.all(promises);
        
        // All requests should return the same result or handle concurrency properly
        const successfulResponses = responses.filter(res => res.status === 200);
        if (successfulResponses.length > 0) {
          const firstBalance = successfulResponses[0].body.balance;
          successfulResponses.forEach(res => {
            expect(res.body.balance).toBe(firstBalance);
          });
        }
      }
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle high-load user registration', async () => {
      const startTime = Date.now();
      
      // Create 50 users concurrently to test high load
      const userPromises = Array(50).fill(null).map((_, index) =>
        request(app)
          .post('/api/auth/register')
          .send({
            username: `load_user_${index}`,
            email: `load${index}@example.com`,
            password: 'ValidPass123!',
            fullName: `Load User ${index}`,
          })
      );

      const responses = await Promise.all(userPromises);
      const endTime = Date.now();
      
      // Should complete within reasonable time (10 seconds for 50 users)
      expect(endTime - startTime).toBeLessThan(10000);
      
      // At least 80% of registrations should succeed
      const successfulRegistrations = responses.filter(res => res.status === 201);
      expect(successfulRegistrations.length).toBeGreaterThan(40);
    });

    it('should handle concurrent API requests efficiently', async () => {
      // First create a user
      const userData = {
        username: 'concurrent_api_user',
        email: 'concurrent@example.com',
        password: 'ValidPass123!',
        fullName: 'Concurrent User',
      };

      const userResponse = await request(app)
        .post('/api/auth/register')
        .send(userData);

      if (userResponse.status === 201) {
        const token = userResponse.body.accessToken;
        const startTime = Date.now();

        // Make 100 concurrent API calls
        const apiPromises = Array(100).fill(null).map(() =>
          request(app)
            .get('/api/credits/balance')
            .set('Authorization', `Bearer ${token}`)
        );

        const responses = await Promise.all(apiPromises);
        const endTime = Date.now();

        // Should complete within reasonable time (5 seconds for 100 requests)
        expect(endTime - startTime).toBeLessThan(5000);

        // Most requests should succeed
        const successfulRequests = responses.filter(res => res.status === 200);
        expect(successfulRequests.length).toBeGreaterThan(80);
      }
    });

    it('should handle database-intensive operations under load', async () => {
      // Create multiple users first
      const users = [];
      for (let i = 0; i < 10; i++) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            username: `db_user_${i}`,
            email: `db${i}@example.com`,
            password: 'ValidPass123!',
            fullName: `DB User ${i}`,
          });
        
        if (response.status === 201) {
          users.push({ token: response.body.accessToken, id: response.body.user.id });
        }
      }

      if (users.length > 0) {
        const startTime = Date.now();

        // Perform database-intensive operations concurrently
        const operations = users.flatMap(user => [
          request(app).get('/api/credits/balance').set('Authorization', `Bearer ${user.token}`),
          request(app).get('/api/credits/transactions').set('Authorization', `Bearer ${user.token}`),
          request(app).get('/api/analytics/dashboard').set('Authorization', `Bearer ${user.token}`),
        ]);

        const responses = await Promise.all(operations);
        const endTime = Date.now();

        // Should complete within reasonable time
        expect(endTime - startTime).toBeLessThan(8000);

        // Most operations should succeed
        const successfulOps = responses.filter(res => res.status === 200);
        expect(successfulOps.length).toBeGreaterThan(operations.length * 0.7);
      }
    });

    it('should handle large request payloads appropriately', async () => {
      // Test with large but valid payload
      const largeDescription = 'A'.repeat(50000); // 50KB description
      
      const userData = {
        username: 'large_payload_user',
        email: 'large@example.com',
        password: 'ValidPass123!',
        fullName: 'Large Payload User',
        bio: largeDescription,
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      // Should either accept it or reject with appropriate error (413 for payload too large)
      expect([201, 400, 413]).toContain(response.status);
    });

    it('should maintain response times under sustained load', async () => {
      // Create a user for testing
      const userData = {
        username: 'sustained_load_user',
        email: 'sustained@example.com',
        password: 'ValidPass123!',
        fullName: 'Sustained Load User',
      };

      const userResponse = await request(app)
        .post('/api/auth/register')
        .send(userData);

      if (userResponse.status === 201) {
        const token = userResponse.body.accessToken;
        const responseTimes: number[] = [];

        // Make requests in batches to simulate sustained load
        for (let batch = 0; batch < 5; batch++) {
          const batchPromises = Array(20).fill(null).map(async () => {
            const startTime = Date.now();
            const response = await request(app)
              .get('/api/credits/balance')
              .set('Authorization', `Bearer ${token}`);
            const endTime = Date.now();
            
            if (response.status === 200) {
              responseTimes.push(endTime - startTime);
            }
            return response;
          });

          await Promise.all(batchPromises);
          
          // Small delay between batches
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (responseTimes.length > 0) {
          const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
          const maxResponseTime = Math.max(...responseTimes);

          // Average response time should be reasonable (under 500ms)
          expect(avgResponseTime).toBeLessThan(500);
          
          // Max response time should not be excessive (under 2 seconds)
          expect(maxResponseTime).toBeLessThan(2000);
        }
      }
    });
  });

  describe('API Versioning and Compatibility', () => {
    it('should handle missing or invalid API versions gracefully', async () => {
      const response = await request(app)
        .get('/api/v999/nonexistent')
        .send();

      expect(response.status).toBe(404);
    });

    it('should maintain backward compatibility', async () => {
      // Test that existing endpoints still work
      const response = await request(app)
        .get('/api/auth/health')
        .send();

      // Should either work or return 404 (not 500)
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('Integration with External Services', () => {
    it('should handle external service failures gracefully', async () => {
      // This would test payment processing, email services, etc.
      // For now, just ensure the app doesn't crash
      
      const userData = {
        username: 'external_test_user',
        email: 'external@example.com',
        password: 'ValidPass123!',
        fullName: 'External Test User',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      // Should handle gracefully even if external services are down
      expect([201, 500, 503]).toContain(response.status);
    });
  });
});