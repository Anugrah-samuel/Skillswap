import { describe, it, expect, beforeEach } from 'vitest';
import { storage } from './storage';
import type { User, Skill, Course, SkillSession, CreditTransaction } from '@shared/schema';

describe('Storage Layer', () => {
  beforeEach(async () => {
    // Clear all storage maps before each test
    (storage as any).users.clear();
    (storage as any).skills.clear();
    (storage as any).courses.clear();
    (storage as any).courseLessons.clear();
    (storage as any).courseEnrollments.clear();
    (storage as any).skillSessions.clear();
    (storage as any).creditTransactions.clear();
    (storage as any).subscriptions.clear();
    (storage as any).paymentMethods.clear();
    (storage as any).notifications.clear();
    (storage as any).userPreferences.clear();
    (storage as any).recommendationHistory.clear();
    (storage as any).lessonProgress.clear();
    (storage as any).courseCertificates.clear();
    (storage as any).mediaFiles.clear();
    (storage as any).deviceTokens.clear();
  });

  describe('User Operations', () => {
    it('should create and retrieve a user', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'hashedpassword',
        fullName: 'Test User',
      };

      const user = await storage.createUser(userData);
      
      expect(user).toBeDefined();
      expect(user.username).toBe(userData.username);
      expect(user.email).toBe(userData.email);
      expect(user.creditBalance).toBe(0);
      expect(user.subscriptionStatus).toBe('basic');

      const retrievedUser = await storage.getUser(user.id);
      expect(retrievedUser).toEqual(user);
    });

    it('should update user information', async () => {
      const user = await storage.createUser({
        username: 'testuser',
        email: 'test@example.com',
        password: 'hashedpassword',
        fullName: 'Test User',
      });

      const updatedUser = await storage.updateUser(user.id, {
        creditBalance: 100,
        skillPoints: 50,
      });

      expect(updatedUser.creditBalance).toBe(100);
      expect(updatedUser.skillPoints).toBe(50);
    });

    it('should find user by email', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'hashedpassword',
        fullName: 'Test User',
      };

      const user = await storage.createUser(userData);
      const foundUser = await storage.getUserByEmail(userData.email);
      
      expect(foundUser).toEqual(user);
    });

    it('should return null for non-existent user', async () => {
      const user = await storage.getUser('nonexistent-id');
      expect(user).toBeNull();
    });
  });

  describe('Skill Operations', () => {
    let testUser: User;

    beforeEach(async () => {
      testUser = await storage.createUser({
        username: 'testuser',
        email: 'test@example.com',
        password: 'hashedpassword',
        fullName: 'Test User',
      });
    });

    it('should create and retrieve a skill', async () => {
      const skillData = {
        userId: testUser.id,
        title: 'JavaScript Programming',
        description: 'Learn JavaScript fundamentals',
        category: 'Programming',
        level: 'intermediate' as const,
        type: 'teach' as const,
      };

      const skill = await storage.createSkill(skillData);
      
      expect(skill).toBeDefined();
      expect(skill.title).toBe(skillData.title);
      expect(skill.userId).toBe(testUser.id);

      const retrievedSkill = await storage.getSkill(skill.id);
      expect(retrievedSkill).toEqual(skill);
    });

    it('should get skills by user', async () => {
      await storage.createSkill({
        userId: testUser.id,
        title: 'JavaScript',
        description: 'JS skills',
        category: 'Programming',
        level: 'intermediate',
        type: 'teach',
      });

      await storage.createSkill({
        userId: testUser.id,
        title: 'Python',
        description: 'Python skills',
        category: 'Programming',
        level: 'advanced',
        type: 'learn',
      });

      const skills = await storage.getSkillsByUser(testUser.id);
      expect(skills).toHaveLength(2);
      expect(skills.every(skill => skill.userId === testUser.id)).toBe(true);
    });
  });

  describe('Course Operations', () => {
    let testUser: User;
    let testSkill: Skill;

    beforeEach(async () => {
      testUser = await storage.createUser({
        username: 'testuser',
        email: 'test@example.com',
        password: 'hashedpassword',
        fullName: 'Test User',
      });

      testSkill = await storage.createSkill({
        userId: testUser.id,
        title: 'JavaScript',
        description: 'JS skills',
        category: 'Programming',
        level: 'intermediate',
        type: 'teach',
      });
    });

    it('should create and retrieve a course', async () => {
      const courseData = {
        creatorId: testUser.id,
        skillId: testSkill.id,
        title: 'JavaScript Fundamentals',
        description: 'Learn the basics of JavaScript',
        priceCredits: 50,
      };

      const course = await storage.createCourse(courseData);
      
      expect(course).toBeDefined();
      expect(course.title).toBe(courseData.title);
      expect(course.creatorId).toBe(testUser.id);
      expect(course.status).toBe('draft');

      const retrievedCourse = await storage.getCourse(course.id);
      expect(retrievedCourse).toEqual(course);
    });

    it('should update course information', async () => {
      const course = await storage.createCourse({
        creatorId: testUser.id,
        skillId: testSkill.id,
        title: 'Test Course',
        description: 'Test Description',
        priceCredits: 30,
      });

      const updatedCourse = await storage.updateCourse(course.id, {
        status: 'published',
        totalLessons: 5,
      });

      expect(updatedCourse.status).toBe('published');
      expect(updatedCourse.totalLessons).toBe(5);
    });

    it('should get courses by creator', async () => {
      await storage.createCourse({
        creatorId: testUser.id,
        skillId: testSkill.id,
        title: 'Course 1',
        description: 'Description 1',
        priceCredits: 30,
      });

      await storage.createCourse({
        creatorId: testUser.id,
        skillId: testSkill.id,
        title: 'Course 2',
        description: 'Description 2',
        priceCredits: 40,
      });

      const courses = await storage.getCoursesByCreator(testUser.id);
      expect(courses).toHaveLength(2);
      expect(courses.every(course => course.creatorId === testUser.id)).toBe(true);
    });
  });

  describe('Credit Transaction Operations', () => {
    let testUser: User;

    beforeEach(async () => {
      testUser = await storage.createUser({
        username: 'testuser',
        email: 'test@example.com',
        password: 'hashedpassword',
        fullName: 'Test User',
        creditBalance: 100,
      });
    });

    it('should create and retrieve credit transactions', async () => {
      const transactionData = {
        userId: testUser.id,
        amount: 50,
        type: 'earned' as const,
        description: 'Session completion',
      };

      const transaction = await storage.createCreditTransaction(transactionData);
      
      expect(transaction).toBeDefined();
      expect(transaction.amount).toBe(50);
      expect(transaction.type).toBe('earned');
      expect(transaction.userId).toBe(testUser.id);

      const transactions = await storage.getCreditTransactionsByUser(testUser.id);
      expect(transactions).toHaveLength(1);
      expect(transactions[0]).toEqual(transaction);
    });

    it('should get transactions with limit', async () => {
      // Create multiple transactions
      for (let i = 0; i < 5; i++) {
        await storage.createCreditTransaction({
          userId: testUser.id,
          amount: 10 * (i + 1),
          type: 'earned',
          description: `Transaction ${i + 1}`,
        });
      }

      const transactions = await storage.getCreditTransactionsByUser(testUser.id, 3);
      expect(transactions).toHaveLength(3);
    });
  });

  describe('Session Operations', () => {
    let testTeacher: User;
    let testStudent: User;
    let testSkill: Skill;

    beforeEach(async () => {
      testTeacher = await storage.createUser({
        username: 'teacher',
        email: 'teacher@example.com',
        password: 'hashedpassword',
        fullName: 'Test Teacher',
      });

      testStudent = await storage.createUser({
        username: 'student',
        email: 'student@example.com',
        password: 'hashedpassword',
        fullName: 'Test Student',
      });

      testSkill = await storage.createSkill({
        userId: testTeacher.id,
        title: 'JavaScript',
        description: 'JS skills',
        category: 'Programming',
        level: 'intermediate',
        type: 'teach',
      });
    });

    it('should create and retrieve a skill session', async () => {
      const sessionData = {
        matchId: 'match-123',
        teacherId: testTeacher.id,
        studentId: testStudent.id,
        skillId: testSkill.id,
        scheduledStart: new Date(),
        scheduledEnd: new Date(Date.now() + 3600000),
        creditsAmount: 20,
      };

      const session = await storage.createSkillSession(sessionData);
      
      expect(session).toBeDefined();
      expect(session.teacherId).toBe(testTeacher.id);
      expect(session.studentId).toBe(testStudent.id);
      expect(session.status).toBe('scheduled');

      const retrievedSession = await storage.getSkillSession(session.id);
      expect(retrievedSession).toEqual(session);
    });

    it('should update session status', async () => {
      const session = await storage.createSkillSession({
        matchId: 'match-123',
        teacherId: testTeacher.id,
        studentId: testStudent.id,
        skillId: testSkill.id,
        scheduledStart: new Date(),
        scheduledEnd: new Date(Date.now() + 3600000),
        creditsAmount: 20,
      });

      const updatedSession = await storage.updateSkillSession(session.id, {
        status: 'completed',
        actualStart: new Date(),
        actualEnd: new Date(),
      });

      expect(updatedSession.status).toBe('completed');
      expect(updatedSession.actualStart).toBeDefined();
      expect(updatedSession.actualEnd).toBeDefined();
    });

    it('should get sessions by user', async () => {
      await storage.createSkillSession({
        matchId: 'match-1',
        teacherId: testTeacher.id,
        studentId: testStudent.id,
        skillId: testSkill.id,
        scheduledStart: new Date(),
        scheduledEnd: new Date(Date.now() + 3600000),
        creditsAmount: 20,
      });

      await storage.createSkillSession({
        matchId: 'match-2',
        teacherId: testStudent.id,
        studentId: testTeacher.id,
        skillId: testSkill.id,
        scheduledStart: new Date(),
        scheduledEnd: new Date(Date.now() + 3600000),
        creditsAmount: 15,
      });

      const teacherSessions = await storage.getSessionsByUser(testTeacher.id);
      expect(teacherSessions).toHaveLength(2); // Both as teacher and student

      const studentSessions = await storage.getSessionsByUser(testStudent.id);
      expect(studentSessions).toHaveLength(2); // Both as student and teacher
    });
  });

  describe('Search Operations', () => {
    let testUser: User;

    beforeEach(async () => {
      testUser = await storage.createUser({
        username: 'testuser',
        email: 'test@example.com',
        password: 'hashedpassword',
        fullName: 'Test User',
      });

      // Create test skills
      await storage.createSkill({
        userId: testUser.id,
        title: 'JavaScript Programming',
        description: 'Learn JavaScript fundamentals',
        category: 'Programming',
        level: 'intermediate',
        type: 'teach',
      });

      await storage.createSkill({
        userId: testUser.id,
        title: 'Python Development',
        description: 'Python programming skills',
        category: 'Programming',
        level: 'advanced',
        type: 'teach',
      });

      await storage.createSkill({
        userId: testUser.id,
        title: 'Graphic Design',
        description: 'Creative design skills',
        category: 'Design',
        level: 'beginner',
        type: 'learn',
      });
    });

    it('should search skills by title', async () => {
      const results = await storage.searchSkills('JavaScript');
      expect(results).toHaveLength(1);
      expect(results[0].title).toContain('JavaScript');
    });

    it('should search skills by category', async () => {
      const results = await storage.searchSkills('Programming');
      expect(results).toHaveLength(2);
      expect(results.every(skill => skill.category === 'Programming')).toBe(true);
    });

    it('should search skills by description', async () => {
      const results = await storage.searchSkills('fundamentals');
      expect(results).toHaveLength(1);
      expect(results[0].description).toContain('fundamentals');
    });

    it('should return empty array for no matches', async () => {
      const results = await storage.searchSkills('NonExistentSkill');
      expect(results).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid user creation', async () => {
      await expect(storage.createUser({
        username: '',
        email: 'invalid-email',
        password: '',
        fullName: '',
      })).rejects.toThrow();
    });

    it('should handle updates to non-existent records', async () => {
      await expect(storage.updateUser('nonexistent-id', { creditBalance: 100 }))
        .rejects.toThrow('User not found');
    });

    it('should handle duplicate email registration', async () => {
      const userData = {
        username: 'testuser1',
        email: 'test@example.com',
        password: 'hashedpassword',
        fullName: 'Test User 1',
      };

      await storage.createUser(userData);

      await expect(storage.createUser({
        ...userData,
        username: 'testuser2',
      })).rejects.toThrow('Email already exists');
    });
  });
});