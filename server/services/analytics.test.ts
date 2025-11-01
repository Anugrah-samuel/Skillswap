import { describe, it, expect, beforeEach } from "vitest";
import { analyticsService } from "./analytics";
import { storage } from "../storage";
import { creditsService } from "./credits";
import { sessionService } from "./sessions";

describe("AnalyticsService", () => {
  let testUserId: string;
  let testSkillId: string;
  let testCourseId: string;

  beforeEach(async () => {
    // Create test user
    const user = await storage.createUser({
      username: "testuser",
      email: "test@example.com",
      password: "hashedpassword",
      fullName: "Test User",
      creditBalance: 100,
      skillPoints: 50,
      badges: ["first_session"]
    });
    testUserId = user.id;

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

    // Create test course
    const course = await storage.createCourse({
      creatorId: testUserId,
      skillId: testSkillId,
      title: "JavaScript Basics",
      description: "Learn JavaScript fundamentals",
      priceCredits: 50,
      status: "published"
    });
    testCourseId = course.id;
  });

  describe("getUserAnalytics", () => {
    it("should return comprehensive user analytics", async () => {
      // Add some test data
      await creditsService.addCredits(testUserId, 25, "earned", "Test earning");
      await creditsService.deductCredits(testUserId, 10, "spent", "Test spending");

      const analytics = await analyticsService.getUserAnalytics(testUserId);

      expect(analytics.userId).toBe(testUserId);
      expect(analytics.creditBalance).toBe(115); // 100 + 25 - 10
      expect(analytics.totalCreditsEarned).toBe(25);
      expect(analytics.totalCreditsSpent).toBe(10);
      expect(analytics.skillPoints).toBe(50);
      expect(analytics.badges).toContain("first_session");
      expect(analytics.coursesCreated).toBe(1);
      expect(analytics.coursesCompleted).toBe(0);
    });

    it("should handle user with no activity", async () => {
      const newUser = await storage.createUser({
        username: "newuser",
        email: "new@example.com",
        password: "hashedpassword",
        fullName: "New User"
      });

      const analytics = await analyticsService.getUserAnalytics(newUser.id);

      expect(analytics.totalCreditsEarned).toBe(0);
      expect(analytics.totalCreditsSpent).toBe(0);
      expect(analytics.coursesCreated).toBe(0);
      expect(analytics.coursesCompleted).toBe(0);
      expect(analytics.currentStreak).toBe(0);
    });
  });

  describe("getSkillAnalytics", () => {
    it("should return skill-specific analytics", async () => {
      const analytics = await analyticsService.getSkillAnalytics(testUserId, testSkillId);

      expect(analytics).toHaveLength(1);
      expect(analytics[0].skillId).toBe(testSkillId);
      expect(analytics[0].skillTitle).toBe("JavaScript");
      expect(analytics[0].sessionsAsTeacher).toBe(0);
      expect(analytics[0].sessionsAsStudent).toBe(0);
      expect(analytics[0].proficiencyLevel).toBeGreaterThanOrEqual(0);
    });

    it("should return all skills when no specific skill requested", async () => {
      // Create another skill
      await storage.createSkill({
        userId: testUserId,
        title: "Python",
        description: "Another programming language",
        category: "Programming",
        level: "beginner",
        type: "learn"
      });

      const analytics = await analyticsService.getSkillAnalytics(testUserId);

      expect(analytics).toHaveLength(2);
      expect(analytics.map(a => a.skillTitle)).toContain("JavaScript");
      expect(analytics.map(a => a.skillTitle)).toContain("Python");
    });
  });

  describe("calculateSkillProficiency", () => {
    it("should calculate proficiency based on sessions and ratings", async () => {
      const proficiency = await analyticsService.calculateSkillProficiency(testUserId, testSkillId);

      expect(proficiency).toBeGreaterThanOrEqual(0);
      expect(proficiency).toBeLessThanOrEqual(100);
    });

    it("should increase proficiency with teaching sessions", async () => {
      // Create a student user
      const student = await storage.createUser({
        username: "student",
        email: "student@example.com",
        password: "hashedpassword",
        fullName: "Student User",
        creditBalance: 50
      });

      // Create a match
      const match = await storage.createMatch({
        userId: testUserId,
        matchedUserId: student.id,
        userSkillId: testSkillId,
        matchedSkillId: testSkillId
      });

      // Update match status to accepted
      await storage.updateMatch(match.id, "accepted");

      // Create and complete a session (15+ minutes duration)
      const session = await sessionService.scheduleSession(match.id, {
        teacherId: testUserId,
        studentId: student.id,
        skillId: testSkillId,
        scheduledStart: new Date(Date.now() + 60000),
        scheduledEnd: new Date(Date.now() + 60000 + 16 * 60 * 1000), // 16 minutes later
        creditsAmount: 10
      });

      // Complete the session
      await storage.updateSkillSession(session.id, {
        status: "completed",
        actualStart: new Date(Date.now() - 60000),
        actualEnd: new Date()
      });

      const proficiencyAfter = await analyticsService.calculateSkillProficiency(testUserId, testSkillId);

      expect(proficiencyAfter).toBeGreaterThan(0);
    });
  });

  describe("updateLearningStreak", () => {
    it("should calculate learning streak correctly", async () => {
      const streak = await analyticsService.updateLearningStreak(testUserId);

      expect(streak.userId).toBe(testUserId);
      expect(streak.currentStreak).toBeGreaterThanOrEqual(0);
      expect(streak.longestStreak).toBeGreaterThanOrEqual(0);
    });
  });

  describe("checkAndAwardBadges", () => {
    it("should award badges based on achievements", async () => {
      // User already has first_session badge, so no new badges should be awarded initially
      const newBadges = await analyticsService.checkAndAwardBadges(testUserId);

      expect(Array.isArray(newBadges)).toBe(true);
    });

    it("should award course creator badge when user creates a course", async () => {
      // Create a new user without any badges
      const newUser = await storage.createUser({
        username: "creator",
        email: "creator@example.com",
        password: "hashedpassword",
        fullName: "Creator User"
      });

      // Create a skill for the new user
      const skill = await storage.createSkill({
        userId: newUser.id,
        title: "React",
        description: "Frontend framework",
        category: "Programming",
        level: "intermediate",
        type: "teach"
      });

      // Create a course
      await storage.createCourse({
        creatorId: newUser.id,
        skillId: skill.id,
        title: "React Basics",
        description: "Learn React fundamentals",
        priceCredits: 30
      });

      const newBadges = await analyticsService.checkAndAwardBadges(newUser.id);

      expect(newBadges).toContain("course_creator");
    });
  });

  describe("getTeachingAnalytics", () => {
    it("should return teaching analytics", async () => {
      const analytics = await analyticsService.getTeachingAnalytics(testUserId);

      expect(analytics.userId).toBe(testUserId);
      expect(analytics.totalStudents).toBe(0);
      expect(analytics.totalTeachingHours).toBe(0);
      expect(analytics.coursesCreated).toBe(1);
      expect(analytics.topSkills).toEqual([]);
    });
  });

  describe("calculateTeachingEffectiveness", () => {
    it("should return 0 for users with no students", async () => {
      const effectiveness = await analyticsService.calculateTeachingEffectiveness(testUserId);

      expect(effectiveness).toBe(0);
    });
  });

  describe("getAvailableBadges", () => {
    it("should return all available badges", async () => {
      const badges = await analyticsService.getAvailableBadges();

      expect(badges.length).toBeGreaterThan(0);
      expect(badges[0]).toHaveProperty("id");
      expect(badges[0]).toHaveProperty("name");
      expect(badges[0]).toHaveProperty("description");
      expect(badges[0]).toHaveProperty("criteria");
      expect(badges[0]).toHaveProperty("rarity");
    });
  });

  describe("getUserBadges", () => {
    it("should return badges earned by user", async () => {
      const badges = await analyticsService.getUserBadges(testUserId);

      expect(badges.length).toBeGreaterThan(0);
      expect(badges[0].id).toBe("first_session");
    });
  });

  describe("getActivitySummary", () => {
    it("should return activity summary for specified period", async () => {
      const summary = await analyticsService.getActivitySummary(testUserId, 7);

      expect(summary.period).toBe("7 days");
      expect(summary.sessionsCompleted).toBe(0);
      expect(summary.creditsEarned).toBe(0);
      expect(summary.creditsSpent).toBe(0);
      expect(summary.coursesEnrolled).toBe(0);
      expect(summary.activeDays).toBe(0);
    });
  });
});