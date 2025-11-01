import { storage } from '../storage';
import { getWebSocketService } from './websocket';
import type { InsertNotification, User, SkillSession } from '@shared/schema';

export interface NotificationPreferences {
  emailNotifications: boolean;
  pushNotifications: boolean;
  sessionReminders: boolean;
  messageNotifications: boolean;
  matchNotifications: boolean;
  courseNotifications: boolean;
  marketingEmails: boolean;
}

export interface EmailTemplate {
  subject: string;
  htmlContent: string;
  textContent: string;
}

export interface PushNotificationData {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, any>;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

export class NotificationService {
  private static instance: NotificationService;
  private emailService: EmailService;
  private pushService: PushNotificationService;

  private constructor() {
    this.emailService = new EmailService();
    this.pushService = new PushNotificationService();
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  // Core notification creation and delivery
  public async createNotification(notification: InsertNotification): Promise<void> {
    try {
      // Store notification in database
      const createdNotification = await storage.createNotification(notification);

      // Get user preferences
      const preferences = await this.getUserNotificationPreferences(notification.userId);

      // Send real-time notification via WebSocket
      const webSocketService = getWebSocketService();
      if (webSocketService) {
        webSocketService.sendNotificationToUser(notification.userId, notification);
      }

      // Send push notification if enabled
      if (preferences.pushNotifications && this.shouldSendPushNotification(notification.type)) {
        await this.sendPushNotification(notification.userId, {
          title: notification.title,
          body: notification.message,
          data: {
            type: notification.type,
            relatedId: notification.relatedId,
            notificationId: createdNotification.id
          }
        });
      }

      // Send email notification if enabled and appropriate
      if (preferences.emailNotifications && this.shouldSendEmailNotification(notification.type)) {
        await this.sendEmailNotification(notification.userId, notification);
      }

    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  // Session reminder system
  public async scheduleSessionReminder(session: SkillSession): Promise<void> {
    try {
      const reminderTime = new Date(session.scheduledStart.getTime() - 15 * 60 * 1000); // 15 minutes before
      
      if (reminderTime > new Date()) {
        // Schedule reminder for teacher
        setTimeout(async () => {
          await this.sendSessionReminder(session.teacherId, session, 'teacher');
        }, reminderTime.getTime() - Date.now());

        // Schedule reminder for student
        setTimeout(async () => {
          await this.sendSessionReminder(session.studentId, session, 'student');
        }, reminderTime.getTime() - Date.now());
      }
    } catch (error) {
      console.error('Error scheduling session reminder:', error);
    }
  }

  private async sendSessionReminder(userId: string, session: SkillSession, role: 'teacher' | 'student'): Promise<void> {
    const otherUserId = role === 'teacher' ? session.studentId : session.teacherId;
    const otherUser = await storage.getUser(otherUserId);
    const skill = await storage.getSkill(session.skillId);

    if (!otherUser || !skill) return;

    const notification: InsertNotification = {
      userId,
      type: 'reminder',
      title: 'Session Starting Soon',
      message: `Your ${role === 'teacher' ? 'teaching' : 'learning'} session "${skill.title}" with ${otherUser.fullName} starts in 15 minutes`,
      relatedId: session.id
    };

    await this.createNotification(notification);
  }

  // Email notification methods
  private async sendEmailNotification(userId: string, notification: InsertNotification): Promise<void> {
    try {
      const user = await storage.getUser(userId);
      if (!user || !user.email) return;

      const template = this.getEmailTemplate(notification.type, notification);
      
      await this.emailService.sendEmail({
        to: user.email,
        subject: template.subject,
        html: template.htmlContent,
        text: template.textContent
      });

    } catch (error) {
      console.error('Error sending email notification:', error);
    }
  }

  private getEmailTemplate(type: string, notification: InsertNotification): EmailTemplate {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    
    switch (type) {
      case 'match':
        return {
          subject: 'New Skill Exchange Match - SkillSwap',
          htmlContent: `
            <h2>You have a new skill exchange match!</h2>
            <p>${notification.message}</p>
            <p><a href="${baseUrl}/matches" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Match</a></p>
          `,
          textContent: `You have a new skill exchange match! ${notification.message} View your matches at ${baseUrl}/matches`
        };

      case 'message':
        return {
          subject: 'New Message - SkillSwap',
          htmlContent: `
            <h2>You have a new message!</h2>
            <p>${notification.message}</p>
            <p><a href="${baseUrl}/messages" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Read Message</a></p>
          `,
          textContent: `You have a new message! ${notification.message} Read your messages at ${baseUrl}/messages`
        };

      case 'reminder':
        return {
          subject: 'Session Reminder - SkillSwap',
          htmlContent: `
            <h2>Session Reminder</h2>
            <p>${notification.message}</p>
            <p><a href="${baseUrl}/sessions" style="background-color: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Session</a></p>
          `,
          textContent: `Session Reminder: ${notification.message} View your sessions at ${baseUrl}/sessions`
        };

      case 'course':
        return {
          subject: 'Course Update - SkillSwap',
          htmlContent: `
            <h2>Course Update</h2>
            <p>${notification.message}</p>
            <p><a href="${baseUrl}/courses" style="background-color: #17a2b8; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Courses</a></p>
          `,
          textContent: `Course Update: ${notification.message} View your courses at ${baseUrl}/courses`
        };

      default:
        return {
          subject: `${notification.title} - SkillSwap`,
          htmlContent: `
            <h2>${notification.title}</h2>
            <p>${notification.message}</p>
            <p><a href="${baseUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Visit SkillSwap</a></p>
          `,
          textContent: `${notification.title}: ${notification.message} Visit SkillSwap at ${baseUrl}`
        };
    }
  }

  // Push notification methods
  private async sendPushNotification(userId: string, data: PushNotificationData): Promise<void> {
    try {
      await this.pushService.sendToUser(userId, data);
    } catch (error) {
      console.error('Error sending push notification:', error);
    }
  }

  // Notification preferences
  public async getUserNotificationPreferences(userId: string): Promise<NotificationPreferences> {
    try {
      const preferences = await storage.getNotificationPreferences(userId);
      
      if (preferences) {
        return {
          emailNotifications: preferences.emailNotifications,
          pushNotifications: preferences.pushNotifications,
          sessionReminders: preferences.sessionReminders,
          messageNotifications: preferences.messageNotifications,
          matchNotifications: preferences.matchNotifications,
          courseNotifications: preferences.courseNotifications,
          marketingEmails: preferences.marketingEmails
        };
      }
      
      // Return default preferences if none exist
      return {
        emailNotifications: true,
        pushNotifications: true,
        sessionReminders: true,
        messageNotifications: true,
        matchNotifications: true,
        courseNotifications: true,
        marketingEmails: false
      };
    } catch (error) {
      console.error('Error getting notification preferences:', error);
      // Return safe defaults
      return {
        emailNotifications: false,
        pushNotifications: false,
        sessionReminders: true,
        messageNotifications: false,
        matchNotifications: false,
        courseNotifications: false,
        marketingEmails: false
      };
    }
  }

  public async updateNotificationPreferences(userId: string, preferences: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    try {
      const existingPreferences = await storage.getNotificationPreferences(userId);
      
      if (existingPreferences) {
        // Update existing preferences
        const updated = await storage.updateNotificationPreferences(userId, preferences);
        if (!updated) {
          throw new Error('Failed to update notification preferences');
        }
        
        return {
          emailNotifications: updated.emailNotifications,
          pushNotifications: updated.pushNotifications,
          sessionReminders: updated.sessionReminders,
          messageNotifications: updated.messageNotifications,
          matchNotifications: updated.matchNotifications,
          courseNotifications: updated.courseNotifications,
          marketingEmails: updated.marketingEmails
        };
      } else {
        // Create new preferences
        const defaultPreferences = {
          userId,
          emailNotifications: true,
          pushNotifications: true,
          sessionReminders: true,
          messageNotifications: true,
          matchNotifications: true,
          courseNotifications: true,
          marketingEmails: false,
          ...preferences
        };
        
        const created = await storage.createNotificationPreferences(defaultPreferences);
        
        return {
          emailNotifications: created.emailNotifications,
          pushNotifications: created.pushNotifications,
          sessionReminders: created.sessionReminders,
          messageNotifications: created.messageNotifications,
          matchNotifications: created.matchNotifications,
          courseNotifications: created.courseNotifications,
          marketingEmails: created.marketingEmails
        };
      }
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      throw error;
    }
  }

  // Helper methods
  private shouldSendPushNotification(type: string): boolean {
    const pushEnabledTypes = ['match', 'message', 'reminder', 'session_started', 'session_cancelled'];
    return pushEnabledTypes.includes(type);
  }

  private shouldSendEmailNotification(type: string): boolean {
    const emailEnabledTypes = ['match', 'reminder', 'course', 'subscription'];
    return emailEnabledTypes.includes(type);
  }

  // Bulk notification methods
  public async sendBulkNotification(userIds: string[], notification: Omit<InsertNotification, 'userId'>): Promise<void> {
    try {
      const promises = userIds.map(userId => 
        this.createNotification({ ...notification, userId })
      );
      
      await Promise.all(promises);
    } catch (error) {
      console.error('Error sending bulk notification:', error);
      throw error;
    }
  }

  // Cleanup old notifications
  public async cleanupOldNotifications(daysOld: number = 30): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      
      // TODO: Implement cleanup in storage layer
      console.log(`Cleaning up notifications older than ${cutoffDate.toISOString()}`);
    } catch (error) {
      console.error('Error cleaning up old notifications:', error);
    }
  }
}

// Email service implementation
class EmailService {
  async sendEmail(options: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<void> {
    try {
      // In a real implementation, this would use a service like SendGrid, AWS SES, or Nodemailer
      console.log('Sending email:', {
        to: options.to,
        subject: options.subject,
        preview: options.text.substring(0, 100) + '...'
      });

      // TODO: Implement actual email sending
      // Example with a hypothetical email service:
      /*
      await emailProvider.send({
        from: process.env.FROM_EMAIL,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text
      });
      */
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }
}

// Push notification service implementation
class PushNotificationService {
  async sendToUser(userId: string, data: PushNotificationData): Promise<void> {
    try {
      // In a real implementation, this would use Firebase Cloud Messaging or similar
      console.log('Sending push notification to user:', userId, {
        title: data.title,
        body: data.body,
        data: data.data
      });

      // TODO: Implement actual push notification sending
      // Example with Firebase:
      /*
      const message = {
        notification: {
          title: data.title,
          body: data.body,
          icon: data.icon,
        },
        data: data.data,
        token: await this.getUserPushToken(userId)
      };
      
      await admin.messaging().send(message);
      */
    } catch (error) {
      console.error('Error sending push notification:', error);
      throw error;
    }
  }

  private async getUserPushToken(userId: string): Promise<string | null> {
    try {
      // TODO: Implement push token retrieval from database
      return null;
    } catch (error) {
      console.error('Error getting user push token:', error);
      return null;
    }
  }
}

// Export singleton instance
export const notificationService = NotificationService.getInstance();