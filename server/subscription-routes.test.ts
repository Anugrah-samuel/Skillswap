import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { registerSubscriptionRoutes } from './subscription-routes';
import { storage } from './storage';
import { AuthService } from './auth';
import type { User } from '@shared/schema';

// Mock Stripe
vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      subscriptions: {
        create: vi.fn(),
        update: vi.fn(),
      },
    })),
  };
});

// Set up environment variables for testing
process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key';
process.env.STRIPE_PREMIUM_PRICE_ID = 'price_mock_premium';
process.env.JWT_SECRET = 'test_jwt_secret';

describe('Subscription Routes', () => {
  let app: any;
  let mockUser: User;
  let authToken: string;

  beforeEach(async () => {
    // Create mock user first
    mockUser = await storage.createUser({
      username: 'testuser',
      email: 'test@example.com',
      password: 'hashedpassword',
      fullName: 'Test User',
    });

    // Create test server
    app = express();
    app.use(express.json());
    
    // Mock the authenticateToken middleware to set req.user
    app.use((req: any, res, next) => {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        // For testing, we'll just set the user directly
        req.user = { userId: mockUser.id, username: mockUser.username };
      }
      next();
    });
    
    registerSubscriptionRoutes(app);

    // Generate auth token using JWT directly (simplified for testing)
    const jwt = await import('jsonwebtoken');
    authToken = jwt.sign(
      { userId: mockUser.id, username: mockUser.username },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' }
    );
  });

  describe('POST /api/subscriptions', () => {
    it('should create a basic subscription successfully', async () => {
      const response = await request(app)
        .post('/api/subscriptions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          planType: 'basic',
          paymentMethodId: 'pm_test_card',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.planType).toBe('basic');
      expect(response.body.status).toBe('active');
      expect(response.body.userId).toBe(mockUser.id);
    });

    it('should return 400 for invalid plan type', async () => {
      const response = await request(app)
        .post('/api/subscriptions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          planType: 'invalid',
          paymentMethodId: 'pm_test_card',
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('INVALID_PLAN_TYPE');
    });

    it('should return 409 if user already has active subscription', async () => {
      // Create first subscription
      await request(app)
        .post('/api/subscriptions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          planType: 'basic',
          paymentMethodId: 'pm_test_card',
        });

      // Try to create another
      const response = await request(app)
        .post('/api/subscriptions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          planType: 'premium',
          paymentMethodId: 'pm_test_card',
        });

      expect(response.status).toBe(409);
      expect(response.body.code).toBe('SUBSCRIPTION_EXISTS');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/subscriptions')
        .send({
          planType: 'basic',
          paymentMethodId: 'pm_test_card',
        });

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/subscriptions/cancel', () => {
    beforeEach(async () => {
      // Create a subscription to cancel
      await request(app)
        .post('/api/subscriptions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          planType: 'basic',
          paymentMethodId: 'pm_test_card',
        });
    });

    it('should cancel subscription successfully', async () => {
      const response = await request(app)
        .put('/api/subscriptions/cancel')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('cancelled');
    });

    it('should return 404 if no subscription found', async () => {
      // Cancel the existing subscription first
      await request(app)
        .put('/api/subscriptions/cancel')
        .set('Authorization', `Bearer ${authToken}`);

      // Try to cancel again
      const response = await request(app)
        .put('/api/subscriptions/cancel')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(409);
      expect(response.body.code).toBe('SUBSCRIPTION_ALREADY_CANCELLED');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .put('/api/subscriptions/cancel');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/subscriptions/status', () => {
    it('should return inactive status for user with no subscription', async () => {
      const response = await request(app)
        .get('/api/subscriptions/status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.isActive).toBe(false);
      expect(response.body.planType).toBe('basic');
      expect(response.body.status).toBe('none');
    });

    it('should return active status for user with active subscription', async () => {
      // Create subscription first
      await request(app)
        .post('/api/subscriptions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          planType: 'basic',
          paymentMethodId: 'pm_test_card',
        });

      const response = await request(app)
        .get('/api/subscriptions/status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.isActive).toBe(true);
      expect(response.body.planType).toBe('basic');
      expect(response.body.status).toBe('active');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/subscriptions/status');

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/subscriptions/plan', () => {
    beforeEach(async () => {
      // Create a basic subscription to update
      await request(app)
        .post('/api/subscriptions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          planType: 'basic',
          paymentMethodId: 'pm_test_card',
        });
    });

    it('should return 409 if user is already on the requested plan', async () => {
      const response = await request(app)
        .put('/api/subscriptions/plan')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          planType: 'basic',
        });

      expect(response.status).toBe(409);
      expect(response.body.code).toBe('ALREADY_ON_PLAN');
    });

    it('should return 400 for invalid plan type', async () => {
      const response = await request(app)
        .put('/api/subscriptions/plan')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          planType: 'invalid',
        });

      expect(response.status).toBe(400);
    });

    it('should cancel subscription when downgrading to basic', async () => {
      // First upgrade to premium (mock)
      await storage.createSubscription({
        userId: mockUser.id,
        planType: 'premium',
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        stripeSubscriptionId: 'sub_mock',
      });

      const response = await request(app)
        .put('/api/subscriptions/plan')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          planType: 'basic',
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('cancelled');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .put('/api/subscriptions/plan')
        .send({
          planType: 'premium',
        });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/subscriptions/webhook', () => {
    it('should process webhook successfully', async () => {
      const mockEvent = {
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_mock',
            status: 'active',
            current_period_start: Math.floor(Date.now() / 1000),
            current_period_end: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000),
          },
        },
      };

      const response = await request(app)
        .post('/api/subscriptions/webhook')
        .set('stripe-signature', 'test_signature')
        .send(mockEvent);

      expect(response.status).toBe(200);
      expect(response.body.received).toBe(true);
    });

    it('should return 400 without Stripe signature', async () => {
      const response = await request(app)
        .post('/api/subscriptions/webhook')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('MISSING_SIGNATURE');
    });
  });
});