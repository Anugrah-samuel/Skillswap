import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';
import { storage } from './storage';
import type { User } from '@shared/schema';

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h'; // Extended for development
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

// User roles
export enum UserRole {
  USER = 'user',
  CREATOR = 'creator',
  ADMIN = 'admin'
}

// JWT payload interface
export interface JWTPayload {
  userId: string;
  username: string;
  email: string;
  role: UserRole;
  subscriptionStatus: string;
}

// Refresh token payload
export interface RefreshTokenPayload {
  userId: string;
  tokenVersion: number;
}

// Extended request interface with user
export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
}

// Authentication service
export class AuthService {
  // Hash password
  static async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  // Verify password
  static async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  // Generate access token
  static generateAccessToken(user: User): string {
    const payload: JWTPayload = {
      userId: user.id,
      username: user.username,
      email: user.email,
      role: AuthService.getUserRole(user),
      subscriptionStatus: user.subscriptionStatus || 'basic'
    };

    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
      issuer: 'skillswap-api',
      audience: 'skillswap-client'
    });
  }

  // Generate refresh token
  static generateRefreshToken(userId: string, tokenVersion: number = 0): string {
    const payload: RefreshTokenPayload = {
      userId,
      tokenVersion
    };

    return jwt.sign(payload, JWT_REFRESH_SECRET, {
      expiresIn: JWT_REFRESH_EXPIRES_IN,
      issuer: 'skillswap-api',
      audience: 'skillswap-client'
    });
  }

  // Verify access token
  static verifyAccessToken(token: string): JWTPayload | null {
    try {
      const decoded = jwt.verify(token, JWT_SECRET, {
        issuer: 'skillswap-api',
        audience: 'skillswap-client'
      }) as JWTPayload;
      return decoded;
    } catch (error) {
      return null;
    }
  }

  // Verify refresh token
  static verifyRefreshToken(token: string): RefreshTokenPayload | null {
    try {
      const decoded = jwt.verify(token, JWT_REFRESH_SECRET, {
        issuer: 'skillswap-api',
        audience: 'skillswap-client'
      }) as RefreshTokenPayload;
      return decoded;
    } catch (error) {
      return null;
    }
  }

  // Determine user role based on user data
  static getUserRole(user: User): UserRole {
    // Admin users could be determined by email domain or specific flag
    if (user.email.endsWith('@skillswap.admin')) {
      return UserRole.ADMIN;
    }
    
    // Creator role could be based on having created courses or high skill points
    if (user.skillPoints >= 1000 || user.totalSessionsTaught >= 10) {
      return UserRole.CREATOR;
    }
    
    return UserRole.USER;
  }

  // Extract token from Authorization header
  static extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7);
  }
}

// Authentication middleware
export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = AuthService.extractTokenFromHeader(req.headers.authorization);
    
    if (!token) {
      res.status(401).json({ 
        code: 'MISSING_TOKEN',
        message: 'Access token is required' 
      });
      return;
    }

    const payload = AuthService.verifyAccessToken(token);
    if (!payload) {
      res.status(401).json({ 
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired access token' 
      });
      return;
    }

    // Verify user still exists and is active
    const user = await storage.getUser(payload.userId);
    if (!user) {
      res.status(401).json({ 
        code: 'USER_NOT_FOUND',
        message: 'User account not found' 
      });
      return;
    }

    // Update payload with current user data
    req.user = {
      ...payload,
      subscriptionStatus: user.subscriptionStatus || 'basic',
      role: AuthService.getUserRole(user)
    };

    next();
  } catch (error) {
    res.status(500).json({ 
      code: 'AUTH_ERROR',
      message: 'Authentication error' 
    });
  }
};

// Optional authentication middleware (doesn't fail if no token)
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = AuthService.extractTokenFromHeader(req.headers.authorization);
    
    if (token) {
      const payload = AuthService.verifyAccessToken(token);
      if (payload) {
        const user = await storage.getUser(payload.userId);
        if (user) {
          req.user = {
            ...payload,
            subscriptionStatus: user.subscriptionStatus || 'basic',
            role: AuthService.getUserRole(user)
          };
        }
      }
    }

    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

// Role-based access control middleware
export const requireRole = (requiredRoles: UserRole | UserRole[]) => {
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
  
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ 
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required' 
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ 
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'Insufficient permissions for this action' 
      });
      return;
    }

    next();
  };
};

// Premium subscription middleware
export const requirePremium = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ 
      code: 'AUTHENTICATION_REQUIRED',
      message: 'Authentication required' 
    });
    return;
  }

  if (req.user.subscriptionStatus !== 'premium') {
    res.status(403).json({ 
      code: 'PREMIUM_REQUIRED',
      message: 'Premium subscription required for this feature' 
    });
    return;
  }

  next();
};

// Rate limiting by user
const userRequestCounts = new Map<string, { count: number; resetTime: number }>();

export const rateLimitByUser = (maxRequests: number = 100, windowMs: number = 15 * 60 * 1000) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const userId = req.user?.userId || req.ip;
    const now = Date.now();
    
    const userLimit = userRequestCounts.get(userId);
    
    if (!userLimit || now > userLimit.resetTime) {
      userRequestCounts.set(userId, {
        count: 1,
        resetTime: now + windowMs
      });
      next();
      return;
    }
    
    if (userLimit.count >= maxRequests) {
      res.status(429).json({
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later',
        retryAfter: Math.ceil((userLimit.resetTime - now) / 1000)
      });
      return;
    }
    
    userLimit.count++;
    next();
  };
};