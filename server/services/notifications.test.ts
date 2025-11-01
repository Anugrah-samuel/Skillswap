import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotificationService, notificationService } from './notifications';
import type { InsertNotification, SkillSession } from '@shared/schema';

// Mock dependencies
vi.mock('../storage', () => ({
  storage: {
    createNotification: vi.fn(),
    getUser: vi.fn(),
    getSkill: vi.fn(),
    markNotificationAsRead: vi.fn()
  }
}));

vi.mock('./websocket', () => ({
  getWebSocketService: vi.fn(() => ({
    sendNotificationToUser: vi.fn()
  }))
}));

describe('NotificationService', () => {
  const mockUser = {
    id: 'user-1',
    username: 'testuser',
    email: 'test@example.com',
    fullName: 'Test User'
  };

  const mockSkill = {
    id: 'skill-1',
    title: 'JavaScript Programming',
    description: 'Learn JavaScript basics'
  };

  const mockSession: SkillSession = {
    id: 'session-1',
    matchId: 'match-1',
    teacherId: 'teacher-1',
    studentId: 'student-1',
    skillId: 'skill-1',
    scheduledStart: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
    scheduledEnd: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
    actualStart: null,
    actualEnd: null,
    status: 'scheduled',
    creditsAmount: 10,
    videoRoomId: null,
    notes: null,
    createdAt: new Date()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    const { storage } = require('../storage');
    vi.mocked(storage.getUser).mockResolvedValue(mockUser);
    vi.mocked(storage.getSkill).mockResolvedValue(mockSkill);
    vi.mocked(storage.createNotification).mockResolvedValue({
      id: 'notif-1',
      userId: 'user-1',
      type: 'test',
      title: 'Test',
      message: 'Test message',
      read: false,
      relatedId: null,
      createdAt: new Date()
    });
  });

  describe('createNotification', () => {
    it('should create and deliver notification successfully', async () => {
      const notification: InsertNotification = {
        userId: 'user-1',
        type: 'message',
        title: 'New Message',
        message: 'You have a new message'
      };

      await notificationService.createNotification(notification);

      const { storage } = require('../storage');
      expect(storage.createNotification).toHaveBeenCalledWith(notification);
    });

    it('should send WebSocket notification', async () => {
      const notification: InsertNotification = {
        userId: 'user-1',
        type: 'message',
        title: 'New Message',
        message: 'You have a new message'
      };

      const { getWebSocketService } = require('./websocket');
      const mockWebSocketService = getWebSocketService();

      await notificationService.createNotification(notification);

      expect(mockWebSocketService.sendNotificationToUser).toHaveBeenCalledWith(
        'user-1',
        notification
      );
    });

    it('should handle errors gracefully', async () => {
      const { storage } = require('../storage');
      vi.mocked(storage.createNotification).mockRejectedValue(new Error('Database error'));

      const notification: InsertNotification = {
        userId: 'user-1',
        type: 'message',
        title: 'New Message',
        message: 'You have a new message'
      };

      await expect(notificationService.createNotification(notification)).rejects.toThrow('Database error');
    });
  });

  describe('scheduleSessionReminder', () => {
    it('should schedule reminders for both participants', async () => {
      // Mock setTimeout to capture the scheduled functions
      const originalSetTimeout = global.setTimeout;
      const scheduledFunctions: Array<{ fn: Function; delay: number }> = [];
      
      global.setTimeout = vi.fn((fn: Function, delay: number) => {
        scheduledFunctions.push({ fn, delay });
        return 1 as any; // Return a timer ID
      });

      await notificationService.scheduleSessionReminder(mockSession);

      // Should schedule 2 reminders (teacher and student)
      expect(scheduledFunctions).toHaveLength(2);
      
      // Check that reminders are scheduled for 15 minutes before session
      const expectedDelay = mockSession.scheduledStart.getTime() - 15 * 60 * 1000 - Date.now();
      scheduledFunctions.forEach(({ delay }) => {
        expect(delay).toBeCloseTo(expectedDelay, -2); // Allow some tolerance for timing
      });

      // Restore original setTimeout
      global.setTimeout = originalSetTimeout;
    });

    it('should not schedule reminders for past sessions', async () => {
      const pastSession = {
        ...mockSession,
        scheduledStart: new Date(Date.now() - 60 * 60 * 1000) // 1 hour ago
      };

      const originalSetTimeout = global.setTimeout;
      global.setTimeout = vi.fn();

      await notificationService.scheduleSessionReminder(pastSession);

      expect(global.setTimeout).not.toHaveBeenCalled();

      global.setTimeout = originalSetTimeout;
    });
  });

  describe('getUserNotificationPreferences', () => {
    it('should return default preferences', async () => {
      const preferences = await (notificationService as any).getUserNotificationPreferences('user-1');

      expect(preferences).toEqual({
        emailNotifications: true,
        pushNotifications: true,
        sessionReminders: true,
        messageNotifications: true,
        matchNotifications: true,
        courseNotifications: true,
        marketingEmails: false
      });
    });
  });

  describe('updateNotificationPreferences', () => {
    it('should update preferences successfully', async () => {
      const updates = {
        emailNotifications: false,
        pushNotifications: false
      };

      const result = await notificationService.updateNotificationPreferences('user-1', updates);

      expect(result.emailNotifications).toBe(false);
      expect(result.pushNotifications).toBe(false);
      expect(result.sessionReminders).toBe(true); // Should keep existing values
    });
  });

  describe('sendBulkNotification', () => {
    it('should send notifications to multiple users', async () => {
      const userIds = ['user-1', 'user-2', 'user-3'];
      const notification = {
        type: 'announcement',
        title: 'System Maintenance',
        message: 'The system will be down for maintenance'
      };

      const createNotificationSpy = vi.spyOn(notificationService, 'createNotification');

      await notificationService.sendBulkNotification(userIds, notification);

      expect(createNotificationSpy).toHaveBeenCalledTimes(3);
      userIds.forEach(userId => {
        expect(createNotificationSpy).toHaveBeenCalledWith({
          ...notification,
          userId
        });
      });
    });
  });

  describe('Email Templates', () => {
    it('should generate correct email template for match notifications', () => {
      const notification: InsertNotification = {
        userId: 'user-1',
        type: 'match',
        title: 'New Match',
        message: 'You have a new skill match'
      };

      const template = (notificationService as any).getEmailTemplate('match', notification);

      expect(template.subject).toBe('New Skill Exchange Match - SkillSwap');
      expect(template.htmlContent).toContain('You have a new skill exchange match!');
      expect(template.textContent).toContain('You have a new skill exchange match!');
    });

    it('should generate correct email template for message notifications', () => {
      const notification: InsertNotification = {
        userId: 'user-1',
        type: 'message',
        title: 'New Message',
        message: 'You have a new message from John'
      };

      const template = (notificationService as any).getEmailTemplate('message', notification);

      expect(template.subject).toBe('New Message - SkillSwap');
      expect(template.htmlContent).toContain('You have a new message!');
      expect(template.textContent).toContain('You have a new message!');
    });

    it('should generate default template for unknown notification types', () => {
      const notification: InsertNotification = {
        userId: 'user-1',
        type: 'unknown',
        title: 'Unknown Notification',
        message: 'This is an unknown notification type'
      };

      const template = (notificationService as any).getEmailTemplate('unknown', notification);

      expect(template.subject).toBe('Unknown Notification - SkillSwap');
      expect(template.htmlContent).toContain('Unknown Notification');
      expect(template.textContent).toContain('Unknown Notification');
    });
  });

  describe('Notification Type Filtering', () => {
    it('should identify push notification types correctly', () => {
      const pushTypes = ['match', 'message', 'reminder', 'session_started', 'session_cancelled'];
      const nonPushTypes = ['course', 'subscription', 'marketing'];

      pushTypes.forEach(type => {
        expect((notificationService as any).shouldSendPushNotification(type)).toBe(true);
      });

      nonPushTypes.forEach(type => {
        expect((notificationService as any).shouldSendPushNotification(type)).toBe(false);
      });
    });

    it('should identify email notification types correctly', () => {
      const emailTypes = ['match', 'reminder', 'course', 'subscription'];
      const nonEmailTypes = ['message', 'session_started', 'typing'];

      emailTypes.forEach(type => {
        expect((notificationService as any).shouldSendEmailNotification(type)).toBe(true);
      });

      nonEmailTypes.forEach(type => {
        expect((notificationService as any).shouldSendEmailNotification(type)).toBe(false);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle WebSocket service unavailability', async () => {
      const { getWebSocketService } = require('./websocket');
      vi.mocked(getWebSocketService).mockReturnValue(null);

      const notification: InsertNotification = {
        userId: 'user-1',
        type: 'message',
        title: 'New Message',
        message: 'You have a new message'
      };

      // Should not throw error even if WebSocket service is unavailable
      await expect(notificationService.createNotification(notification)).resolves.not.toThrow();
    });

    it('should handle user not found gracefully', async () => {
      const { storage } = require('../storage');
      vi.mocked(storage.getUser).mockResolvedValue(null);

      const notification: InsertNotification = {
        userId: 'nonexistent-user',
        type: 'message',
        title: 'New Message',
        message: 'You have a new message'
      };

      // Should still create notification even if user details can't be fetched
      await expect(notificationService.createNotification(notification)).resolves.not.toThrow();
    });
  });
});