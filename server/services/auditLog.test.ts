import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuditLogService } from './auditLog';
import { storage } from '../storage';

// Mock storage
vi.mock('../storage', () => ({
  storage: {
    createAuditLogEntry: vi.fn(),
    getUserAuditLogs: vi.fn(),
    getResourceAuditLogs: vi.fn(),
    getSecurityEvents: vi.fn(),
    getFailedAuthAttempts: vi.fn(),
    deleteOldAuditLogs: vi.fn(),
  },
}));

describe('AuditLogService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('logSecurityEvent', () => {
    it('should log security event successfully', async () => {
      vi.mocked(storage.createAuditLogEntry).mockResolvedValue(undefined);

      await AuditLogService.logSecurityEvent(
        'login_attempt',
        'user-123',
        { method: 'password' },
        { ip: '192.168.1.1', userAgent: 'Mozilla/5.0' }
      );

      expect(storage.createAuditLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          action: 'login_attempt',
          resource: 'security',
          details: { method: 'password' },
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          success: true,
        })
      );
    });

    it('should handle storage errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      vi.mocked(storage.createAuditLogEntry).mockRejectedValue(new Error('Database error'));

      await AuditLogService.logSecurityEvent('test_action', 'user-123');

      expect(consoleSpy).toHaveBeenCalledWith('Failed to write audit log entry:', expect.any(Error));
      expect(consoleLogSpy).toHaveBeenCalledWith('Audit Log Entry:', expect.any(String));
      
      consoleSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });
  });

  describe('logAuthEvent', () => {
    it('should log successful login', async () => {
      vi.mocked(storage.createAuditLogEntry).mockResolvedValue(undefined);

      await AuditLogService.logAuthEvent('login', 'user-123', true, undefined, {
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      });

      expect(storage.createAuditLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          action: 'login',
          resource: 'authentication',
          success: true,
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        })
      );
    });

    it('should log failed login attempt', async () => {
      vi.mocked(storage.createAuditLogEntry).mockResolvedValue(undefined);

      await AuditLogService.logAuthEvent('login_failed', 'user-123', false, 'Invalid password');

      expect(storage.createAuditLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          action: 'login_failed',
          resource: 'authentication',
          success: false,
          errorMessage: 'Invalid password',
        })
      );
    });
  });

  describe('logDataAccess', () => {
    it('should log data access event', async () => {
      vi.mocked(storage.createAuditLogEntry).mockResolvedValue(undefined);

      await AuditLogService.logDataAccess(
        'read',
        'user',
        'user-123',
        'admin-456',
        true,
        { fields: ['email', 'name'] }
      );

      expect(storage.createAuditLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'admin-456',
          action: 'read',
          resource: 'user',
          resourceId: 'user-123',
          details: { fields: ['email', 'name'] },
          success: true,
        })
      );
    });
  });

  describe('logPaymentEvent', () => {
    it('should log successful payment', async () => {
      vi.mocked(storage.createAuditLogEntry).mockResolvedValue(undefined);

      await AuditLogService.logPaymentEvent(
        'payment_success',
        'user-123',
        2000,
        'USD',
        'pm_test123',
        true
      );

      expect(storage.createAuditLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          action: 'payment_success',
          resource: 'payment',
          details: {
            amount: 2000,
            currency: 'USD',
            paymentMethodId: 'pm_test123',
          },
          success: true,
        })
      );
    });
  });

  describe('logSuspiciousActivity', () => {
    it('should log suspicious activity and warn for high severity', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.mocked(storage.createAuditLogEntry).mockResolvedValue(undefined);

      await AuditLogService.logSuspiciousActivity(
        'Multiple failed login attempts',
        'high',
        'user-123',
        { attempts: 5 }
      );

      expect(storage.createAuditLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          action: 'suspicious_activity',
          resource: 'security',
          details: {
            activity: 'Multiple failed login attempts',
            severity: 'high',
            attempts: 5,
          },
          success: false,
        })
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        'SECURITY ALERT [HIGH]: Multiple failed login attempts',
        expect.objectContaining({
          userId: 'user-123',
          details: { attempts: 5 },
        })
      );

      consoleSpy.mockRestore();
    });

    it('should not warn for low severity', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.mocked(storage.createAuditLogEntry).mockResolvedValue(undefined);

      await AuditLogService.logSuspiciousActivity(
        'Unusual access pattern',
        'low',
        'user-123'
      );

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('getUserAuditLogs', () => {
    it('should return user audit logs', async () => {
      const mockLogs = [
        { id: '1', userId: 'user-123', action: 'login', resource: 'authentication' },
        { id: '2', userId: 'user-123', action: 'read', resource: 'profile' },
      ];

      vi.mocked(storage.getUserAuditLogs).mockResolvedValue(mockLogs as any);

      const result = await AuditLogService.getUserAuditLogs('user-123', 50, 0);

      expect(result).toEqual(mockLogs);
      expect(storage.getUserAuditLogs).toHaveBeenCalledWith('user-123', 50, 0);
    });
  });

  describe('getRecentSecurityEvents', () => {
    it('should return recent security events', async () => {
      const mockEvents = [
        { id: '1', action: 'suspicious_activity', resource: 'security' },
      ];

      vi.mocked(storage.getSecurityEvents).mockResolvedValue(mockEvents as any);

      const result = await AuditLogService.getRecentSecurityEvents(24, 'high');

      expect(result).toEqual(mockEvents);
      expect(storage.getSecurityEvents).toHaveBeenCalledWith(
        expect.any(Date),
        'high'
      );
    });
  });

  describe('cleanupOldLogs', () => {
    it('should clean up old audit logs', async () => {
      vi.mocked(storage.deleteOldAuditLogs).mockResolvedValue(150);

      const result = await AuditLogService.cleanupOldLogs(90);

      expect(result).toBe(150);
      expect(storage.deleteOldAuditLogs).toHaveBeenCalledWith(expect.any(Date));
    });
  });
});