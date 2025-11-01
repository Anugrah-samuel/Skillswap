import { PushNotificationService, PushNotificationPayload } from './pushNotifications';
import { NotificationSchedulerService } from './notificationScheduler';
import { storage } from '../storage';

export interface NotificationPreferences {
  emailNotifications: boolean;
  pushNotifications: boolean;
  sessionReminders: boolean;
  messageNotifications: boolean;
  matchNotifications: boolean;
  courseNotifications: boolean;
  marketingEmails: boolean;
  digestFrequency: 'daily' | 'weekly' | 'never';
  quietHours: {
    enabled: boolean;
    start: string; // HH:MM format
    end: string;   // HH:MM format
  };
}

export interface NotificationContext {
  userId: string;
  type: string;
  relatedId?: string;
  metadata?: Record<string, any>;
}

export class NotificationManagerService {
  private static instance: NotificationManagerService;
  private pushService: PushNotificationService;
  private schedulerService: NotificationSchedulerService;

  private constructor() {
    this.pushService = PushNotificationService.getInstance();
    this.schedulerService = NotificationSchedulerService.getInstance();
    
    // Start the scheduler
    this.schedulerService.start();
  }

  static getInstance(): NotificationManagerService {
    if (!NotificationManagerService.instance) {
      NotificationManagerService.instance = new NotificationManagerService();
    }
    return NotificationManagerService.instance;
  }

  // Send immediate notification
  async sendNotification(context: NotificationContext, payload: PushNotificationPayload): Promise<void> {
    // Check user preferences
    const preferences = await this.getUserPreferences(context.userId);
    if (!this.shouldSendNotification(context, preferences)) {
      return;
    }

    // Check quiet hours
    if (this.isQuietHours(preferences)) {
      // Schedule for after quiet hours
      const nextAllowedTime = this.getNextAllowedTime(preferences);
      await this.schedulerService.scheduleNotification(context.userId, payload, nextAllowedTime);
      return;
    }

    // Send immediately
    await this.pushService.sendToUser(context.userId, payload);
    
    // Create notification record
    await storage.createNotification({
      userId: context.userId,
      type: context.type,
      title: payload.title,
      message: payload.body,
      relatedId: context.relatedId || null
    });
  }

  // Handle new match notification
  async handleNewMatch(matchId: string, userId: string, matchedUserId: string): Promise<void> {
    const matchedUser = await storage.getUser(matchedUserId);
    if (!matchedUser) return;

    const context: NotificationContext = {
      userId,
      type: 'match',
      relatedId: matchId,
      metadata: { matchedUserId }
    };

    const payload: PushNotificationPayload = {
      title: 'New Skill Match!',
      body: `${matchedUser.fullName || matchedUser.username} wants to exchange skills with you`,
      category: 'match',
      data: {
        type: 'match',
        matchId,
        matchedUserId
      }
    };

    await this.sendNotification(context, payload);
  }

  // Handle new message notification
  async handleNewMessage(messageId: string, senderId: string, receiverId: string): Promise<void> {
    const sender = await storage.getUser(senderId);
    if (!sender) return;

    const context: NotificationContext = {
      userId: receiverId,
      type: 'message',
      relatedId: messageId,
      metadata: { senderId }
    };

    const payload: PushNotificationPayload = {
      title: 'New Message',
      body: `${sender.fullName || sender.username} sent you a message`,
      category: 'message',
      data: {
        type: 'message',
        messageId,
        senderId
      }
    };

    await this.sendNotification(context, payload);
  }

  // Handle session reminder
  async handleSessionReminder(sessionId: string, userId: string, minutesBefore: number): Promise<void> {
    const session = await storage.getSkillSession(sessionId);
    if (!session) return;

    const context: NotificationContext = {
      userId,
      type: 'session_reminder',
      relatedId: sessionId,
      metadata: { minutesBefore }
    };

    const payload: PushNotificationPayload = {
      title: 'Session Reminder',
      body: `Your skill exchange session starts in ${minutesBefore} minutes`,
      category: 'session',
      data: {
        type: 'session_reminder',
        sessionId,
        minutesBefore: minutesBefore.toString()
      }
    };

    await this.sendNotification(context, payload);
  }

  // Handle course update notification
  async handleCourseUpdate(courseId: string, creatorId: string): Promise<void> {
    const course = await storage.getCourse(courseId);
    if (!course) return;

    const enrollments = await storage.getEnrollmentsByCourse(courseId);
    
    for (const enrollment of enrollments) {
      if (enrollment.userId === creatorId) continue; // Don't notify creator

      const context: NotificationContext = {
        userId: enrollment.userId,
        type: 'course_update',
        relatedId: courseId,
        metadata: { creatorId }
      };

      const payload: PushNotificationPayload = {
        title: 'Course Updated',
        body: `New content is available in "${course.title}"`,
        category: 'course',
        data: {
          type: 'course_update',
          courseId,
          courseTitle: course.title
        }
      };

      await this.sendNotification(context, payload);
    }
  }

  // Handle credits earned notification
  async handleCreditsEarned(userId: string, amount: number, reason: string): Promise<void> {
    const context: NotificationContext = {
      userId,
      type: 'credits_earned',
      metadata: { amount, reason }
    };

    const payload: PushNotificationPayload = {
      title: 'Credits Earned!',
      body: `You earned ${amount} credits from ${reason}`,
      category: 'credits',
      data: {
        type: 'credits_earned',
        amount: amount.toString(),
        reason
      }
    };

    await this.sendNotification(context, payload);
  }

