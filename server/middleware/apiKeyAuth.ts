import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../auth';
import { storage } from '../storage';
import crypto from 'crypto';

// API Key interface
export interface ApiKey {
  id: string;
  userId: string;
  keyHash: string;
  name: string;
  permissions: string[];
  lastUsed?: Date;
  expiresAt?: Date;
  isActive: boolean;
  createdAt: Date;
}

// Extended request interface for API key authentication
export interface ApiKeyRequest extends Request {
  apiKey?: ApiKey;
  user?: {
    userId: string;
    username: string;
    email: string;
    role: string;
    subscriptionStatus: string;
  };
}

// API Key permissions
export enum ApiKeyPermission {
  READ_PROFILE = 'read:profile',
  WRITE_PROFILE = 'write:profile',
  READ_SKILLS = 'read:skills',
  WRITE_SKILLS = 'write:skills',
  READ_SESSIONS = 'read:sessions',
  WRITE_SESSIONS = 'write:sessions',
  READ_COURSES = 'read:courses',
  WRITE_COURSES = 'write:courses',
  READ_ANALYTICS = 'read:analytics',
  PROCESS_PAYMENTS = 'process:payments',
  ADMIN_ACCESS = 'admin:access'
}

// API Key service
export class ApiKeyService {
  // Generate a new API key
  static generateApiKey(): { key: string; hash: string } {
    const key = `sk_${crypto.randomBytes(32).toString('hex')}`;
    const hash = crypto.createHash('sha256').update(key).digest('hex');
    return { key, hash };
  }

  // Hash an API key for storage
  static hashApiKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  // Verify API key format
  static isValidApiKeyFormat(key: string): boolean {
    return /^sk_[a-f0-9]{64}$/.test(key);
  }

  // Create a new API key for a user
  static async createApiKey(
    userId: string,
    name: string,
    permissions: ApiKeyPermission[],
    expiresAt?: Date
  ): Promise<{ apiKey: ApiKey; key: string }> {
    const { key, hash } = this.generateApiKey();
    
    const apiKey: ApiKey = {
      id: crypto.randomUUID(),
      userId,
      keyHash: hash,
      name,
      permissions,
      expiresAt,
      isActive: true,
      createdAt: new Date()
    };

    // Store in database (you'll need to add this to your storage layer)
    await storage.createApiKey(apiKey);

    return { apiKey, key };
  }

  // Verify and retrieve API key
  static async verifyApiKey(key: string): Promise<ApiKey | null> {
    if (!this.isValidApiKeyFormat(key)) {
      return null;
    }

    const hash = this.hashApiKey(key);
    const apiKey = await storage.getApiKeyByHash(hash);

    if (!apiKey || !apiKey.isActive) {
      return null;
    }

    // Check expiration
    if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
      return null;
    }

    // Update last used timestamp
    await storage.updateApiKeyLastUsed(apiKey.id);

    return apiKey;
  }

  // Revoke an API key
  static async revokeApiKey(keyId: string, userId: string): Promise<boolean> {
    return await storage.revokeApiKey(keyId, userId);
  }

  // Get user's API keys
  static async getUserApiKeys(userId: string): Promise<ApiKey[]> {
    return await storage.getUserApiKeys(userId);
  }
}

// API Key authentication middleware
export function authenticateApiKey(req: ApiKeyRequest, res: Response, next: NextFunction): void {
  const apiKey = extractApiKey(req);

  if (!apiKey) {
    res.status(401).json({
      code: 'MISSING_API_KEY',
      message: 'API key is required. Provide it in the Authorization header as "Bearer sk_..." or X-API-Key header.'
    });
    return;
  }

  ApiKeyService.verifyApiKey(apiKey)
    .then(async (keyData) => {
      if (!keyData) {
        res.status(401).json({
          code: 'INVALID_API_KEY',
          message: 'Invalid or expired API key'
        });
        return;
      }

      // Get user data
      const user = await storage.getUser(keyData.userId);
      if (!user) {
        res.status(401).json({
          code: 'USER_NOT_FOUND',
          message: 'User associated with API key not found'
        });
        return;
      }

      // Set API key and user data on request
      req.apiKey = keyData;
      req.user = {
        userId: user.id,
        username: user.username,
        email: user.email,
        role: user.role || 'user',
        subscriptionStatus: user.subscriptionStatus || 'basic'
      };

      next();
    })
    .catch((error) => {
      console.error('API key verification error:', error);
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Internal server error'
      });
    });
}

