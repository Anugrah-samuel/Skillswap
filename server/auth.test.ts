import { describe, it, expect, beforeEach } from 'vitest';
import { AuthService, UserRole } from './auth';
import type { User } from '@shared/schema';

describe('AuthService', () => {
  const mockUser: User = {
    id: 'test-user-id',
    username: 'testuser',
    email: 'test@example.com',
    password: 'hashedpassword',
    fullName: 'Test User',
    bio: null,
    avatarUrl: null,
    rating: 0,
    totalReviews: 0,
    creditBalance: 100,
    subscriptionStatus: 'basic',
    subscriptionExpiresAt: null,
    totalSessionsCompleted: 5,
    totalSessionsTaught: 3,
    skillPoints: 500,
    badges: [],
    createdAt: new Date(),
  };

  describe('Password hashing and verification', () => {
    it('should hash and verify passwords correctly', async () => {
      const password = 'testpassword123';
      const hashedPassword = await AuthService.hashPassword(password);
      
      expect(hashedPassword).not.toBe(password);
      expect(hashedPassword.length).toBeGreaterThan(50);
      
      const isValid = await AuthService.verifyPassword(password, hashedPassword);
      expect(isValid).toBe(true);
      
      const isInvalid = await AuthService.verifyPassword('wrongpassword', hashedPassword);
      expect(isInvalid).toBe(false);
    });
  });

  describe('JWT token generation and verification', () => {
    it('should generate and verify access tokens', () => {
      const token = AuthService.generateAccessToken(mockUser);
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      
      const payload = AuthService.verifyAccessToken(token);
      expect(payload).toBeTruthy();
      expect(payload?.userId).toBe(mockUser.id);
      expect(payload?.username).toBe(mockUser.username);
      expect(payload?.email).toBe(mockUser.email);
    });

    it('should generate and verify refresh tokens', () => {
      const token = AuthService.generateRefreshToken(mockUser.id);
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      
      const payload = AuthService.verifyRefreshToken(token);
      expect(payload).toBeTruthy();
      expect(payload?.userId).toBe(mockUser.id);
      expect(payload?.tokenVersion).toBe(0);
    });

    it('should reject invalid tokens', () => {
      const invalidToken = 'invalid.token.here';
      
      const accessPayload = AuthService.verifyAccessToken(invalidToken);
      expect(accessPayload).toBeNull();
      
      const refreshPayload = AuthService.verifyRefreshToken(invalidToken);
      expect(refreshPayload).toBeNull();
    });
  });

  describe('User role determination', () => {
    it('should assign USER role by default', () => {
      const role = AuthService.getUserRole(mockUser);
      expect(role).toBe(UserRole.USER);
    });

    it('should assign CREATOR role for experienced users', () => {
      const creatorUser = {
        ...mockUser,
        skillPoints: 1500,
        totalSessionsTaught: 15,
      };
      
      const role = AuthService.getUserRole(creatorUser);
      expect(role).toBe(UserRole.CREATOR);
    });

    it('should assign ADMIN role for admin email domains', () => {
      const adminUser = {
        ...mockUser,
        email: 'admin@skillswap.admin',
      };
      
      const role = AuthService.getUserRole(adminUser);
      expect(role).toBe(UserRole.ADMIN);
    });
  });

  describe('Token extraction', () => {
    it('should extract token from Bearer header', () => {
      const token = 'test.jwt.token';
      const authHeader = `Bearer ${token}`;
      
      const extracted = AuthService.extractTokenFromHeader(authHeader);
      expect(extracted).toBe(token);
    });

    it('should return null for invalid headers', () => {
      expect(AuthService.extractTokenFromHeader(undefined)).toBeNull();
      expect(AuthService.extractTokenFromHeader('Invalid header')).toBeNull();
      expect(AuthService.extractTokenFromHeader('Basic token')).toBeNull();
    });
  });
});