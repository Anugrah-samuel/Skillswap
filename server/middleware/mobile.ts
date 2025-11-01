import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

// API versioning middleware
export function apiVersioning(req: Request, res: Response, next: NextFunction) {
  // Extract version from header or query parameter
  const version = req.headers['api-version'] || req.query.version || 'v1';
  
  // Validate version format
  if (typeof version !== 'string' || !version.match(/^v\d+$/)) {
    return res.status(400).json({
      code: 'INVALID_API_VERSION',
      message: 'API version must be in format v1, v2, etc.'
    });
  }

  // Store version in request for use by handlers
  (req as any).apiVersion = version;
  
  // Set response header
  res.setHeader('API-Version', version);
  
  next();
}

// Pagination middleware
export function paginationMiddleware(req: Request, res: Response, next: NextFunction) {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;

  // Validate pagination parameters
  if (page < 1) {
    return res.status(400).json({
      code: 'INVALID_PAGE',
      message: 'Page must be a positive integer'
    });
  }

  if (limit < 1 || limit > 100) {
    return res.status(400).json({
      code: 'INVALID_LIMIT',
      message: 'Limit must be between 1 and 100'
    });
  }

  // Store pagination info in request
  (req as any).pagination = { page, limit, offset };
  
  next();
}

// Mobile-optimized response formatter
export function mobileResponseFormatter(req: Request, res: Response, next: NextFunction) {
  const originalJson = res.json;
  
  res.json = function(data: any) {
    const isMobile = req.headers['user-agent']?.toLowerCase().includes('mobile') || 
                    req.headers['x-mobile-app'] === 'true';
    
    if (isMobile && data && typeof data === 'object') {
      // Optimize response for mobile
      const optimizedData = optimizeForMobile(data);
      return originalJson.call(this, optimizedData);
    }
    
    return originalJson.call(this, data);
  };
  
  next();
}

// Optimize data structure for mobile consumption
function optimizeForMobile(data: any): any {
  if (Array.isArray(data)) {
    return data.map(item => optimizeForMobile(item));
  }
  
  if (data && typeof data === 'object') {
    const optimized: any = {};
    
    for (const [key, value] of Object.entries(data)) {
      // Skip null/undefined values to reduce payload size
      if (value === null || value === undefined) {
        continue;
      }
      
      // Optimize nested objects
      if (typeof value === 'object') {
        const optimizedValue = optimizeForMobile(value);
        if (optimizedValue !== null && optimizedValue !== undefined) {
          optimized[key] = optimizedValue;
        }
      } else {
        optimized[key] = value;
      }
    }
    
    return optimized;
  }
  
  return data;
}

// Response compression for mobile
export function mobileCompression(req: Request, res: Response, next: NextFunction) {
  const isMobile = req.headers['user-agent']?.toLowerCase().includes('mobile') || 
                  req.headers['x-mobile-app'] === 'true';
  
  if (isMobile) {
    // Enable compression for mobile requests
    res.setHeader('Content-Encoding', 'gzip');
  }
  
  next();
}

// Offline sync support middleware
export function offlineSyncSupport(req: Request, res: Response, next: NextFunction) {
  const lastSync = req.headers['last-sync'] as string;
  const clientId = req.headers['client-id'] as string;
  
  if (lastSync && clientId) {
    // Store sync info for offline support
    (req as any).syncInfo = {
      lastSync: new Date(lastSync),
      clientId
    };
  }
  
  next();
}

// Mobile-specific error handler
export function mobileErrorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  const isMobile = req.headers['user-agent']?.toLowerCase().includes('mobile') || 
                  req.headers['x-mobile-app'] === 'true';
  
  if (isMobile) {
    // Simplified error response for mobile
    const mobileError = {
      error: true,
      code: (err as any).code || 'UNKNOWN_ERROR',
      message: err.message || 'An error occurred',
      timestamp: new Date().toISOString()
    };
    
    // Don't expose stack traces on mobile
    const statusCode = (err as any).statusCode || 500;
    return res.status(statusCode).json(mobileError);
  }
  
  next(err);
}

// Device token validation schema
export const deviceTokenSchema = z.object({
  token: z.string().min(1, 'Device token is required'),
  platform: z.enum(['ios', 'android', 'web'], {
    errorMap: () => ({ message: 'Platform must be ios, android, or web' })
  }),
  deviceId: z.string().optional(),
  appVersion: z.string().optional()
});

// Push notification payload schema
export const pushNotificationSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  body: z.string().min(1, 'Body is required'),
  data: z.record(z.string()).optional(),
  badge: z.number().optional(),
  sound: z.string().optional(),
  category: z.string().optional(),
  threadId: z.string().optional()
});

// Sync request schema
export const syncRequestSchema = z.object({
  lastSync: z.string().datetime(),
  entities: z.array(z.enum(['users', 'skills', 'matches', 'messages', 'notifications'])),
  clientId: z.string().min(1, 'Client ID is required')
});