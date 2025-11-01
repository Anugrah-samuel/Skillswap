import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { 
  createRateLimiter,
  authRateLimiter,
  apiRateLimiter,
  uploadRateLimiter
} from './rateLimiting';

describe('Rate Limiting Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      ip: '192.168.1.1',
      user: { userId: 'user-123' },
      headers: {},
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      setHeader: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
    
    // Clear any existing rate limit data
    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('createRateLimiter', () => {
    it('should allow requests within limit', () => {
      const limiter = createRateLimiter({
        windowMs: 60000, // 1 minute
        max: 5, // 5 requests per minute
        message: 'Too many requests',
      });

      // First request should pass
      limiter(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should block requests exceeding limit', () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        max: 2,
        message: 'Rate limit exceeded',
      });

      // Make requests up to the limit
      limiter(mockReq as Request, mockRes as Response, mockNext);
      limiter(mockReq as Request, mockRes as Response, mockNext);
      
      // Reset mocks for the third request
      vi.clearAllMocks();
      
      // Third request should be blocked
      limiter(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Rate limit exceeded',
        retryAfter: expect.any(Number),
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reset limit after window expires', () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        max: 1,
        message: 'Rate limit exceeded',
      });

      // First request
      limiter(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();

      // Reset mocks
      vi.clearAllMocks();

      // Second request should be blocked
      limiter(mockReq as Request, mockRes as Response, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(429);

      // Reset mocks and advance time
      vi.clearAllMocks();
      vi.advanceTimersByTime(61000); // Advance past window

      // Request after window should pass
      limiter(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should use different limits for different IPs', () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        max: 1,
        message: 'Rate limit exceeded',
      });

      // First IP
      mockReq.ip = '192.168.1.1';
      limiter(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();

      // Different IP should have separate limit
      mockReq.ip = '192.168.1.2';
      vi.clearAllMocks();
      limiter(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should use user ID as key when available', () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        max: 1,
        message: 'Rate limit exceeded',
        keyGenerator: (req) => req.user?.userId || req.ip,
      });

      // First request with user
      mockReq.user = { userId: 'user-123' };
      limiter(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();

      // Same user from different IP should be blocked
      mockReq.ip = '192.168.1.2';
      vi.clearAllMocks();
      limiter(mockReq as Request, mockRes as Response, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(429);
    });
  });

  describe('authRateLimiter', () => {
    it('should have appropriate limits for auth endpoints', () => {
      // Test that auth rate limiter exists and can be called
      expect(typeof authRateLimiter).toBe('function');
      
      // Make a request
      authRateLimiter(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should block after multiple failed attempts', () => {
      // Make multiple requests to simulate failed login attempts
      for (let i = 0; i < 5; i++) {
        authRateLimiter(mockReq as Request, mockRes as Response, mockNext);
      }
      
      // Reset mocks for the request that should be blocked
      vi.clearAllMocks();
      
      // Next request should be blocked
      authRateLimiter(mockReq as Request, mockRes as Response, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(429);
    });
  });

  describe('apiRateLimiter', () => {
    it('should have appropriate limits for API endpoints', () => {
      expect(typeof apiRateLimiter).toBe('function');
      
      apiRateLimiter(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should allow more requests than auth limiter', () => {
      // API limiter should be more permissive than auth limiter
      for (let i = 0; i < 10; i++) {
        apiRateLimiter(mockReq as Request, mockRes as Response, mockNext);
      }
      
      // Should still allow requests (assuming limit is higher than 10)
      expect(mockNext).toHaveBeenCalledTimes(10);
    });
  });

  describe('uploadRateLimiter', () => {
    it('should have appropriate limits for upload endpoints', () => {
      expect(typeof uploadRateLimiter).toBe('function');
      
      uploadRateLimiter(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should be more restrictive than API limiter', () => {
      // Upload limiter should be more restrictive
      for (let i = 0; i < 3; i++) {
        uploadRateLimiter(mockReq as Request, mockRes as Response, mockNext);
      }
      
      // Reset mocks
      vi.clearAllMocks();
      
      // Should be blocked after fewer requests
      uploadRateLimiter(mockReq as Request, mockRes as Response, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(429);
    });
  });

  describe('Rate limit headers', () => {
    it('should set rate limit headers', () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        max: 5,
        message: 'Rate limit exceeded',
      });

      limiter(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 5);
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(Number));
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(Number));
    });

    it('should set retry-after header when blocked', () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        max: 1,
        message: 'Rate limit exceeded',
      });

      // First request
      limiter(mockReq as Request, mockRes as Response, mockNext);
      
      // Reset mocks
      vi.clearAllMocks();
      
      // Second request should be blocked
      limiter(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(Number));
    });
  });

  describe('Edge cases', () => {
    it('should handle missing IP address', () => {
      mockReq.ip = undefined;
      
      const limiter = createRateLimiter({
        windowMs: 60000,
        max: 5,
        message: 'Rate limit exceeded',
      });

      limiter(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle requests with X-Forwarded-For header', () => {
      mockReq.headers = {
        'x-forwarded-for': '203.0.113.1, 192.168.1.1',
      };
      
      const limiter = createRateLimiter({
        windowMs: 60000,
        max: 1,
        message: 'Rate limit exceeded',
        keyGenerator: (req) => {
          const forwarded = req.headers['x-forwarded-for'] as string;
          return forwarded ? forwarded.split(',')[0].trim() : req.ip;
        },
      });

      limiter(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });
  });
});