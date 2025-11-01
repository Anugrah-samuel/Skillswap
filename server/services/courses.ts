import { 
  type Course, 
  type InsertCourse,
  type CourseLesson,
  type InsertCourseLesson,
  type CourseEnrollment,
  type InsertCourseEnrollment
} from "@shared/schema";
import { storage } from "../storage";
import { creditsService } from "./credits";

export interface CreateCourseData {
  skillId: string;
  title: string;
  description: string;
  priceCredits: number;
  priceMoney?: number;
}

export interface CourseFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  status?: string;
  creatorId?: string;
}

export interface CourseWithLessons extends Course {
  lessons: CourseLesson[];
}

export interface EnrollmentWithCourse extends CourseEnrollment {
  course: Course;
}

export interface LessonProgress {
  lessonId: string;
  completed: boolean;
  completedAt?: Date;
  timeSpent?: number; // in minutes
}

export interface CourseAnalytics {
  courseId: string;
  totalEnrollments: number;
  completionRate: number;
  averageProgress: number;
  averageRating: number;
  totalRevenue: number;
  enrollmentsByMonth: { month: string; count: number }[];
  topPerformingLessons: { lessonId: string; title: string; completionRate: number }[];
}

export interface CourseCertificate {
  id: string;
  userId: string;
  courseId: string;
  courseName: string;
  completedAt: Date;
  certificateUrl?: string;
}

export interface CourseServiceInterface {
  createCourse(creatorId: string, courseData: CreateCourseData): Promise<Course>;
  publishCourse(courseId: string, creatorId: string): Promise<Course>;
  enrollInCourse(userId: string, courseId: string, paymentMethod: 'credits' | 'money'): Promise<CourseEnrollment>;
  updateProgress(enrollmentId: string, lessonId: string): Promise<CourseEnrollment>;
  updateLessonProgress(enrollmentId: string, lessonId: string, timeSpent?: number): Promise<CourseEnrollment>;
  getLessonProgress(enrollmentId: string): Promise<LessonProgress[]>;
  getCoursesByCreator(creatorId: string): Promise<Course[]>;
  getEnrolledCourses(userId: string): Promise<EnrollmentWithCourse[]>;
  searchCourses(query?: string, filters?: CourseFilters): Promise<Course[]>;
  getCourseWithLessons(courseId: string): Promise<CourseWithLessons | undefined>;
  addLessonToCourse(courseId: string, creatorId: string, lessonData: Omit<InsertCourseLesson, 'courseId'>): Promise<CourseLesson>;
  updateLesson(lessonId: string, creatorId: string, updates: Partial<CourseLesson>): Promise<CourseLesson>;
  deleteLesson(lessonId: string, creatorId: string): Promise<boolean>;
  getUserEnrollment(userId: string, courseId: string): Promise<CourseEnrollment | undefined>;
  canUserAccessCourse(userId: string, courseId: string): Promise<boolean>;
  generateCertificate(enrollmentId: string): Promise<CourseCertificate>;
  getUserCertificates(userId: string): Promise<CourseCertificate[]>;
  getCourseAnalytics(courseId: string, creatorId: string): Promise<CourseAnalytics>;
  getCreatorAnalytics(creatorId: string): Promise<{ totalRevenue: number; totalStudents: number; averageRating: number; courses: CourseAnalytics[] }>;
}

export class CourseService implements CourseServiceInterface {
  
  /**
   * Create a new course
   */
  async createCourse(creatorId: string, courseData: CreateCourseData): Promise<Course> {
    // Validate that the creator owns the skill
    const skill = await storage.getSkill(courseData.skillId);
    if (!skill) {
      throw new Error('Skill not found');
    }
    
    if (skill.userId !== creatorId) {
      throw new Error('You can only create courses for your own skills');
    }

    // Validate pricing
    if (courseData.priceCredits < 0) {
      throw new Error('Credit price cannot be negative');
    }
    
    if (courseData.priceMoney !== undefined && courseData.priceMoney < 0) {
      throw new Error('Money price cannot be negative');
    }

    const insertCourse: InsertCourse = {
      creatorId,
      skillId: courseData.skillId,
      title: courseData.title,
      description: courseData.description,
      priceCredits: courseData.priceCredits,
      priceMoney: courseData.priceMoney,
      status: 'draft',
    };

    return await storage.createCourse(insertCourse);
  }

