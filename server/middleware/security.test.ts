import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { 
  inputValidationMiddleware,
  securityHeadersMiddleware,
  corsMiddleware,
  sanitizeInput
} from './security';

describe('Security Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      body: {},
      query: {},
      params: {},
      headers: {},
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      setHeader: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
  });

  describe('inputValidationMiddleware', () => {
    it('should sanitize request body', () => {
      mockReq.body = {
        name: '<script>alert("xss")</script>John',
        email: 'john@example.com',
        description: 'This is a <b>bold</b> description',
      };

      inputValidationMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.body.name).toBe('John');
      expect(mockReq.body.email).toBe('john@example.com');
      expect(mockReq.body.description).toBe('This is a bold description');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should sanitize query parameters', () => {
      mockReq.query = {
        search: '<img src=x onerror=alert(1)>',
        category: 'programming',
      };

      inputValidationMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.query.search).toBe('');
      expect(mockReq.query.category).toBe('programming');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should sanitize URL parameters', () => {
      mockReq.params = {
        id: 'user-123',
        slug: '<script>alert("xss")</script>',
      };

      inputValidationMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.params.id).toBe('user-123');
      expect(mockReq.params.slug).toBe('');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle nested objects', () => {
      mockReq.body = {
        user: {
          name: '<script>alert("xss")</script>John',
          profile: {
            bio: 'Hello <b>world</b>',
          },
        },
        tags: ['<script>alert(1)</script>', 'javascript'],
      };

      inputValidationMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.body.user.name).toBe('John');
      expect(mockReq.body.user.profile.bio).toBe('Hello world');
      expect(mockReq.body.tags[0]).toBe('');
      expect(mockReq.body.tags[1]).toBe('javascript');
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('securityHeadersMiddleware', () => {
    it('should set security headers', () => {
      securityHeadersMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Referrer-Policy', 'strict-origin-when-cross-origin');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('corsMiddleware', () => {
    it('should set CORS headers for allowed origins', () => {
      mockReq.headers = {
        origin: 'http://localhost:3000',
      };

      corsMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'http://localhost:3000');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Credentials', 'true');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject disallowed origins', () => {
      mockReq.headers = {
        origin: 'http://malicious-site.com',
      };

      corsMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'CORS policy violation' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle OPTIONS requests', () => {
      mockReq.method = 'OPTIONS';
      mockReq.headers = {
        origin: 'http://localhost:3000',
      };
      mockRes.end = vi.fn();

      corsMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.end).toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow requests without origin header', () => {
      mockReq.headers = {};

      corsMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('sanitizeInput', () => {
    it('should remove script tags', () => {
      const input = '<script>alert("xss")</script>Hello World';
      const result = sanitizeInput(input);
      expect(result).toBe('Hello World');
    });

    it('should remove event handlers', () => {
      const input = '<img src="image.jpg" onerror="alert(1)" onload="alert(2)">';
      const result = sanitizeInput(input);
      expect(result).toBe('');
    });

    it('should remove javascript: URLs', () => {
      const input = '<a href="javascript:alert(1)">Click me</a>';
      const result = sanitizeInput(input);
      expect(result).toBe('Click me');
    });

    it('should preserve safe HTML', () => {
      const input = '<p>This is <strong>bold</strong> and <em>italic</em> text.</p>';
      const result = sanitizeInput(input);
      expect(result).toBe('This is bold and italic text.');
    });

    it('should handle non-string input', () => {
      expect(sanitizeInput(123 as any)).toBe(123);
      expect(sanitizeInput(null as any)).toBe(null);
      expect(sanitizeInput(undefined as any)).toBe(undefined);
      expect(sanitizeInput({} as any)).toEqual({});
    });

    it('should remove SQL injection attempts', () => {
      const input = "'; DROP TABLE users; --";
      const result = sanitizeInput(input);
      expect(result).toBe("'; DROP TABLE users; --"); // Should be escaped, not removed
    });

    it('should handle nested HTML', () => {
      const input = '<div><script>alert(1)</script><p>Safe content</p></div>';
      const result = sanitizeInput(input);
      expect(result).toBe('Safe content');
    });
  });
});