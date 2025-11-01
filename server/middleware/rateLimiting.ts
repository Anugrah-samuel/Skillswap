import { Request, Response, NextFunction } from 'express';

interface RateLimitOptions {
  windowMs: number;
  max: number;
  message: string;
  keyGenerator?: (req: Request) => string;
}

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

// In-memory store for rate limiting (in production, use Redis)
const store: RateLimitStore = {};

// Development helper to clear rate limits
export function clearRateLimits() {
  if (process.env.NODE_ENV === 'development') {
    Object.keys(store).forEach(key => delete store[key]);
    console.log('Rate limits cleared for development');
  }
}

// Create a rate limiter middleware
export function createRateLimiter(options: RateLimitOptions) {
  const { windowMs, max, message, keyGenerator } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    // Generate key for this request
    const key = keyGenerator ? keyGenerator(req) : req.ip || 'unknown';
    
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean up expired entries
    Object.keys(store).forEach(k => {
      if (store[k].resetTime < now) {
        delete store[k];
      }
    });

    // Get or create entry for this key
    if (!store[key] || store[key].resetTime < now) {
      store[key] = {
        count: 0,
        resetTime: now + windowMs,
      };
    }

    const entry = store[key];
    entry.count++;

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - entry.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000));

    // Check if limit exceeded
    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfter);
      
      res.status(429).json({
        code: 'RATE_LIMIT_EXCEEDED',
        message: message,
        retryAfter,
      });
      return;
    }

    next();
  };
}

// Auth endpoints rate limiter (more lenient for development)
export const authRateLimiter = createRateLimiter({
  windowMs: process.env.NODE_ENV === 'development' ? 1 * 60 * 1000 : 15 * 60 * 1000, // 1 min in dev, 15 min in prod
  max: process.env.NODE_ENV === 'development' ? 50 : 5, // 50 attempts in dev, 5 in prod
  message: 'Too many authentication attempts, please try again later',
  keyGenerator: (req) => req.ip || 'unknown',
});

// General API rate limiter
export const apiRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many API requests, please try again later',
  keyGenerator: (req) => (req as any).user?.userId || req.ip || 'unknown',
});

// Group messages rate limiter (more lenient for development)
export const groupMessagesRateLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute
  message: 'Too many group message requests, please try again later',
  keyGenerator: (req) => (req as any).user?.userId || req.ip || 'unknown',
});

// Upload endpoints rate limiter (most restrictive)
export const uploadRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 uploads per window
  message: 'Too many upload requests, please try again later',
  keyGenerator: (req) => (req as any).user?.userId || req.ip || 'unknown',
});

// Password change rate limiter
export const passwordRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 password changes per hour
  message: 'Too many password change attempts, please try again later',
  keyGenerator: (req) => (req as any).user?.userId || req.ip || 'unknown',
});

// Payment endpoints rate limiter
export const paymentRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 payment requests per window
  message: 'Too many payment requests, please try again later',
  keyGenerator: (req) => (req as any).user?.userId || req.ip || 'unknown',
});

// Grouped rate limiters for backward compatibility
export const rateLimiters = {
  auth: authRateLimiter,
  api: apiRateLimiter,
  general: apiRateLimiter,
  upload: uploadRateLimiter,
  password: passwordRateLimiter,
  payment: paymentRateLimiter,
  groupMessages: groupMessagesRateLimiter,
};