  /**
   * Publish a course (make it available for enrollment)
   */
  async publishCourse(courseId: string, creatorId: string): Promise<Course> {
    const course = await storage.getCourse(courseId);
    if (!course) {
      throw new Error('Course not found');
    }

    if (course.creatorId !== creatorId) {
      throw new Error('Only the course creator can publish the course');
    }

    if (course.status !== 'draft') {
      throw new Error('Only draft courses can be published');
    }

    // Validate that the course has at least one lesson
    const lessons = await storage.getLessonsByCourse(courseId);
    if (lessons.length === 0) {
      throw new Error('Course must have at least one lesson before publishing');
    }

    const updatedCourse = await storage.updateCourse(courseId, { status: 'published' });
    if (!updatedCourse) {
      throw new Error('Failed to publish course');
    }

    return updatedCourse;
  }

  /**
   * Enroll a user in a course
   */
  async enrollInCourse(userId: string, courseId: string, paymentMethod: 'credits' | 'money'): Promise<CourseEnrollment> {
    const course = await storage.getCourse(courseId);
    if (!course) {
      throw new Error('Course not found');
    }

    if (course.status !== 'published') {
      throw new Error('Course is not available for enrollment');
    }

    if (course.creatorId === userId) {
      throw new Error('You cannot enroll in your own course');
    }

    // Check if user is already enrolled
    const existingEnrollment = await storage.getUserCourseEnrollment(userId, courseId);
    if (existingEnrollment) {
      throw new Error('User is already enrolled in this course');
    }

    // Process payment
    if (paymentMethod === 'credits') {
      if (course.priceCredits > 0) {
        await creditsService.deductCredits(
          userId,
          course.priceCredits,
          'spent',
          `Enrolled in course: ${course.title}`,
          courseId
        );

        // Award credits to course creator (80% of price)
        const creatorCredits = Math.floor(course.priceCredits * 0.8);
        await creditsService.addCredits(
          course.creatorId,
          creatorCredits,
          'earned',
          `Course enrollment: ${course.title}`,
          courseId
        );
      }
    } else if (paymentMethod === 'money') {
      if (!course.priceMoney || course.priceMoney <= 0) {
        throw new Error('Course does not support money payment');
      }
      // In a real implementation, this would integrate with Stripe
      // For now, we'll just simulate the payment
      throw new Error('Money payment not implemented yet');
    }

    // Create enrollment
    const insertEnrollment: InsertCourseEnrollment = {
      courseId,
      userId,
    };

    return await storage.createCourseEnrollment(insertEnrollment);
  }

  /**
   * Update course progress for a user
   */
  async updateProgress(enrollmentId: string, lessonId: string): Promise<CourseEnrollment> {
    const enrollment = await storage.getCourseEnrollment(enrollmentId);
    if (!enrollment) {
      throw new Error('Enrollment not found');
    }

    const lesson = await storage.getCourseLesson(lessonId);
    if (!lesson) {
      throw new Error('Lesson not found');
    }

    if (lesson.courseId !== enrollment.courseId) {
      throw new Error('Lesson does not belong to the enrolled course');
    }

    // Get all lessons for the course to calculate progress
    const allLessons = await storage.getLessonsByCourse(enrollment.courseId);
    const totalLessons = allLessons.length;
    
    if (totalLessons === 0) {
      throw new Error('Course has no lessons');
    }

    // For simplicity, we'll assume each lesson completion adds equal progress
    // In a real implementation, this might be based on lesson duration or complexity
    const progressIncrement = Math.floor(100 / totalLessons);
    const newProgress = Math.min(100, enrollment.progress + progressIncrement);

    const updatedEnrollment = await storage.updateCourseEnrollment(enrollmentId, {
      progress: newProgress,
    });

    if (!updatedEnrollment) {
      throw new Error('Failed to update progress');
    }

    // Award skill points for progress
    if (newProgress > enrollment.progress) {
      const user = await storage.getUser(enrollment.userId);
      if (user) {
        const skillPointsEarned = Math.floor(progressIncrement / 10); // 1 skill point per 10% progress
        await storage.updateUser(enrollment.userId, {
          skillPoints: user.skillPoints + skillPointsEarned,
        });
      }
    }

    return updatedEnrollment;
  }

