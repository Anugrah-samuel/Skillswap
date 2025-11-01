import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { registerRoutes } from './routes';

// Set test environment variables
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key';

describe('User Preferences API', () => {
  let app: express.Express;
  let server: any;

  beforeEach(async () => {
    app = express();
    app.use(express.json());
    server = await registerRoutes(app);
  });

  const createTestUser = async (username: string) => {
    const signupResponse = await request(app)
      .post('/api/auth/signup')
      .send({
        username,
        email: `${username}@example.com`,
        password: 'testpassword123',
        fullName: 'Test User',
      });
    
    return signupResponse.body.accessToken;
  };

  describe('GET /api/preferences', () => {
    it('should return default preferences for new user', async () => {
      const accessToken = await createTestUser('prefsuser1');
      
      const response = await request(app)
        .get('/api/preferences')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('preferredCategories');
      expect(response.body).toHaveProperty('learningGoals');
      expect(response.body).toHaveProperty('availabilityHours');
      expect(response.body).toHaveProperty('maxSessionDuration');
      expect(response.body.maxSessionDuration).toBe(60);
      expect(Array.isArray(response.body.preferredCategories)).toBe(true);
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/preferences')
        .expect(401);
    });
  });

  describe('PUT /api/preferences', () => {
    it('should update user preferences', async () => {
      const accessToken = await createTestUser('prefsuser2');
      
      const preferences = {
        preferredCategories: ['programming', 'design'],
        learningGoals: ['Learn React', 'Improve UI skills'],
        availabilityHours: ['9:00-12:00', '14:00-17:00'],
        maxSessionDuration: 90,
        preferredTeachingStyle: 'hands-on',
      };

      const response = await request(app)
        .put('/api/preferences')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(preferences)
        .expect(200);

      expect(response.body.preferredCategories).toEqual(preferences.preferredCategories);
      expect(response.body.learningGoals).toEqual(preferences.learningGoals);
      expect(response.body.maxSessionDuration).toBe(preferences.maxSessionDuration);
      expect(response.body.preferredTeachingStyle).toBe(preferences.preferredTeachingStyle);
    });

    it('should validate session duration limits', async () => {
      const accessToken = await createTestUser('prefsuser3');
      
      const response = await request(app)
        .put('/api/preferences')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          maxSessionDuration: 300, // Too long
        })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should require authentication', async () => {
      await request(app)
        .put('/api/preferences')
        .send({
          maxSessionDuration: 60,
        })
        .expect(401);
    });
  });
});