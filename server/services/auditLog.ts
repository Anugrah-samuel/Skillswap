import { storage } from '../storage';
import crypto from 'crypto';

// Audit log entry interface
export interface AuditLogEntry {
  id: string;
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  apiKeyId?: string;
  success: boolean;
  errorMessage?: string;
  timestamp: Date;
}

// Audit log service
export class AuditLogService {
  // Log a security-sensitive operation
  static async logSecurityEvent(
    action: string,
    userId?: string,
    details?: Record<string, any>,
    request?: {
      ip?: string;
      userAgent?: string;
      apiKeyId?: string;
    }
  ): Promise<void> {
    const entry: AuditLogEntry = {
      id: crypto.randomUUID(),
      userId,
      action,
      resource: 'security',
      details,
      ipAddress: request?.ip,
      userAgent: request?.userAgent,
      apiKeyId: request?.apiKeyId,
      success: true,
      timestamp: new Date()
    };

    await this.writeAuditLog(entry);
  }

  // Log authentication events
  static async logAuthEvent(
    action: 'login' | 'logout' | 'login_failed' | 'token_refresh' | 'password_change',
    userId?: string,
    success: boolean = true,
    errorMessage?: string,
    request?: {
      ip?: string;
      userAgent?: string;
    }
  ): Promise<void> {
    const entry: AuditLogEntry = {
      id: crypto.randomUUID(),
      userId,
      action,
      resource: 'authentication',
      success,
      errorMessage,
      ipAddress: request?.ip,
      userAgent: request?.userAgent,
      timestamp: new Date()
    };

    await this.writeAuditLog(entry);
  }

  // Log data access events
  static async logDataAccess(
    action: 'read' | 'create' | 'update' | 'delete',
    resource: string,
    resourceId: string,
    userId?: string,
    success: boolean = true,
    details?: Record<string, any>,
    request?: {
      ip?: string;
      userAgent?: string;
      apiKeyId?: string;
    }
  ): Promise<void> {
    const entry: AuditLogEntry = {
      id: crypto.randomUUID(),
      userId,
      action,
      resource,
      resourceId,
      details,
      success,
      ipAddress: request?.ip,
      userAgent: request?.userAgent,
      apiKeyId: request?.apiKeyId,
      timestamp: new Date()
    };

    await this.writeAuditLog(entry);
  }

  // Log payment events
  static async logPaymentEvent(
    action: 'payment_attempt' | 'payment_success' | 'payment_failed' | 'refund' | 'subscription_change',
    userId: string,
    amount?: number,
    currency?: string,
    paymentMethodId?: string,
    success: boolean = true,
    errorMessage?: string,
    request?: {
      ip?: string;
      userAgent?: string;
    }
  ): Promise<void> {
    const entry: AuditLogEntry = {
      id: crypto.randomUUID(),
      userId,
      action,
      resource: 'payment',
      details: {
        amount,
        currency,
        paymentMethodId
      },
      success,
      errorMessage,
      ipAddress: request?.ip,
      userAgent: request?.userAgent,
      timestamp: new Date()
    };

    await this.writeAuditLog(entry);
  }

  // Log admin actions
  static async logAdminAction(
    action: string,
    adminUserId: string,
    targetUserId?: string,
    resource?: string,
    resourceId?: string,
    details?: Record<string, any>,
    request?: {
      ip?: string;
      userAgent?: string;
    }
  ): Promise<void> {
    const entry: AuditLogEntry = {
      id: crypto.randomUUID(),
      userId: adminUserId,
      action,
      resource: resource || 'admin',
      resourceId,
      details: {
        ...details,
        targetUserId
      },
      success: true,
      ipAddress: request?.ip,
      userAgent: request?.userAgent,
      timestamp: new Date()
    };

    await this.writeAuditLog(entry);
  }

  // Log API key events
  static async logApiKeyEvent(
    action: 'create' | 'revoke' | 'use' | 'expired',
    userId: string,
    apiKeyId: string,
    success: boolean = true,
    details?: Record<string, any>,
    request?: {
      ip?: string;
      userAgent?: string;
    }
  ): Promise<void> {
    const entry: AuditLogEntry = {
      id: crypto.randomUUID(),
      userId,
      action,
      resource: 'api_key',
      resourceId: apiKeyId,
      details,
      success,
      ipAddress: request?.ip,
      userAgent: request?.userAgent,
      apiKeyId,
      timestamp: new Date()
    };

    await this.writeAuditLog(entry);
  }

