import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PushNotificationService } from './pushNotifications';
import { storage } from '../storage';

// Mock fetch for FCM requests
global.fetch = vi.fn();

describe('PushNotificationService', () => {
  let pushService: PushNotificationService;
  let testUser: any;

  beforeEach(async () => {
    pushService = PushNotificationService.getInstance();
    
    // Create test user
    testUser = await storage.createUser({
      username: 'testuser',
      email: 'test@example.com',
      password: 'hashedpassword',
      fullName: 'Test User',
      bio: 'Test bio',
      location: 'Test City',
      avatarUrl: null
    });

    // Reset fetch mock
    vi.clearAllMocks();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = PushNotificationService.getInstance();
      const instance2 = PushNotificationService.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('registerDeviceToken', () => {
    it('should register new device token', async () => {
      const deviceToken = await pushService.registerDeviceToken(
        testUser.id,
        'test-token-123',
        'ios',
        'device-id-123',
        '1.0.0'
      );

      expect(deviceToken).toHaveProperty('token', 'test-token-123');
      expect(deviceToken).toHaveProperty('platform', 'ios');
      expect(deviceToken).toHaveProperty('deviceId', 'device-id-123');
      expect(deviceToken).toHaveProperty('appVersion', '1.0.0');
      expect(deviceToken).toHaveProperty('isActive', true);
    });

    it('should update existing device token', async () => {
      // Register token first time
      await pushService.registerDeviceToken(
        testUser.id,
        'test-token-123',
        'ios'
      );

      // Register same token again
      const deviceToken = await pushService.registerDeviceToken(
        testUser.id,
        'test-token-123',
        'ios',
        'new-device-id'
      );

      expect(deviceToken).toHaveProperty('token', 'test-token-123');
      expect(deviceToken).toHaveProperty('deviceId', 'new-device-id');
    });
  });

  describe('removeDeviceToken', () => {
    it('should remove device token', async () => {
      // Register token first
      const deviceToken = await pushService.registerDeviceToken(
        testUser.id,
        'test-token-123',
        'ios'
      );

      // Remove token
      const success = await pushService.removeDeviceToken(testUser.id, deviceToken.id);
      expect(success).toBe(true);

      // Verify token is removed
      const tokens = await pushService.getUserDeviceTokens(testUser.id);
      expect(tokens).toHaveLength(0);
    });

    it('should return false for non-existent token', async () => {
      const success = await pushService.removeDeviceToken(testUser.id, 'non-existent');
      expect(success).toBe(false);
    });
  });

  describe('getUserDeviceTokens', () => {
    it('should return user device tokens', async () => {
      // Register multiple tokens
      await pushService.registerDeviceToken(testUser.id, 'ios-token', 'ios');
      await pushService.registerDeviceToken(testUser.id, 'android-token', 'android');

      const tokens = await pushService.getUserDeviceTokens(testUser.id);
      expect(tokens).toHaveLength(2);
      expect(tokens.some(t => t.token === 'ios-token')).toBe(true);
      expect(tokens.some(t => t.token === 'android-token')).toBe(true);
    });

    it('should return empty array for user with no tokens', async () => {
      const tokens = await pushService.getUserDeviceTokens(testUser.id);
      expect(tokens).toHaveLength(0);
    });
  });

  describe('sendToUser', () => {
    beforeEach(() => {
      // Mock successful FCM response
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: 1, failure: 0, results: [] })
      });
    });

    it('should send notification to user with device tokens', async () => {
      // Register device token
      await pushService.registerDeviceToken(testUser.id, 'test-token', 'android');

      const payload = {
        title: 'Test Notification',
        body: 'This is a test notification'
      };

      const deliveries = await pushService.sendToUser(testUser.id, payload);
      expect(deliveries).toHaveLength(1);
      expect(deliveries[0]).toHaveProperty('status', 'delivered');
    });

    it('should return empty array for user with no tokens', async () => {
      const payload = {
        title: 'Test Notification',
        body: 'This is a test notification'
      };

      const deliveries = await pushService.sendToUser(testUser.id, payload);
      expect(deliveries).toHaveLength(0);
    });

    it('should handle FCM errors', async () => {
      // Mock FCM error response
      (global.fetch as any).mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('FCM Error')
      });

      await pushService.registerDeviceToken(testUser.id, 'test-token', 'android');

      const payload = {
        title: 'Test Notification',
        body: 'This is a test notification'
      };

      const deliveries = await pushService.sendToUser(testUser.id, payload);
      expect(deliveries).toHaveLength(1);
      expect(deliveries[0]).toHaveProperty('status', 'failed');
      expect(deliveries[0]).toHaveProperty('error');
    });
  });

  describe('sendToUsers', () => {
    it('should send notification to multiple users', async () => {
      // Create second user
      const testUser2 = await storage.createUser({
        username: 'testuser2',
        email: 'test2@example.com',
        password: 'hashedpassword',
        fullName: 'Test User 2',
        bio: 'Test bio 2',
        location: 'Test City 2',
        avatarUrl: null
      });

      // Register tokens for both users
      await pushService.registerDeviceToken(testUser.id, 'token1', 'ios');
      await pushService.registerDeviceToken(testUser2.id, 'token2', 'android');

      // Mock successful responses
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: 1, failure: 0, results: [] })
      });

      const payload = {
        title: 'Broadcast Notification',
        body: 'This is a broadcast notification'
      };

      const deliveries = await pushService.sendToUsers([testUser.id, testUser2.id], payload);
      expect(deliveries).toHaveLength(2);
    });
  });

  describe('sendActivityBasedNotification', () => {
    it('should send new match notification', async () => {
      await pushService.registerDeviceToken(testUser.id, 'test-token', 'ios');

      // Mock successful response
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: 1, failure: 0, results: [] })
      });

      const deliveries = await pushService.sendActivityBasedNotification(
        testUser.id,
        'new_match',
        'match-123'
      );

      expect(deliveries).toHaveLength(1);
      expect(deliveries[0]).toHaveProperty('status', 'delivered');
    });

    it('should return empty array for unknown activity type', async () => {
      const deliveries = await pushService.sendActivityBasedNotification(
        testUser.id,
        'unknown_activity'
      );

      expect(deliveries).toHaveLength(0);
    });
  });

  describe('scheduleNotification', () => {
    it('should schedule notification for future delivery', async () => {
      const scheduledFor = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
      const payload = {
        title: 'Scheduled Notification',
        body: 'This is a scheduled notification'
      };

      const schedule = await pushService.scheduleNotification(testUser.id, payload, scheduledFor);

      expect(schedule).toHaveProperty('userId', testUser.id);
      expect(schedule).toHaveProperty('payload', payload);
      expect(schedule).toHaveProperty('scheduledFor', scheduledFor);
      expect(schedule).toHaveProperty('status', 'pending');
    });
  });

  describe('cancelScheduledNotification', () => {
    it('should cancel scheduled notification', async () => {
      const success = await pushService.cancelScheduledNotification('schedule-123');
      expect(success).toBe(true);
    });
  });

  describe('sendTestNotification', () => {
    it('should send test notification', async () => {
      await pushService.registerDeviceToken(testUser.id, 'test-token', 'web');

      const deliveries = await pushService.sendTestNotification(testUser.id);
      expect(deliveries).toHaveLength(1);
    });
  });

  describe('getNotificationAnalytics', () => {
    it('should return notification analytics', async () => {
      const analytics = await pushService.getNotificationAnalytics(testUser.id, 30);

      expect(analytics).toHaveProperty('totalSent');
      expect(analytics).toHaveProperty('totalDelivered');
      expect(analytics).toHaveProperty('totalClicked');
      expect(analytics).toHaveProperty('deliveryRate');
      expect(analytics).toHaveProperty('clickRate');
      expect(analytics).toHaveProperty('platformBreakdown');
    });
  });

  describe('getActivityNotificationPayload', () => {
    it('should return correct payload for different activity types', () => {
      const service = pushService as any;

      const matchPayload = service.getActivityNotificationPayload('new_match', 'match-123');
      expect(matchPayload).toHaveProperty('title', 'New Skill Match!');
      expect(matchPayload.data?.type).toBe('match');

      const messagePayload = service.getActivityNotificationPayload('message_received', 'msg-123');
      expect(messagePayload).toHaveProperty('title', 'New Message');
      expect(messagePayload.data?.type).toBe('message');

      const unknownPayload = service.getActivityNotificationPayload('unknown_type');
      expect(unknownPayload).toBeNull();
    });
  });
});