import { describe, it, expect, beforeEach } from 'vitest';
import { NotificationService } from './notifications';
import { storage } from '../storage';
import type { InsertNotification } from '@shared/schema';

describe('NotificationService Integration', () => {
  let notificationService: NotificationService;
  let testUserId: string;

  beforeEach(async () => {
    notificationService = NotificationService.getInstance();
    
    // Create a test user
    const testUser = await storage.createUser({
      username: 'testuser',
      email: 'test@example.com',
      password: 'hashedpassword',
      fullName: 'Test User'
    });
    testUserId = testUser.id;
  });

  describe('Notification Preferences', () => {
    it('should return default preferences for new user', async () => {
      const preferences = await notificationService.getUserNotificationPreferences(testUserId);
      
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

    it('should create and update notification preferences', async () => {
      // Update preferences
      const updates = {
        emailNotifications: false,
        pushNotifications: false,
        marketingEmails: true
      };

      const updatedPreferences = await notificationService.updateNotificationPreferences(
        testUserId, 
        updates
      );

      expect(updatedPreferences.emailNotifications).toBe(false);
      expect(updatedPreferences.pushNotifications).toBe(false);
      expect(updatedPreferences.marketingEmails).toBe(true);
      expect(updatedPreferences.sessionReminders).toBe(true); // Should keep default
    });

    it('should persist preference changes', async () => {
      // Update preferences
      await notificationService.updateNotificationPreferences(testUserId, {
        emailNotifications: false,
        sessionReminders: false
      });

      // Fetch preferences again
      const preferences = await notificationService.getUserNotificationPreferences(testUserId);
      
      expect(preferences.emailNotifications).toBe(false);
      expect(preferences.sessionReminders).toBe(false);
      expect(preferences.pushNotifications).toBe(true); // Should keep default
    });
  });

  describe('Push Token Management', () => {
    it('should add and retrieve push tokens', async () => {
      const tokenData = {
        userId: testUserId,
        token: 'test-push-token-123',
        platform: 'web' as const
      };

      const addedToken = await storage.addPushToken(tokenData);
      expect(addedToken.token).toBe('test-push-token-123');
      expect(addedToken.platform).toBe('web');
      expect(addedToken.isActive).toBe(true);

      const userTokens = await storage.getUserPushTokens(testUserId);
      expect(userTokens).toHaveLength(1);
      expect(userTokens[0].token).toBe('test-push-token-123');
    });

    it('should deactivate push tokens', async () => {
      const tokenData = {
        userId: testUserId,
        token: 'test-push-token-456',
        platform: 'ios' as const
      };

      const addedToken = await storage.addPushToken(tokenData);
      
      // Deactivate token
      const success = await storage.deactivatePushToken(addedToken.id);
      expect(success).toBe(true);

      // Should not appear in active tokens
      const activeTokens = await storage.getUserPushTokens(testUserId);
      expect(activeTokens).toHaveLength(0);
    });

    it('should remove push tokens', async () => {
      const tokenData = {
        userId: testUserId,
        token: 'test-push-token-789',
        platform: 'android' as const
      };

      const addedToken = await storage.addPushToken(tokenData);
      
      // Remove token
      const success = await storage.removePushToken(testUserId, addedToken.id);
      expect(success).toBe(true);

      const userTokens = await storage.getUserPushTokens(testUserId);
      expect(userTokens).toHaveLength(0);
    });
  });

  describe('Notification Creation', () => {
    it('should create notifications with proper preferences', async () => {
      // Set preferences to disable push notifications
      await notificationService.updateNotificationPreferences(testUserId, {
        pushNotifications: false,
        emailNotifications: true
      });

      const notification: InsertNotification = {
        userId: testUserId,
        type: 'message',
        title: 'Test Notification',
        message: 'This is a test notification'
      };

      // Should not throw error even with disabled push notifications
      await expect(notificationService.createNotification(notification)).resolves.not.toThrow();

      // Verify notification was created in storage
      const notifications = await storage.getNotificationsByUser(testUserId);
      expect(notifications).toHaveLength(1);
      expect(notifications[0].title).toBe('Test Notification');
    });

    it('should handle bulk notifications', async () => {
      // Create additional test users
      const user2 = await storage.createUser({
        username: 'testuser2',
        email: 'test2@example.com',
        password: 'hashedpassword',
        fullName: 'Test User 2'
      });

      const user3 = await storage.createUser({
        username: 'testuser3',
        email: 'test3@example.com',
        password: 'hashedpassword',
        fullName: 'Test User 3'
      });

      const userIds = [testUserId, user2.id, user3.id];
      const notification = {
        type: 'announcement',
        title: 'System Maintenance',
        message: 'The system will be down for maintenance'
      };

      await notificationService.sendBulkNotification(userIds, notification);

      // Verify all users received the notification
      for (const userId of userIds) {
        const notifications = await storage.getNotificationsByUser(userId);
        expect(notifications).toHaveLength(1);
        expect(notifications[0].title).toBe('System Maintenance');
      }
    });
  });

  describe('Session Reminders', () => {
    it('should schedule session reminders for future sessions', async () => {
      // Create a mock session in the future
      const futureSession = {
        id: 'session-123',
        matchId: 'match-123',
        teacherId: testUserId,
        studentId: 'student-456',
        skillId: 'skill-789',
        scheduledStart: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
        scheduledEnd: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
        actualStart: null,
        actualEnd: null,
        status: 'scheduled' as const,
        creditsAmount: 10,
        videoRoomId: null,
        notes: null,
        createdAt: new Date()
      };

      // Mock setTimeout to capture scheduled functions
      const originalSetTimeout = global.setTimeout;
      let scheduledFunction: Function | null = null;
      
      global.setTimeout = ((fn: Function, delay: number) => {
        scheduledFunction = fn;
        return 1 as any;
      }) as any;

      await notificationService.scheduleSessionReminder(futureSession);

      // Should have scheduled a reminder
      expect(scheduledFunction).toBeTruthy();

      // Restore original setTimeout
      global.setTimeout = originalSetTimeout;
    });
  });
});