// Optional API key authentication (doesn't fail if no key provided)
export function optionalApiKeyAuth(req: ApiKeyRequest, res: Response, next: NextFunction): void {
  const apiKey = extractApiKey(req);

  if (!apiKey) {
    return next();
  }

  ApiKeyService.verifyApiKey(apiKey)
    .then(async (keyData) => {
      if (keyData) {
        const user = await storage.getUser(keyData.userId);
        if (user) {
          req.apiKey = keyData;
          req.user = {
            userId: user.id,
            username: user.username,
            email: user.email,
            role: user.role || 'user',
            subscriptionStatus: user.subscriptionStatus || 'basic'
          };
        }
      }
      next();
    })
    .catch((error) => {
      console.error('Optional API key verification error:', error);
      next(); // Continue without authentication
    });
}

// Permission-based access control for API keys
export function requireApiKeyPermission(permission: ApiKeyPermission) {
  return (req: ApiKeyRequest, res: Response, next: NextFunction): void => {
    if (!req.apiKey) {
      res.status(401).json({
        code: 'AUTHENTICATION_REQUIRED',
        message: 'API key authentication required'
      });
      return;
    }

    if (!req.apiKey.permissions.includes(permission)) {
      res.status(403).json({
        code: 'INSUFFICIENT_PERMISSIONS',
        message: `API key does not have required permission: ${permission}`
      });
      return;
    }

    next();
  };
}

// Multiple permissions check (requires ALL permissions)
export function requireApiKeyPermissions(permissions: ApiKeyPermission[]) {
  return (req: ApiKeyRequest, res: Response, next: NextFunction): void => {
    if (!req.apiKey) {
      res.status(401).json({
        code: 'AUTHENTICATION_REQUIRED',
        message: 'API key authentication required'
      });
      return;
    }

    const missingPermissions = permissions.filter(
      permission => !req.apiKey!.permissions.includes(permission)
    );

    if (missingPermissions.length > 0) {
      res.status(403).json({
        code: 'INSUFFICIENT_PERMISSIONS',
        message: `API key missing required permissions: ${missingPermissions.join(', ')}`
      });
      return;
    }

    next();
  };
}

// Any permission check (requires ANY of the permissions)
export function requireAnyApiKeyPermission(permissions: ApiKeyPermission[]) {
  return (req: ApiKeyRequest, res: Response, next: NextFunction): void => {
    if (!req.apiKey) {
      res.status(401).json({
        code: 'AUTHENTICATION_REQUIRED',
        message: 'API key authentication required'
      });
      return;
    }

    const hasPermission = permissions.some(
      permission => req.apiKey!.permissions.includes(permission)
    );

    if (!hasPermission) {
      res.status(403).json({
        code: 'INSUFFICIENT_PERMISSIONS',
        message: `API key requires one of these permissions: ${permissions.join(', ')}`
      });
      return;
    }

    next();
  };
}

// Extract API key from request headers
function extractApiKey(req: Request): string | null {
  // Check Authorization header (Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer sk_')) {
    return authHeader.substring(7);
  }

  // Check X-API-Key header
  const apiKeyHeader = req.headers['x-api-key'] as string;
  if (apiKeyHeader && apiKeyHeader.startsWith('sk_')) {
    return apiKeyHeader;
  }

  return null;
}

// Middleware to log API key usage
export function logApiKeyUsage(req: ApiKeyRequest, res: Response, next: NextFunction): void {
  if (req.apiKey) {
    const logData = {
      apiKeyId: req.apiKey.id,
      userId: req.apiKey.userId,
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      timestamp: new Date()
    };

    // Log to console (in production, you'd want to use a proper logging service)
    console.log('API Key Usage:', JSON.stringify(logData));

    // You could also store this in a database for audit purposes
    // await storage.logApiKeyUsage(logData);
  }

  next();
}

// Middleware to check API key rate limits (separate from user rate limits)
export function apiKeyRateLimit(maxRequestsPerHour: number = 1000) {
  const apiKeyRequests = new Map<string, { count: number; resetTime: number }>();

  return (req: ApiKeyRequest, res: Response, next: NextFunction): void => {
    if (!req.apiKey) {
      return next();
    }

    const now = Date.now();
    const keyId = req.apiKey.id;
    const windowMs = 60 * 60 * 1000; // 1 hour

    let usage = apiKeyRequests.get(keyId);

    if (!usage || now > usage.resetTime) {
      usage = {
        count: 0,
        resetTime: now + windowMs
      };
    }

    usage.count++;
    apiKeyRequests.set(keyId, usage);

    if (usage.count > maxRequestsPerHour) {
      const resetTime = Math.ceil((usage.resetTime - now) / 1000);
      res.status(429).json({
        code: 'API_KEY_RATE_LIMIT_EXCEEDED',
        message: 'API key rate limit exceeded',
        retryAfter: resetTime
      });
      return;
    }

    // Add rate limit headers
    res.set({
      'X-API-RateLimit-Limit': maxRequestsPerHour.toString(),
      'X-API-RateLimit-Remaining': (maxRequestsPerHour - usage.count).toString(),
      'X-API-RateLimit-Reset': new Date(usage.resetTime).toISOString()
    });

    next();
  };
}