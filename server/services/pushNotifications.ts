import { storage } from '../storage';

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  badge?: number;
  sound?: string;
  category?: string;
  threadId?: string;
}

export interface DeviceToken {
  id: string;
  userId: string;
  token: string;
  platform: 'ios' | 'android' | 'web';
  deviceId?: string;
  appVersion?: string;
  isActive: boolean;
  createdAt: Date;
  lastUsed?: Date;
}

export interface NotificationSchedule {
  id: string;
  userId: string;
  payload: PushNotificationPayload;
  scheduledFor: Date;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  createdAt: Date;
  sentAt?: Date;
  error?: string;
}

export interface NotificationDelivery {
  id: string;
  notificationId: string;
  deviceToken: string;
  platform: string;
  status: 'sent' | 'delivered' | 'failed' | 'clicked';
  sentAt: Date;
  deliveredAt?: Date;
  clickedAt?: Date;
  error?: string;
}

export class PushNotificationService {
  private static instance: PushNotificationService;
  private fcmServerKey: string;
  private apnsKeyId: string;
  private apnsTeamId: string;
  private apnsPrivateKey: string;

  private constructor() {
    // Initialize with environment variables
    this.fcmServerKey = process.env.FCM_SERVER_KEY || '';
    this.apnsKeyId = process.env.APNS_KEY_ID || '';
    this.apnsTeamId = process.env.APNS_TEAM_ID || '';
    this.apnsPrivateKey = process.env.APNS_PRIVATE_KEY || '';
  }

  static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  // Register a device token
  async registerDeviceToken(userId: string, token: string, platform: 'ios' | 'android' | 'web', deviceId?: string, appVersion?: string): Promise<DeviceToken> {
    // Check if token already exists
    const existingTokens = await storage.getUserPushTokens(userId);
    const existingToken = existingTokens.find(t => t.token === token);

    if (existingToken) {
      // Update existing token
      return {
        id: existingToken.id,
        userId,
        token,
        platform,
        deviceId,
        appVersion,
        isActive: true,
        createdAt: existingToken.createdAt,
        lastUsed: new Date()
      };
    }

    // Create new token
    const deviceToken = await storage.addPushToken({
      userId,
      token,
      platform,
      deviceId,
      appVersion,
      isActive: true,
      createdAt: new Date()
    });

    return deviceToken;
  }

  // Remove a device token
  async removeDeviceToken(userId: string, tokenId: string): Promise<boolean> {
    return await storage.removePushToken(userId, tokenId);
  }

  // Get user's device tokens
  async getUserDeviceTokens(userId: string): Promise<DeviceToken[]> {
    return await storage.getUserPushTokens(userId);
  }

