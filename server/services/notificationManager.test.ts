import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotificationManagerService } from './notificationManager';
import { storage } from '../storage';

// Mock the push notification service
vi.mock('./pushNotifications', () => ({
  PushNotificationService: {
    getInstance: () => ({
      sendToUser: vi.fn().mockResolvedValue([{ status: 'delivered' }]),
      sendToUsers: vi.fn().mockResolvedValue([{ status: 'delivered' }])
    })
  }
}));

// Mock the scheduler service
vi.mock('./notificationScheduler', () => ({
  NotificationSchedulerService: {
    getInstance: () => ({
      start: vi.fn(),
      scheduleNotification: vi.fn().mockResolvedValue({ id: 'scheduled-123' }),
      scheduleSessionReminder: vi.fn().mockResolvedValue(undefined),
      getStatistics: vi.fn().mockReturnValue({
        total: 0,
        pending: 0,
        sent: 0,
        failed: 0,
        cancelled: 0,
        isRunning: true
      })
    })
  }
}));

describe('NotificationManagerService', () => {
  let notificationManager: NotificationManagerService;
  let testUser: any;
  let testUser2: any;

  beforeEach(async () => {
    // Clear storage
    (storage as any).users.clear();
    (storage as any).notifications.clear();
    (storage as any).notificationPreferences.clear();

    notificationManager = NotificationManagerService.getInstance();

    // Create test users
    testUser = await storage.createUser({
      username: 'testuser1',
      email: 'test1@example.com',
      password: 'hashedpassword',
      fullName: 'Test User 1',
      bio: 'Test bio',
      location: 'Test City',
      avatarUrl: null
    });

    testUser2 = await storage.createUser({
      username: 'testuser2',
      email: 'test2@example.com',
      password: 'hashedpassword',
      fullName: 'Test User 2',
      bio: 'Test bio',
      location: 'Test City',
      avatarUrl: null
    });
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = NotificationManagerService.getInstance();
      const instance2 = NotificationManagerService.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('getUserPreferences', () => {
    it('should return default preferences for new user', async () => {
      const preferences = await notificationManager.getUserPreferences(testUser.id);
      
      expect(preferences).toHaveProperty('pushNotifications', true);
      expect(preferences).toHaveProperty('emailNotifications', true);
      expect(preferences).toHaveProperty('sessionReminders', true);
      expect(preferences).toHaveProperty('digestFrequency', 'weekly');
      expect(preferences.quietHours).toHaveProperty('enabled', false);
    });

    it('should return stored preferences', async () => {
      // Create preferences
      await storage.createNotificationPreferences({
        userId: testUser.id,
        pushNotifications: false,
        emailNotifications: true,
        sessionReminders: false,
        messageNotifications: true,
        matchNotifications: false,
        courseNotifications: true,
        marketingEmails: true
      });

      const preferences = await notificationManager.getUserPreferences(testUser.id);
      
      expect(preferences.pushNotifications).toBe(false);
      expect(preferences.sessionReminders).toBe(false);
      expect(preferences.matchNotifications).toBe(false);
    });
  });

  describe('updateUserPreferences', () => {
    it('should create new preferences', async () => {
      const newPreferences = {
        pushNotifications: false,
        sessionReminders: false,
        digestFrequency: 'daily' as const
      };

      await notificationManager.updateUserPreferences(testUser.id, newPreferences);
      
      const stored = await storage.getNotificationPreferences(testUser.id);
      expect(stored).toBeTruthy();
      expect(stored!.pushNotifications).toBe(false);
    });

    it('should update existing preferences', async () => {
      // Create initial preferences
      await storage.createNotificationPreferences({
        userId: testUser.id,
        pushNotifications: true,
        emailNotifications: true,
        sessionReminders: true,
        messageNotifications: true,
        matchNotifications: true,
        courseNotifications: true,
        marketingEmails: false
      });

      // Update preferences
      await notificationManager.updateUserPreferences(testUser.id, {
        pushNotifications: false,
        sessionReminders: false
      });

      const updated = await storage.getNotificationPreferences(testUser.id);
      expect(updated!.pushNotifications).toBe(false);
      expect(updated!.sessionReminders).toBe(false);
      expect(updated!.emailNotifications).toBe(true); // Should remain unchanged
    });
  });

  describe('handleNewMatch', () => {
    it('should send match notification', async () => {
      const matchId = 'match-123';
      
      await notificationManager.handleNewMatch(matchId, testUser.id, testUser2.id);
      
      // Check that notification was created
      const notifications = await storage.getNotificationsByUser(testUser.id);
      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('match');
      expect(notifications[0].relatedId).toBe(matchId);
    });

    it('should not send notification if match notifications disabled', async () => {
      // Disable match notifications
      await storage.createNotificationPreferences({
        userId: testUser.id,
        pushNotifications: true,
        emailNotifications: true,
        sessionReminders: true,
        messageNotifications: true,
        matchNotifications: false,
        courseNotifications: true,
        marketingEmails: false
      });

      const matchId = 'match-123';
      
      await notificationManager.handleNewMatch(matchId, testUser.id, testUser2.id);
      
      // Check that no notification was created
      const notifications = await storage.getNotificationsByUser(testUser.id);
      expect(notifications).toHaveLength(0);
    });
  });

  describe('handleNewMessage', () => {
    it('should send message notification', async () => {
      const messageId = 'message-123';
      
      await notificationManager.handleNewMessage(messageId, testUser2.id, testUser.id);
      
      // Check that notification was created
      const notifications = await storage.getNotificationsByUser(testUser.id);
      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('message');
      expect(notifications[0].relatedId).toBe(messageId);
      expect(notifications[0].title).toBe('New Message');
    });
  });

  describe('handleCreditsEarned', () => {
    it('should send credits earned notification', async () => {
      const amount = 50;
      const reason = 'session completion';
      
      await notificationManager.handleCreditsEarned(testUser.id, amount, reason);
      
      // Check that notification was created
      const notifications = await storage.getNotificationsByUser(testUser.id);
      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('credits_earned');
      expect(notifications[0].title).toBe('Credits Earned!');
      expect(notifications[0].message).toContain('50 credits');
    });
  });

  describe('sendBulkNotification', () => {
    it('should send notification to multiple users', async () => {
      const userIds = [testUser.id, testUser2.id];
      const payload = {
        title: 'Bulk Notification',
        body: 'This is a bulk notification'
      };
      
      await notificationManager.sendBulkNotification(userIds, payload);
      
      // Check that notifications were created for both users
      const user1Notifications = await storage.getNotificationsByUser(testUser.id);
      const user2Notifications = await storage.getNotificationsByUser(testUser2.id);
      
      expect(user1Notifications).toHaveLength(1);
      expect(user2Notifications).toHaveLength(1);
      expect(user1Notifications[0].title).toBe('Bulk Notification');
      expect(user2Notifications[0].title).toBe('Bulk Notification');
    });
  });

  describe('getNotificationStats', () => {
    it('should return notification statistics', async () => {
      // Create some test notifications
      await storage.createNotification({
        userId: testUser.id,
        type: 'match',
        title: 'Test Match',
        message: 'Test match message',
        relatedId: 'match-1'
      });

      await storage.createNotification({
        userId: testUser.id,
        type: 'message',
        title: 'Test Message',
        message: 'Test message content',
        relatedId: 'message-1'
      });

      const stats = await notificationManager.getNotificationStats(testUser.id, 30);
      
      expect(stats).toHaveProperty('total', 2);
      expect(stats).toHaveProperty('unread', 2);
      expect(stats).toHaveProperty('byType');
      expect(stats.byType).toHaveProperty('match', 1);
      expect(stats.byType).toHaveProperty('message', 1);
      expect(stats).toHaveProperty('schedulerStats');
    });
  });

  describe('quiet hours', () => {
    it('should schedule notification during quiet hours', async () => {
      // Set up quiet hours (current time should be within quiet hours for this test)
      const preferences = {
        pushNotifications: true,
        quietHours: {
          enabled: true,
          start: '00:00',
          end: '23:59'
        }
      };

      await notificationManager.updateUserPreferences(testUser.id, preferences);

      const payload = {
        title: 'Test Notification',
        body: 'This should be scheduled'
      };

      const context = {
        userId: testUser.id,
        type: 'test'
      };

      await notificationManager.sendNotification(context, payload);

      // Should not create immediate notification during quiet hours
      const notifications = await storage.getNotificationsByUser(testUser.id);
      expect(notifications).toHaveLength(0);
    });
  });
});