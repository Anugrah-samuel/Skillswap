import { PushNotificationService, PushNotificationPayload } from './pushNotifications';
import { storage } from '../storage';

export interface ScheduledNotification {
  id: string;
  userId: string;
  payload: PushNotificationPayload;
  scheduledFor: Date;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  sentAt?: Date;
  error?: string;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  title: string;
  body: string;
  category: string;
  variables: string[];
  isActive: boolean;
}

export class NotificationSchedulerService {
  private static instance: NotificationSchedulerService;
  private scheduledNotifications: Map<string, ScheduledNotification> = new Map();
  private templates: Map<string, NotificationTemplate> = new Map();
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  private constructor() {
    this.initializeTemplates();
  }

  static getInstance(): NotificationSchedulerService {
    if (!NotificationSchedulerService.instance) {
      NotificationSchedulerService.instance = new NotificationSchedulerService();
    }
    return NotificationSchedulerService.instance;
  }

  // Start the scheduler
  start(intervalMs: number = 60000): void { // Default: check every minute
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.intervalId = setInterval(() => {
      this.processScheduledNotifications();
    }, intervalMs);

    console.log('Notification scheduler started');
  }

  // Stop the scheduler
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('Notification scheduler stopped');
  }

  // Schedule a notification
  async scheduleNotification(
    userId: string,
    payload: PushNotificationPayload,
    scheduledFor: Date,
    maxAttempts: number = 3
  ): Promise<ScheduledNotification> {
    const id = this.generateId();
    
    const scheduledNotification: ScheduledNotification = {
      id,
      userId,
      payload,
      scheduledFor,
      status: 'pending',
      attempts: 0,
      maxAttempts,
      createdAt: new Date()
    };

    this.scheduledNotifications.set(id, scheduledNotification);
    return scheduledNotification;
  }

  // Schedule notification using template
  async scheduleFromTemplate(
    userId: string,
    templateId: string,
    variables: Record<string, string>,
    scheduledFor: Date,
    maxAttempts: number = 3
  ): Promise<ScheduledNotification> {
    const template = this.templates.get(templateId);
    if (!template || !template.isActive) {
      throw new Error('Template not found or inactive');
    }

    const payload = this.buildPayloadFromTemplate(template, variables);
    return this.scheduleNotification(userId, payload, scheduledFor, maxAttempts);
  }

  // Cancel scheduled notification
  async cancelNotification(notificationId: string): Promise<boolean> {
    const notification = this.scheduledNotifications.get(notificationId);
    if (!notification || notification.status !== 'pending') {
      return false;
    }

    notification.status = 'cancelled';
    this.scheduledNotifications.set(notificationId, notification);
    return true;
  }

  // Get scheduled notifications for a user
  getScheduledNotifications(userId: string, status?: string): ScheduledNotification[] {
    return Array.from(this.scheduledNotifications.values())
      .filter(notification => 
        notification.userId === userId && 
        (!status || notification.status === status)
      )
      .sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime());
  }

  // Schedule session reminders
  async scheduleSessionReminder(sessionId: string, userId: string, sessionStart: Date): Promise<void> {
    // Schedule reminder 15 minutes before session
    const reminderTime = new Date(sessionStart.getTime() - 15 * 60 * 1000);
    
    if (reminderTime > new Date()) {
      await this.scheduleFromTemplate(
        userId,
        'session_reminder',
        { sessionId },
        reminderTime
      );
    }

    // Schedule reminder 1 hour before session
    const earlyReminderTime = new Date(sessionStart.getTime() - 60 * 60 * 1000);
    
    if (earlyReminderTime > new Date()) {
      await this.scheduleFromTemplate(
        userId,
        'session_early_reminder',
        { sessionId },
        earlyReminderTime
      );
    }
  }

  // Schedule course update notifications
  async scheduleCourseUpdateNotification(courseId: string, creatorId: string, delay: number = 0): Promise<void> {
    const enrollments = await storage.getEnrollmentsByCourse(courseId);
    const notificationTime = new Date(Date.now() + delay);

    for (const enrollment of enrollments) {
      if (enrollment.userId !== creatorId) {
        await this.scheduleFromTemplate(
          enrollment.userId,
          'course_update',
          { courseId },
          notificationTime
        );
      }
    }
  }

  // Schedule daily digest notifications
  async scheduleDailyDigest(userId: string): Promise<void> {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0); // 9 AM next day

    await this.scheduleFromTemplate(
      userId,
      'daily_digest',
      { date: tomorrow.toDateString() },
      tomorrow
    );
  }

  // Schedule weekly summary notifications
  async scheduleWeeklySummary(userId: string): Promise<void> {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    nextWeek.setHours(10, 0, 0, 0); // 10 AM next week

    await this.scheduleFromTemplate(
      userId,
      'weekly_summary',
      { week: `Week of ${nextWeek.toDateString()}` },
      nextWeek
    );
  }

  // Process scheduled notifications
  private async processScheduledNotifications(): Promise<void> {
    const now = new Date();
    const pendingNotifications = Array.from(this.scheduledNotifications.values())
      .filter(notification => 
        notification.status === 'pending' && 
        notification.scheduledFor <= now
      );

    for (const notification of pendingNotifications) {
      await this.sendScheduledNotification(notification);
    }
  }

  // Send a scheduled notification
  private async sendScheduledNotification(notification: ScheduledNotification): Promise<void> {
    try {
      notification.attempts++;
      
      const pushService = PushNotificationService.getInstance();
      const deliveries = await pushService.sendToUser(notification.userId, notification.payload);
      
      // Check if at least one delivery was successful
      const hasSuccessfulDelivery = deliveries.some(d => d.status === 'delivered');
      
      if (hasSuccessfulDelivery) {
        notification.status = 'sent';
        notification.sentAt = new Date();
      } else {
        throw new Error('All deliveries failed');
      }
    } catch (error) {
      notification.error = error instanceof Error ? error.message : 'Unknown error';
      
      if (notification.attempts >= notification.maxAttempts) {
        notification.status = 'failed';
      }
      // If not max attempts, keep status as 'pending' for retry
    }

    this.scheduledNotifications.set(notification.id, notification);
  }

  // Build payload from template
  private buildPayloadFromTemplate(
    template: NotificationTemplate,
    variables: Record<string, string>
  ): PushNotificationPayload {
    let title = template.title;
    let body = template.body;

    // Replace variables in title and body
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      title = title.replace(new RegExp(placeholder, 'g'), value);
      body = body.replace(new RegExp(placeholder, 'g'), value);
    }

    return {
      title,
      body,
      category: template.category,
      data: { templateId: template.id, ...variables }
    };
  }

  // Initialize notification templates
  private initializeTemplates(): void {
    const templates: NotificationTemplate[] = [
      {
        id: 'session_reminder',
        name: 'Session Reminder (15 min)',
        title: 'Session Starting Soon',
        body: 'Your skill exchange session starts in 15 minutes',
        category: 'session',
        variables: ['sessionId'],
        isActive: true
      },
      {
        id: 'session_early_reminder',
        name: 'Session Reminder (1 hour)',
        title: 'Upcoming Session',
        body: 'You have a skill exchange session in 1 hour',
        category: 'session',
        variables: ['sessionId'],
        isActive: true
      },
      {
        id: 'new_match',
        name: 'New Match',
        title: 'New Skill Match!',
        body: 'Someone wants to exchange skills with you',
        category: 'match',
        variables: ['matchId'],
        isActive: true
      },
      {
        id: 'message_received',
        name: 'New Message',
        title: 'New Message',
        body: 'You have a new message from {{senderName}}',
        category: 'message',
        variables: ['senderId', 'senderName'],
        isActive: true
      },
      {
        id: 'course_update',
        name: 'Course Update',
        title: 'Course Updated',
        body: 'New content is available in your enrolled course',
        category: 'course',
        variables: ['courseId'],
        isActive: true
      },
      {
        id: 'credit_earned',
        name: 'Credits Earned',
        title: 'Credits Earned!',
        body: 'You earned {{amount}} credits from your recent session',
        category: 'credits',
        variables: ['amount'],
        isActive: true
      },
      {
        id: 'daily_digest',
        name: 'Daily Digest',
        title: 'Your Daily SkillSwap Summary',
        body: 'Check out your activity and new opportunities for {{date}}',
        category: 'digest',
        variables: ['date'],
        isActive: true
      },
      {
        id: 'weekly_summary',
        name: 'Weekly Summary',
        title: 'Your Weekly Progress',
        body: 'See what you accomplished this week on SkillSwap',
        category: 'summary',
        variables: ['week'],
        isActive: true
      },
      {
        id: 'subscription_expiring',
        name: 'Subscription Expiring',
        title: 'Premium Subscription Expiring',
        body: 'Your premium subscription expires in {{days}} days',
        category: 'subscription',
        variables: ['days'],
        isActive: true
      },
      {
        id: 'course_completed',
        name: 'Course Completed',
        title: 'Congratulations!',
        body: 'You completed the course "{{courseName}}"',
        category: 'achievement',
        variables: ['courseId', 'courseName'],
        isActive: true
      }
    ];

    templates.forEach(template => {
      this.templates.set(template.id, template);
    });
  }

  // Generate unique ID
  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  // Get notification statistics
  getStatistics(): any {
    const notifications = Array.from(this.scheduledNotifications.values());
    
    return {
      total: notifications.length,
      pending: notifications.filter(n => n.status === 'pending').length,
      sent: notifications.filter(n => n.status === 'sent').length,
      failed: notifications.filter(n => n.status === 'failed').length,
      cancelled: notifications.filter(n => n.status === 'cancelled').length,
      isRunning: this.isRunning
    };
  }

  // Get available templates
  getTemplates(): NotificationTemplate[] {
    return Array.from(this.templates.values()).filter(t => t.isActive);
  }

  // Add or update template
  setTemplate(template: NotificationTemplate): void {
    this.templates.set(template.id, template);
  }

  // Remove template
  removeTemplate(templateId: string): boolean {
    return this.templates.delete(templateId);
  }
}