  // Log suspicious activity
  static async logSuspiciousActivity(
    activity: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    userId?: string,
    details?: Record<string, any>,
    request?: {
      ip?: string;
      userAgent?: string;
      apiKeyId?: string;
    }
  ): Promise<void> {
    const entry: AuditLogEntry = {
      id: crypto.randomUUID(),
      userId,
      action: 'suspicious_activity',
      resource: 'security',
      details: {
        activity,
        severity,
        ...details
      },
      success: false,
      ipAddress: request?.ip,
      userAgent: request?.userAgent,
      apiKeyId: request?.apiKeyId,
      timestamp: new Date()
    };

    await this.writeAuditLog(entry);

    // For high/critical severity, also log to console immediately
    if (severity === 'high' || severity === 'critical') {
      console.warn(`SECURITY ALERT [${severity.toUpperCase()}]: ${activity}`, {
        userId,
        ip: request?.ip,
        details
      });
    }
  }

  // Write audit log entry to storage
  private static async writeAuditLog(entry: AuditLogEntry): Promise<void> {
    try {
      await storage.createAuditLogEntry(entry);
    } catch (error) {
      // If we can't write to the database, at least log to console
      console.error('Failed to write audit log entry:', error);
      console.log('Audit Log Entry:', JSON.stringify(entry));
    }
  }

  // Get audit logs for a user (admin function)
  static async getUserAuditLogs(
    userId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<AuditLogEntry[]> {
    return await storage.getUserAuditLogs(userId, limit, offset);
  }

  // Get audit logs by resource (admin function)
  static async getResourceAuditLogs(
    resource: string,
    resourceId?: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<AuditLogEntry[]> {
    return await storage.getResourceAuditLogs(resource, resourceId, limit, offset);
  }

  // Get recent security events (admin function)
  static async getRecentSecurityEvents(
    hours: number = 24,
    severity?: 'low' | 'medium' | 'high' | 'critical'
  ): Promise<AuditLogEntry[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    return await storage.getSecurityEvents(since, severity);
  }

  // Get failed authentication attempts (admin function)
  static async getFailedAuthAttempts(
    hours: number = 24,
    ipAddress?: string
  ): Promise<AuditLogEntry[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    return await storage.getFailedAuthAttempts(since, ipAddress);
  }

  // Clean up old audit logs (should be run periodically)
  static async cleanupOldLogs(daysToKeep: number = 90): Promise<number> {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    return await storage.deleteOldAuditLogs(cutoffDate);
  }
}

// Middleware to automatically log API requests
export function auditLogMiddleware(req: any, res: any, next: any): void {
  const startTime = Date.now();
  
  // Capture original res.json to log response
  const originalJson = res.json;
  res.json = function(body: any) {
    const duration = Date.now() - startTime;
    
    // Log the request if it's a sensitive operation
    if (isSensitiveOperation(req)) {
      const success = res.statusCode < 400;
      
      AuditLogService.logDataAccess(
        getActionFromMethod(req.method),
        getResourceFromPath(req.path),
        req.params.id || 'unknown',
        req.user?.userId,
        success,
        {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration,
          query: req.query,
          params: req.params
        },
        {
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          apiKeyId: req.apiKey?.id
        }
      ).catch(error => {
        console.error('Failed to log audit entry:', error);
      });
    }
    
    return originalJson.call(this, body);
  };
  
  next();
}

// Helper functions
function isSensitiveOperation(req: any): boolean {
  const sensitivePaths = [
    '/api/auth',
    '/api/payments',
    '/api/subscriptions',
    '/api/profile',
    '/api/admin'
  ];
  
  return sensitivePaths.some(path => req.path.startsWith(path)) ||
         req.method === 'DELETE' ||
         (req.method === 'PUT' && req.path.includes('/password'));
}

function getActionFromMethod(method: string): 'read' | 'create' | 'update' | 'delete' {
  switch (method.toUpperCase()) {
    case 'GET': return 'read';
    case 'POST': return 'create';
    case 'PUT':
    case 'PATCH': return 'update';
    case 'DELETE': return 'delete';
    default: return 'read';
  }
}

function getResourceFromPath(path: string): string {
  const segments = path.split('/').filter(Boolean);
  if (segments.length >= 2 && segments[0] === 'api') {
    return segments[1];
  }
  return 'unknown';
}