  /**
   * Update lesson progress with detailed tracking
   */
  async updateLessonProgress(enrollmentId: string, lessonId: string, timeSpent?: number): Promise<CourseEnrollment> {
    const enrollment = await storage.getCourseEnrollment(enrollmentId);
    if (!enrollment) {
      throw new Error('Enrollment not found');
    }

    const lesson = await storage.getCourseLesson(lessonId);
    if (!lesson) {
      throw new Error('Lesson not found');
    }

    if (lesson.courseId !== enrollment.courseId) {
      throw new Error('Lesson does not belong to the enrolled course');
    }

    // Get or create lesson progress
    let lessonProgress = await storage.getLessonProgress(enrollmentId, lessonId);
    
    if (!lessonProgress) {
      lessonProgress = await storage.createLessonProgress({
        enrollmentId,
        lessonId,
      });
    }

    // Update lesson progress
    const updatedLessonProgress = await storage.updateLessonProgress(lessonProgress.id, {
      completed: true,
      timeSpent: (lessonProgress.timeSpent || 0) + (timeSpent || 0),
    });

    if (!updatedLessonProgress) {
      throw new Error('Failed to update lesson progress');
    }

    // Calculate overall course progress
    const allLessons = await storage.getLessonsByCourse(enrollment.courseId);
    const allProgress = await storage.getLessonProgressByEnrollment(enrollmentId);
    
    const completedLessons = allProgress.filter(p => p.completed).length;
    const totalLessons = allLessons.length;
    const newProgress = totalLessons > 0 ? Math.floor((completedLessons / totalLessons) * 100) : 0;

    // Update enrollment progress
    const updatedEnrollment = await storage.updateCourseEnrollment(enrollmentId, {
      progress: newProgress,
    });

    if (!updatedEnrollment) {
      throw new Error('Failed to update enrollment progress');
    }

    // Award skill points for lesson completion
    const user = await storage.getUser(enrollment.userId);
    if (user && !lessonProgress.completed) { // Only award points for first completion
      const skillPointsEarned = Math.max(1, Math.floor((lesson.duration || 30) / 15)); // 1 point per 15 minutes
      await storage.updateUser(enrollment.userId, {
        skillPoints: user.skillPoints + skillPointsEarned,
      });
    }

    // Generate certificate if course is completed
    if (newProgress === 100 && !enrollment.completedAt) {
      await this.generateCertificate(enrollmentId);
      
      // Award completion badge
      if (user) {
        const badges = user.badges || [];
        const courseBadge = `course-completed-${enrollment.courseId}`;
        if (!badges.includes(courseBadge)) {
          badges.push(courseBadge);
          await storage.updateUser(enrollment.userId, { badges });
        }
      }
    }

    return updatedEnrollment;
  }

  /**
   * Get lesson progress for an enrollment
   */
  async getLessonProgress(enrollmentId: string): Promise<LessonProgress[]> {
    return await storage.getLessonProgressByEnrollment(enrollmentId);
  }

  /**
   * Get courses created by a specific user
   */
  async getCoursesByCreator(creatorId: string): Promise<Course[]> {
    return await storage.getCoursesByCreator(creatorId);
  }

  /**
   * Get courses a user is enrolled in
   */
  async getEnrolledCourses(userId: string): Promise<EnrollmentWithCourse[]> {
    const enrollments = await storage.getEnrollmentsByUser(userId);
    
    const enrollmentsWithCourses = await Promise.all(
      enrollments.map(async (enrollment) => {
        const course = await storage.getCourse(enrollment.courseId);
        if (!course) {
          throw new Error(`Course not found for enrollment ${enrollment.id}`);
        }
        return {
          ...enrollment,
          course,
        };
      })
    );

    return enrollmentsWithCourses;
  }

