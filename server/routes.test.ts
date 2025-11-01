import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { registerRoutes } from './routes';

// Set test environment variables
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key';

describe('Authentication Routes', () => {
  let app: express.Express;
  let server: any;

  beforeEach(async () => {
    app = express();
    app.use(express.json());
    server = await registerRoutes(app);
  });

  describe('POST /api/auth/signup', () => {
    it('should create a new user account', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'testpassword123',
        fullName: 'Test User',
        bio: 'Test bio',
      };

      const response = await request(app)
        .post('/api/auth/signup')
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.user.username).toBe(userData.username);
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user).not.toHaveProperty('password');
    });

    it('should reject duplicate usernames', async () => {
      const userData = {
        username: 'testuser2',
        email: 'test2@example.com',
        password: 'testpassword123',
        fullName: 'Test User',
      };

      // Create first user
      const firstResponse = await request(app)
        .post('/api/auth/signup')
        .send(userData);
      
      expect(firstResponse.status).toBe(201);

      // Try to create duplicate
      const response = await request(app)
        .post('/api/auth/signup')
        .send({
          ...userData,
          email: 'different@example.com',
        })
        .expect(400);

      expect(response.body.code).toBe('USERNAME_EXISTS');
    });

    it('should reject invalid data', async () => {
      const response = await request(app)
        .post('/api/auth/signup')
        .send({
          username: '',
          email: 'invalid-email',
          password: '123', // Too short
        })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create a test user
      await request(app)
        .post('/api/auth/signup')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'testpassword123',
          fullName: 'Test User',
        });
    });

    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'testpassword123',
        })
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.user.username).toBe('testuser');
    });

    it('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'wrongpassword',
        })
        .expect(401);

      expect(response.body.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('GET /api/auth/me', () => {
    let accessToken: string;

    beforeEach(async () => {
      const signupResponse = await request(app)
        .post('/api/auth/signup')
        .send({
          username: 'testuser3',
          email: 'test3@example.com',
          password: 'testpassword123',
          fullName: 'Test User',
        });
      
      accessToken = signupResponse.body.accessToken;
    });

    it('should return current user info with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.username).toBe('testuser3');
      expect(response.body.email).toBe('test3@example.com');
      expect(response.body).not.toHaveProperty('password');
    });

    it('should reject requests without token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body.code).toBe('MISSING_TOKEN');
    });

    it('should reject requests with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);

      expect(response.body.code).toBe('INVALID_TOKEN');
    });
  });
});