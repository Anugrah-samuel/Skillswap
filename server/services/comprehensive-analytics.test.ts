import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnalyticsService } from './analytics';
import { storage } from '../storage';
import { resetAllMocks, createMockUser, createMockSkill, createMockSession } from '../test-setup';

// Mock storage
vi.mock('../storage', () => ({
  storage: {
    getUser: vi.fn(),
    getSkillsByUser: vi.fn(),
    getSessionsByUser: vi.fn(),
    getCreditTransactionsByUser: vi.fn(),
    getCoursesByCreator: vi.fn(),
    getCourseEnrollmentsByUser: vi.fn(),
    updateUser: vi.fn(),
    createUserBadge: vi.fn(),
    getUserBadges: vi.fn(),
  },
}));

describe('AnalyticsService - Comprehensive Tests', () => {
  let analyticsService: AnalyticsService;
  let mockUser: any;
  let mockSkill: any;

  beforeEach(() => {
    resetAllMocks();
    analyticsService = new AnalyticsService();
    
    mockUser = createMockUser({
      totalSessionsCompleted: 10,
      totalSessionsTaught: 5,
      skillPoints: 150,
      creditBalance: 200,
    });
    
    mockSkill = createMockSkill();
    
    vi.mocked(storage.getUser).mockResolvedValue(mockUser);
  });

  describe('getUserDashboard', () => {
    it('should return comprehensive dashboard data', async () => {
      const mockSessions = [
        createMockSession({ status: 'completed', creditsAmount: 20 }),
        createMockSession({ status: 'completed', creditsAmount: 15 }),
      ];
      
      const mockTransactions = [
        { amount: 20, type: 'earned', createdAt: new Date() },
        { amount: 15, type: 'earned', createdAt: new Date() },
        { amount: -10, type: 'spent', createdAt: new Date() },
      ];

      vi.mocked(storage.getSessionsByUser).mockResolvedValue(mockSessions);
      vi.mocked(storage.getCreditTransactionsByUser).mockResolvedValue(mockTransactions);
      vi.mocked(storage.getSkillsByUser).mockResolvedValue([mockSkill]);

      const dashboard = await analyticsService.getUserDashboard(mockUser.id);

      expect(dashboard).toEqual({
        userId: mockUser.id,
        totalSessions: 10,
        totalSessionsTaught: 5,
        skillPoints: 150,
        creditBalance: 200,
        creditsEarned: 35,
        creditsSpent: 10,
        skillsCount: 1,
        averageRating: 0,
        learningStreak: 0,
        teachingEffectiveness: 0,
        badges: [],
      });
    });

    it('should handle user not found', async () => {
      vi.mocked(storage.getUser).mockResolvedValue(null);

      await expect(analyticsService.getUserDashboard('nonexistent'))
        .rejects.toThrow('User not found');
    });

    it('should calculate learning streak correctly', async () => {
      const today = new Date();
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000);

      const mockSessions = [
        createMockSession({ 
          status: 'completed', 
          actualEnd: today,
          studentId: mockUser.id 
        }),
        createMockSession({ 
          status: 'completed', 
          actualEnd: yesterday,
          studentId: mockUser.id 
        }),
        createMockSession({ 
          status: 'completed', 
          actualEnd: twoDaysAgo,
          studentId: mockUser.id 
        }),
      ];

      vi.mocked(storage.getSessionsByUser).mockResolvedValue(mockSessions);
      vi.mocked(storage.getCreditTransactionsByUser).mockResolvedValue([]);
      vi.mocked(storage.getSkillsByUser).mockResolvedValue([]);

      const dashboard = await analyticsService.getUserDashboard(mockUser.id);
      expect(dashboard.learningStreak).toBe(3);
    });
  });

  describe('getSkillProgress', () => {
    it('should return skill progress data', async () => {
      const mockSessions = [
        createMockSession({ 
          skillId: mockSkill.id,
          status: 'completed',
          studentId: mockUser.id,
          actualEnd: new Date(),
        }),
        createMockSession({ 
          skillId: mockSkill.id,
          status: 'completed',
          studentId: mockUser.id,
          actualEnd: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        }),
      ];

      vi.mocked(storage.getSessionsByUser).mockResolvedValue(mockSessions);
      vi.mocked(storage.getSkillsByUser).mockResolvedValue([mockSkill]);

      const progress = await analyticsService.getSkillProgress(mockUser.id);

      expect(progress).toHaveLength(1);
      expect(progress[0]).toEqual({
        skillId: mockSkill.id,
        skillTitle: mockSkill.title,
        category: mockSkill.category,
        level: mockSkill.level,
        sessionsCompleted: 2,
        totalHours: 0,
        proficiencyScore: 40, // 2 sessions * 20 points each
        lastActivity: expect.any(Date),
        progressTrend: 'improving',
      });
    });

    it('should handle no sessions for skills', async () => {
      vi.mocked(storage.getSessionsByUser).mockResolvedValue([]);
      vi.mocked(storage.getSkillsByUser).mockResolvedValue([mockSkill]);

      const progress = await analyticsService.getSkillProgress(mockUser.id);

      expect(progress).toHaveLength(1);
      expect(progress[0].sessionsCompleted).toBe(0);
      expect(progress[0].proficiencyScore).toBe(0);
    });
  });

  describe('getTeachingMetrics', () => {
    it('should return teaching effectiveness metrics', async () => {
      const mockSessions = [
        createMockSession({ 
          teacherId: mockUser.id,
          status: 'completed',
          creditsAmount: 20,
        }),
        createMockSession({ 
          teacherId: mockUser.id,
          status: 'completed',
          creditsAmount: 25,
        }),
      ];

      vi.mocked(storage.getSessionsByUser).mockResolvedValue(mockSessions);
      vi.mocked(storage.getSkillsByUser).mockResolvedValue([mockSkill]);

      const metrics = await analyticsService.getTeachingMetrics(mockUser.id);

      expect(metrics).toEqual({
        totalSessionsTaught: 2,
        totalStudents: 2,
        averageRating: 0,
        totalEarnings: 45,
        skillsTaught: 1,
        studentSatisfaction: 0,
        repeatStudents: 0,
        cancellationRate: 0,
        averageSessionDuration: 0,
      });
    });

    it('should calculate repeat students correctly', async () => {
      const studentId = 'student-123';
      const mockSessions = [
        createMockSession({ 
          teacherId: mockUser.id,
          studentId: studentId,
          status: 'completed',
        }),
        createMockSession({ 
          teacherId: mockUser.id,
          studentId: studentId,
          status: 'completed',
        }),
        createMockSession({ 
          teacherId: mockUser.id,
          studentId: 'different-student',
          status: 'completed',
        }),
      ];

      vi.mocked(storage.getSessionsByUser).mockResolvedValue(mockSessions);
      vi.mocked(storage.getSkillsByUser).mockResolvedValue([mockSkill]);

      const metrics = await analyticsService.getTeachingMetrics(mockUser.id);
      expect(metrics.repeatStudents).toBe(1);
    });
  });

  describe('updateSkillProficiency', () => {
    it('should update skill proficiency based on session completion', async () => {
      const sessionData = {
        userId: mockUser.id,
        skillId: mockSkill.id,
        sessionDuration: 60,
        performanceScore: 85,
      };

      await analyticsService.updateSkillProficiency(sessionData);

      expect(storage.updateUser).toHaveBeenCalledWith(mockUser.id, {
        skillPoints: mockUser.skillPoints + 17, // 60 * 0.2 + 85 * 0.1
      });
    });

    it('should handle minimum proficiency gains', async () => {
      const sessionData = {
        userId: mockUser.id,
        skillId: mockSkill.id,
        sessionDuration: 10,
        performanceScore: 50,
      };

      await analyticsService.updateSkillProficiency(sessionData);

      expect(storage.updateUser).toHaveBeenCalledWith(mockUser.id, {
        skillPoints: mockUser.skillPoints + 7, // 10 * 0.2 + 50 * 0.1
      });
    });
  });

  describe('calculateLearningStreak', () => {
    it('should calculate consecutive learning days', async () => {
      const today = new Date();
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000);
      const fourDaysAgo = new Date(today.getTime() - 4 * 24 * 60 * 60 * 1000);

      const mockSessions = [
        createMockSession({ 
          studentId: mockUser.id,
          status: 'completed',
          actualEnd: today,
        }),
        createMockSession({ 
          studentId: mockUser.id,
          status: 'completed',
          actualEnd: yesterday,
        }),
        createMockSession({ 
          studentId: mockUser.id,
          status: 'completed',
          actualEnd: twoDaysAgo,
        }),
        // Gap here - no session 3 days ago
        createMockSession({ 
          studentId: mockUser.id,
          status: 'completed',
          actualEnd: fourDaysAgo,
        }),
      ];

      vi.mocked(storage.getSessionsByUser).mockResolvedValue(mockSessions);

      const streak = await analyticsService.calculateLearningStreak(mockUser.id);
      expect(streak).toBe(3); // Should stop at the gap
    });

    it('should return 0 for no recent sessions', async () => {
      const oldSession = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      const mockSessions = [
        createMockSession({ 
          studentId: mockUser.id,
          status: 'completed',
          actualEnd: oldSession,
        }),
      ];

      vi.mocked(storage.getSessionsByUser).mockResolvedValue(mockSessions);

      const streak = await analyticsService.calculateLearningStreak(mockUser.id);
      expect(streak).toBe(0);
    });
  });

  describe('awardBadge', () => {
    it('should award badge for milestone achievement', async () => {
      const badgeData = {
        userId: mockUser.id,
        badgeType: 'first_session',
        title: 'First Session Complete',
        description: 'Completed your first learning session',
      };

      vi.mocked(storage.createUserBadge).mockResolvedValue({
        id: 'badge-123',
        ...badgeData,
        awardedAt: new Date(),
      });

      const badge = await analyticsService.awardBadge(badgeData);

      expect(badge).toBeDefined();
      expect(badge.badgeType).toBe('first_session');
      expect(storage.createUserBadge).toHaveBeenCalledWith(badgeData);
    });

    it('should check for milestone badges after session completion', async () => {
      const updatedUser = { ...mockUser, totalSessionsCompleted: 10 };
      vi.mocked(storage.getUser).mockResolvedValue(updatedUser);
      vi.mocked(storage.getUserBadges).mockResolvedValue([]);

      await analyticsService.checkAndAwardMilestoneBadges(mockUser.id);

      // Should award 10 sessions badge
      expect(storage.createUserBadge).toHaveBeenCalledWith({
        userId: mockUser.id,
        badgeType: 'sessions_10',
        title: '10 Sessions Complete',
        description: 'Completed 10 learning sessions',
      });
    });

    it('should not award duplicate badges', async () => {
      const updatedUser = { ...mockUser, totalSessionsCompleted: 10 };
      vi.mocked(storage.getUser).mockResolvedValue(updatedUser);
      vi.mocked(storage.getUserBadges).mockResolvedValue([
        { badgeType: 'sessions_10', userId: mockUser.id }
      ]);

      await analyticsService.checkAndAwardMilestoneBadges(mockUser.id);

      // Should not award badge again
      expect(storage.createUserBadge).not.toHaveBeenCalled();
    });
  });

  describe('generateReport', () => {
    it('should generate comprehensive analytics report', async () => {
      const mockSessions = [
        createMockSession({ status: 'completed', creditsAmount: 20 }),
      ];
      const mockTransactions = [
        { amount: 20, type: 'earned', createdAt: new Date() },
      ];

      vi.mocked(storage.getSessionsByUser).mockResolvedValue(mockSessions);
      vi.mocked(storage.getCreditTransactionsByUser).mockResolvedValue(mockTransactions);
      vi.mocked(storage.getSkillsByUser).mockResolvedValue([mockSkill]);
      vi.mocked(storage.getUserBadges).mockResolvedValue([]);

      const report = await analyticsService.generateReport(mockUser.id, {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date(),
        includeSkillProgress: true,
        includeTeachingMetrics: true,
      });

      expect(report).toHaveProperty('dashboard');
      expect(report).toHaveProperty('skillProgress');
      expect(report).toHaveProperty('teachingMetrics');
      expect(report).toHaveProperty('generatedAt');
      expect(report.dashboard.userId).toBe(mockUser.id);
    });

    it('should filter data by date range', async () => {
      const oldDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      const recentDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      
      const mockSessions = [
        createMockSession({ 
          status: 'completed', 
          actualEnd: oldDate,
          creditsAmount: 20 
        }),
        createMockSession({ 
          status: 'completed', 
          actualEnd: recentDate,
          creditsAmount: 15 
        }),
      ];

      vi.mocked(storage.getSessionsByUser).mockResolvedValue(mockSessions);
      vi.mocked(storage.getCreditTransactionsByUser).mockResolvedValue([]);
      vi.mocked(storage.getSkillsByUser).mockResolvedValue([]);

      const report = await analyticsService.generateReport(mockUser.id, {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date(),
      });

      // Should only include the recent session
      expect(report.dashboard.totalSessions).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle storage errors gracefully', async () => {
      vi.mocked(storage.getUser).mockRejectedValue(new Error('Database error'));

      await expect(analyticsService.getUserDashboard(mockUser.id))
        .rejects.toThrow('Database error');
    });

    it('should handle invalid date ranges', async () => {
      await expect(analyticsService.generateReport(mockUser.id, {
        startDate: new Date(),
        endDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // End before start
      })).rejects.toThrow('Invalid date range');
    });

    it('should handle missing user data', async () => {
      vi.mocked(storage.getUser).mockResolvedValue(null);

      await expect(analyticsService.getSkillProgress('nonexistent'))
        .rejects.toThrow('User not found');
    });
  });
});