  /**
   * Search for courses with optional filters
   */
  async searchCourses(query?: string, filters?: CourseFilters): Promise<Course[]> {
    let courses = await storage.searchCourses(query, filters?.category, filters?.status || 'published');

    // Apply additional filters
    if (filters?.creatorId) {
      courses = courses.filter(course => course.creatorId === filters.creatorId);
    }

    if (filters?.minPrice !== undefined) {
      courses = courses.filter(course => course.priceCredits >= filters.minPrice!);
    }

    if (filters?.maxPrice !== undefined) {
      courses = courses.filter(course => course.priceCredits <= filters.maxPrice!);
    }

    return courses;
  }

  /**
   * Get a course with its lessons
   */
  async getCourseWithLessons(courseId: string): Promise<CourseWithLessons | undefined> {
    const course = await storage.getCourse(courseId);
    if (!course) {
      return undefined;
    }

    const lessons = await storage.getLessonsByCourse(courseId);
    
    return {
      ...course,
      lessons,
    };
  }

  /**
   * Add a lesson to a course
   */
  async addLessonToCourse(
    courseId: string, 
    creatorId: string, 
    lessonData: Omit<InsertCourseLesson, 'courseId'>
  ): Promise<CourseLesson> {
    const course = await storage.getCourse(courseId);
    if (!course) {
      throw new Error('Course not found');
    }

    if (course.creatorId !== creatorId) {
      throw new Error('Only the course creator can add lessons');
    }

    if (course.status === 'published') {
      throw new Error('Cannot add lessons to published courses');
    }

    const insertLesson: InsertCourseLesson = {
      ...lessonData,
      courseId,
    };

    return await storage.createCourseLesson(insertLesson);
  }

  /**
   * Update a lesson
   */
  async updateLesson(lessonId: string, creatorId: string, updates: Partial<CourseLesson>): Promise<CourseLesson> {
    const lesson = await storage.getCourseLesson(lessonId);
    if (!lesson) {
      throw new Error('Lesson not found');
    }

    const course = await storage.getCourse(lesson.courseId);
    if (!course) {
      throw new Error('Course not found');
    }

    if (course.creatorId !== creatorId) {
      throw new Error('Only the course creator can update lessons');
    }

    if (course.status === 'published') {
      throw new Error('Cannot update lessons in published courses');
    }

    const updatedLesson = await storage.updateCourseLesson(lessonId, updates);
    if (!updatedLesson) {
      throw new Error('Failed to update lesson');
    }

    return updatedLesson;
  }

  /**
   * Delete a lesson
   */
  async deleteLesson(lessonId: string, creatorId: string): Promise<boolean> {
    const lesson = await storage.getCourseLesson(lessonId);
    if (!lesson) {
      throw new Error('Lesson not found');
    }

    const course = await storage.getCourse(lesson.courseId);
    if (!course) {
      throw new Error('Course not found');
    }

    if (course.creatorId !== creatorId) {
      throw new Error('Only the course creator can delete lessons');
    }

    if (course.status === 'published') {
      throw new Error('Cannot delete lessons from published courses');
    }

    return await storage.deleteCourseLesson(lessonId);
  }

  /**
   * Get user's enrollment for a specific course
   */
  async getUserEnrollment(userId: string, courseId: string): Promise<CourseEnrollment | undefined> {
    return await storage.getUserCourseEnrollment(userId, courseId);
  }

  /**
   * Check if a user can access a course (either as creator or enrolled student)
   */
  async canUserAccessCourse(userId: string, courseId: string): Promise<boolean> {
    const course = await storage.getCourse(courseId);
    if (!course) {
      return false;
    }

    // Course creator always has access
    if (course.creatorId === userId) {
      return true;
    }

    // Check if user is enrolled
    const enrollment = await storage.getUserCourseEnrollment(userId, courseId);
    return enrollment !== undefined;
  }

