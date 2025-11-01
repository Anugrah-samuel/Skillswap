import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createServer } from 'http';
import express from 'express';
import { registerRoutes } from './routes';
import { storage } from './storage';
import { AuthService } from './auth';

describe('Mobile API Routes', () => {
  let app: express.Express;
  let server: any;
  let authToken: string;
  let testUser: any;

  beforeEach(async () => {
    app = express();
    app.use(express.json());
    server = await registerRoutes(app);

    // Create test user
    const hashedPassword = await AuthService.hashPassword('testpass123');
    testUser = await storage.createUser({
      username: 'mobileuser',
      email: 'mobile@test.com',
      password: hashedPassword,
      fullName: 'Mobile Test User',
      bio: 'Test user for mobile API',
      location: 'Test City',
      avatarUrl: null,
      creditBalance: 100,
      subscriptionStatus: 'premium'
    });

    // Generate auth token
    authToken = AuthService.generateAccessToken(testUser);

    // Create test skills
    await storage.createSkill({
      userId: testUser.id,
      name: 'JavaScript',
      category: 'Programming',
      level: 'intermediate',
      description: 'JavaScript programming language',
      isOffering: true,
      isLearning: false
    });

    await storage.createSkill({
      userId: testUser.id,
      name: 'React',
      category: 'Programming',
      level: 'advanced',
      description: 'React framework for building user interfaces',
      isOffering: false,
      isLearning: true
    });
  });

  describe('GET /api/mobile/dashboard', () => {
    it('should return mobile-optimized dashboard data', async () => {
      const response = await request(app)
        .get('/api/mobile/dashboard')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Mobile-App', 'true')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('stats');
      expect(response.body.data).toHaveProperty('recentActivity');
      expect(response.body.data.user.id).toBe(testUser.id);
      expect(response.body.data.stats.totalSkills).toBe(2);
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/mobile/dashboard')
        .set('X-Mobile-App', 'true')
        .expect(401);
    });
  });

  describe('GET /api/mobile/skills', () => {
    it('should return paginated skills', async () => {
      const response = await request(app)
        .get('/api/mobile/skills?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Mobile-App', 'true')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination).toHaveProperty('page', 1);
      expect(response.body.pagination).toHaveProperty('limit', 10);
      expect(response.body.pagination).toHaveProperty('total', 2);
    });

    it('should handle pagination parameters', async () => {
      const response = await request(app)
        .get('/api/mobile/skills?page=2&limit=1')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Mobile-App', 'true')
        .expect(200);

      expect(response.body.pagination.page).toBe(2);
      expect(response.body.pagination.limit).toBe(1);
      expect(response.body.data).toHaveLength(1);
    });

    it('should validate pagination parameters', async () => {
      await request(app)
        .get('/api/mobile/skills?page=0&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Mobile-App', 'true')
        .expect(400);

      await request(app)
        .get('/api/mobile/skills?page=1&limit=200')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Mobile-App', 'true')
        .expect(400);
    });
  });

  describe('GET /api/mobile/search', () => {
    it('should search skills', async () => {
      const response = await request(app)
        .get('/api/mobile/search?q=JavaScript&type=skills')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Mobile-App', 'true')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.query).toBe('JavaScript');
      expect(response.body.type).toBe('skills');
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should require query and type parameters', async () => {
      await request(app)
        .get('/api/mobile/search')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Mobile-App', 'true')
        .expect(400);

      await request(app)
        .get('/api/mobile/search?q=test')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Mobile-App', 'true')
        .expect(400);
    });

    it('should validate search type', async () => {
      await request(app)
        .get('/api/mobile/search?q=test&type=invalid')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Mobile-App', 'true')
        .expect(400);
    });
  });

  describe('POST /api/mobile/sync', () => {
    it('should sync data for offline support', async () => {
      const lastSync = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // 24 hours ago
      
      const response = await request(app)
        .post('/api/mobile/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Mobile-App', 'true')
        .send({
          lastSync,
          entities: ['users', 'skills'],
          clientId: 'test-client-123'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('lastSync');
      expect(response.body.data).toHaveProperty('users');
      expect(response.body.data).toHaveProperty('skills');
    });

    it('should validate sync request data', async () => {
      await request(app)
        .post('/api/mobile/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Mobile-App', 'true')
        .send({
          lastSync: 'invalid-date',
          entities: ['users'],
          clientId: 'test-client'
        })
        .expect(400);
    });
  });

  describe('POST /api/mobile/device-tokens', () => {
    it('should register device token', async () => {
      const response = await request(app)
        .post('/api/mobile/device-tokens')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Mobile-App', 'true')
        .send({
          token: 'test-device-token-123',
          platform: 'ios',
          deviceId: 'test-device-id',
          appVersion: '1.0.0'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('token', 'test-device-token-123');
      expect(response.body.data).toHaveProperty('platform', 'ios');
    });

    it('should validate device token data', async () => {
      await request(app)
        .post('/api/mobile/device-tokens')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Mobile-App', 'true')
        .send({
          token: '',
          platform: 'invalid'
        })
        .expect(400);
    });
  });

  describe('GET /api/mobile/device-tokens', () => {
    beforeEach(async () => {
      // Register a test device token
      await storage.addPushToken({
        userId: testUser.id,
        token: 'test-token-123',
        platform: 'ios',
        isActive: true,
        createdAt: new Date()
      });
    });

    it('should get user device tokens', async () => {
      const response = await request(app)
        .get('/api/mobile/device-tokens')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Mobile-App', 'true')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toHaveProperty('token', 'test-token-123');
    });
  });

  describe('POST /api/mobile/test-notification', () => {
    it('should send test notification', async () => {
      const response = await request(app)
        .post('/api/mobile/test-notification')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Mobile-App', 'true')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Test notification sent');
    });
  });

  describe('GET /api/mobile/profile', () => {
    it('should return mobile-optimized profile', async () => {
      const response = await request(app)
        .get('/api/mobile/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Mobile-App', 'true')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id', testUser.id);
      expect(response.body.data).toHaveProperty('username', testUser.username);
      expect(response.body.data).toHaveProperty('creditBalance');
      expect(response.body.data).not.toHaveProperty('password');
    });
  });

  describe('GET /api/mobile/version', () => {
    it('should return API version information', async () => {
      const response = await request(app)
        .get('/api/mobile/version')
        .set('X-Mobile-App', 'true')
        .expect(200);

      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('supportedVersions');
      expect(response.body).toHaveProperty('features');
      expect(response.body.features).toHaveProperty('pagination', true);
      expect(response.body.features).toHaveProperty('pushNotifications', true);
    });
  });

  describe('GET /api/mobile/health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/mobile/health')
        .set('X-Mobile-App', 'true')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('services');
      expect(response.body.services).toHaveProperty('pushNotifications', true);
    });
  });

  describe('API Versioning', () => {
    it('should handle API version header', async () => {
      const response = await request(app)
        .get('/api/mobile/version')
        .set('API-Version', 'v1')
        .set('X-Mobile-App', 'true')
        .expect(200);

      expect(response.headers['api-version']).toBe('v1');
      expect(response.body.version).toBe('v1');
    });

    it('should validate API version format', async () => {
      await request(app)
        .get('/api/mobile/version')
        .set('API-Version', 'invalid')
        .set('X-Mobile-App', 'true')
        .expect(400);
    });
  });

  describe('Mobile Response Optimization', () => {
    it('should optimize responses for mobile', async () => {
      const response = await request(app)
        .get('/api/mobile/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .set('User-Agent', 'Mobile App iOS')
        .expect(200);

      // Mobile responses should exclude null/undefined values
      expect(response.body.data).not.toHaveProperty('avatarUrl');
    });
  });
});