  // Send push notification to a specific user
  async sendToUser(userId: string, payload: PushNotificationPayload): Promise<NotificationDelivery[]> {
    const deviceTokens = await this.getUserDeviceTokens(userId);
    const activeTokens = deviceTokens.filter(token => token.isActive);

    if (activeTokens.length === 0) {
      console.log(`No active device tokens found for user ${userId}`);
      return [];
    }

    const deliveries: NotificationDelivery[] = [];

    for (const deviceToken of activeTokens) {
      try {
        const delivery = await this.sendToDevice(deviceToken, payload);
        deliveries.push(delivery);
      } catch (error) {
        console.error(`Failed to send notification to device ${deviceToken.id}:`, error);
        deliveries.push({
          id: this.generateId(),
          notificationId: this.generateId(),
          deviceToken: deviceToken.token,
          platform: deviceToken.platform,
          status: 'failed',
          sentAt: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return deliveries;
  }

  // Send push notification to multiple users
  async sendToUsers(userIds: string[], payload: PushNotificationPayload): Promise<NotificationDelivery[]> {
    const allDeliveries: NotificationDelivery[] = [];

    for (const userId of userIds) {
      const deliveries = await this.sendToUser(userId, payload);
      allDeliveries.push(...deliveries);
    }

    return allDeliveries;
  }

  // Send notification to a specific device
  private async sendToDevice(deviceToken: DeviceToken, payload: PushNotificationPayload): Promise<NotificationDelivery> {
    const delivery: NotificationDelivery = {
      id: this.generateId(),
      notificationId: this.generateId(),
      deviceToken: deviceToken.token,
      platform: deviceToken.platform,
      status: 'sent',
      sentAt: new Date()
    };

    try {
      switch (deviceToken.platform) {
        case 'android':
          await this.sendFCMNotification(deviceToken.token, payload);
          break;
        case 'ios':
          await this.sendAPNSNotification(deviceToken.token, payload);
          break;
        case 'web':
          await this.sendWebPushNotification(deviceToken.token, payload);
          break;
        default:
          throw new Error(`Unsupported platform: ${deviceToken.platform}`);
      }

      delivery.status = 'delivered';
      delivery.deliveredAt = new Date();
    } catch (error) {
      delivery.status = 'failed';
      delivery.error = error instanceof Error ? error.message : 'Unknown error';
      
      // Deactivate token if it's invalid
      if (this.isTokenInvalid(error)) {
        await storage.deactivatePushToken(deviceToken.id);
      }
    }

    return delivery;
  }

  // Send FCM notification (Android)
  private async sendFCMNotification(token: string, payload: PushNotificationPayload): Promise<void> {
    if (!this.fcmServerKey) {
      throw new Error('FCM server key not configured');
    }

    try {
      const { FirebaseMessagingService } = await import('./firebaseMessaging');
      const fcmService = FirebaseMessagingService.getInstance({ serverKey: this.fcmServerKey });
      
      const result = await fcmService.sendToDevice(token, payload);
      
      if (result.error) {
        throw new Error(`FCM delivery failed: ${result.error}`);
      }
    } catch (error) {
      // Fallback to direct FCM API call
      const fcmPayload = {
        to: token,
        notification: {
          title: payload.title,
          body: payload.body,
          sound: payload.sound || 'default',
          badge: payload.badge
        },
        data: payload.data || {}
      };

      const response = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Authorization': `key=${this.fcmServerKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(fcmPayload)
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`FCM request failed: ${error}`);
      }

      const result = await response.json();
      if (result.failure > 0) {
        throw new Error(`FCM delivery failed: ${JSON.stringify(result.results)}`);
      }
    }
  }

  // Send APNS notification (iOS)
  private async sendAPNSNotification(token: string, payload: PushNotificationPayload): Promise<void> {
    if (!this.apnsKeyId || !this.apnsTeamId || !this.apnsPrivateKey) {
      throw new Error('APNS credentials not configured');
    }

    // For production, you would use a proper APNS library like node-apn
    // This is a simplified implementation
    const apnsPayload = {
      aps: {
        alert: {
          title: payload.title,
          body: payload.body
        },
        sound: payload.sound || 'default',
        badge: payload.badge,
        category: payload.category,
        'thread-id': payload.threadId
      },
      ...payload.data
    };

    // In a real implementation, you would:
    // 1. Generate JWT token using APNS credentials
    // 2. Send HTTP/2 request to APNS servers
    // 3. Handle response and errors
    
    console.log(`Would send APNS notification to ${token}:`, apnsPayload);
  }

  // Send Web Push notification
  private async sendWebPushNotification(token: string, payload: PushNotificationPayload): Promise<void> {
    // For production, you would use a library like web-push
    // This is a simplified implementation
    const webPushPayload = {
      title: payload.title,
      body: payload.body,
      data: payload.data,
      badge: payload.badge,
      icon: '/icon-192x192.png',
      tag: payload.category
    };

    console.log(`Would send Web Push notification to ${token}:`, webPushPayload);
  }

  // Schedule a notification for later delivery
  async scheduleNotification(userId: string, payload: PushNotificationPayload, scheduledFor: Date): Promise<NotificationSchedule> {
    const schedule: NotificationSchedule = {
      id: this.generateId(),
      userId,
      payload,
      scheduledFor,
      status: 'pending',
      createdAt: new Date()
    };

    // In a real implementation, you would store this in the database
    // and have a background job process scheduled notifications
    console.log('Scheduled notification:', schedule);

    return schedule;
  }

  // Cancel a scheduled notification
  async cancelScheduledNotification(scheduleId: string): Promise<boolean> {
    // In a real implementation, you would update the status in the database
    console.log(`Cancelled scheduled notification: ${scheduleId}`);
    return true;
  }

  // Send notification based on user activity
  async sendActivityBasedNotification(userId: string, activityType: string, relatedId?: string): Promise<NotificationDelivery[]> {
    const payload = this.getActivityNotificationPayload(activityType, relatedId);
    if (!payload) {
      return [];
    }

    return await this.sendToUser(userId, payload);
  }

  // Get notification payload based on activity type
  private getActivityNotificationPayload(activityType: string, relatedId?: string): PushNotificationPayload | null {
    switch (activityType) {
      case 'new_match':
        return {
          title: 'New Skill Match!',
          body: 'Someone wants to exchange skills with you',
          category: 'match',
          data: { type: 'match', relatedId: relatedId || '' }
        };

      case 'message_received':
        return {
          title: 'New Message',
          body: 'You have a new message',
          category: 'message',
          data: { type: 'message', relatedId: relatedId || '' }
        };

      case 'session_reminder':
        return {
          title: 'Session Reminder',
          body: 'Your skill exchange session starts in 15 minutes',
          category: 'session',
          data: { type: 'session', relatedId: relatedId || '' }
        };

      case 'course_update':
        return {
          title: 'Course Update',
          body: 'New content available in your enrolled course',
          category: 'course',
          data: { type: 'course', relatedId: relatedId || '' }
        };

      case 'credit_earned':
        return {
          title: 'Credits Earned!',
          body: 'You earned credits from your recent session',
          category: 'credits',
          data: { type: 'credits', relatedId: relatedId || '' }
        };

      default:
        return null;
    }
  }

  // Check if token error indicates invalid token
  private isTokenInvalid(error: any): boolean {
    const errorMessage = error?.message?.toLowerCase() || '';
    return errorMessage.includes('invalid') || 
           errorMessage.includes('not registered') ||
           errorMessage.includes('token') && errorMessage.includes('expired');
  }

  // Generate unique ID
  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  // Get notification analytics
  async getNotificationAnalytics(userId: string, days: number = 30): Promise<any> {
    // In a real implementation, you would query delivery records from the database
    return {
      totalSent: 0,
      totalDelivered: 0,
      totalClicked: 0,
      deliveryRate: 0,
      clickRate: 0,
      platformBreakdown: {
        ios: { sent: 0, delivered: 0, clicked: 0 },
        android: { sent: 0, delivered: 0, clicked: 0 },
        web: { sent: 0, delivered: 0, clicked: 0 }
      }
    };
  }

  // Test notification delivery
  async sendTestNotification(userId: string): Promise<NotificationDelivery[]> {
    const payload: PushNotificationPayload = {
      title: 'Test Notification',
      body: 'This is a test notification from SkillSwap',
      data: { type: 'test' }
    };

    return await this.sendToUser(userId, payload);
  }
}