  // Handle subscription expiring notification
  async handleSubscriptionExpiring(userId: string, daysUntilExpiry: number): Promise<void> {
    const context: NotificationContext = {
      userId,
      type: 'subscription_expiring',
      metadata: { daysUntilExpiry }
    };

    const payload: PushNotificationPayload = {
      title: 'Premium Subscription Expiring',
      body: `Your premium subscription expires in ${daysUntilExpiry} days`,
      category: 'subscription',
      data: {
        type: 'subscription_expiring',
        daysUntilExpiry: daysUntilExpiry.toString()
      }
    };

    await this.sendNotification(context, payload);
  }

  // Schedule session reminders
  async scheduleSessionReminders(sessionId: string, teacherId: string, studentId: string, sessionStart: Date): Promise<void> {
    // Schedule reminders for both participants
    await this.schedulerService.scheduleSessionReminder(sessionId, teacherId, sessionStart);
    await this.schedulerService.scheduleSessionReminder(sessionId, studentId, sessionStart);
  }

  // Send bulk notification to multiple users
  async sendBulkNotification(userIds: string[], payload: PushNotificationPayload): Promise<void> {
    const deliveries = await this.pushService.sendToUsers(userIds, payload);
    
    // Create notification records for all users
    for (const userId of userIds) {
      await storage.createNotification({
        userId,
        type: 'bulk',
        title: payload.title,
        message: payload.body,
        relatedId: null
      });
    }
  }

  // Send notification to topic subscribers
  async sendTopicNotification(topic: string, payload: PushNotificationPayload): Promise<void> {
    // This would require implementing topic subscription management
    // For now, we'll just log it
    console.log(`Would send topic notification to ${topic}:`, payload);
  }

  // Get user notification preferences
  async getUserPreferences(userId: string): Promise<NotificationPreferences> {
    const prefs = await storage.getNotificationPreferences(userId);
    
    if (!prefs) {
      // Return default preferences
      return {
        emailNotifications: true,
        pushNotifications: true,
        sessionReminders: true,
        messageNotifications: true,
        matchNotifications: true,
        courseNotifications: true,
        marketingEmails: false,
        digestFrequency: 'weekly',
        quietHours: {
          enabled: false,
          start: '22:00',
          end: '08:00'
        }
      };
    }

    return {
      emailNotifications: prefs.emailNotifications ?? true,
      pushNotifications: prefs.pushNotifications ?? true,
      sessionReminders: prefs.sessionReminders ?? true,
      messageNotifications: prefs.messageNotifications ?? true,
      matchNotifications: prefs.matchNotifications ?? true,
      courseNotifications: prefs.courseNotifications ?? true,
      marketingEmails: prefs.marketingEmails ?? false,
      digestFrequency: (prefs as any).digestFrequency ?? 'weekly',
      quietHours: (prefs as any).quietHours ?? {
        enabled: false,
        start: '22:00',
        end: '08:00'
      }
    };
  }

  // Update user notification preferences
  async updateUserPreferences(userId: string, preferences: Partial<NotificationPreferences>): Promise<void> {
    const existing = await storage.getNotificationPreferences(userId);
    
    if (existing) {
      await storage.updateNotificationPreferences(userId, preferences as any);
    } else {
      await storage.createNotificationPreferences({
        userId,
        ...preferences as any
      });
    }
  }

  // Check if notification should be sent based on preferences
  private shouldSendNotification(context: NotificationContext, preferences: NotificationPreferences): boolean {
    if (!preferences.pushNotifications) {
      return false;
    }

    switch (context.type) {
      case 'match':
        return preferences.matchNotifications;
      case 'message':
        return preferences.messageNotifications;
      case 'session_reminder':
        return preferences.sessionReminders;
      case 'course_update':
        return preferences.courseNotifications;
      default:
        return true;
    }
  }

  // Check if current time is within quiet hours
  private isQuietHours(preferences: NotificationPreferences): boolean {
    if (!preferences.quietHours.enabled) {
      return false;
    }

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    const [startHour, startMin] = preferences.quietHours.start.split(':').map(Number);
    const [endHour, endMin] = preferences.quietHours.end.split(':').map(Number);
    
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    if (startTime <= endTime) {
      // Same day quiet hours (e.g., 22:00 to 23:00)
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      // Overnight quiet hours (e.g., 22:00 to 08:00)
      return currentTime >= startTime || currentTime <= endTime;
    }
  }

  // Get next allowed time after quiet hours
  private getNextAllowedTime(preferences: NotificationPreferences): Date {
    const now = new Date();
    const [endHour, endMin] = preferences.quietHours.end.split(':').map(Number);
    
    const nextAllowed = new Date(now);
    nextAllowed.setHours(endHour, endMin, 0, 0);
    
    // If end time is earlier in the day, it means overnight quiet hours
    if (nextAllowed <= now) {
      nextAllowed.setDate(nextAllowed.getDate() + 1);
    }
    
    return nextAllowed;
  }

  // Get notification statistics
  async getNotificationStats(userId: string, days: number = 30): Promise<any> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const notifications = await storage.getNotificationsByUser(userId);
    
    const recentNotifications = notifications.filter(n => n.createdAt >= since);
    
    return {
      total: recentNotifications.length,
      unread: recentNotifications.filter(n => !n.read).length,
      byType: this.groupByType(recentNotifications),
      schedulerStats: this.schedulerService.getStatistics()
    };
  }

  // Group notifications by type
  private groupByType(notifications: any[]): Record<string, number> {
    return notifications.reduce((acc, notification) => {
      acc[notification.type] = (acc[notification.type] || 0) + 1;
      return acc;
    }, {});
  }

  // Cleanup old notifications
  async cleanupOldNotifications(daysToKeep: number = 90): Promise<number> {
    // This would require implementing cleanup in storage
    // For now, just return 0
    return 0;
  }
}