import { describe, it, expect, beforeEach, vi } from 'vitest';
import { courseService, type CreateCourseData } from './courses';
import { creditsService } from './credits';
import { storage } from '../storage';
import type { User, Skill, Course, CourseLesson } from '@shared/schema';

// Mock the credits service
vi.mock('./credits', () => ({
  creditsService: {
    deductCredits: vi.fn(),
    addCredits: vi.fn(),
  },
}));

describe('CourseService', () => {
  let testUser: User;
  let testSkill: Skill;
  let testCourse: Course;

  beforeEach(async () => {
    // Clear storage
    (storage as any).courses.clear();
    (storage as any).courseLessons.clear();
    (storage as any).courseEnrollments.clear();
    (storage as any).lessonProgress.clear();
    (storage as any).courseCertificates.clear();
    (storage as any).users.clear();
    (storage as any).skills.clear();

    // Create test user
    testUser = await storage.createUser({
      username: 'testuser',
      email: 'test@example.com',
      password: 'hashedpassword',
      fullName: 'Test User',
      creditBalance: 100,
    });

    // Create test skill
    testSkill = await storage.createSkill({
      userId: testUser.id,
      title: 'JavaScript Programming',
      description: 'Learn JavaScript fundamentals',
      category: 'Programming',
      level: 'Intermediate',
      type: 'teach',
    });

    // Reset mocks
    vi.clearAllMocks();
  });

  describe('createCourse', () => {
    it('should create a course successfully', async () => {
      const courseData: CreateCourseData = {
        skillId: testSkill.id,
        title: 'JavaScript Fundamentals',
        description: 'Learn the basics of JavaScript',
        priceCredits: 50,
        priceMoney: 2000, // $20.00
      };

      const course = await courseService.createCourse(testUser.id, courseData);

      expect(course).toBeDefined();
      expect(course.title).toBe(courseData.title);
      expect(course.description).toBe(courseData.description);
      expect(course.priceCredits).toBe(courseData.priceCredits);
      expect(course.priceMoney).toBe(courseData.priceMoney);
      expect(course.creatorId).toBe(testUser.id);
      expect(course.skillId).toBe(testSkill.id);
      expect(course.status).toBe('draft');
      expect(course.totalLessons).toBe(0);
      expect(course.totalDuration).toBe(0);
    });

    it('should throw error if skill not found', async () => {
      const courseData: CreateCourseData = {
        skillId: 'nonexistent-skill',
        title: 'Test Course',
        description: 'Test Description',
        priceCredits: 50,
      };

      await expect(courseService.createCourse(testUser.id, courseData))
        .rejects.toThrow('Skill not found');
    });

    it('should throw error if user does not own the skill', async () => {
      const otherUser = await storage.createUser({
        username: 'otheruser',
        email: 'other@example.com',
        password: 'hashedpassword',
        fullName: 'Other User',
      });

      const courseData: CreateCourseData = {
        skillId: testSkill.id,
        title: 'Test Course',
        description: 'Test Description',
        priceCredits: 50,
      };

      await expect(courseService.createCourse(otherUser.id, courseData))
        .rejects.toThrow('You can only create courses for your own skills');
    });

    it('should throw error for negative credit price', async () => {
      const courseData: CreateCourseData = {
        skillId: testSkill.id,
        title: 'Test Course',
        description: 'Test Description',
        priceCredits: -10,
      };

      await expect(courseService.createCourse(testUser.id, courseData))
        .rejects.toThrow('Credit price cannot be negative');
    });

    it('should throw error for negative money price', async () => {
      const courseData: CreateCourseData = {
        skillId: testSkill.id,
        title: 'Test Course',
        description: 'Test Description',
        priceCredits: 50,
        priceMoney: -100,
      };

      await expect(courseService.createCourse(testUser.id, courseData))
        .rejects.toThrow('Money price cannot be negative');
    });
  });

  describe('publishCourse', () => {
    beforeEach(async () => {
      testCourse = await courseService.createCourse(testUser.id, {
        skillId: testSkill.id,
        title: 'Test Course',
        description: 'Test Description',
        priceCredits: 50,
      });
    });

    it('should publish a course with lessons', async () => {
      // Add a lesson first
      await courseService.addLessonToCourse(testCourse.id, testUser.id, {
        title: 'Lesson 1',
        description: 'First lesson',
        contentType: 'video',
        contentUrl: 'https://example.com/video1',
        duration: 30,
        orderIndex: 1,
      });

      const publishedCourse = await courseService.publishCourse(testCourse.id, testUser.id);

      expect(publishedCourse.status).toBe('published');
    });

    it('should throw error if course not found', async () => {
      await expect(courseService.publishCourse('nonexistent-course', testUser.id))
        .rejects.toThrow('Course not found');
    });

    it('should throw error if user is not the creator', async () => {
      const otherUser = await storage.createUser({
        username: 'otheruser',
        email: 'other@example.com',
        password: 'hashedpassword',
        fullName: 'Other User',
      });

      await expect(courseService.publishCourse(testCourse.id, otherUser.id))
        .rejects.toThrow('Only the course creator can publish the course');
    });

    it('should throw error if course is not in draft status', async () => {
      await storage.updateCourse(testCourse.id, { status: 'published' });

      await expect(courseService.publishCourse(testCourse.id, testUser.id))
        .rejects.toThrow('Only draft courses can be published');
    });

    it('should throw error if course has no lessons', async () => {
      await expect(courseService.publishCourse(testCourse.id, testUser.id))
        .rejects.toThrow('Course must have at least one lesson before publishing');
    });
  });

  describe('enrollInCourse', () => {
    let studentUser: User;
    let publishedCourse: Course;

    beforeEach(async () => {
      studentUser = await storage.createUser({
        username: 'student',
        email: 'student@example.com',
        password: 'hashedpassword',
        fullName: 'Student User',
        creditBalance: 100,
      });

      testCourse = await courseService.createCourse(testUser.id, {
        skillId: testSkill.id,
        title: 'Test Course',
        description: 'Test Description',
        priceCredits: 30,
      });

      // Add lesson and publish
      await courseService.addLessonToCourse(testCourse.id, testUser.id, {
        title: 'Lesson 1',
        description: 'First lesson',
        contentType: 'video',
        orderIndex: 1,
      });

      publishedCourse = await courseService.publishCourse(testCourse.id, testUser.id);
    });

    it('should enroll user in course with credits', async () => {
      const enrollment = await courseService.enrollInCourse(studentUser.id, publishedCourse.id, 'credits');

      expect(enrollment).toBeDefined();
      expect(enrollment.userId).toBe(studentUser.id);
      expect(enrollment.courseId).toBe(publishedCourse.id);
      expect(enrollment.progress).toBe(0);

      // Verify credits were deducted and awarded
      expect(creditsService.deductCredits).toHaveBeenCalledWith(
        studentUser.id,
        30,
        'spent',
        `Enrolled in course: ${publishedCourse.title}`,
        publishedCourse.id
      );

      expect(creditsService.addCredits).toHaveBeenCalledWith(
        testUser.id,
        24, // 80% of 30
        'earned',
        `Course enrollment: ${publishedCourse.title}`,
        publishedCourse.id
      );
    });

    it('should enroll user in free course', async () => {
      const freeCourse = await courseService.createCourse(testUser.id, {
        skillId: testSkill.id,
        title: 'Free Course',
        description: 'Free Description',
        priceCredits: 0,
      });

      await courseService.addLessonToCourse(freeCourse.id, testUser.id, {
        title: 'Lesson 1',
        description: 'First lesson',
        contentType: 'video',
        orderIndex: 1,
      });

      const publishedFreeCourse = await courseService.publishCourse(freeCourse.id, testUser.id);

      const enrollment = await courseService.enrollInCourse(studentUser.id, publishedFreeCourse.id, 'credits');

      expect(enrollment).toBeDefined();
      expect(creditsService.deductCredits).not.toHaveBeenCalled();
      expect(creditsService.addCredits).not.toHaveBeenCalled();
    });

    it('should throw error if course not found', async () => {
      await expect(courseService.enrollInCourse(studentUser.id, 'nonexistent-course', 'credits'))
        .rejects.toThrow('Course not found');
    });

    it('should throw error if course is not published', async () => {
      const draftCourse = await courseService.createCourse(testUser.id, {
        skillId: testSkill.id,
        title: 'Draft Course',
        description: 'Draft Description',
        priceCredits: 30,
      });

      await expect(courseService.enrollInCourse(studentUser.id, draftCourse.id, 'credits'))
        .rejects.toThrow('Course is not available for enrollment');
    });

    it('should throw error if user tries to enroll in own course', async () => {
      await expect(courseService.enrollInCourse(testUser.id, publishedCourse.id, 'credits'))
        .rejects.toThrow('You cannot enroll in your own course');
    });

    it('should throw error if user is already enrolled', async () => {
      await courseService.enrollInCourse(studentUser.id, publishedCourse.id, 'credits');

      await expect(courseService.enrollInCourse(studentUser.id, publishedCourse.id, 'credits'))
        .rejects.toThrow('User is already enrolled in this course');
    });

    it('should throw error for money payment (not implemented)', async () => {
      const courseWithMoney = await courseService.createCourse(testUser.id, {
        skillId: testSkill.id,
        title: 'Paid Course',
        description: 'Paid Description',
        priceCredits: 30,
        priceMoney: 2000,
      });

      await courseService.addLessonToCourse(courseWithMoney.id, testUser.id, {
        title: 'Lesson 1',
        description: 'First lesson',
        contentType: 'video',
        orderIndex: 1,
      });

      const publishedPaidCourse = await courseService.publishCourse(courseWithMoney.id, testUser.id);

      await expect(courseService.enrollInCourse(studentUser.id, publishedPaidCourse.id, 'money'))
        .rejects.toThrow('Money payment not implemented yet');
    });
  });

  describe('updateProgress', () => {
    let studentUser: User;
    let enrollment: any;
    let lesson: CourseLesson;

    beforeEach(async () => {
      studentUser = await storage.createUser({
        username: 'student',
        email: 'student@example.com',
        password: 'hashedpassword',
        fullName: 'Student User',
        creditBalance: 100,
      });

      testCourse = await courseService.createCourse(testUser.id, {
        skillId: testSkill.id,
        title: 'Test Course',
        description: 'Test Description',
        priceCredits: 0,
      });

      lesson = await courseService.addLessonToCourse(testCourse.id, testUser.id, {
        title: 'Lesson 1',
        description: 'First lesson',
        contentType: 'video',
        orderIndex: 1,
      });

      const publishedCourse = await courseService.publishCourse(testCourse.id, testUser.id);
      enrollment = await courseService.enrollInCourse(studentUser.id, publishedCourse.id, 'credits');
    });

    it('should update progress successfully', async () => {
      const updatedEnrollment = await courseService.updateProgress(enrollment.id, lesson.id);

      expect(updatedEnrollment.progress).toBe(100); // 100% for single lesson
      expect(updatedEnrollment.completedAt).toBeDefined();
    });

    it('should throw error if enrollment not found', async () => {
      await expect(courseService.updateProgress('nonexistent-enrollment', lesson.id))
        .rejects.toThrow('Enrollment not found');
    });

    it('should throw error if lesson not found', async () => {
      await expect(courseService.updateProgress(enrollment.id, 'nonexistent-lesson'))
        .rejects.toThrow('Lesson not found');
    });

    it('should throw error if lesson does not belong to course', async () => {
      const otherCourse = await courseService.createCourse(testUser.id, {
        skillId: testSkill.id,
        title: 'Other Course',
        description: 'Other Description',
        priceCredits: 0,
      });

      const otherLesson = await courseService.addLessonToCourse(otherCourse.id, testUser.id, {
        title: 'Other Lesson',
        description: 'Other lesson',
        contentType: 'video',
        orderIndex: 1,
      });

      await expect(courseService.updateProgress(enrollment.id, otherLesson.id))
        .rejects.toThrow('Lesson does not belong to the enrolled course');
    });
  });

  describe('addLessonToCourse', () => {
    beforeEach(async () => {
      testCourse = await courseService.createCourse(testUser.id, {
        skillId: testSkill.id,
        title: 'Test Course',
        description: 'Test Description',
        priceCredits: 50,
      });
    });

    it('should add lesson to course', async () => {
      const lessonData = {
        title: 'Lesson 1',
        description: 'First lesson',
        contentType: 'video' as const,
        contentUrl: 'https://example.com/video1',
        duration: 30,
        orderIndex: 1,
      };

      const lesson = await courseService.addLessonToCourse(testCourse.id, testUser.id, lessonData);

      expect(lesson).toBeDefined();
      expect(lesson.title).toBe(lessonData.title);
      expect(lesson.courseId).toBe(testCourse.id);
      expect(lesson.orderIndex).toBe(lessonData.orderIndex);

      // Verify course totals were updated
      const updatedCourse = await storage.getCourse(testCourse.id);
      expect(updatedCourse?.totalLessons).toBe(1);
      expect(updatedCourse?.totalDuration).toBe(30);
    });

    it('should throw error if course not found', async () => {
      await expect(courseService.addLessonToCourse('nonexistent-course', testUser.id, {
        title: 'Lesson 1',
        description: 'First lesson',
        contentType: 'video',
        orderIndex: 1,
      })).rejects.toThrow('Course not found');
    });

    it('should throw error if user is not the creator', async () => {
      const otherUser = await storage.createUser({
        username: 'otheruser',
        email: 'other@example.com',
        password: 'hashedpassword',
        fullName: 'Other User',
      });

      await expect(courseService.addLessonToCourse(testCourse.id, otherUser.id, {
        title: 'Lesson 1',
        description: 'First lesson',
        contentType: 'video',
        orderIndex: 1,
      })).rejects.toThrow('Only the course creator can add lessons');
    });

    it('should throw error if course is published', async () => {
      await courseService.addLessonToCourse(testCourse.id, testUser.id, {
        title: 'Lesson 1',
        description: 'First lesson',
        contentType: 'video',
        orderIndex: 1,
      });

      await courseService.publishCourse(testCourse.id, testUser.id);

      await expect(courseService.addLessonToCourse(testCourse.id, testUser.id, {
        title: 'Lesson 2',
        description: 'Second lesson',
        contentType: 'video',
        orderIndex: 2,
      })).rejects.toThrow('Cannot add lessons to published courses');
    });
  });

  describe('searchCourses', () => {
    beforeEach(async () => {
      // Create multiple courses for testing
      const course1 = await courseService.createCourse(testUser.id, {
        skillId: testSkill.id,
        title: 'JavaScript Basics',
        description: 'Learn JavaScript fundamentals',
        priceCredits: 30,
      });

      const course2 = await courseService.createCourse(testUser.id, {
        skillId: testSkill.id,
        title: 'Advanced JavaScript',
        description: 'Advanced JavaScript concepts',
        priceCredits: 50,
      });

      // Add lessons and publish
      await courseService.addLessonToCourse(course1.id, testUser.id, {
        title: 'Lesson 1',
        contentType: 'video',
        orderIndex: 1,
      });

      await courseService.addLessonToCourse(course2.id, testUser.id, {
        title: 'Lesson 1',
        contentType: 'video',
        orderIndex: 1,
      });

      await courseService.publishCourse(course1.id, testUser.id);
      await courseService.publishCourse(course2.id, testUser.id);
    });

    it('should search courses by title', async () => {
      const results = await courseService.searchCourses('JavaScript');
      expect(results).toHaveLength(2);
      expect(results.every(course => course.title.includes('JavaScript'))).toBe(true);
    });

    it('should search courses by description', async () => {
      const results = await courseService.searchCourses('fundamentals');
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('JavaScript Basics');
    });

    it('should filter by price range', async () => {
      const results = await courseService.searchCourses(undefined, {
        minPrice: 40,
        maxPrice: 60,
      });
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Advanced JavaScript');
    });

    it('should filter by creator', async () => {
      const results = await courseService.searchCourses(undefined, {
        creatorId: testUser.id,
      });
      expect(results).toHaveLength(2);
      expect(results.every(course => course.creatorId === testUser.id)).toBe(true);
    });
  });

  describe('canUserAccessCourse', () => {
    let studentUser: User;
    let publishedCourse: Course;

    beforeEach(async () => {
      studentUser = await storage.createUser({
        username: 'student',
        email: 'student@example.com',
        password: 'hashedpassword',
        fullName: 'Student User',
        creditBalance: 100,
      });

      testCourse = await courseService.createCourse(testUser.id, {
        skillId: testSkill.id,
        title: 'Test Course',
        description: 'Test Description',
        priceCredits: 0,
      });

      await courseService.addLessonToCourse(testCourse.id, testUser.id, {
        title: 'Lesson 1',
        contentType: 'video',
        orderIndex: 1,
      });

      publishedCourse = await courseService.publishCourse(testCourse.id, testUser.id);
    });

    it('should allow creator to access course', async () => {
      const canAccess = await courseService.canUserAccessCourse(testUser.id, publishedCourse.id);
      expect(canAccess).toBe(true);
    });

    it('should allow enrolled user to access course', async () => {
      await courseService.enrollInCourse(studentUser.id, publishedCourse.id, 'credits');
      
      const canAccess = await courseService.canUserAccessCourse(studentUser.id, publishedCourse.id);
      expect(canAccess).toBe(true);
    });

    it('should not allow non-enrolled user to access course', async () => {
      const canAccess = await courseService.canUserAccessCourse(studentUser.id, publishedCourse.id);
      expect(canAccess).toBe(false);
    });

    it('should return false for non-existent course', async () => {
      const canAccess = await courseService.canUserAccessCourse(testUser.id, 'nonexistent-course');
      expect(canAccess).toBe(false);
    });
  });
  });

  describe("updateLessonProgress", () => {
    it("should update lesson progress with time tracking", async () => {
      // Create a teacher user
      const teacherUser = await storage.createUser({
        username: 'teacher-progress',
        email: 'teacher-progress@example.com',
        password: 'hashedpassword',
        fullName: 'Teacher User',
      });

      // Create a skill
      const skill = await storage.createSkill({
        userId: teacherUser.id,
        title: 'Progress Tracking',
        description: 'A skill for testing progress',
        category: 'Technology',
        level: 'intermediate',
        type: 'teach',
      });

      // Create a student user
      const studentUser = await storage.createUser({
        username: 'student',
        email: 'student@example.com',
        password: 'hashedpassword',
        fullName: 'Student User',
      });

      // Create and publish a course
      const course = await courseService.createCourse(teacherUser.id, {
        skillId: skill.id,
        title: 'Test Course',
        description: 'A test course for progress tracking',
        priceCredits: 0,
      });

      // Add a lesson
      const lesson = await courseService.addLessonToCourse(course.id, teacherUser.id, {
        title: 'Introduction',
        description: 'Course introduction',
        contentType: 'video',
        duration: 30,
        orderIndex: 1,
      });

      await courseService.publishCourse(course.id, teacherUser.id);

      // Enroll student
      const enrollment = await courseService.enrollInCourse(studentUser.id, course.id, 'credits');

      // Update lesson progress
      const result = await courseService.updateLessonProgress(enrollment.id, lesson.id, 30);

      expect(result.progress).toBe(100); // Should be 100% since there's only one lesson
      
      // Check lesson progress was created
      const lessonProgress = await storage.getLessonProgressByEnrollment(enrollment.id);
      expect(lessonProgress).toHaveLength(1);
      expect(lessonProgress[0].completed).toBe(true);
      expect(lessonProgress[0].timeSpent).toBe(30);
    });

    it("should throw error when enrollment not found", async () => {
      await expect(courseService.updateLessonProgress("nonexistent", "lesson-1", 15))
        .rejects.toThrow("Enrollment not found");
    });
  });

  describe("generateCertificate", () => {
    it("should generate certificate for completed course", async () => {
      // Create a teacher user
      const teacherUser = await storage.createUser({
        username: 'teacher-cert',
        email: 'teacher-cert@example.com',
        password: 'hashedpassword',
        fullName: 'Teacher User',
      });

      // Create a skill
      const skill = await storage.createSkill({
        userId: teacherUser.id,
        title: 'Certificate Skill',
        description: 'A skill for testing certificates',
        category: 'Technology',
        level: 'intermediate',
        type: 'teach',
      });

      // Create a student user
      const studentUser = await storage.createUser({
        username: 'student2',
        email: 'student2@example.com',
        password: 'hashedpassword',
        fullName: 'Student User 2',
      });

      // Create and publish a course
      const course = await courseService.createCourse(teacherUser.id, {
        skillId: skill.id,
        title: 'Certificate Course',
        description: 'A course for certificate testing',
        priceCredits: 0,
      });

      // Add a lesson
      const lesson = await courseService.addLessonToCourse(course.id, teacherUser.id, {
        title: 'Final Lesson',
        description: 'Course final lesson',
        contentType: 'video',
        duration: 60,
        orderIndex: 1,
      });

      await courseService.publishCourse(course.id, teacherUser.id);

      // Enroll and complete the course
      const enrollment = await courseService.enrollInCourse(studentUser.id, course.id, 'credits');
      await courseService.updateLessonProgress(enrollment.id, lesson.id, 60);

      // Generate certificate
      const certificate = await courseService.generateCertificate(enrollment.id);

      expect(certificate.userId).toBe(studentUser.id);
      expect(certificate.courseId).toBe(course.id);
      expect(certificate.courseName).toBe('Certificate Course');
      expect(certificate.certificateUrl).toContain(enrollment.id);
    });

    it("should throw error when course not completed", async () => {
      // Create a teacher user
      const teacherUser = await storage.createUser({
        username: 'teacher-incomplete',
        email: 'teacher-incomplete@example.com',
        password: 'hashedpassword',
        fullName: 'Teacher User',
      });

      // Create a skill
      const skill = await storage.createSkill({
        userId: teacherUser.id,
        title: 'Incomplete Skill',
        description: 'A skill for testing incomplete courses',
        category: 'Technology',
        level: 'intermediate',
        type: 'teach',
      });

      // Create a student user
      const studentUser = await storage.createUser({
        username: 'student3',
        email: 'student3@example.com',
        password: 'hashedpassword',
        fullName: 'Student User 3',
      });

      // Create and publish a course
      const course = await courseService.createCourse(teacherUser.id, {
        skillId: skill.id,
        title: 'Incomplete Course',
        description: 'A course for incomplete testing',
        priceCredits: 0,
      });

      await courseService.addLessonToCourse(course.id, teacherUser.id, {
        title: 'Lesson 1',
        description: 'First lesson',
        contentType: 'video',
        duration: 30,
        orderIndex: 1,
      });

      await courseService.publishCourse(course.id, teacherUser.id);

      // Enroll but don't complete
      const enrollment = await courseService.enrollInCourse(studentUser.id, course.id, 'credits');

      await expect(courseService.generateCertificate(enrollment.id))
        .rejects.toThrow("Course must be completed to generate certificate");
    });
  });

  describe("getCourseAnalytics", () => {
    it("should return course analytics for creator", async () => {
      // Create a teacher user
      const teacherUser = await storage.createUser({
        username: 'teacher-analytics',
        email: 'teacher-analytics@example.com',
        password: 'hashedpassword',
        fullName: 'Teacher User',
      });

      // Create a skill
      const skill = await storage.createSkill({
        userId: teacherUser.id,
        title: 'Analytics Skill',
        description: 'A skill for testing analytics',
        category: 'Technology',
        level: 'intermediate',
        type: 'teach',
      });

      // Create students
      const student1 = await storage.createUser({
        username: 'analytics-student1',
        email: 'analytics1@example.com',
        password: 'hashedpassword',
        fullName: 'Analytics Student 1',
      });

      const student2 = await storage.createUser({
        username: 'analytics-student2',
        email: 'analytics2@example.com',
        password: 'hashedpassword',
        fullName: 'Analytics Student 2',
      });

      // Create and publish a course with lessons
      const course = await courseService.createCourse(teacherUser.id, {
        skillId: skill.id,
        title: 'Analytics Course',
        description: 'A course for analytics testing',
        priceCredits: 50,
      });

      const lesson1 = await courseService.addLessonToCourse(course.id, teacherUser.id, {
        title: 'Lesson 1',
        description: 'First lesson',
        contentType: 'video',
        duration: 30,
        orderIndex: 1,
      });

      const lesson2 = await courseService.addLessonToCourse(course.id, teacherUser.id, {
        title: 'Lesson 2',
        description: 'Second lesson',
        contentType: 'video',
        duration: 45,
        orderIndex: 2,
      });

      await courseService.publishCourse(course.id, teacherUser.id);

      // Enroll students
      const enrollment1 = await courseService.enrollInCourse(student1.id, course.id, 'credits');
      const enrollment2 = await courseService.enrollInCourse(student2.id, course.id, 'credits');

      // Complete course for student1
      await courseService.updateLessonProgress(enrollment1.id, lesson1.id, 30);
      await courseService.updateLessonProgress(enrollment1.id, lesson2.id, 45);

      // Partially complete for student2
      await courseService.updateLessonProgress(enrollment2.id, lesson1.id, 30);

      // Get analytics
      const analytics = await courseService.getCourseAnalytics(course.id, teacherUser.id);

      expect(analytics.courseId).toBe(course.id);
      expect(analytics.totalEnrollments).toBe(2);
      expect(analytics.completionRate).toBe(50); // 1 out of 2 completed
      expect(analytics.averageProgress).toBe(75); // (100 + 50) / 2
      expect(analytics.totalRevenue).toBe(80); // 2 * 50 * 0.8
    });

    it("should throw error when user is not course creator", async () => {
      // Create a teacher user
      const teacherUser = await storage.createUser({
        username: 'teacher-protected',
        email: 'teacher-protected@example.com',
        password: 'hashedpassword',
        fullName: 'Teacher User',
      });

      // Create a skill
      const skill = await storage.createSkill({
        userId: teacherUser.id,
        title: 'Protected Skill',
        description: 'A skill for testing access',
        category: 'Technology',
        level: 'intermediate',
        type: 'teach',
      });

      // Create another user
      const otherUser = await storage.createUser({
        username: 'other-user',
        email: 'other@example.com',
        password: 'hashedpassword',
        fullName: 'Other User',
      });

      // Create a course
      const course = await courseService.createCourse(teacherUser.id, {
        skillId: skill.id,
        title: 'Protected Course',
        description: 'A course for access testing',
        priceCredits: 25,
      });

      await expect(courseService.getCourseAnalytics(course.id, otherUser.id))
        .rejects.toThrow("Only the course creator can view analytics");
    });
  });

