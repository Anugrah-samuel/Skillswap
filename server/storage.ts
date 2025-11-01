import {
  type User, type InsertUser,
  type Skill, type InsertSkill,
  type SkillMatch, type InsertMatch,
  type Message, type InsertMessage,
  type Event, type InsertEvent,
  type Review, type InsertReview,
  type Notification, type InsertNotification,
  type UserPreferences, type InsertUserPreferences,
  type CreditTransaction, type InsertCreditTransaction,
  type SkillSession, type InsertSkillSession,
  type Course, type InsertCourse,
  type CourseLesson, type InsertCourseLesson,
  type CourseEnrollment, type InsertCourseEnrollment,
  type LessonProgress, type InsertLessonProgress,
  type CourseCertificate, type InsertCourseCertificate,
  type Subscription, type InsertSubscription,
  type NotificationPreferences, type InsertNotificationPreferences,
  type PushToken, type InsertPushToken,
  type MediaFile, type InsertMediaFile
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<User>): Promise<User | undefined>;
  
  // User Preferences
  getUserPreferences(userId: string): Promise<UserPreferences | undefined>;
  createUserPreferences(preferences: InsertUserPreferences): Promise<UserPreferences>;
  updateUserPreferences(userId: string, preferences: Partial<UserPreferences>): Promise<UserPreferences | undefined>;
  
  // Skills
  getSkill(id: string): Promise<Skill | undefined>;
  getSkillsByUser(userId: string): Promise<Skill[]>;
  createSkill(skill: InsertSkill): Promise<Skill>;
  updateSkill(id: string, skill: Partial<Skill>): Promise<Skill | undefined>;
  deleteSkill(id: string): Promise<boolean>;
  
  // Skill Matches
  getMatch(id: string): Promise<SkillMatch | undefined>;
  getMatchesByUser(userId: string): Promise<SkillMatch[]>;
  createMatch(match: InsertMatch): Promise<SkillMatch>;
  updateMatch(id: string, status: string): Promise<SkillMatch | undefined>;
  
  // Messages
  getMessage(id: string): Promise<Message | undefined>;
  getMessagesBetweenUsers(user1Id: string, user2Id: string): Promise<Message[]>;
  getConversationsByUser(userId: string): Promise<any[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  markMessageAsRead(id: string): Promise<Message | undefined>;
  
  // Group Messages
  getGroupMessages(): Promise<Message[]>;
  createGroupMessage(message: { senderId: string; content: string }): Promise<Message>;
  
  // Events
  getEvent(id: string): Promise<Event | undefined>;
  getEventsByUser(userId: string): Promise<Event[]>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: string, event: Partial<Event>): Promise<Event | undefined>;
  deleteEvent(id: string): Promise<boolean>;
  
  // Reviews
  getReview(id: string): Promise<Review | undefined>;
  getReviewsByUser(userId: string): Promise<Review[]>;
  createReview(review: InsertReview): Promise<Review>;
  
  // Notifications
  getNotification(id: string): Promise<Notification | undefined>;
  getNotificationsByUser(userId: string): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: string): Promise<Notification | undefined>;
  markAllNotificationsAsRead(userId: string): Promise<void>;
  
  // Credit Transactions
  getCreditTransaction(id: string): Promise<CreditTransaction | undefined>;
  getCreditTransactionsByUser(userId: string): Promise<CreditTransaction[]>;
  createCreditTransaction(transaction: InsertCreditTransaction): Promise<CreditTransaction>;
  
  // Skill Sessions
  getSkillSession(id: string): Promise<SkillSession | undefined>;
  getSkillSessionsByUser(userId: string): Promise<SkillSession[]>;
  createSkillSession(session: InsertSkillSession): Promise<SkillSession>;
  updateSkillSession(id: string, session: Partial<SkillSession>): Promise<SkillSession | undefined>;
  
  // Courses
  getCourse(id: string): Promise<Course | undefined>;
  getCoursesByCreator(creatorId: string): Promise<Course[]>;
  getCoursesBySkill(skillId: string): Promise<Course[]>;
  searchCourses(query?: string, category?: string, status?: string): Promise<Course[]>;
  createCourse(course: InsertCourse): Promise<Course>;
  updateCourse(id: string, course: Partial<Course>): Promise<Course | undefined>;
  deleteCourse(id: string): Promise<boolean>;
  
  // Course Lessons
  getCourseLesson(id: string): Promise<CourseLesson | undefined>;
  getLessonsByCourse(courseId: string): Promise<CourseLesson[]>;
  createCourseLesson(lesson: InsertCourseLesson): Promise<CourseLesson>;
  updateCourseLesson(id: string, lesson: Partial<CourseLesson>): Promise<CourseLesson | undefined>;
  deleteCourseLesson(id: string): Promise<boolean>;
  
  // Course Enrollments
  getCourseEnrollment(id: string): Promise<CourseEnrollment | undefined>;
  getEnrollmentsByUser(userId: string): Promise<CourseEnrollment[]>;
  getCourseEnrollmentsByUser(userId: string): Promise<CourseEnrollment[]>;
  getAllCourseEnrollments(): Promise<CourseEnrollment[]>;
  getEnrollmentsByCourse(courseId: string): Promise<CourseEnrollment[]>;
  getUserCourseEnrollment(userId: string, courseId: string): Promise<CourseEnrollment | undefined>;
  createCourseEnrollment(enrollment: InsertCourseEnrollment): Promise<CourseEnrollment>;
  updateCourseEnrollment(id: string, enrollment: Partial<CourseEnrollment>): Promise<CourseEnrollment | undefined>;
  
  // Lesson Progress
  getLessonProgress(enrollmentId: string, lessonId: string): Promise<LessonProgress | undefined>;
  getLessonProgressByEnrollment(enrollmentId: string): Promise<LessonProgress[]>;
  createLessonProgress(progress: InsertLessonProgress): Promise<LessonProgress>;
  updateLessonProgress(id: string, progress: Partial<LessonProgress>): Promise<LessonProgress | undefined>;
  
  // Course Certificates
  getCourseCertificate(id: string): Promise<CourseCertificate | undefined>;
  getCertificatesByUser(userId: string): Promise<CourseCertificate[]>;
  getCertificateByEnrollment(enrollmentId: string): Promise<CourseCertificate | undefined>;
  createCourseCertificate(certificate: InsertCourseCertificate): Promise<CourseCertificate>;
  
  // Subscriptions
  getSubscription(id: string): Promise<Subscription | undefined>;
  getSubscriptionByUser(userId: string): Promise<Subscription | undefined>;
  createSubscription(subscription: InsertSubscription): Promise<Subscription>;
  updateSubscription(id: string, subscription: Partial<Subscription>): Promise<Subscription | undefined>;
  deleteSubscription(id: string): Promise<boolean>;

  // Notification Preferences
  getNotificationPreferences(userId: string): Promise<NotificationPreferences | undefined>;
  createNotificationPreferences(preferences: InsertNotificationPreferences): Promise<NotificationPreferences>;
  updateNotificationPreferences(userId: string, preferences: Partial<NotificationPreferences>): Promise<NotificationPreferences | undefined>;

  // Push Tokens
  getUserPushTokens(userId: string): Promise<PushToken[]>;
  addPushToken(token: InsertPushToken): Promise<PushToken>;
  removePushToken(userId: string, tokenId: string): Promise<boolean>;
  deactivatePushToken(tokenId: string): Promise<boolean>;

  // API Keys
  createApiKey(apiKey: any): Promise<any>;
  getApiKeyByHash(hash: string): Promise<any | undefined>;
  updateApiKeyLastUsed(keyId: string): Promise<void>;
  revokeApiKey(keyId: string, userId: string): Promise<boolean>;
  getUserApiKeys(userId: string): Promise<any[]>;

  // Audit Logs
  createAuditLogEntry(entry: any): Promise<void>;
  getUserAuditLogs(userId: string, limit: number, offset: number): Promise<any[]>;
  getResourceAuditLogs(resource: string, resourceId?: string, limit?: number, offset?: number): Promise<any[]>;
  getSecurityEvents(since: Date, severity?: string): Promise<any[]>;
  getFailedAuthAttempts(since: Date, ipAddress?: string): Promise<any[]>;
  deleteOldAuditLogs(cutoffDate: Date): Promise<number>;

  // Content Moderation
  createContentReport(report: any): Promise<any>;
  getContentReport(reportId: string): Promise<any | undefined>;
  getContentReports(status?: string, contentType?: string, limit?: number): Promise<any[]>;
  updateContentReport(reportId: string, updates: any): Promise<any>;
  createUserBehaviorEntry(entry: any): Promise<void>;
  getUserBehaviorEntries(userId: string, since: Date): Promise<any[]>;
  createUserFlag(flag: any): Promise<any>;
  getUserFlag(flagId: string): Promise<any | undefined>;
  getUserFlags(status?: string, limit?: number): Promise<any[]>;
  updateUserFlag(flagId: string, updates: any): Promise<any>;

  // Media Files
  getMediaFile(id: string): Promise<MediaFile | undefined>;
  getMediaFilesByUser(userId: string, fileType?: string): Promise<MediaFile[]>;
  getMediaFilesByRelated(relatedType: string, relatedId: string): Promise<MediaFile[]>;
  createMediaFile(mediaFile: InsertMediaFile): Promise<MediaFile>;
  updateMediaFile(id: string, updates: Partial<MediaFile>): Promise<MediaFile | undefined>;
  deleteMediaFile(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private skills: Map<string, Skill>;
  private matches: Map<string, SkillMatch>;
  private messages: Map<string, Message>;
  private events: Map<string, Event>;
  private reviews: Map<string, Review>;
  private notifications: Map<string, Notification>;
  private userPreferences: Map<string, UserPreferences>;
  private creditTransactions: Map<string, CreditTransaction>;
  private skillSessions: Map<string, SkillSession>;
  private courses: Map<string, Course>;
  private courseLessons: Map<string, CourseLesson>;
  private courseEnrollments: Map<string, CourseEnrollment>;
  private lessonProgress: Map<string, LessonProgress>;
  private courseCertificates: Map<string, CourseCertificate>;
  private subscriptions: Map<string, Subscription>;
  private notificationPreferences: Map<string, NotificationPreferences>;
  private pushTokens: Map<string, PushToken>;
  private apiKeys: Map<string, any>;
  private auditLogs: Map<string, any>;
  private contentReports: Map<string, any>;
  private userBehaviorEntries: Map<string, any>;
  private userFlags: Map<string, any>;
  private mediaFiles: Map<string, MediaFile>;

  constructor() {
    this.users = new Map();
    this.skills = new Map();
    this.matches = new Map();
    this.messages = new Map();
    this.events = new Map();
    this.reviews = new Map();
    this.notifications = new Map();
    this.userPreferences = new Map();
    this.creditTransactions = new Map();
    this.skillSessions = new Map();
    this.courses = new Map();
    this.courseLessons = new Map();
    this.courseEnrollments = new Map();
    this.lessonProgress = new Map();
    this.courseCertificates = new Map();
    this.subscriptions = new Map();
    this.notificationPreferences = new Map();
    this.pushTokens = new Map();
    this.apiKeys = new Map();
    this.auditLogs = new Map();
    this.contentReports = new Map();
    this.userBehaviorEntries = new Map();
    this.userFlags = new Map();
    this.mediaFiles = new Map();
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      ...insertUser,
      id,
      rating: 0,
      totalReviews: 0,
      creditBalance: insertUser.creditBalance || 0,
      subscriptionStatus: insertUser.subscriptionStatus || 'basic',
      subscriptionExpiresAt: insertUser.subscriptionExpiresAt || null,
      totalSessionsCompleted: insertUser.totalSessionsCompleted || 0,
      totalSessionsTaught: insertUser.totalSessionsTaught || 0,
      skillPoints: insertUser.skillPoints || 0,
      badges: insertUser.badges || [],
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  // Skills
  async getSkill(id: string): Promise<Skill | undefined> {
    return this.skills.get(id);
  }

  async getSkillsByUser(userId: string): Promise<Skill[]> {
    return Array.from(this.skills.values()).filter(
      (skill) => skill.userId === userId,
    );
  }

  async createSkill(insertSkill: InsertSkill): Promise<Skill> {
    const id = randomUUID();
    const skill: Skill = {
      ...insertSkill,
      id,
      createdAt: new Date(),
    };
    this.skills.set(id, skill);
    return skill;
  }

  async updateSkill(id: string, updates: Partial<Skill>): Promise<Skill | undefined> {
    const skill = this.skills.get(id);
    if (!skill) return undefined;
    
    const updatedSkill = { ...skill, ...updates };
    this.skills.set(id, updatedSkill);
    return updatedSkill;
  }

  async deleteSkill(id: string): Promise<boolean> {
    return this.skills.delete(id);
  }

  // Skill Matches
  async getMatch(id: string): Promise<SkillMatch | undefined> {
    return this.matches.get(id);
  }

  async getMatchesByUser(userId: string): Promise<SkillMatch[]> {
    return Array.from(this.matches.values()).filter(
      (match) => match.userId === userId || match.matchedUserId === userId,
    );
  }

  async createMatch(insertMatch: InsertMatch): Promise<SkillMatch> {
    const id = randomUUID();
    const match: SkillMatch = {
      ...insertMatch,
      id,
      status: "pending",
      createdAt: new Date(),
    };
    this.matches.set(id, match);
    return match;
  }

  async updateMatch(id: string, status: string): Promise<SkillMatch | undefined> {
    const match = this.matches.get(id);
    if (!match) return undefined;
    
    const updatedMatch = { ...match, status };
    this.matches.set(id, updatedMatch);
    return updatedMatch;
  }

  // Messages
  async getMessage(id: string): Promise<Message | undefined> {
    return this.messages.get(id);
  }

  async getMessagesBetweenUsers(user1Id: string, user2Id: string): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(
        (msg) =>
          (msg.senderId === user1Id && msg.receiverId === user2Id) ||
          (msg.senderId === user2Id && msg.receiverId === user1Id),
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async getConversationsByUser(userId: string): Promise<any[]> {
    const userMessages = Array.from(this.messages.values()).filter(
      (msg) => msg.senderId === userId || msg.receiverId === userId,
    );

    const partnersMap = new Map<string, { lastMessage: Message; unreadCount: number }>();

    for (const msg of userMessages) {
      const partnerId = msg.senderId === userId ? msg.receiverId : msg.senderId;
      const existing = partnersMap.get(partnerId);
      
      if (!existing || msg.createdAt > existing.lastMessage.createdAt) {
        const unreadCount = userMessages.filter(
          (m) => m.senderId === partnerId && m.receiverId === userId && !m.read
        ).length;
        
        partnersMap.set(partnerId, {
          lastMessage: msg,
          unreadCount,
        });
      }
    }

    const conversations = await Promise.all(
      Array.from(partnersMap.entries()).map(async ([partnerId, data]) => {
        const partner = await this.getUser(partnerId);
        return {
          partnerId,
          partner,
          lastMessage: data.lastMessage,
          unreadCount: data.unreadCount,
        };
      })
    );

    return conversations.sort(
      (a, b) => b.lastMessage.createdAt.getTime() - a.lastMessage.createdAt.getTime()
    );
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = randomUUID();
    const message: Message = {
      ...insertMessage,
      id,
      read: false,
      createdAt: new Date(),
    };
    this.messages.set(id, message);
    return message;
  }

  async markMessageAsRead(id: string): Promise<Message | undefined> {
    const message = this.messages.get(id);
    if (!message) return undefined;
    
    const updatedMessage = { ...message, read: true };
    this.messages.set(id, updatedMessage);
    return updatedMessage;
  }

  // Group Messages
  async getGroupMessages(): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(msg => !msg.receiverId) // Group messages have no specific receiver
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(-100); // Return last 100 messages
  }

  async createGroupMessage(data: { senderId: string; content: string }): Promise<Message> {
    const id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const message: Message = {
      id,
      senderId: data.senderId,
      receiverId: null, // null for group messages
      content: data.content,
      read: true, // Group messages are considered "read" by default
      createdAt: new Date(),
    };
    this.messages.set(id, message);
    return message;
  }

  // Events
  async getEvent(id: string): Promise<Event | undefined> {
    return this.events.get(id);
  }

  async getEventsByUser(userId: string): Promise<Event[]> {
    return Array.from(this.events.values())
      .filter((event) => event.userId === userId || event.partnerId === userId)
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }

  async createEvent(insertEvent: InsertEvent): Promise<Event> {
    const id = randomUUID();
    const event: Event = {
      ...insertEvent,
      id,
      createdAt: new Date(),
    };
    this.events.set(id, event);
    return event;
  }

  async updateEvent(id: string, updates: Partial<Event>): Promise<Event | undefined> {
    const event = this.events.get(id);
    if (!event) return undefined;
    
    const updatedEvent = { ...event, ...updates };
    this.events.set(id, updatedEvent);
    return updatedEvent;
  }

  async deleteEvent(id: string): Promise<boolean> {
    return this.events.delete(id);
  }

  // Reviews
  async getReview(id: string): Promise<Review | undefined> {
    return this.reviews.get(id);
  }

  async getReviewsByUser(userId: string): Promise<Review[]> {
    return Array.from(this.reviews.values())
      .filter((review) => review.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createReview(insertReview: InsertReview): Promise<Review> {
    const id = randomUUID();
    const review: Review = {
      ...insertReview,
      id,
      createdAt: new Date(),
    };
    this.reviews.set(id, review);
    
    // Update user rating (stored as integer * 10, e.g., 45 for 4.5)
    const user = await this.getUser(insertReview.userId);
    if (user) {
      const userReviews = await this.getReviewsByUser(insertReview.userId);
      const totalRating = userReviews.reduce((sum, r) => sum + r.rating, 0);
      const avgRating = totalRating / userReviews.length;
      
      await this.updateUser(insertReview.userId, {
        rating: Math.round(avgRating * 10), // Store as integer * 10
        totalReviews: userReviews.length,
      });
    }
    
    return review;
  }

  // Notifications
  async getNotification(id: string): Promise<Notification | undefined> {
    return this.notifications.get(id);
  }

  async getNotificationsByUser(userId: string): Promise<Notification[]> {
    return Array.from(this.notifications.values())
      .filter((notification) => notification.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createNotification(insertNotification: InsertNotification): Promise<Notification> {
    const id = randomUUID();
    const notification: Notification = {
      ...insertNotification,
      id,
      read: false,
      createdAt: new Date(),
    };
    this.notifications.set(id, notification);
    return notification;
  }

  async markNotificationAsRead(id: string): Promise<Notification | undefined> {
    const notification = this.notifications.get(id);
    if (!notification) return undefined;
    
    const updatedNotification = { ...notification, read: true };
    this.notifications.set(id, updatedNotification);
    return updatedNotification;
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    const userNotifications = await this.getNotificationsByUser(userId);
    for (const notification of userNotifications) {
      await this.markNotificationAsRead(notification.id);
    }
  }

  // User Preferences
  async getUserPreferences(userId: string): Promise<UserPreferences | undefined> {
    return Array.from(this.userPreferences.values()).find(
      (prefs) => prefs.userId === userId
    );
  }

  async createUserPreferences(insertPreferences: InsertUserPreferences): Promise<UserPreferences> {
    const id = randomUUID();
    const preferences: UserPreferences = {
      ...insertPreferences,
      id,
      updatedAt: new Date(),
    };
    this.userPreferences.set(id, preferences);
    return preferences;
  }

  async updateUserPreferences(userId: string, updates: Partial<UserPreferences>): Promise<UserPreferences | undefined> {
    const existing = await this.getUserPreferences(userId);
    if (!existing) return undefined;
    
    const updatedPreferences = { 
      ...existing, 
      ...updates, 
      updatedAt: new Date() 
    };
    this.userPreferences.set(existing.id, updatedPreferences);
    return updatedPreferences;
  }

  // Credit Transactions
  async getCreditTransaction(id: string): Promise<CreditTransaction | undefined> {
    return this.creditTransactions.get(id);
  }

  async getCreditTransactionsByUser(userId: string): Promise<CreditTransaction[]> {
    return Array.from(this.creditTransactions.values()).filter(
      (transaction) => transaction.userId === userId
    );
  }

  async createCreditTransaction(insertTransaction: InsertCreditTransaction): Promise<CreditTransaction> {
    const id = randomUUID();
    const transaction: CreditTransaction = {
      ...insertTransaction,
      id,
      createdAt: new Date(),
    };
    this.creditTransactions.set(id, transaction);
    return transaction;
  }

  // Skill Sessions
  async getSkillSession(id: string): Promise<SkillSession | undefined> {
    return this.skillSessions.get(id);
  }

  async getSkillSessionsByUser(userId: string): Promise<SkillSession[]> {
    return Array.from(this.skillSessions.values()).filter(
      (session) => session.teacherId === userId || session.studentId === userId
    );
  }

  async createSkillSession(insertSession: InsertSkillSession): Promise<SkillSession> {
    const id = randomUUID();
    const session: SkillSession = {
      ...insertSession,
      id,
      status: insertSession.status || 'scheduled',
      createdAt: new Date(),
    };
    this.skillSessions.set(id, session);
    return session;
  }

  async updateSkillSession(id: string, updates: Partial<SkillSession>): Promise<SkillSession | undefined> {
    const session = this.skillSessions.get(id);
    if (!session) return undefined;
    
    const updatedSession = { ...session, ...updates };
    this.skillSessions.set(id, updatedSession);
    return updatedSession;
  }

  // Courses
  async getCourse(id: string): Promise<Course | undefined> {
    return this.courses.get(id);
  }

  async getCoursesByCreator(creatorId: string): Promise<Course[]> {
    return Array.from(this.courses.values()).filter(
      (course) => course.creatorId === creatorId
    );
  }

  async getCoursesBySkill(skillId: string): Promise<Course[]> {
    return Array.from(this.courses.values()).filter(
      (course) => course.skillId === skillId
    );
  }

  async searchCourses(query?: string, category?: string, status?: string): Promise<Course[]> {
    let courses = Array.from(this.courses.values());

    if (status) {
      courses = courses.filter(course => course.status === status);
    }

    if (query) {
      const lowerQuery = query.toLowerCase();
      courses = courses.filter(course => 
        course.title.toLowerCase().includes(lowerQuery) ||
        course.description.toLowerCase().includes(lowerQuery)
      );
    }

    if (category) {
      // For category filtering, we'd need to join with skills table
      // For now, we'll skip this filter in the memory implementation
    }

    return courses.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createCourse(insertCourse: InsertCourse): Promise<Course> {
    const id = randomUUID();
    const course: Course = {
      ...insertCourse,
      id,
      status: insertCourse.status || 'draft',
      totalLessons: 0,
      totalDuration: 0,
      rating: 0,
      totalReviews: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.courses.set(id, course);
    return course;
  }

  async updateCourse(id: string, updates: Partial<Course>): Promise<Course | undefined> {
    const course = this.courses.get(id);
    if (!course) return undefined;
    
    const updatedCourse = { 
      ...course, 
      ...updates, 
      updatedAt: new Date() 
    };
    this.courses.set(id, updatedCourse);
    return updatedCourse;
  }

  async deleteCourse(id: string): Promise<boolean> {
    return this.courses.delete(id);
  }

  // Course Lessons
  async getCourseLesson(id: string): Promise<CourseLesson | undefined> {
    return this.courseLessons.get(id);
  }

  async getLessonsByCourse(courseId: string): Promise<CourseLesson[]> {
    return Array.from(this.courseLessons.values())
      .filter(lesson => lesson.courseId === courseId)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }

  async createCourseLesson(insertLesson: InsertCourseLesson): Promise<CourseLesson> {
    const id = randomUUID();
    const lesson: CourseLesson = {
      ...insertLesson,
      id,
      createdAt: new Date(),
    };
    this.courseLessons.set(id, lesson);

    // Update course totals
    const course = await this.getCourse(insertLesson.courseId);
    if (course) {
      const lessons = await this.getLessonsByCourse(insertLesson.courseId);
      const totalDuration = lessons.reduce((sum, l) => sum + (l.duration || 0), 0);
      await this.updateCourse(insertLesson.courseId, {
        totalLessons: lessons.length,
        totalDuration,
      });
    }

    return lesson;
  }

  async updateCourseLesson(id: string, updates: Partial<CourseLesson>): Promise<CourseLesson | undefined> {
    const lesson = this.courseLessons.get(id);
    if (!lesson) return undefined;
    
    const updatedLesson = { ...lesson, ...updates };
    this.courseLessons.set(id, updatedLesson);

    // Update course totals if duration changed
    if (updates.duration !== undefined) {
      const course = await this.getCourse(lesson.courseId);
      if (course) {
        const lessons = await this.getLessonsByCourse(lesson.courseId);
        const totalDuration = lessons.reduce((sum, l) => sum + (l.duration || 0), 0);
        await this.updateCourse(lesson.courseId, { totalDuration });
      }
    }

    return updatedLesson;
  }

  async deleteCourseLesson(id: string): Promise<boolean> {
    const lesson = this.courseLessons.get(id);
    if (!lesson) return false;

    const deleted = this.courseLessons.delete(id);
    
    if (deleted) {
      // Update course totals
      const course = await this.getCourse(lesson.courseId);
      if (course) {
        const lessons = await this.getLessonsByCourse(lesson.courseId);
        const totalDuration = lessons.reduce((sum, l) => sum + (l.duration || 0), 0);
        await this.updateCourse(lesson.courseId, {
          totalLessons: lessons.length,
          totalDuration,
        });
      }
    }

    return deleted;
  }

  // Course Enrollments
  async getCourseEnrollment(id: string): Promise<CourseEnrollment | undefined> {
    return this.courseEnrollments.get(id);
  }

  async getEnrollmentsByUser(userId: string): Promise<CourseEnrollment[]> {
    return Array.from(this.courseEnrollments.values())
      .filter(enrollment => enrollment.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getCourseEnrollmentsByUser(userId: string): Promise<CourseEnrollment[]> {
    return this.getEnrollmentsByUser(userId);
  }

  async getAllCourseEnrollments(): Promise<CourseEnrollment[]> {
    return Array.from(this.courseEnrollments.values());
  }

  async getEnrollmentsByCourse(courseId: string): Promise<CourseEnrollment[]> {
    return Array.from(this.courseEnrollments.values())
      .filter(enrollment => enrollment.courseId === courseId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getUserCourseEnrollment(userId: string, courseId: string): Promise<CourseEnrollment | undefined> {
    return Array.from(this.courseEnrollments.values()).find(
      enrollment => enrollment.userId === userId && enrollment.courseId === courseId
    );
  }

  async createCourseEnrollment(insertEnrollment: InsertCourseEnrollment): Promise<CourseEnrollment> {
    const id = randomUUID();
    const enrollment: CourseEnrollment = {
      ...insertEnrollment,
      id,
      progress: 0,
      completedAt: null,
      createdAt: new Date(),
    };
    this.courseEnrollments.set(id, enrollment);
    return enrollment;
  }

  async updateCourseEnrollment(id: string, updates: Partial<CourseEnrollment>): Promise<CourseEnrollment | undefined> {
    const enrollment = this.courseEnrollments.get(id);
    if (!enrollment) return undefined;
    
    const updatedEnrollment = { ...enrollment, ...updates };
    
    // Set completion date if progress reaches 100%
    if (updates.progress === 100 && !enrollment.completedAt) {
      updatedEnrollment.completedAt = new Date();
    }
    
    this.courseEnrollments.set(id, updatedEnrollment);
    return updatedEnrollment;
  }

  // Lesson Progress
  async getLessonProgress(enrollmentId: string, lessonId: string): Promise<LessonProgress | undefined> {
    for (const progress of this.lessonProgress.values()) {
      if (progress.enrollmentId === enrollmentId && progress.lessonId === lessonId) {
        return progress;
      }
    }
    return undefined;
  }

  async getLessonProgressByEnrollment(enrollmentId: string): Promise<LessonProgress[]> {
    return Array.from(this.lessonProgress.values())
      .filter(progress => progress.enrollmentId === enrollmentId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async createLessonProgress(progressData: InsertLessonProgress): Promise<LessonProgress> {
    const id = randomUUID();
    const now = new Date();
    const progress: LessonProgress = {
      id,
      ...progressData,
      completed: false,
      timeSpent: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.lessonProgress.set(id, progress);
    return progress;
  }

  async updateLessonProgress(id: string, updates: Partial<LessonProgress>): Promise<LessonProgress | undefined> {
    const progress = this.lessonProgress.get(id);
    if (!progress) return undefined;
    
    const updatedProgress = { 
      ...progress, 
      ...updates, 
      updatedAt: new Date(),
      // Set completion date if marked as completed
      completedAt: updates.completed && !progress.completedAt ? new Date() : progress.completedAt
    };
    
    this.lessonProgress.set(id, updatedProgress);
    return updatedProgress;
  }

  // Course Certificates
  async getCourseCertificate(id: string): Promise<CourseCertificate | undefined> {
    return this.courseCertificates.get(id);
  }

  async getCertificatesByUser(userId: string): Promise<CourseCertificate[]> {
    return Array.from(this.courseCertificates.values())
      .filter(cert => cert.userId === userId)
      .sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());
  }

  async getCertificateByEnrollment(enrollmentId: string): Promise<CourseCertificate | undefined> {
    for (const cert of this.courseCertificates.values()) {
      if (cert.enrollmentId === enrollmentId) {
        return cert;
      }
    }
    return undefined;
  }

  async createCourseCertificate(certificateData: InsertCourseCertificate): Promise<CourseCertificate> {
    const id = randomUUID();
    const now = new Date();
    const certificate: CourseCertificate = {
      id,
      ...certificateData,
      createdAt: now,
    };
    this.courseCertificates.set(id, certificate);
    return certificate;
  }

  // Subscription methods
  async getSubscription(id: string): Promise<Subscription | undefined> {
    return this.subscriptions.get(id);
  }

  async getSubscriptionByUser(userId: string): Promise<Subscription | undefined> {
    for (const subscription of this.subscriptions.values()) {
      if (subscription.userId === userId) {
        return subscription;
      }
    }
    return undefined;
  }

  async createSubscription(subscriptionData: InsertSubscription): Promise<Subscription> {
    const id = randomUUID();
    const now = new Date();
    const subscription: Subscription = {
      id,
      ...subscriptionData,
      createdAt: now,
      updatedAt: now,
    };
    this.subscriptions.set(id, subscription);
    return subscription;
  }

  async updateSubscription(id: string, subscriptionData: Partial<Subscription>): Promise<Subscription | undefined> {
    const subscription = this.subscriptions.get(id);
    if (!subscription) return undefined;

    const updatedSubscription: Subscription = {
      ...subscription,
      ...subscriptionData,
      updatedAt: new Date(),
    };
    this.subscriptions.set(id, updatedSubscription);
    return updatedSubscription;
  }

  async deleteSubscription(id: string): Promise<boolean> {
    return this.subscriptions.delete(id);
  }

  // Notification Preferences methods
  async getNotificationPreferences(userId: string): Promise<NotificationPreferences | undefined> {
    for (const prefs of this.notificationPreferences.values()) {
      if (prefs.userId === userId) {
        return prefs;
      }
    }
    return undefined;
  }

  async createNotificationPreferences(preferencesData: InsertNotificationPreferences): Promise<NotificationPreferences> {
    const id = randomUUID();
    const now = new Date();
    const preferences: NotificationPreferences = {
      id,
      ...preferencesData,
      createdAt: now,
      updatedAt: now,
    };
    this.notificationPreferences.set(id, preferences);
    return preferences;
  }

  async updateNotificationPreferences(userId: string, preferencesData: Partial<NotificationPreferences>): Promise<NotificationPreferences | undefined> {
    const existing = await this.getNotificationPreferences(userId);
    if (!existing) return undefined;

    const updatedPreferences: NotificationPreferences = {
      ...existing,
      ...preferencesData,
      updatedAt: new Date(),
    };
    this.notificationPreferences.set(existing.id, updatedPreferences);
    return updatedPreferences;
  }

  // Push Token methods
  async getUserPushTokens(userId: string): Promise<PushToken[]> {
    return Array.from(this.pushTokens.values())
      .filter(token => token.userId === userId && token.isActive)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async addPushToken(tokenData: InsertPushToken): Promise<PushToken> {
    const id = randomUUID();
    const now = new Date();
    const token: PushToken = {
      id,
      ...tokenData,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    this.pushTokens.set(id, token);
    return token;
  }

  async removePushToken(userId: string, tokenId: string): Promise<boolean> {
    const token = this.pushTokens.get(tokenId);
    if (!token || token.userId !== userId) return false;
    
    return this.pushTokens.delete(tokenId);
  }

  async deactivatePushToken(tokenId: string): Promise<boolean> {
    const token = this.pushTokens.get(tokenId);
    if (!token) return false;
    
    const updatedToken: PushToken = {
      ...token,
      isActive: false,
      updatedAt: new Date(),
    };
    this.pushTokens.set(tokenId, updatedToken);
    return true;
  }

  // API Key methods
  async createApiKey(apiKey: any): Promise<any> {
    this.apiKeys.set(apiKey.id, apiKey);
    return apiKey;
  }

  async getApiKeyByHash(hash: string): Promise<any | undefined> {
    return Array.from(this.apiKeys.values()).find(key => key.keyHash === hash);
  }

  async updateApiKeyLastUsed(keyId: string): Promise<void> {
    const apiKey = this.apiKeys.get(keyId);
    if (apiKey) {
      apiKey.lastUsed = new Date();
      this.apiKeys.set(keyId, apiKey);
    }
  }

  async revokeApiKey(keyId: string, userId: string): Promise<boolean> {
    const apiKey = this.apiKeys.get(keyId);
    if (!apiKey || apiKey.userId !== userId) return false;
    
    apiKey.isActive = false;
    this.apiKeys.set(keyId, apiKey);
    return true;
  }

  async getUserApiKeys(userId: string): Promise<any[]> {
    return Array.from(this.apiKeys.values())
      .filter(key => key.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // Audit Log methods
  async createAuditLogEntry(entry: any): Promise<void> {
    this.auditLogs.set(entry.id, entry);
  }

  async getUserAuditLogs(userId: string, limit: number, offset: number): Promise<any[]> {
    const logs = Array.from(this.auditLogs.values())
      .filter(log => log.userId === userId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(offset, offset + limit);
    return logs;
  }

  async getResourceAuditLogs(resource: string, resourceId?: string, limit: number = 100, offset: number = 0): Promise<any[]> {
    let logs = Array.from(this.auditLogs.values())
      .filter(log => log.resource === resource);
    
    if (resourceId) {
      logs = logs.filter(log => log.resourceId === resourceId);
    }
    
    return logs
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(offset, offset + limit);
  }

  async getSecurityEvents(since: Date, severity?: string): Promise<any[]> {
    let logs = Array.from(this.auditLogs.values())
      .filter(log => 
        log.resource === 'security' && 
        log.timestamp >= since
      );
    
    if (severity) {
      logs = logs.filter(log => log.details?.severity === severity);
    }
    
    return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async getFailedAuthAttempts(since: Date, ipAddress?: string): Promise<any[]> {
    let logs = Array.from(this.auditLogs.values())
      .filter(log => 
        log.resource === 'authentication' && 
        !log.success &&
        log.timestamp >= since
      );
    
    if (ipAddress) {
      logs = logs.filter(log => log.ipAddress === ipAddress);
    }
    
    return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async deleteOldAuditLogs(cutoffDate: Date): Promise<number> {
    const oldLogs = Array.from(this.auditLogs.entries())
      .filter(([_, log]) => log.timestamp < cutoffDate);
    
    oldLogs.forEach(([id, _]) => this.auditLogs.delete(id));
    return oldLogs.length;
  }

  // Content Moderation methods
  async createContentReport(report: any): Promise<any> {
    this.contentReports.set(report.id, report);
    return report;
  }

  async getContentReport(reportId: string): Promise<any | undefined> {
    return this.contentReports.get(reportId);
  }

  async getContentReports(status?: string, contentType?: string, limit: number = 50): Promise<any[]> {
    let reports = Array.from(this.contentReports.values());
    
    if (status) {
      reports = reports.filter(report => report.status === status);
    }
    
    if (contentType) {
      reports = reports.filter(report => report.contentType === contentType);
    }
    
    return reports
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async updateContentReport(reportId: string, updates: any): Promise<any> {
    const existing = this.contentReports.get(reportId);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates };
    this.contentReports.set(reportId, updated);
    return updated;
  }

  async createUserBehaviorEntry(entry: any): Promise<void> {
    this.userBehaviorEntries.set(entry.id, entry);
  }

  async getUserBehaviorEntries(userId: string, since: Date): Promise<any[]> {
    return Array.from(this.userBehaviorEntries.values())
      .filter(entry => entry.userId === userId && entry.timestamp >= since)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async createUserFlag(flag: any): Promise<any> {
    this.userFlags.set(flag.id, flag);
    return flag;
  }

  async getUserFlag(flagId: string): Promise<any | undefined> {
    return this.userFlags.get(flagId);
  }

  async getUserFlags(status?: string, limit: number = 50): Promise<any[]> {
    let flags = Array.from(this.userFlags.values());
    
    if (status) {
      flags = flags.filter(flag => flag.status === status);
    }
    
    return flags
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async updateUserFlag(flagId: string, updates: any): Promise<any> {
    const existing = this.userFlags.get(flagId);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates };
    this.userFlags.set(flagId, updated);
    return updated;
  }

  // Media Files methods
  async getMediaFile(id: string): Promise<MediaFile | undefined> {
    return this.mediaFiles.get(id);
  }

  async getMediaFilesByUser(userId: string, fileType?: string): Promise<MediaFile[]> {
    let files = Array.from(this.mediaFiles.values())
      .filter(file => file.userId === userId);
    
    if (fileType) {
      files = files.filter(file => file.fileType === fileType);
    }
    
    return files.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getMediaFilesByRelated(relatedType: string, relatedId: string): Promise<MediaFile[]> {
    return Array.from(this.mediaFiles.values())
      .filter(file => file.relatedType === relatedType && file.relatedId === relatedId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createMediaFile(mediaFileData: InsertMediaFile): Promise<MediaFile> {
    const id = randomUUID();
    const now = new Date();
    const mediaFile: MediaFile = {
      id,
      ...mediaFileData,
      processingStatus: 'pending',
      virusScanStatus: 'pending',
      createdAt: now,
      updatedAt: now,
    };
    this.mediaFiles.set(id, mediaFile);
    return mediaFile;
  }

  async updateMediaFile(id: string, updates: Partial<MediaFile>): Promise<MediaFile | undefined> {
    const mediaFile = this.mediaFiles.get(id);
    if (!mediaFile) return undefined;
    
    const updatedMediaFile = { 
      ...mediaFile, 
      ...updates, 
      updatedAt: new Date() 
    };
    this.mediaFiles.set(id, updatedMediaFile);
    return updatedMediaFile;
  }

  async deleteMediaFile(id: string): Promise<boolean> {
    return this.mediaFiles.delete(id);
  }
}

import { PostgresStorage } from './postgres-storage';

export const storage = new PostgresStorage();
