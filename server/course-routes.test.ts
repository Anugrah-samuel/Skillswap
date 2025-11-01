import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import { registerRoutes } from "./routes";
import { storage } from "./storage";
import { courseService } from "./services/courses";
import { creditsService } from "./services/credits";
import { AuthService } from "./auth";

// Set test environment variables
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key';

// Mock dependencies
vi.mock("./storage");
vi.mock("./services/courses", () => ({
  courseService: {
    createCourse: vi.fn(),
    publishCourse: vi.fn(),
    enrollInCourse: vi.fn(),
    updateProgress: vi.fn(),
    updateLessonProgress: vi.fn(),
    getLessonProgress: vi.fn(),
    getCoursesByCreator: vi.fn(),
    getEnrolledCourses: vi.fn(),
    searchCourses: vi.fn(),
    getCourseWithLessons: vi.fn(),
    addLessonToCourse: vi.fn(),
    updateLesson: vi.fn(),
    deleteLesson: vi.fn(),
    getUserEnrollment: vi.fn(),
    canUserAccessCourse: vi.fn(),
    generateCertificate: vi.fn(),
    getUserCertificates: vi.fn(),
    getCourseAnalytics: vi.fn(),
    getCreatorAnalytics: vi.fn(),
  },
}));
vi.mock("./services/credits");
vi.mock("./auth", () => ({
  AuthService: {
    verifyAccessToken: vi.fn(),
    hashPassword: vi.fn(),
    verifyPassword: vi.fn(),
    generateAccessToken: vi.fn(),
    generateRefreshToken: vi.fn(),
    verifyRefreshToken: vi.fn(),
    getUserRole: vi.fn(),
    extractTokenFromHeader: vi.fn(),
  },
  authenticateToken: vi.fn((req: any, res: any, next: any) => {
    req.user = {
      userId: "user-1",
      username: "testuser",
      email: "test@example.com",
      role: "user",
      subscriptionStatus: "basic"
    };
    next();
  }),
  optionalAuth: vi.fn((req: any, res: any, next: any) => {
    req.user = {
      userId: "user-1",
      username: "testuser",
      email: "test@example.com",
      role: "user",
      subscriptionStatus: "basic"
    };
    next();
  }),
  requireRole: vi.fn(() => (req: any, res: any, next: any) => next()),
  requirePremium: vi.fn(() => (req: any, res: any, next: any) => next()),
  rateLimitByUser: vi.fn(() => (req: any, res: any, next: any) => next()),
  UserRole: {
    USER: 'user',
    CREATOR: 'creator',
    ADMIN: 'admin'
  }
}));

const mockStorage = vi.mocked(storage);
const mockCourseService = vi.mocked(courseService);
const mockCreditsService = vi.mocked(creditsService);
const mockAuthService = vi.mocked(AuthService);

