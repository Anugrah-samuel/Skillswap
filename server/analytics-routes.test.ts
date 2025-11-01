import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { registerRoutes } from "./routes";
import { storage } from "./storage";
import { AuthService } from "./auth";

describe("Analytics Routes", () => {
  let app: express.Express;
  let testUserId: string;
  let testSkillId: string;
  let authToken: string;

  beforeEach(async () => {
    app = express();
    app.use(express.json());
    await registerRoutes(app);

    // Create test user
    const hashedPassword = await AuthService.hashPassword("testpassword");
    const user = await storage.createUser({
      username: "testuser",
      email: "test@example.com",
      password: hashedPassword,
      fullName: "Test User",
      creditBalance: 100,
      skillPoints: 50,
      badges: ["first_session"]
    });
    testUserId = user.id;

    // Generate auth token
    authToken = AuthService.generateAccessToken(user);

    // Create test skill
    const skill = await storage.createSkill({
      userId: testUserId,
      title: "JavaScript",
      description: "Programming language",
      category: "Programming",
      level: "intermediate",
      type: "teach"
    });
    testSkillId = skill.id;
  });

  describe("GET /api/analytics/dashboard", () => {
    it("should return user dashboard analytics", async () => {
      const response = await request(app)
        .get("/api/analytics/dashboard")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("userId", testUserId);
      expect(response.body).toHaveProperty("creditBalance", 100);
      expect(response.body).toHaveProperty("skillPoints", 50);
      expect(response.body).toHaveProperty("badges");
      expect(response.body.badges).toContain("first_session");
      expect(response.body).toHaveProperty("totalSessionsCompleted");
      expect(response.body).toHaveProperty("totalSessionsTaught");
      expect(response.body).toHaveProperty("coursesCreated");
      expect(response.body).toHaveProperty("coursesCompleted");
      expect(response.body).toHaveProperty("currentStreak");
      expect(response.body).toHaveProperty("longestStreak");
    });

    it("should require authentication", async () => {
      await request(app)
        .get("/api/analytics/dashboard")
        .expect(401);
    });
  });

  describe("GET /api/analytics/skills", () => {
    it("should return skill analytics for all user skills", async () => {
      const response = await request(app)
        .get("/api/analytics/skills")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toHaveProperty("skillId", testSkillId);
      expect(response.body[0]).toHaveProperty("skillTitle", "JavaScript");
      expect(response.body[0]).toHaveProperty("proficiencyLevel");
      expect(response.body[0]).toHaveProperty("sessionsAsTeacher");
      expect(response.body[0]).toHaveProperty("sessionsAsStudent");
    });

    it("should return analytics for specific skill when skillId provided", async () => {
      const response = await request(app)
        .get(`/api/analytics/skills?skillId=${testSkillId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].skillId).toBe(testSkillId);
    });

    it("should require authentication", async () => {
      await request(app)
        .get("/api/analytics/skills")
        .expect(401);
    });
  });

  describe("GET /api/analytics/teaching", () => {
    it("should return teaching analytics", async () => {
      const response = await request(app)
        .get("/api/analytics/teaching")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("userId", testUserId);
      expect(response.body).toHaveProperty("totalStudents");
      expect(response.body).toHaveProperty("totalTeachingHours");
      expect(response.body).toHaveProperty("averageRating");
      expect(response.body).toHaveProperty("totalEarnings");
      expect(response.body).toHaveProperty("coursesCreated");
      expect(response.body).toHaveProperty("courseEnrollments");
      expect(response.body).toHaveProperty("studentSatisfactionRate");
      expect(response.body).toHaveProperty("repeatStudentRate");
      expect(response.body).toHaveProperty("topSkills");
      expect(Array.isArray(response.body.topSkills)).toBe(true);
    });

    it("should require authentication", async () => {
      await request(app)
        .get("/api/analytics/teaching")
        .expect(401);
    });
  });

  describe("GET /api/analytics/badges", () => {
    it("should return user badges", async () => {
      const response = await request(app)
        .get("/api/analytics/badges")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toHaveProperty("id", "first_session");
      expect(response.body[0]).toHaveProperty("name");
      expect(response.body[0]).toHaveProperty("description");
      expect(response.body[0]).toHaveProperty("criteria");
      expect(response.body[0]).toHaveProperty("rarity");
    });

    it("should require authentication", async () => {
      await request(app)
        .get("/api/analytics/badges")
        .expect(401);
    });
  });

  describe("GET /api/analytics/badges/available", () => {
    it("should return all available badges", async () => {
      const response = await request(app)
        .get("/api/analytics/badges/available")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty("id");
      expect(response.body[0]).toHaveProperty("name");
      expect(response.body[0]).toHaveProperty("description");
      expect(response.body[0]).toHaveProperty("criteria");
      expect(response.body[0]).toHaveProperty("rarity");
    });

    it("should require authentication", async () => {
      await request(app)
        .get("/api/analytics/badges/available")
        .expect(401);
    });
  });

  describe("POST /api/analytics/badges/check", () => {
    it("should check and award new badges", async () => {
      const response = await request(app)
        .post("/api/analytics/badges/check")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("newBadges");
      expect(Array.isArray(response.body.newBadges)).toBe(true);
    });

    it("should require authentication", async () => {
      await request(app)
        .post("/api/analytics/badges/check")
        .expect(401);
    });
  });

  describe("GET /api/analytics/streak", () => {
    it("should return learning streak information", async () => {
      const response = await request(app)
        .get("/api/analytics/streak")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("userId", testUserId);
      expect(response.body).toHaveProperty("currentStreak");
      expect(response.body).toHaveProperty("longestStreak");
      expect(response.body).toHaveProperty("lastActivityDate");
      expect(response.body).toHaveProperty("streakStartDate");
    });

    it("should require authentication", async () => {
      await request(app)
        .get("/api/analytics/streak")
        .expect(401);
    });
  });

  describe("GET /api/analytics/activity", () => {
    it("should return activity summary with default 30 days", async () => {
      const response = await request(app)
        .get("/api/analytics/activity")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("period", "30 days");
      expect(response.body).toHaveProperty("sessionsCompleted");
      expect(response.body).toHaveProperty("sessionsScheduled");
      expect(response.body).toHaveProperty("creditsEarned");
      expect(response.body).toHaveProperty("creditsSpent");
      expect(response.body).toHaveProperty("coursesEnrolled");
      expect(response.body).toHaveProperty("activeDays");
    });

    it("should return activity summary for specified days", async () => {
      const response = await request(app)
        .get("/api/analytics/activity?days=7")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.period).toBe("7 days");
    });

    it("should validate days parameter", async () => {
      await request(app)
        .get("/api/analytics/activity?days=0")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(400);

      await request(app)
        .get("/api/analytics/activity?days=400")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(400);

      await request(app)
        .get("/api/analytics/activity?days=invalid")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(400);
    });

    it("should require authentication", async () => {
      await request(app)
        .get("/api/analytics/activity")
        .expect(401);
    });
  });

  describe("GET /api/analytics/teaching/effectiveness", () => {
    it("should return teaching effectiveness score", async () => {
      const response = await request(app)
        .get("/api/analytics/teaching/effectiveness")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("effectiveness");
      expect(typeof response.body.effectiveness).toBe("number");
      expect(response.body.effectiveness).toBeGreaterThanOrEqual(0);
      expect(response.body.effectiveness).toBeLessThanOrEqual(100);
    });

    it("should require authentication", async () => {
      await request(app)
        .get("/api/analytics/teaching/effectiveness")
        .expect(401);
    });
  });

  describe("GET /api/analytics/export", () => {
    it("should export comprehensive analytics data", async () => {
      const response = await request(app)
        .get("/api/analytics/export")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("exportDate");
      expect(response.body).toHaveProperty("user");
      expect(response.body).toHaveProperty("skills");
      expect(response.body).toHaveProperty("teaching");
      expect(response.body).toHaveProperty("badges");
      expect(response.body).toHaveProperty("streak");
      expect(response.body).toHaveProperty("activity");
      expect(response.body.activity).toHaveProperty("last30Days");
      expect(response.body.activity).toHaveProperty("last90Days");

      // Check headers for file download
      expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('skillswap-analytics');
    });

    it("should only support JSON format", async () => {
      await request(app)
        .get("/api/analytics/export?format=csv")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(400);
    });

    it("should require authentication", async () => {
      await request(app)
        .get("/api/analytics/export")
        .expect(401);
    });
  });
});