  /**
   * Generate a certificate for completed course
   */
  async generateCertificate(enrollmentId: string): Promise<CourseCertificate> {
    const enrollment = await storage.getCourseEnrollment(enrollmentId);
    if (!enrollment) {
      throw new Error('Enrollment not found');
    }

    if (enrollment.progress < 100) {
      throw new Error('Course must be completed to generate certificate');
    }

    // Check if certificate already exists
    const existingCertificate = await storage.getCertificateByEnrollment(enrollmentId);
    if (existingCertificate) {
      return existingCertificate;
    }

    const course = await storage.getCourse(enrollment.courseId);
    if (!course) {
      throw new Error('Course not found');
    }

    // In a real implementation, this would generate a PDF certificate
    // For now, we'll just create a record
    const certificate = await storage.createCourseCertificate({
      userId: enrollment.userId,
      courseId: enrollment.courseId,
      enrollmentId: enrollmentId,
      courseName: course.title,
      completedAt: enrollment.completedAt || new Date(),
      certificateUrl: `https://certificates.skillswap.com/${enrollmentId}.pdf`, // Mock URL
    });

    return certificate;
  }

  /**
   * Get user's certificates
   */
  async getUserCertificates(userId: string): Promise<CourseCertificate[]> {
    return await storage.getCertificatesByUser(userId);
  }

  /**
   * Get analytics for a specific course
   */
  async getCourseAnalytics(courseId: string, creatorId: string): Promise<CourseAnalytics> {
    const course = await storage.getCourse(courseId);
    if (!course) {
      throw new Error('Course not found');
    }

    if (course.creatorId !== creatorId) {
      throw new Error('Only the course creator can view analytics');
    }

    const enrollments = await storage.getEnrollmentsByCourse(courseId);
    const lessons = await storage.getLessonsByCourse(courseId);
    
    // Calculate completion rate
    const completedEnrollments = enrollments.filter(e => e.progress === 100).length;
    const completionRate = enrollments.length > 0 ? (completedEnrollments / enrollments.length) * 100 : 0;

    // Calculate average progress
    const averageProgress = enrollments.length > 0 
      ? enrollments.reduce((sum, e) => sum + e.progress, 0) / enrollments.length 
      : 0;

    // Calculate revenue (80% of course price per enrollment)
    const totalRevenue = enrollments.length * course.priceCredits * 0.8;

    // Group enrollments by month
    const enrollmentsByMonth = enrollments.reduce((acc, enrollment) => {
      const month = enrollment.createdAt.toISOString().substring(0, 7); // YYYY-MM
      const existing = acc.find(item => item.month === month);
      if (existing) {
        existing.count++;
      } else {
        acc.push({ month, count: 1 });
      }
      return acc;
    }, [] as { month: string; count: number }[]);

    // Calculate lesson performance
    const topPerformingLessons = await Promise.all(
      lessons.map(async (lesson) => {
        const lessonProgressRecords = [];
        for (const enrollment of enrollments) {
          const progress = await storage.getLessonProgress(enrollment.id, lesson.id);
          if (progress) {
            lessonProgressRecords.push(progress);
          }
        }
        
        const completedCount = lessonProgressRecords.filter(p => p.completed).length;
        const completionRate = enrollments.length > 0 ? (completedCount / enrollments.length) * 100 : 0;
        
        return {
          lessonId: lesson.id,
          title: lesson.title,
          completionRate,
        };
      })
    );

    return {
      courseId,
      totalEnrollments: enrollments.length,
      completionRate,
      averageProgress,
      averageRating: course.rating,
      totalRevenue,
      enrollmentsByMonth,
      topPerformingLessons: topPerformingLessons.sort((a, b) => b.completionRate - a.completionRate),
    };
  }

  /**
   * Get analytics for all courses by a creator
   */
  async getCreatorAnalytics(creatorId: string): Promise<{ 
    totalRevenue: number; 
    totalStudents: number; 
    averageRating: number; 
    courses: CourseAnalytics[] 
  }> {
    const courses = await storage.getCoursesByCreator(creatorId);
    
    const courseAnalytics = await Promise.all(
      courses.map(course => this.getCourseAnalytics(course.id, creatorId))
    );

    const totalRevenue = courseAnalytics.reduce((sum, analytics) => sum + analytics.totalRevenue, 0);
    const totalStudents = courseAnalytics.reduce((sum, analytics) => sum + analytics.totalEnrollments, 0);
    const averageRating = courses.length > 0 
      ? courses.reduce((sum, course) => sum + course.rating, 0) / courses.length 
      : 0;

    return {
      totalRevenue,
      totalStudents,
      averageRating,
      courses: courseAnalytics,
    };
  }
}

// Export singleton instance
export const courseService = new CourseService();