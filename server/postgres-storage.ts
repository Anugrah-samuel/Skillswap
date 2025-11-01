import { eq, and, desc, asc, sql, like, or, isNull } from 'drizzle-orm';
import { db } from './db';
import * as schema from '@shared/schema';
import type { IStorage } from './storage';
import type {
  User, InsertUser,
  Skill, InsertSkill,
  SkillMatch, InsertMatch,
  Message, InsertMessage,
  Event, InsertEvent,
  Review, InsertReview,
  Notification, InsertNotification,
  UserPreferences, InsertUserPreferences,
  CreditTransaction, InsertCreditTransaction,
  SkillSession, InsertSkillSession,
  Course, InsertCourse,
  CourseLesson, InsertCourseLesson,
  CourseEnrollment, InsertCourseEnrollment,
  LessonProgress, InsertLessonProgress,
  CourseCertificate, InsertCourseCertificate,
  Subscription, InsertSubscription,
  NotificationPreferences, InsertNotificationPreferences,
  PushToken, InsertPushToken,
  MediaFile, InsertMediaFile
} from '@shared/schema';

export class PostgresStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(schema.users).where(eq(schema.users.username, username)).limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(schema.users).values(user).returning();
    return result[0];
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const result = await db.update(schema.users).set(updates).where(eq(schema.users.id, id)).returning();
    return result[0];
  }

  // User Preferences
  async getUserPreferences(userId: string): Promise<UserPreferences | undefined> {
    const result = await db.select().from(schema.userPreferences).where(eq(schema.userPreferences.userId, userId)).limit(1);
    return result[0];
  }

  async createUserPreferences(preferences: InsertUserPreferences): Promise<UserPreferences> {
    const result = await db.insert(schema.userPreferences).values(preferences).returning();
    return result[0];
  }

  async updateUserPreferences(userId: string, updates: Partial<UserPreferences>): Promise<UserPreferences | undefined> {
    const result = await db.update(schema.userPreferences)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.userPreferences.userId, userId))
      .returning();
    return result[0];
  }

  // Skills
  async getSkill(id: string): Promise<Skill | undefined> {
    const result = await db.select().from(schema.skills).where(eq(schema.skills.id, id)).limit(1);
    return result[0];
  }

  async getSkillsByUser(userId: string): Promise<Skill[]> {
    return await db.select().from(schema.skills).where(eq(schema.skills.userId, userId));
  }

  async createSkill(skill: InsertSkill): Promise<Skill> {
    const result = await db.insert(schema.skills).values(skill).returning();
    return result[0];
  }

  async updateSkill(id: string, updates: Partial<Skill>): Promise<Skill | undefined> {
    const result = await db.update(schema.skills).set(updates).where(eq(schema.skills.id, id)).returning();
    return result[0];
  }

  async deleteSkill(id: string): Promise<boolean> {
    const result = await db.delete(schema.skills).where(eq(schema.skills.id, id));
    return result.rowCount > 0;
  }

  // Skill Matches
  async getMatch(id: string): Promise<SkillMatch | undefined> {
    const result = await db.select().from(schema.skillMatches).where(eq(schema.skillMatches.id, id)).limit(1);
    return result[0];
  }

  async getMatchesByUser(userId: string): Promise<SkillMatch[]> {
    return await db.select().from(schema.skillMatches)
      .where(or(eq(schema.skillMatches.userId, userId), eq(schema.skillMatches.matchedUserId, userId)));
  }

  async createMatch(match: InsertMatch): Promise<SkillMatch> {
    const result = await db.insert(schema.skillMatches).values(match).returning();
    return result[0];
  }

  async updateMatch(id: string, status: string): Promise<SkillMatch | undefined> {
    const result = await db.update(schema.skillMatches).set({ status }).where(eq(schema.skillMatches.id, id)).returning();
    return result[0];
  }

  // Messages
  async getMessage(id: string): Promise<Message | undefined> {
    const result = await db.select().from(schema.messages).where(eq(schema.messages.id, id)).limit(1);
    return result[0];
  }

  async getMessagesBetweenUsers(user1Id: string, user2Id: string): Promise<Message[]> {
    return await db.select().from(schema.messages)
      .where(
        or(
          and(eq(schema.messages.senderId, user1Id), eq(schema.messages.receiverId, user2Id)),
          and(eq(schema.messages.senderId, user2Id), eq(schema.messages.receiverId, user1Id))
        )
      )
      .orderBy(asc(schema.messages.createdAt));
  }

  async getConversationsByUser(userId: string): Promise<any[]> {
    // This is a complex query that would need raw SQL or multiple queries
    // For now, implementing a simplified version
    const messages = await db.select().from(schema.messages)
      .where(or(eq(schema.messages.senderId, userId), eq(schema.messages.receiverId, userId)))
      .orderBy(desc(schema.messages.createdAt));

    const partnersMap = new Map<string, { lastMessage: Message; unreadCount: number }>();

    for (const msg of messages) {
      const partnerId = msg.senderId === userId ? msg.receiverId : msg.senderId;
      const existing = partnersMap.get(partnerId);
      
      if (!existing || msg.createdAt > existing.lastMessage.createdAt) {
        const unreadCount = messages.filter(
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

  async createMessage(message: InsertMessage): Promise<Message> {
    const result = await db.insert(schema.messages).values(message).returning();
    return result[0];
  }

  async markMessageAsRead(id: string): Promise<Message | undefined> {
    const result = await db.update(schema.messages).set({ read: true }).where(eq(schema.messages.id, id)).returning();
    return result[0];
  }

  // Group Messages
  async getGroupMessages(): Promise<Message[]> {
    const messages = await db.select({
      id: schema.messages.id,
      senderId: schema.messages.senderId,
      receiverId: schema.messages.receiverId,
      content: schema.messages.content,
      read: schema.messages.read,
      createdAt: schema.messages.createdAt,
      sender: {
        id: schema.users.id,
        username: schema.users.username,
        fullName: schema.users.fullName,
        avatarUrl: schema.users.avatarUrl,
      }
    })
    .from(schema.messages)
    .leftJoin(schema.users, eq(schema.messages.senderId, schema.users.id))
    .where(isNull(schema.messages.receiverId)) // Group messages have null receiverId
    .orderBy(asc(schema.messages.createdAt))
    .limit(100);

    return messages;
  }

  async createGroupMessage(data: { senderId: string; content: string }): Promise<Message> {
    const result = await db.insert(schema.messages).values({
      senderId: data.senderId,
      receiverId: null, // null for group messages
      content: data.content,
      read: true, // Group messages are considered "read" by default
    }).returning();
    
    // Get the message with sender info
    const messageWithSender = await db.select({
      id: schema.messages.id,
      senderId: schema.messages.senderId,
      receiverId: schema.messages.receiverId,
      content: schema.messages.content,
      read: schema.messages.read,
      createdAt: schema.messages.createdAt,
      sender: {
        id: schema.users.id,
        username: schema.users.username,
        fullName: schema.users.fullName,
        avatarUrl: schema.users.avatarUrl,
      }
    })
    .from(schema.messages)
    .leftJoin(schema.users, eq(schema.messages.senderId, schema.users.id))
    .where(eq(schema.messages.id, result[0].id))
    .limit(1);

    return messageWithSender[0];
  }

  // Events
  async getEvent(id: string): Promise<Event | undefined> {
    const result = await db.select().from(schema.events).where(eq(schema.events.id, id)).limit(1);
    return result[0];
  }

  async getEventsByUser(userId: string): Promise<Event[]> {
    return await db.select().from(schema.events)
      .where(or(eq(schema.events.userId, userId), eq(schema.events.partnerId, userId)))
      .orderBy(asc(schema.events.startTime));
  }

  async createEvent(event: InsertEvent): Promise<Event> {
    const result = await db.insert(schema.events).values(event).returning();
    return result[0];
  }

  async updateEvent(id: string, updates: Partial<Event>): Promise<Event | undefined> {
    const result = await db.update(schema.events).set(updates).where(eq(schema.events.id, id)).returning();
    return result[0];
  }

  async deleteEvent(id: string): Promise<boolean> {
    const result = await db.delete(schema.events).where(eq(schema.events.id, id));
    return result.rowCount > 0;
  }

  // Reviews
  async getReview(id: string): Promise<Review | undefined> {
    const result = await db.select().from(schema.reviews).where(eq(schema.reviews.id, id)).limit(1);
    return result[0];
  }

  async getReviewsByUser(userId: string): Promise<Review[]> {
    return await db.select().from(schema.reviews)
      .where(eq(schema.reviews.userId, userId))
      .orderBy(desc(schema.reviews.createdAt));
  }

  async createReview(review: InsertReview): Promise<Review> {
    const result = await db.insert(schema.reviews).values(review).returning();
    
    // Update user rating
    const userReviews = await this.getReviewsByUser(review.userId);
    const totalRating = userReviews.reduce((sum, r) => sum + r.rating, 0);
    const avgRating = totalRating / userReviews.length;
    
    await this.updateUser(review.userId, {
      rating: Math.round(avgRating * 10), // Store as integer * 10
      totalReviews: userReviews.length,
    });
    
    return result[0];
  }

  // Notifications
  async getNotification(id: string): Promise<Notification | undefined> {
    const result = await db.select().from(schema.notifications).where(eq(schema.notifications.id, id)).limit(1);
    return result[0];
  }

  async getNotificationsByUser(userId: string): Promise<Notification[]> {
    return await db.select().from(schema.notifications)
      .where(eq(schema.notifications.userId, userId))
      .orderBy(desc(schema.notifications.createdAt));
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const result = await db.insert(schema.notifications).values(notification).returning();
    return result[0];
  }

  async markNotificationAsRead(id: string): Promise<Notification | undefined> {
    const result = await db.update(schema.notifications).set({ read: true }).where(eq(schema.notifications.id, id)).returning();
    return result[0];
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await db.update(schema.notifications).set({ read: true }).where(eq(schema.notifications.userId, userId));
  }

  // Credit Transactions
  async getCreditTransaction(id: string): Promise<CreditTransaction | undefined> {
    const result = await db.select().from(schema.creditTransactions).where(eq(schema.creditTransactions.id, id)).limit(1);
    return result[0];
  }

  async getCreditTransactionsByUser(userId: string): Promise<CreditTransaction[]> {
    return await db.select().from(schema.creditTransactions)
      .where(eq(schema.creditTransactions.userId, userId))
      .orderBy(desc(schema.creditTransactions.createdAt));
  }

  async createCreditTransaction(transaction: InsertCreditTransaction): Promise<CreditTransaction> {
    const result = await db.insert(schema.creditTransactions).values(transaction).returning();
    return result[0];
  }

  // Skill Sessions
  async getSkillSession(id: string): Promise<SkillSession | undefined> {
    const result = await db.select().from(schema.skillSessions).where(eq(schema.skillSessions.id, id)).limit(1);
    return result[0];
  }

  async getSkillSessionsByUser(userId: string): Promise<SkillSession[]> {
    return await db.select().from(schema.skillSessions)
      .where(or(eq(schema.skillSessions.teacherId, userId), eq(schema.skillSessions.studentId, userId)))
      .orderBy(desc(schema.skillSessions.createdAt));
  }

  async createSkillSession(session: InsertSkillSession): Promise<SkillSession> {
    const result = await db.insert(schema.skillSessions).values(session).returning();
    return result[0];
  }

  async updateSkillSession(id: string, updates: Partial<SkillSession>): Promise<SkillSession | undefined> {
    const result = await db.update(schema.skillSessions).set(updates).where(eq(schema.skillSessions.id, id)).returning();
    return result[0];
  }

  // Courses
  async getCourse(id: string): Promise<Course | undefined> {
    const result = await db.select().from(schema.courses).where(eq(schema.courses.id, id)).limit(1);
    return result[0];
  }

  async getCoursesByCreator(creatorId: string): Promise<Course[]> {
    return await db.select().from(schema.courses)
      .where(eq(schema.courses.creatorId, creatorId))
      .orderBy(desc(schema.courses.createdAt));
  }

  async getCoursesBySkill(skillId: string): Promise<Course[]> {
    return await db.select().from(schema.courses)
      .where(eq(schema.courses.skillId, skillId))
      .orderBy(desc(schema.courses.createdAt));
  }

  async searchCourses(query?: string, category?: string, status?: string): Promise<Course[]> {
    let queryBuilder = db.select().from(schema.courses);
    
    const conditions = [];
    
    if (status) {
      conditions.push(eq(schema.courses.status, status));
    }
    
    if (query) {
      conditions.push(
        or(
          like(schema.courses.title, `%${query}%`),
          like(schema.courses.description, `%${query}%`)
        )
      );
    }
    
    if (conditions.length > 0) {
      queryBuilder = queryBuilder.where(and(...conditions));
    }
    
    return await queryBuilder.orderBy(desc(schema.courses.createdAt));
  }

  async createCourse(course: InsertCourse): Promise<Course> {
    const result = await db.insert(schema.courses).values(course).returning();
    return result[0];
  }

  async updateCourse(id: string, updates: Partial<Course>): Promise<Course | undefined> {
    const result = await db.update(schema.courses)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.courses.id, id))
      .returning();
    return result[0];
  }

  async deleteCourse(id: string): Promise<boolean> {
    const result = await db.delete(schema.courses).where(eq(schema.courses.id, id));
    return result.rowCount > 0;
  }

  // Course Lessons
  async getCourseLesson(id: string): Promise<CourseLesson | undefined> {
    const result = await db.select().from(schema.courseLessons).where(eq(schema.courseLessons.id, id)).limit(1);
    return result[0];
  }

  async getLessonsByCourse(courseId: string): Promise<CourseLesson[]> {
    return await db.select().from(schema.courseLessons)
      .where(eq(schema.courseLessons.courseId, courseId))
      .orderBy(asc(schema.courseLessons.orderIndex));
  }

  async createCourseLesson(lesson: InsertCourseLesson): Promise<CourseLesson> {
    const result = await db.insert(schema.courseLessons).values(lesson).returning();
    
    // Update course totals
    const lessons = await this.getLessonsByCourse(lesson.courseId);
    const totalDuration = lessons.reduce((sum, l) => sum + (l.duration || 0), 0);
    await this.updateCourse(lesson.courseId, {
      totalLessons: lessons.length,
      totalDuration,
    });
    
    return result[0];
  }

  async updateCourseLesson(id: string, updates: Partial<CourseLesson>): Promise<CourseLesson | undefined> {
    const lesson = await this.getCourseLesson(id);
    if (!lesson) return undefined;
    
    const result = await db.update(schema.courseLessons).set(updates).where(eq(schema.courseLessons.id, id)).returning();
    
    // Update course totals if duration changed
    if (updates.duration !== undefined) {
      const lessons = await this.getLessonsByCourse(lesson.courseId);
      const totalDuration = lessons.reduce((sum, l) => sum + (l.duration || 0), 0);
      await this.updateCourse(lesson.courseId, { totalDuration });
    }
    
    return result[0];
  }

  async deleteCourseLesson(id: string): Promise<boolean> {
    const lesson = await this.getCourseLesson(id);
    if (!lesson) return false;
    
    const result = await db.delete(schema.courseLessons).where(eq(schema.courseLessons.id, id));
    
    if (result.rowCount > 0) {
      // Update course totals
      const lessons = await this.getLessonsByCourse(lesson.courseId);
      const totalDuration = lessons.reduce((sum, l) => sum + (l.duration || 0), 0);
      await this.updateCourse(lesson.courseId, {
        totalLessons: lessons.length,
        totalDuration,
      });
    }
    
    return result.rowCount > 0;
  }

  // Course Enrollments
  async getCourseEnrollment(id: string): Promise<CourseEnrollment | undefined> {
    const result = await db.select().from(schema.courseEnrollments).where(eq(schema.courseEnrollments.id, id)).limit(1);
    return result[0];
  }

  async getEnrollmentsByUser(userId: string): Promise<CourseEnrollment[]> {
    return await db.select().from(schema.courseEnrollments)
      .where(eq(schema.courseEnrollments.userId, userId))
      .orderBy(desc(schema.courseEnrollments.createdAt));
  }

  async getCourseEnrollmentsByUser(userId: string): Promise<CourseEnrollment[]> {
    return this.getEnrollmentsByUser(userId);
  }

  async getAllCourseEnrollments(): Promise<CourseEnrollment[]> {
    return await db.select().from(schema.courseEnrollments);
  }

  async getEnrollmentsByCourse(courseId: string): Promise<CourseEnrollment[]> {
    return await db.select().from(schema.courseEnrollments)
      .where(eq(schema.courseEnrollments.courseId, courseId))
      .orderBy(desc(schema.courseEnrollments.createdAt));
  }

  async getUserCourseEnrollment(userId: string, courseId: string): Promise<CourseEnrollment | undefined> {
    const result = await db.select().from(schema.courseEnrollments)
      .where(and(eq(schema.courseEnrollments.userId, userId), eq(schema.courseEnrollments.courseId, courseId)))
      .limit(1);
    return result[0];
  }

  async createCourseEnrollment(enrollment: InsertCourseEnrollment): Promise<CourseEnrollment> {
    const result = await db.insert(schema.courseEnrollments).values(enrollment).returning();
    return result[0];
  }

  async updateCourseEnrollment(id: string, updates: Partial<CourseEnrollment>): Promise<CourseEnrollment | undefined> {
    const updateData = { ...updates };
    
    // Set completion date if progress reaches 100%
    if (updates.progress === 100) {
      const enrollment = await this.getCourseEnrollment(id);
      if (enrollment && !enrollment.completedAt) {
        updateData.completedAt = new Date();
      }
    }
    
    const result = await db.update(schema.courseEnrollments).set(updateData).where(eq(schema.courseEnrollments.id, id)).returning();
    return result[0];
  }

  // Lesson Progress
  async getLessonProgress(enrollmentId: string, lessonId: string): Promise<LessonProgress | undefined> {
    const result = await db.select().from(schema.lessonProgress)
      .where(and(eq(schema.lessonProgress.enrollmentId, enrollmentId), eq(schema.lessonProgress.lessonId, lessonId)))
      .limit(1);
    return result[0];
  }

  async getLessonProgressByEnrollment(enrollmentId: string): Promise<LessonProgress[]> {
    return await db.select().from(schema.lessonProgress)
      .where(eq(schema.lessonProgress.enrollmentId, enrollmentId))
      .orderBy(asc(schema.lessonProgress.createdAt));
  }

  async createLessonProgress(progress: InsertLessonProgress): Promise<LessonProgress> {
    const result = await db.insert(schema.lessonProgress).values(progress).returning();
    return result[0];
  }

  async updateLessonProgress(id: string, updates: Partial<LessonProgress>): Promise<LessonProgress | undefined> {
    const updateData = { ...updates, updatedAt: new Date() };
    
    // Set completion date if marked as completed
    if (updates.completed) {
      const progress = await db.select().from(schema.lessonProgress).where(eq(schema.lessonProgress.id, id)).limit(1);
      if (progress[0] && !progress[0].completedAt) {
        updateData.completedAt = new Date();
      }
    }
    
    const result = await db.update(schema.lessonProgress).set(updateData).where(eq(schema.lessonProgress.id, id)).returning();
    return result[0];
  }

  // Course Certificates
  async getCourseCertificate(id: string): Promise<CourseCertificate | undefined> {
    const result = await db.select().from(schema.courseCertificates).where(eq(schema.courseCertificates.id, id)).limit(1);
    return result[0];
  }

  async getCertificatesByUser(userId: string): Promise<CourseCertificate[]> {
    return await db.select().from(schema.courseCertificates)
      .where(eq(schema.courseCertificates.userId, userId))
      .orderBy(desc(schema.courseCertificates.completedAt));
  }

  async getCertificateByEnrollment(enrollmentId: string): Promise<CourseCertificate | undefined> {
    const result = await db.select().from(schema.courseCertificates)
      .where(eq(schema.courseCertificates.enrollmentId, enrollmentId))
      .limit(1);
    return result[0];
  }

  async createCourseCertificate(certificate: InsertCourseCertificate): Promise<CourseCertificate> {
    const result = await db.insert(schema.courseCertificates).values(certificate).returning();
    return result[0];
  }

  // Subscriptions
  async getSubscription(id: string): Promise<Subscription | undefined> {
    const result = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.id, id)).limit(1);
    return result[0];
  }

  async getSubscriptionByUser(userId: string): Promise<Subscription | undefined> {
    const result = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, userId)).limit(1);
    return result[0];
  }

  async createSubscription(subscription: InsertSubscription): Promise<Subscription> {
    const result = await db.insert(schema.subscriptions).values(subscription).returning();
    return result[0];
  }

  async updateSubscription(id: string, updates: Partial<Subscription>): Promise<Subscription | undefined> {
    const result = await db.update(schema.subscriptions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.subscriptions.id, id))
      .returning();
    return result[0];
  }

  async deleteSubscription(id: string): Promise<boolean> {
    const result = await db.delete(schema.subscriptions).where(eq(schema.subscriptions.id, id));
    return result.rowCount > 0;
  }

  // Notification Preferences
  async getNotificationPreferences(userId: string): Promise<NotificationPreferences | undefined> {
    const result = await db.select().from(schema.notificationPreferences).where(eq(schema.notificationPreferences.userId, userId)).limit(1);
    return result[0];
  }

  async createNotificationPreferences(preferences: InsertNotificationPreferences): Promise<NotificationPreferences> {
    const result = await db.insert(schema.notificationPreferences).values(preferences).returning();
    return result[0];
  }

  async updateNotificationPreferences(userId: string, updates: Partial<NotificationPreferences>): Promise<NotificationPreferences | undefined> {
    const result = await db.update(schema.notificationPreferences)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.notificationPreferences.userId, userId))
      .returning();
    return result[0];
  }

  // Push Tokens
  async getUserPushTokens(userId: string): Promise<PushToken[]> {
    return await db.select().from(schema.pushTokens)
      .where(and(eq(schema.pushTokens.userId, userId), eq(schema.pushTokens.isActive, true)))
      .orderBy(desc(schema.pushTokens.createdAt));
  }

  async addPushToken(token: InsertPushToken): Promise<PushToken> {
    const result = await db.insert(schema.pushTokens).values(token).returning();
    return result[0];
  }

  async removePushToken(userId: string, tokenId: string): Promise<boolean> {
    const result = await db.delete(schema.pushTokens)
      .where(and(eq(schema.pushTokens.id, tokenId), eq(schema.pushTokens.userId, userId)));
    return result.rowCount > 0;
  }

  async deactivatePushToken(tokenId: string): Promise<boolean> {
    const result = await db.update(schema.pushTokens)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(schema.pushTokens.id, tokenId));
    return result.rowCount > 0;
  }

  // Placeholder implementations for API Keys, Audit Logs, Content Moderation, and Media Files
  // These would need proper table schemas to be fully implemented
  
  async createApiKey(apiKey: any): Promise<any> {
    // TODO: Implement with proper schema
    throw new Error('API Keys not implemented in PostgreSQL storage yet');
  }

  async getApiKeyByHash(hash: string): Promise<any | undefined> {
    // TODO: Implement with proper schema
    throw new Error('API Keys not implemented in PostgreSQL storage yet');
  }

  async updateApiKeyLastUsed(keyId: string): Promise<void> {
    // TODO: Implement with proper schema
    throw new Error('API Keys not implemented in PostgreSQL storage yet');
  }

  async revokeApiKey(keyId: string, userId: string): Promise<boolean> {
    // TODO: Implement with proper schema
    throw new Error('API Keys not implemented in PostgreSQL storage yet');
  }

  async getUserApiKeys(userId: string): Promise<any[]> {
    // TODO: Implement with proper schema
    throw new Error('API Keys not implemented in PostgreSQL storage yet');
  }

  async createAuditLogEntry(entry: any): Promise<void> {
    // TODO: Implement with proper schema
    throw new Error('Audit Logs not implemented in PostgreSQL storage yet');
  }

  async getUserAuditLogs(userId: string, limit: number, offset: number): Promise<any[]> {
    // TODO: Implement with proper schema
    throw new Error('Audit Logs not implemented in PostgreSQL storage yet');
  }

  async getResourceAuditLogs(resource: string, resourceId?: string, limit?: number, offset?: number): Promise<any[]> {
    // TODO: Implement with proper schema
    throw new Error('Audit Logs not implemented in PostgreSQL storage yet');
  }

  async getSecurityEvents(since: Date, severity?: string): Promise<any[]> {
    // TODO: Implement with proper schema
    throw new Error('Audit Logs not implemented in PostgreSQL storage yet');
  }

  async getFailedAuthAttempts(since: Date, ipAddress?: string): Promise<any[]> {
    // TODO: Implement with proper schema
    throw new Error('Audit Logs not implemented in PostgreSQL storage yet');
  }

  async deleteOldAuditLogs(cutoffDate: Date): Promise<number> {
    // TODO: Implement with proper schema
    throw new Error('Audit Logs not implemented in PostgreSQL storage yet');
  }

  async createContentReport(report: any): Promise<any> {
    // TODO: Implement with proper schema
    throw new Error('Content Moderation not implemented in PostgreSQL storage yet');
  }

  async getContentReport(reportId: string): Promise<any | undefined> {
    // TODO: Implement with proper schema
    throw new Error('Content Moderation not implemented in PostgreSQL storage yet');
  }

  async getContentReports(status?: string, contentType?: string, limit?: number): Promise<any[]> {
    // TODO: Implement with proper schema
    throw new Error('Content Moderation not implemented in PostgreSQL storage yet');
  }

  async updateContentReport(reportId: string, updates: any): Promise<any> {
    // TODO: Implement with proper schema
    throw new Error('Content Moderation not implemented in PostgreSQL storage yet');
  }

  async createUserBehaviorEntry(entry: any): Promise<void> {
    // TODO: Implement with proper schema
    throw new Error('Content Moderation not implemented in PostgreSQL storage yet');
  }

  async getUserBehaviorEntries(userId: string, since: Date): Promise<any[]> {
    // TODO: Implement with proper schema
    throw new Error('Content Moderation not implemented in PostgreSQL storage yet');
  }

  async createUserFlag(flag: any): Promise<any> {
    // TODO: Implement with proper schema
    throw new Error('Content Moderation not implemented in PostgreSQL storage yet');
  }

  async getUserFlag(flagId: string): Promise<any | undefined> {
    // TODO: Implement with proper schema
    throw new Error('Content Moderation not implemented in PostgreSQL storage yet');
  }

  async getUserFlags(status?: string, limit?: number): Promise<any[]> {
    // TODO: Implement with proper schema
    throw new Error('Content Moderation not implemented in PostgreSQL storage yet');
  }

  async updateUserFlag(flagId: string, updates: any): Promise<any> {
    // TODO: Implement with proper schema
    throw new Error('Content Moderation not implemented in PostgreSQL storage yet');
  }

  // Media Files
  async getMediaFile(id: string): Promise<MediaFile | undefined> {
    const result = await db.select().from(schema.mediaFiles).where(eq(schema.mediaFiles.id, id)).limit(1);
    return result[0];
  }

  async getMediaFilesByUser(userId: string, fileType?: string): Promise<MediaFile[]> {
    let queryBuilder = db.select().from(schema.mediaFiles).where(eq(schema.mediaFiles.userId, userId));
    
    if (fileType) {
      queryBuilder = queryBuilder.where(and(eq(schema.mediaFiles.userId, userId), eq(schema.mediaFiles.fileType, fileType)));
    }
    
    return await queryBuilder.orderBy(desc(schema.mediaFiles.createdAt));
  }

  async getMediaFilesByRelated(relatedType: string, relatedId: string): Promise<MediaFile[]> {
    return await db.select().from(schema.mediaFiles)
      .where(and(eq(schema.mediaFiles.relatedType, relatedType), eq(schema.mediaFiles.relatedId, relatedId)))
      .orderBy(desc(schema.mediaFiles.createdAt));
  }

  async createMediaFile(mediaFile: InsertMediaFile): Promise<MediaFile> {
    const result = await db.insert(schema.mediaFiles).values(mediaFile).returning();
    return result[0];
  }

  async updateMediaFile(id: string, updates: Partial<MediaFile>): Promise<MediaFile | undefined> {
    const result = await db.update(schema.mediaFiles)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.mediaFiles.id, id))
      .returning();
    return result[0];
  }

  async deleteMediaFile(id: string): Promise<boolean> {
    const result = await db.delete(schema.mediaFiles).where(eq(schema.mediaFiles.id, id));
    return result.rowCount > 0;
  }
}