describe("Course Management API", () => {
  let app: express.Application;
  let server: any;
  let authToken: string;
  let mockUser: any;
  let mockSkill: any;
  let mockCourse: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    app = express();
    app.use(express.json());
    server = await registerRoutes(app);

    // Mock user and auth
    mockUser = {
      id: "user-1",
      username: "testuser",
      email: "test@example.com",
      fullName: "Test User",
      creditBalance: 100,
      subscriptionStatus: "basic",
      skillPoints: 50,
    };

    mockSkill = {
      id: "skill-1",
      userId: "user-1",
      title: "JavaScript",
      description: "Programming language",
      category: "Programming",
      level: "intermediate",
    };

    mockCourse = {
      id: "course-1",
      creatorId: "user-1",
      skillId: "skill-1",
      title: "Learn JavaScript",
      description: "Complete JavaScript course",
      priceCredits: 50,
      priceMoney: null,
      status: "draft",
      totalLessons: 0,
      totalDuration: 0,
      rating: 0,
      totalReviews: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    authToken = "valid-jwt-token";
    
    // Mock auth verification
    mockAuthService.verifyAccessToken.mockReturnValue({
      userId: mockUser.id,
      username: mockUser.username,
      role: "user",
    });

    mockStorage.getUser.mockResolvedValue(mockUser);
    mockStorage.getSkill.mockResolvedValue(mockSkill);
  });

  describe("POST /api/courses", () => {
    it("should create a new course successfully", async () => {
      const courseData = {
        skillId: "skill-1",
        title: "Learn JavaScript",
        description: "Complete JavaScript course",
        priceCredits: 50,
      };

      mockCourseService.createCourse.mockResolvedValue(mockCourse);

      const response = await request(app)
        .post("/api/courses")
        .set("Authorization", `Bearer ${authToken}`)
        .send(courseData);

      expect(response.status).toBe(201);
      expect(response.body).toEqual(mockCourse);
      expect(mockCourseService.createCourse).toHaveBeenCalledWith(mockUser.id, courseData);
    });

    it("should return 400 for invalid course data", async () => {
      const invalidData = {
        skillId: "",
        title: "",
        description: "Short",
        priceCredits: -1,
      };

      const response = await request(app)
        .post("/api/courses")
        .set("Authorization", `Bearer ${authToken}`)
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.code).toBe("VALIDATION_ERROR");
    });

    it("should return 404 when skill not found", async () => {
      const courseData = {
        skillId: "nonexistent-skill",
        title: "Learn JavaScript",
        description: "Complete JavaScript course",
        priceCredits: 50,
      };

      mockCourseService.createCourse.mockRejectedValue(new Error("Skill not found"));

      const response = await request(app)
        .post("/api/courses")
        .set("Authorization", `Bearer ${authToken}`)
        .send(courseData);

      expect(response.status).toBe(404);
      expect(response.body.code).toBe("SKILL_NOT_FOUND");
    });

    it("should return 403 when trying to create course for someone else's skill", async () => {
      const courseData = {
        skillId: "skill-1",
        title: "Learn JavaScript",
        description: "Complete JavaScript course",
        priceCredits: 50,
      };

      mockCourseService.createCourse.mockRejectedValue(
        new Error("You can only create courses for your own skills")
      );

      const response = await request(app)
        .post("/api/courses")
        .set("Authorization", `Bearer ${authToken}`)
        .send(courseData);

      expect(response.status).toBe(403);
      expect(response.body.code).toBe("UNAUTHORIZED_SKILL_ACCESS");
    });
  });

  describe("PUT /api/courses/:id/publish", () => {
    it("should publish a course successfully", async () => {
      const publishedCourse = { ...mockCourse, status: "published" };
      mockCourseService.publishCourse.mockResolvedValue(publishedCourse);

      const response = await request(app)
        .put("/api/courses/course-1/publish")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(publishedCourse);
      expect(mockCourseService.publishCourse).toHaveBeenCalledWith("course-1", mockUser.id);
    });

    it("should return 404 when course not found", async () => {
      mockCourseService.publishCourse.mockRejectedValue(new Error("Course not found"));

      const response = await request(app)
        .put("/api/courses/nonexistent/publish")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.code).toBe("COURSE_NOT_FOUND");
    });

    it("should return 403 when user is not the course creator", async () => {
      mockCourseService.publishCourse.mockRejectedValue(
        new Error("Only the course creator can publish the course")
      );

      const response = await request(app)
        .put("/api/courses/course-1/publish")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(403);
      expect(response.body.code).toBe("UNAUTHORIZED_COURSE_ACCESS");
    });

    it("should return 400 when course has no lessons", async () => {
      mockCourseService.publishCourse.mockRejectedValue(
        new Error("Course must have at least one lesson before publishing")
      );

      const response = await request(app)
        .put("/api/courses/course-1/publish")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.code).toBe("INSUFFICIENT_CONTENT");
    });
  });

  describe("GET /api/courses/search", () => {
    it("should search courses with default parameters", async () => {
      const mockCourses = [mockCourse];
      mockCourseService.searchCourses.mockResolvedValue(mockCourses);

      const response = await request(app)
        .get("/api/courses/search");

      expect(response.status).toBe(200);
      expect(response.body.courses).toEqual(mockCourses);
      expect(response.body.pagination).toBeDefined();
      expect(mockCourseService.searchCourses).toHaveBeenCalledWith(
        undefined,
        { status: "published" }
      );
    });

    it("should search courses with query and filters", async () => {
      const mockCourses = [mockCourse];
      mockCourseService.searchCourses.mockResolvedValue(mockCourses);

      const response = await request(app)
        .get("/api/courses/search")
        .query({
          query: "javascript",
          category: "programming",
          minPrice: 10,
          maxPrice: 100,
          sortBy: "rating",
          sortOrder: "desc",
          page: 1,
          limit: 10,
        });

      expect(response.status).toBe(200);
      expect(response.body.courses).toEqual(mockCourses);
      expect(mockCourseService.searchCourses).toHaveBeenCalledWith(
        "javascript",
        {
          category: "programming",
          minPrice: 10,
          maxPrice: 100,
          status: "published",
        }
      );
    });

    it("should return 400 for invalid search parameters", async () => {
      const response = await request(app)
        .get("/api/courses/search")
        .query({
          page: -1,
          limit: 200,
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("POST /api/courses/:id/enroll", () => {
    it("should enroll user in course with credits", async () => {
      const mockEnrollment = {
        id: "enrollment-1",
        courseId: "course-1",
        userId: mockUser.id,
        progress: 0,
        createdAt: new Date(),
      };

      mockCourseService.enrollInCourse.mockResolvedValue(mockEnrollment);

      const response = await request(app)
        .post("/api/courses/course-1/enroll")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ paymentMethod: "credits" });

      expect(response.status).toBe(201);
      expect(response.body).toEqual(mockEnrollment);
      expect(mockCourseService.enrollInCourse).toHaveBeenCalledWith(
        mockUser.id,
        "course-1",
        "credits"
      );
    });

    it("should return 400 when user tries to enroll in own course", async () => {
      mockCourseService.enrollInCourse.mockRejectedValue(
        new Error("You cannot enroll in your own course")
      );

      const response = await request(app)
        .post("/api/courses/course-1/enroll")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ paymentMethod: "credits" });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe("SELF_ENROLLMENT_NOT_ALLOWED");
    });

    it("should return 400 when user is already enrolled", async () => {
      mockCourseService.enrollInCourse.mockRejectedValue(
        new Error("User is already enrolled in this course")
      );

      const response = await request(app)
        .post("/api/courses/course-1/enroll")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ paymentMethod: "credits" });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe("ALREADY_ENROLLED");
    });

    it("should return 400 when user has insufficient credits", async () => {
      mockCourseService.enrollInCourse.mockRejectedValue(
        new Error("Insufficient credits")
      );

      const response = await request(app)
        .post("/api/courses/course-1/enroll")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ paymentMethod: "credits" });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe("INSUFFICIENT_CREDITS");
    });
  });

  describe("GET /api/courses/:id", () => {
    it("should return course details for enrolled user", async () => {
      const mockCourseWithLessons = {
        ...mockCourse,
        lessons: [
          {
            id: "lesson-1",
            courseId: "course-1",
            title: "Introduction",
            description: "Course introduction",
            contentType: "video",
            contentUrl: "https://example.com/video1.mp4",
            duration: 30,
            orderIndex: 1,
            createdAt: new Date(),
          },
        ],
      };

      const mockEnrollment = {
        id: "enrollment-1",
        courseId: "course-1",
        userId: mockUser.id,
        progress: 25,
        createdAt: new Date(),
      };

      mockCourseService.getCourseWithLessons.mockResolvedValue(mockCourseWithLessons);
      mockCourseService.canUserAccessCourse.mockResolvedValue(true);
      mockCourseService.getUserEnrollment.mockResolvedValue(mockEnrollment);

      const response = await request(app)
        .get("/api/courses/course-1")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ...mockCourseWithLessons,
        userEnrollment: mockEnrollment,
      });
    });

    it("should return limited course details for non-enrolled user", async () => {
      const mockCourseWithLessons = {
        ...mockCourse,
        lessons: [
          {
            id: "lesson-1",
            courseId: "course-1",
            title: "Introduction",
            description: "Course introduction",
            contentType: "video",
            contentUrl: "https://example.com/video1.mp4",
            duration: 30,
            orderIndex: 1,
            createdAt: new Date(),
          },
        ],
      };

      mockCourseService.getCourseWithLessons.mockResolvedValue(mockCourseWithLessons);
      mockCourseService.canUserAccessCourse.mockResolvedValue(false);

      const response = await request(app)
        .get("/api/courses/course-1")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.lessons[0]).not.toHaveProperty("contentUrl");
    });

    it("should return 404 when course not found", async () => {
      mockCourseService.getCourseWithLessons.mockResolvedValue(undefined);

      const response = await request(app)
        .get("/api/courses/nonexistent");

      expect(response.status).toBe(404);
      expect(response.body.code).toBe("COURSE_NOT_FOUND");
    });
  });

  describe("GET /api/courses/my/created", () => {
    it("should return courses created by user", async () => {
      const mockCourses = [mockCourse];
      mockCourseService.getCoursesByCreator.mockResolvedValue(mockCourses);

      const response = await request(app)
        .get("/api/courses/my/created")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockCourses);
      expect(mockCourseService.getCoursesByCreator).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe("GET /api/courses/my/enrolled", () => {
    it("should return courses user is enrolled in", async () => {
      const mockEnrollments = [
        {
          id: "enrollment-1",
          courseId: "course-1",
          userId: mockUser.id,
          progress: 50,
          createdAt: new Date(),
          course: mockCourse,
        },
      ];

      mockCourseService.getEnrolledCourses.mockResolvedValue(mockEnrollments);

      const response = await request(app)
        .get("/api/courses/my/enrolled")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockEnrollments);
      expect(mockCourseService.getEnrolledCourses).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe("PUT /api/courses/enrollments/:id/progress", () => {
    it("should update course progress with enhanced tracking", async () => {
      const mockUpdatedEnrollment = {
        id: "enrollment-1",
        courseId: "course-1",
        userId: mockUser.id,
        progress: 75,
        createdAt: new Date(),
      };

      const mockEnrollment = {
        id: "enrollment-1",
        courseId: "course-1",
        userId: mockUser.id,
        progress: 50,
        createdAt: new Date(),
      };

      mockStorage.getCourseEnrollment.mockResolvedValue(mockEnrollment);
      mockCourseService.updateLessonProgress.mockResolvedValue(mockUpdatedEnrollment);

      const response = await request(app)
        .put("/api/courses/enrollments/enrollment-1/progress")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ lessonId: "lesson-1", timeSpent: 30 });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockUpdatedEnrollment);
      expect(mockCourseService.updateLessonProgress).toHaveBeenCalledWith("enrollment-1", "lesson-1", 30);
    });

    it("should return 400 when lessonId is missing", async () => {
      const response = await request(app)
        .put("/api/courses/enrollments/enrollment-1/progress")
        .set("Authorization", `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.code).toBe("MISSING_LESSON_ID");
    });

    it("should return 403 when user doesn't own enrollment", async () => {
      const mockEnrollment = {
        id: "enrollment-1",
        courseId: "course-1",
        userId: "other-user",
        progress: 50,
        createdAt: new Date(),
      };

      mockStorage.getCourseEnrollment.mockResolvedValue(mockEnrollment);

      const response = await request(app)
        .put("/api/courses/enrollments/enrollment-1/progress")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ lessonId: "lesson-1" });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe("UNAUTHORIZED_ENROLLMENT_ACCESS");
    });

    it("should return 404 when enrollment not found", async () => {
      mockStorage.getCourseEnrollment.mockResolvedValue(undefined);

      const response = await request(app)
        .put("/api/courses/enrollments/nonexistent/progress")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ lessonId: "lesson-1" });

      expect(response.status).toBe(404);
      expect(response.body.code).toBe("ENROLLMENT_NOT_FOUND");
    });
  });

  describe("GET /api/courses/enrollments/:id/lessons/progress", () => {
    it("should return lesson progress for enrollment", async () => {
      const mockEnrollment = {
        id: "enrollment-1",
        courseId: "course-1",
        userId: mockUser.id,
        progress: 50,
        createdAt: new Date(),
      };

      const mockLessonProgress = [
        {
          id: "progress-1",
          enrollmentId: "enrollment-1",
          lessonId: "lesson-1",
          completed: true,
          completedAt: new Date(),
          timeSpent: 30,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockStorage.getCourseEnrollment.mockResolvedValue(mockEnrollment);
      mockCourseService.getLessonProgress.mockResolvedValue(mockLessonProgress);

      const response = await request(app)
        .get("/api/courses/enrollments/enrollment-1/lessons/progress")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.lessonProgress).toEqual(mockLessonProgress);
    });

    it("should return 403 when user doesn't own enrollment", async () => {
      const mockEnrollment = {
        id: "enrollment-1",
        courseId: "course-1",
        userId: "other-user",
        progress: 50,
        createdAt: new Date(),
      };

      mockStorage.getCourseEnrollment.mockResolvedValue(mockEnrollment);

      const response = await request(app)
        .get("/api/courses/enrollments/enrollment-1/lessons/progress")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(403);
      expect(response.body.code).toBe("UNAUTHORIZED_ENROLLMENT_ACCESS");
    });
  });

  describe("POST /api/courses/enrollments/:id/certificate", () => {
    it("should generate certificate for completed course", async () => {
      const mockEnrollment = {
        id: "enrollment-1",
        courseId: "course-1",
        userId: mockUser.id,
        progress: 100,
        completedAt: new Date(),
        createdAt: new Date(),
      };

      const mockCertificate = {
        id: "cert-1",
        userId: mockUser.id,
        courseId: "course-1",
        enrollmentId: "enrollment-1",
        courseName: "Learn JavaScript",
        certificateUrl: "https://certificates.skillswap.com/enrollment-1.pdf",
        completedAt: new Date(),
        createdAt: new Date(),
      };

      mockStorage.getCourseEnrollment.mockResolvedValue(mockEnrollment);
      mockCourseService.generateCertificate.mockResolvedValue(mockCertificate);

      const response = await request(app)
        .post("/api/courses/enrollments/enrollment-1/certificate")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(201);
      expect(response.body).toEqual(mockCertificate);
    });

    it("should return 400 when course not completed", async () => {
      const mockEnrollment = {
        id: "enrollment-1",
        courseId: "course-1",
        userId: mockUser.id,
        progress: 75,
        createdAt: new Date(),
      };

      mockStorage.getCourseEnrollment.mockResolvedValue(mockEnrollment);
      mockCourseService.generateCertificate.mockRejectedValue(
        new Error("Course must be completed to generate certificate")
      );

      const response = await request(app)
        .post("/api/courses/enrollments/enrollment-1/certificate")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.code).toBe("COURSE_NOT_COMPLETED");
    });
  });

  describe("GET /api/certificates", () => {
    it("should return user certificates", async () => {
      const mockCertificates = [
        {
          id: "cert-1",
          userId: mockUser.id,
          courseId: "course-1",
          enrollmentId: "enrollment-1",
          courseName: "Learn JavaScript",
          certificateUrl: "https://certificates.skillswap.com/enrollment-1.pdf",
          completedAt: new Date(),
          createdAt: new Date(),
        },
      ];

      mockCourseService.getUserCertificates.mockResolvedValue(mockCertificates);

      const response = await request(app)
        .get("/api/certificates")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.certificates).toEqual(mockCertificates);
    });
  });

  describe("GET /api/courses/:id/analytics", () => {
    it("should return course analytics for creator", async () => {
      const mockAnalytics = {
        courseId: "course-1",
        totalEnrollments: 10,
        completionRate: 80,
        averageProgress: 85,
        averageRating: 4.5,
        totalRevenue: 400,
        enrollmentsByMonth: [{ month: "2024-01", count: 5 }],
        topPerformingLessons: [
          { lessonId: "lesson-1", title: "Introduction", completionRate: 95 },
        ],
      };

      mockCourseService.getCourseAnalytics.mockResolvedValue(mockAnalytics);

      const response = await request(app)
        .get("/api/courses/course-1/analytics")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockAnalytics);
    });

    it("should return 403 when user is not course creator", async () => {
      mockCourseService.getCourseAnalytics.mockRejectedValue(
        new Error("Only the course creator can view analytics")
      );

      const response = await request(app)
        .get("/api/courses/course-1/analytics")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(403);
      expect(response.body.code).toBe("UNAUTHORIZED_COURSE_ACCESS");
    });
  });

  describe("GET /api/analytics/creator", () => {
    it("should return creator analytics", async () => {
      const mockCreatorAnalytics = {
        totalRevenue: 1000,
        totalStudents: 25,
        averageRating: 4.3,
        courses: [
          {
            courseId: "course-1",
            totalEnrollments: 10,
            completionRate: 80,
            averageProgress: 85,
            averageRating: 4.5,
            totalRevenue: 400,
            enrollmentsByMonth: [{ month: "2024-01", count: 5 }],
            topPerformingLessons: [],
          },
        ],
      };

      mockCourseService.getCreatorAnalytics.mockResolvedValue(mockCreatorAnalytics);

      const response = await request(app)
        .get("/api/analytics/creator")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockCreatorAnalytics);
    });
  });
});