import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RecommendationService } from './recommendations';
import { storage } from '../storage';
import type { User, Skill, SkillSession, UserPreferences } from "@shared/schema";

// Mock storage
vi.mock('../storage.js', () => ({
  storage: {
    getSkillsByUser: vi.fn(),
    getUserPreferences: vi.fn(),
    getSkillSessionsByUser: vi.fn(),
    getSkill: vi.fn(),
    getUser: vi.fn(),
    createUserPreferences: vi.fn(),
    updateUserPreferences: vi.fn(),
  }
}));

describe('RecommendationService', () => {
  let recommendationService: RecommendationService;
  let mockUser: User;
  let mockSkills: Skill[];
  let mockSessions: SkillSession[];
  let mockPreferences: UserPreferences;

  beforeEach(() => {
    recommendationService = new RecommendationService();
    vi.clearAllMocks();

    // Mock data
    mockUser = {
      id: 'user1',
      username: 'testuser',
      email: 'test@example.com',
      password: 'hashedpassword',
      fullName: 'Test User',
      bio: 'Test bio',
      avatarUrl: null,
      rating: 45, // 4.5 stars * 10
      totalReviews: 10,
      creditBalance: 100,
      subscriptionStatus: 'premium',
      subscriptionExpiresAt: null,
      totalSessionsCompleted: 5,
      totalSessionsTaught: 15,
      skillPoints: 250,
      badges: ['early-adopter'],
      createdAt: new Date('2024-01-01')
    };

    mockSkills = [
      {
        id: 'skill1',
        userId: 'user1',
        title: 'JavaScript Programming',
        description: 'Learn JavaScript fundamentals',
        category: 'Programming',
        level: 'intermediate',
        type: 'teach',
        availability: 'weekends',
        createdAt: new Date('2024-01-01')
      },
      {
        id: 'skill2',
        userId: 'user2',
        title: 'Python Programming',
        description: 'Learn Python basics',
        category: 'Programming',
        level: 'beginner',
        type: 'learn',
        availability: 'evenings',
        createdAt: new Date('2024-01-02')
      }
    ];

    mockSessions = [
      {
        id: 'session1',
        teacherId: 'user2',
        studentId: 'user1',
        skillId: 'skill2',
        scheduledAt: new Date('2024-01-15'),
        duration: 60,
        status: 'completed',
        creditCost: 10,
        videoRoomId: 'room1',
        notes: 'Great session',
        createdAt: new Date('2024-01-10')
      }
    ];

    mockPreferences = {
      id: 'pref1',
      userId: 'user1',
      preferredCategories: ['Programming', 'Design'],
      availabilityHours: ['evening', 'weekend'],
      learningGoals: ['Improve coding skills'],
      teachingInterests: ['JavaScript', 'Web Development'],
      communicationStyle: 'casual',
      sessionDuration: 60,
      updatedAt: new Date('2024-01-01')
    };
  });

  describe('getSkillRecommendations', () => {
    it('should return skill recommendations based on user activity', async () => {
      // Setup mocks
      vi.mocked(storage.getSkillsByUser).mockResolvedValue([mockSkills[0]]);
      vi.mocked(storage.getUserPreferences).mockResolvedValue(mockPreferences);
      vi.mocked(storage.getSkillSessionsByUser).mockResolvedValue(mockSessions);

      const recommendations = await recommendationService.getSkillRecommendations('user1', 5);

      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
      expect(storage.getSkillsByUser).toHaveBeenCalledWith('user1');
      expect(storage.getUserPreferences).toHaveBeenCalledWith('user1');
      expect(storage.getSkillSessionsByUser).toHaveBeenCalledWith('user1');
    });

    it('should limit recommendations to specified number', async () => {
      vi.mocked(storage.getSkillsByUser).mockResolvedValue([]);
      vi.mocked(storage.getUserPreferences).mockResolvedValue(null);
      vi.mocked(storage.getSkillSessionsByUser).mockResolvedValue([]);

      const recommendations = await recommendationService.getSkillRecommendations('user1', 3);

      expect(recommendations.length).toBeLessThanOrEqual(3);
    });

    it('should handle user with no preferences', async () => {
      vi.mocked(storage.getSkillsByUser).mockResolvedValue([]);
      vi.mocked(storage.getUserPreferences).mockResolvedValue(null);
      vi.mocked(storage.getSkillSessionsByUser).mockResolvedValue([]);

      const recommendations = await recommendationService.getSkillRecommendations('user1');

      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
    });
  });

  describe('getUserRecommendations', () => {
    it('should return user recommendations for a skill', async () => {
      vi.mocked(storage.getSkill).mockResolvedValue(mockSkills[1]);
      vi.mocked(storage.getUserPreferences).mockResolvedValue(mockPreferences);
      vi.mocked(storage.getSkillSessionsByUser).mockResolvedValue(mockSessions);

      const recommendations = await recommendationService.getUserRecommendations('user1', 'skill2');

      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
      expect(storage.getSkill).toHaveBeenCalledWith('skill2');
    });

    it('should throw error for non-existent skill', async () => {
      vi.mocked(storage.getSkill).mockResolvedValue(undefined);

      await expect(
        recommendationService.getUserRecommendations('user1', 'nonexistent')
      ).rejects.toThrow('Skill not found');
    });

    it('should apply rating filter', async () => {
      vi.mocked(storage.getSkill).mockResolvedValue(mockSkills[1]);
      vi.mocked(storage.getUserPreferences).mockResolvedValue(mockPreferences);
      vi.mocked(storage.getSkillSessionsByUser).mockResolvedValue([]);

      const filters = { minRating: 4.0 };
      const recommendations = await recommendationService.getUserRecommendations(
        'user1', 
        'skill2', 
        filters
      );

      expect(recommendations).toBeDefined();
    });
  });

  describe('recordInteraction', () => {
    it('should record user interaction with recommendations', async () => {
      // First create some recommendations
      vi.mocked(storage.getSkillsByUser).mockResolvedValue([]);
      vi.mocked(storage.getUserPreferences).mockResolvedValue(null);
      vi.mocked(storage.getSkillSessionsByUser).mockResolvedValue([]);

      await recommendationService.getSkillRecommendations('user1');

      // Then record interaction
      await expect(
        recommendationService.recordInteraction('user1', 'skill', 'skill1', 'click')
      ).resolves.not.toThrow();
    });
  });

  describe('getRecommendationHistory', () => {
    it('should return recommendation history for user', async () => {
      const history = await recommendationService.getRecommendationHistory('user1');

      expect(history).toBeDefined();
      expect(Array.isArray(history)).toBe(true);
    });

    it('should filter by recommendation type', async () => {
      const history = await recommendationService.getRecommendationHistory('user1', 'skill');

      expect(history).toBeDefined();
      expect(Array.isArray(history)).toBe(true);
    });

    it('should limit results', async () => {
      const history = await recommendationService.getRecommendationHistory('user1', undefined, 10);

      expect(history.length).toBeLessThanOrEqual(10);
    });
  });

  describe('updateUserPreferences', () => {
    it('should update existing user preferences', async () => {
      vi.mocked(storage.getUserPreferences).mockResolvedValue(mockPreferences);
      vi.mocked(storage.updateUserPreferences).mockResolvedValue(mockPreferences);

      const updates = { preferredCategories: ['Programming'] };
      const result = await recommendationService.updateUserPreferences('user1', updates);

      expect(result).toBeDefined();
      expect(storage.updateUserPreferences).toHaveBeenCalledWith('user1', expect.objectContaining(updates));
    });

    it('should create new preferences if none exist', async () => {
      vi.mocked(storage.getUserPreferences).mockResolvedValue(null);
      vi.mocked(storage.createUserPreferences).mockResolvedValue(mockPreferences);

      const preferences = { preferredCategories: ['Programming'] };
      const result = await recommendationService.updateUserPreferences('user1', preferences);

      expect(result).toBeDefined();
      expect(storage.createUserPreferences).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user1', ...preferences })
      );
    });
  });

  describe('getRecommendationAnalytics', () => {
    it('should return analytics for user recommendations', async () => {
      vi.mocked(storage.getSkillsByUser).mockResolvedValue(mockSkills);

      const analytics = await recommendationService.getRecommendationAnalytics('user1');

      expect(analytics).toBeDefined();
      expect(analytics).toHaveProperty('totalRecommendations');
      expect(analytics).toHaveProperty('clickedRecommendations');
      expect(analytics).toHaveProperty('clickThroughRate');
      expect(analytics).toHaveProperty('topCategories');
      expect(Array.isArray(analytics.topCategories)).toBe(true);
    });

    it('should calculate click through rate correctly', async () => {
      vi.mocked(storage.getSkillsByUser).mockResolvedValue([]);

      const analytics = await recommendationService.getRecommendationAnalytics('user1');

      expect(analytics.clickThroughRate).toBe(0);
    });
  });
});