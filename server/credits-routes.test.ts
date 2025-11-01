import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express, { type Express } from 'express';
import { registerRoutes } from './routes';
import { storage } from './storage';
import { AuthService } from './auth';
import type { User } from '@shared/schema';

describe('Credits API Routes', () => {
  let app: Express;
  let testUser: User;
  let authToken: string;

  beforeEach(async () => {
    // Create Express app similar to index.ts
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));
    
    // Register routes
    await registerRoutes(app);
    
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

  describe('GET /api/credits/balance', () => {
    it('should return user credit balance', async () => {
      const response = await request(app)
        .get('/api/credits/balance')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toEqual({
        balance: 100,
      });
    });

    it('should return 401 for unauthenticated request', async () => {
      const response = await request(app)
        .get('/api/credits/balance')
        .expect(401);

      expect(response.body.code).toBe('MISSING_TOKEN');
    });
  });

  describe('POST /api/credits/purchase', () => {
    it('should purchase credits successfully', async () => {
      const purchaseData = {
        amount: 50,
        paymentMethodId: 'payment_method_123',
      };

      const response = await request(app)
        .post('/api/credits/purchase')
        .set('Authorization', `Bearer ${authToken}`)
        .send(purchaseData)
        .expect(201);

      expect(response.body).toHaveProperty('transaction');
      expect(response.body).toHaveProperty('newBalance');
      expect(response.body.transaction.amount).toBe(50);
      expect(response.body.transaction.type).toBe('purchased');
      expect(response.body.newBalance).toBe(150); // 100 + 50
    });

    it('should return 400 for invalid amount', async () => {
      const purchaseData = {
        amount: -10,
        paymentMethodId: 'payment_method_123',
      };

      const response = await request(app)
        .post('/api/credits/purchase')
        .set('Authorization', `Bearer ${authToken}`)
        .send(purchaseData)
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for missing payment method', async () => {
      const purchaseData = {
        amount: 50,
      };

      const response = await request(app)
        .post('/api/credits/purchase')
        .set('Authorization', `Bearer ${authToken}`)
        .send(purchaseData)
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for payment failure', async () => {
      const purchaseData = {
        amount: 50,
        paymentMethodId: 'fail', // This triggers payment failure in our mock
      };

      const response = await request(app)
        .post('/api/credits/purchase')
        .set('Authorization', `Bearer ${authToken}`)
        .send(purchaseData)
        .expect(400);

      expect(response.body.code).toBe('PAYMENT_FAILED');
    });

    it('should return 401 for unauthenticated request', async () => {
      const purchaseData = {
        amount: 50,
        paymentMethodId: 'payment_method_123',
      };

      const response = await request(app)
        .post('/api/credits/purchase')
        .send(purchaseData)
        .expect(401);

      expect(response.body.code).toBe('MISSING_TOKEN');
    });
  });

  describe('GET /api/credits/transactions', () => {
    beforeEach(async () => {
      // Create some test transactions with delays to ensure proper ordering
      await storage.createCreditTransaction({
        userId: testUser.id,
        amount: 25,
        type: 'earned',
        description: 'Test earning',
      });
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await storage.createCreditTransaction({
        userId: testUser.id,
        amount: -10,
        type: 'spent',
        description: 'Test spending',
      });
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await storage.createCreditTransaction({
        userId: testUser.id,
        amount: 50,
        type: 'purchased',
        description: 'Test purchase',
      });
    });

    it('should return transaction history', async () => {
      const response = await request(app)
        .get('/api/credits/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('transactions');
      expect(response.body.transactions).toHaveLength(3);
      expect(response.body.transactions[0].type).toBe('purchased'); // Most recent first
    });

    it('should limit transaction history when limit is specified', async () => {
      const response = await request(app)
        .get('/api/credits/transactions?limit=2')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.transactions).toHaveLength(2);
    });

    it('should return 400 for invalid limit', async () => {
      const response = await request(app)
        .get('/api/credits/transactions?limit=invalid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.code).toBe('INVALID_LIMIT');
    });

    it('should return 400 for limit out of range', async () => {
      const response = await request(app)
        .get('/api/credits/transactions?limit=150')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.code).toBe('INVALID_LIMIT');
    });

    it('should return 401 for unauthenticated request', async () => {
      const response = await request(app)
        .get('/api/credits/transactions')
        .expect(401);

      expect(response.body.code).toBe('MISSING_TOKEN');
    });

    it('should return empty array for user with no transactions', async () => {
      // Create a new user with no transactions
      const newUser = await storage.createUser({
        username: 'newuser',
        email: 'new@example.com',
        password: await AuthService.hashPassword('password123'),
        fullName: 'New User',
        creditBalance: 0,
      });

      const newUserToken = AuthService.generateAccessToken(newUser);

      const response = await request(app)
        .get('/api/credits/transactions')
        .set('Authorization', `Bearer ${newUserToken}`)
        .expect(200);

      expect(response.body.transactions).toHaveLength(0);
    });
  });
});