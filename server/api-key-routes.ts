import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, requireRole, UserRole, type AuthenticatedRequest } from './auth';
import { ApiKeyService, ApiKeyPermission } from './middleware/apiKeyAuth';
import { AuditLogService } from './services/auditLog';
import { apiRateLimiter } from './middleware/rateLimiting';

const router = Router();

// Validation schemas
const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  permissions: z.array(z.enum([
    'read:profile',
    'write:profile', 
    'read:skills',
    'write:skills',
    'read:sessions',
    'write:sessions',
    'read:courses',
    'write:courses',
    'read:analytics',
    'process:payments',
    'admin:access'
  ])),
  expiresAt: z.string().datetime().optional()
});

// Apply rate limiting to all API key routes
router.use(apiRateLimiter);

// Get user's API keys
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const apiKeys = await ApiKeyService.getUserApiKeys(userId);

    // Remove sensitive data before sending
    const sanitizedKeys = apiKeys.map(key => ({
      id: key.id,
      name: key.name,
      permissions: key.permissions,
      lastUsed: key.lastUsed,
      expiresAt: key.expiresAt,
      isActive: key.isActive,
      createdAt: key.createdAt
    }));

    res.json({
      apiKeys: sanitizedKeys,
      count: sanitizedKeys.length
    });
  } catch (error) {
    console.error('Get API keys error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error'
    });
  }
});

// Create new API key
router.post('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const data = createApiKeySchema.parse(req.body);

    // Check if user already has too many API keys
    const existingKeys = await ApiKeyService.getUserApiKeys(userId);
    const activeKeys = existingKeys.filter(key => key.isActive);
    
    if (activeKeys.length >= 10) {
      return res.status(400).json({
        code: 'TOO_MANY_API_KEYS',
        message: 'Maximum number of API keys reached (10)'
      });
    }

    // Validate permissions based on user role
    const userRole = req.user!.role as UserRole;
    const allowedPermissions = getAllowedPermissions(userRole);
    
    const invalidPermissions = data.permissions.filter(
      permission => !allowedPermissions.includes(permission as ApiKeyPermission)
    );

    if (invalidPermissions.length > 0) {
      return res.status(403).json({
        code: 'INVALID_PERMISSIONS',
        message: `You don't have access to these permissions: ${invalidPermissions.join(', ')}`
      });
    }

    // Parse expiration date if provided
    const expiresAt = data.expiresAt ? new Date(data.expiresAt) : undefined;
    
    // Validate expiration date
    if (expiresAt) {
      const now = new Date();
      const maxExpiry = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year max
      
      if (expiresAt <= now) {
        return res.status(400).json({
          code: 'INVALID_EXPIRY',
          message: 'Expiration date must be in the future'
        });
      }
      
      if (expiresAt > maxExpiry) {
        return res.status(400).json({
          code: 'EXPIRY_TOO_FAR',
          message: 'Expiration date cannot be more than 1 year in the future'
        });
      }
    }

    const { apiKey, key } = await ApiKeyService.createApiKey(
      userId,
      data.name,
      data.permissions as ApiKeyPermission[],
      expiresAt
    );

    // Log API key creation
    await AuditLogService.logApiKeyEvent(
      'create',
      userId,
      apiKey.id,
      true,
      { name: data.name, permissions: data.permissions },
      { ip: req.ip, userAgent: req.headers['user-agent'] }
    );

    res.status(201).json({
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        permissions: apiKey.permissions,
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.createdAt
      },
      key, // Only returned once during creation
      message: 'API key created successfully. Save this key securely - it will not be shown again.'
    });
  } catch (error) {
    console.error('Create API key error:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Invalid data',
        errors: error.errors
      });
    }

    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error'
    });
  }
});

// Revoke API key
router.delete('/:keyId', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const keyId = req.params.keyId;

    if (!keyId) {
      return res.status(400).json({
        code: 'MISSING_KEY_ID',
        message: 'API key ID is required'
      });
    }

    const success = await ApiKeyService.revokeApiKey(keyId, userId);

    if (!success) {
      return res.status(404).json({
        code: 'API_KEY_NOT_FOUND',
        message: 'API key not found or does not belong to you'
      });
    }

    // Log API key revocation
    await AuditLogService.logApiKeyEvent(
      'revoke',
      userId,
      keyId,
      true,
      undefined,
      { ip: req.ip, userAgent: req.headers['user-agent'] }
    );

    res.json({
      message: 'API key revoked successfully'
    });
  } catch (error) {
    console.error('Revoke API key error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error'
    });
  }
});

// Get API key usage statistics (admin only)
router.get('/:keyId/usage', 
  authenticateToken, 
  requireRole(UserRole.ADMIN), 
  async (req: AuthenticatedRequest, res) => {
    try {
      const keyId = req.params.keyId;
      
      // This would typically come from a usage tracking system
      // For now, return basic info
      const usage = {
        keyId,
        totalRequests: 0,
        lastUsed: null,
        requestsToday: 0,
        requestsThisMonth: 0
      };

      res.json(usage);
    } catch (error) {
      console.error('Get API key usage error:', error);
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Internal server error'
      });
    }
  }
);

// Helper function to get allowed permissions based on user role
function getAllowedPermissions(role: UserRole): ApiKeyPermission[] {
  const basePermissions = [
    ApiKeyPermission.READ_PROFILE,
    ApiKeyPermission.WRITE_PROFILE,
    ApiKeyPermission.READ_SKILLS,
    ApiKeyPermission.WRITE_SKILLS,
    ApiKeyPermission.READ_SESSIONS,
    ApiKeyPermission.WRITE_SESSIONS,
    ApiKeyPermission.READ_ANALYTICS
  ];

  const creatorPermissions = [
    ...basePermissions,
    ApiKeyPermission.READ_COURSES,
    ApiKeyPermission.WRITE_COURSES
  ];

  const adminPermissions = [
    ...creatorPermissions,
    ApiKeyPermission.PROCESS_PAYMENTS,
    ApiKeyPermission.ADMIN_ACCESS
  ];

  switch (role) {
    case UserRole.ADMIN:
      return adminPermissions;
    case UserRole.CREATOR:
      return creatorPermissions;
    case UserRole.USER:
    default:
      return basePermissions;
  }
}

export default router;