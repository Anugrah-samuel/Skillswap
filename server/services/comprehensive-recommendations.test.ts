import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RecommendationService } from './recommendations';
import { storage } from '../storage';
import { resetAllMocks, createMockUser, createMockSkill } from '../test-setup';

// Mock storage
vi.mock('../storage', () => ({
  storage: {
    getUser: vi.fn(),
    getSkillsByUser: vi.fn(),
    getSessionsByUser: vi.fn(),
    searchSkills: vi.fn(),
    searchUsers: vi.fn(),
    createRecommendationHistory: vi.fn(),
    getRecommendationHistory: vi.fn(),
    updateUserPreferences: vi.fn(),
    getUserPreferences: vi.fn(),
    getCoursesByCreator: vi.fn(),
    getCourseEnrollmentsByUser: vi.fn(),
  },
}));

describe('RecommendationService - Comprehensive Tests', () => {
  let recommendationService: RecommendationService;
  let mockUser: any;
  let mockSkills: any[];

  beforeEach(() => {
    resetAllMocks();
    recommendationService = new RecommendationService();
    
    mockUser = createMockUser({
      skillPoints: 100,
      totalSessionsCompleted: 5,
    });
    
    mockSkills = [
      createMockSkill({ 
        title: 'JavaScript Programming',
        category: 'Programming',
        level: 'intermediate',
      }),
      createMockSkill({ 
        title: 'React Development',
        category: 'Programming',
        level: 'advanced',
      }),
      createMockSkill({ 
        title: 'UI/UX Design',
        category: 'Design',
        level: 'beginner',
      }),
    ];
    
    vi.mocked(storage.getUser).mockResolvedValue(mockUser);
  });

  describe('getSkillRecommendations', () => {
    it('should return personalized skill recommendations', async () => {
      const mockUserSkills = [mockSkills[0]]; // User knows JavaScript
      const mockSessions = [
        {
          skillId: mockSkills[0].id,
          status: 'completed',
          studentId: mockUser.id,
        },
      ];

      vi.mocked(storage.getSkillsByUser).mockResolvedValue(mockUserSkills);
      vi.mocked(storage.getSessionsByUser).mockResolvedValue(mockSessions);
      vi.mocked(storage.searchSkills).mockResolvedValue(mockSkills);

      const recommendations = await recommendationService.getSkillRecommendations(mockUser.id);

      expect(recommendations).toHaveLength(2); // Should exclude JavaScript (already known)
      expect(recommendations[0]).toHaveProperty('skill');
      expect(recommendations[0]).toHaveProperty('score');
      expect(recommendations[0]).toHaveProperty('reason');
      
      // React should be recommended higher due to same category
      const reactRec = recommendations.find(r => r.skill.title === 'React Development');
      expect(reactRec).toBeDefined();
      expect(reactRec!.score).toBeGreaterThan(0.5);
    });

    it('should limit recommendations to specified count', async () => {
      vi.mocked(storage.getSkillsByUser).mockResolvedValue([]);
      vi.mocked(storage.getSessionsByUser).mockResolvedValue([]);
      vi.mocked(storage.searchSkills).mockResolvedValue(mockSkills);

      const recommendations = await recommendationService.getSkillRecommendations(mockUser.id, 2);

      expect(recommendations).toHaveLength(2);
    });

    it('should consider user preferences in recommendations', async () => {
      const mockPreferences = {
        preferredCategories: ['Design'],
        learningGoals: ['creativity', 'visual design'],
      };

      vi.mocked(storage.getUserPreferences).mockResolvedValue(mockPreferences);
      vi.mocked(storage.getSkillsByUser).mockResolvedValue([]);
      vi.mocked(storage.getSessionsByUser).mockResolvedValue([]);
      vi.mocked(storage.searchSkills).mockResolvedValue(mockSkills);

      const recommendations = await recommendationService.getSkillRecommendations(mockUser.id);

      // Design skills should be ranked higher
      const designRec = recommendations.find(r => r.skill.category === 'Design');
      expect(designRec).toBeDefined();
      expect(designRec!.score).toBeGreaterThan(0.6);
    });

    it('should handle user with no existing skills', async () => {
      vi.mocked(storage.getSkillsByUser).mockResolvedValue([]);
      vi.mocked(storage.getSessionsByUser).mockResolvedValue([]);
      vi.mocked(storage.searchSkills).mockResolvedValue(mockSkills);

      const recommendations = await recommendationService.getSkillRecommendations(mockUser.id);

      expect(recommendations).toHaveLength(3);
      // Should recommend beginner-friendly skills first
      expect(recommendations[0].skill.level).toBe('beginner');
    });
  });

  describe('getUserRecommendations', () => {
    it('should recommend compatible users for skill exchange', async () => {
      const skillId = mockSkills[0].id;
      const mockTeachers = [
        createMockUser({ 
          id: 'teacher1',
          username: 'teacher1',
          rating: 4.5,
          totalSessionsTaught: 20,
        }),
        createMockUser({ 
          id: 'teacher2',
          username: 'teacher2',
          rating: 4.0,
          totalSessionsTaught: 10,
        }),
      ];

      vi.mocked(storage.searchUsers).mockResolvedValue(mockTeachers);
      vi.mocked(storage.getSkillsByUser).mockImplementation((userId) => {
        if (userId === 'teacher1' || userId === 'teacher2') {
          return Promise.resolve([{ ...mockSkills[0], type: 'teach' }]);
        }
        return Promise.resolve([]);
      });

      const recommendations = await recommendationService.getUserRecommendations(
        mockUser.id, 
        skillId
      );

      expect(recommendations).toHaveLength(2);
      expect(recommendations[0]).toHaveProperty('user');
      expect(recommendations[0]).toHaveProperty('compatibilityScore');
      expect(recommendations[0]).toHaveProperty('reasons');
      
      // Higher rated teacher should be first
      expect(recommendations[0].user.rating).toBe(4.5);
    });

    it('should filter by availability and preferences', async () => {
      const skillId = mockSkills[0].id;
      const filters = {
        availability: ['morning', 'afternoon'],
        maxPrice: 50,
        minRating: 4.0,
      };

      const mockTeachers = [
        createMockUser({ 
          id: 'teacher1',
          rating: 4.5,
          totalSessionsTaught: 20,
        }),
        createMockUser({ 
          id: 'teacher2',
          rating: 3.5, // Below min rating
          totalSessionsTaught: 5,
        }),
      ];

      vi.mocked(storage.searchUsers).mockResolvedValue(mockTeachers);
      vi.mocked(storage.getSkillsByUser).mockResolvedValue([
        { ...mockSkills[0], type: 'teach' }
      ]);

      const recommendations = await recommendationService.getUserRecommendations(
        mockUser.id, 
        skillId, 
        filters
      );

      // Should only include teacher1 (meets rating requirement)
      expect(recommendations).toHaveLength(1);
      expect(recommendations[0].user.rating).toBe(4.5);
    });

    it('should handle skill not found', async () => {
      vi.mocked(storage.searchUsers).mockResolvedValue([]);

      await expect(recommendationService.getUserRecommendations(
        mockUser.id, 
        'nonexistent-skill'
      )).rejects.toThrow('Skill not found');
    });
  });

  describe('recordInteraction', () => {
    it('should record user interaction with recommendations', async () => {
      const interactionData = {
        userId: mockUser.id,
        recommendationType: 'skill' as const,
        recommendedId: mockSkills[0].id,
        interactionType: 'click' as const,
      };

      vi.mocked(storage.createRecommendationHistory).mockResolvedValue({
        id: 'history-123',
        ...interactionData,
        score: 0.8,
        clicked: true,
        createdAt: new Date(),
      });

      await recommendationService.recordInteraction(
        mockUser.id,
        'skill',
        mockSkills[0].id,
        'click'
      );

      expect(storage.createRecommendationHistory).toHaveBeenCalledWith({
        userId: mockUser.id,
        recommendationType: 'skill',
        recommendedId: mockSkills[0].id,
        score: expect.any(Number),
        clicked: true,
      });
    });

    it('should handle different interaction types', async () => {
      vi.mocked(storage.createRecommendationHistory).mockResolvedValue({
        id: 'history-123',
        userId: mockUser.id,
        recommendationType: 'user',
        recommendedId: 'user-123',
        score: 0.6,
        clicked: false,
        createdAt: new Date(),
      });

      await recommendationService.recordInteraction(
        mockUser.id,
        'user',
        'user-123',
        'view'
      );

      expect(storage.createRecommendationHistory).toHaveBeenCalledWith({
        userId: mockUser.id,
        recommendationType: 'user',
        recommendedId: 'user-123',
        score: expect.any(Number),
        clicked: false,
      });
    });
  });

  describe('updateUserPreferences', () => {
    it('should update user learning preferences', async () => {
      const preferences = {
        preferredCategories: ['Programming', 'Design'],
        learningGoals: ['career advancement', 'personal interest'],
        availabilityHours: ['morning', 'evening'],
        maxSessionDuration: 90,
      };

      vi.mocked(storage.updateUserPreferences).mockResolvedValue({
        id: 'pref-123',
        userId: mockUser.id,
        ...preferences,
        updatedAt: new Date(),
      });

      const result = await recommendationService.updateUserPreferences(
        mockUser.id, 
        preferences
      );

      expect(result).toBeDefined();
      expect(storage.updateUserPreferences).toHaveBeenCalledWith(
        mockUser.id, 
        preferences
      );
    });

    it('should validate preference data', async () => {
      const invalidPreferences = {
        preferredCategories: ['InvalidCategory'],
        maxSessionDuration: -30, // Invalid duration
      };

      await expect(recommendationService.updateUserPreferences(
        mockUser.id, 
        invalidPreferences
      )).rejects.toThrow('Invalid preferences');
    });
  });

  describe('getRecommendationHistory', () => {
    it('should return user recommendation history', async () => {
      const mockHistory = [
        {
          id: 'history-1',
          userId: mockUser.id,
          recommendationType: 'skill',
          recommendedId: mockSkills[0].id,
          score: 0.8,
          clicked: true,
          createdAt: new Date(),
        },
        {
          id: 'history-2',
          userId: mockUser.id,
          recommendationType: 'user',
          recommendedId: 'user-123',
          score: 0.7,
          clicked: false,
          createdAt: new Date(),
        },
      ];

      vi.mocked(storage.getRecommendationHistory).mockResolvedValue(mockHistory);

      const history = await recommendationService.getRecommendationHistory(mockUser.id);

      expect(history).toEqual(mockHistory);
      expect(storage.getRecommendationHistory).toHaveBeenCalledWith(
        mockUser.id, 
        undefined, 
        20
      );
    });

    it('should filter by recommendation type', async () => {
      const mockHistory = [
        {
          id: 'history-1',
          userId: mockUser.id,
          recommendationType: 'skill',
          recommendedId: mockSkills[0].id,
          score: 0.8,
          clicked: true,
          createdAt: new Date(),
        },
      ];

      vi.mocked(storage.getRecommendationHistory).mockResolvedValue(mockHistory);

      await recommendationService.getRecommendationHistory(
        mockUser.id, 
        'skill', 
        10
      );

      expect(storage.getRecommendationHistory).toHaveBeenCalledWith(
        mockUser.id, 
        'skill', 
        10
      );
    });
  });

  describe('getRecommendationAnalytics', () => {
    it('should return recommendation performance analytics', async () => {
      const mockHistory = [
        {
          recommendationType: 'skill',
          clicked: true,
          createdAt: new Date(),
        },
        {
          recommendationType: 'skill',
          clicked: false,
          createdAt: new Date(),
        },
        {
          recommendationType: 'user',
          clicked: true,
          createdAt: new Date(),
        },
      ];

      vi.mocked(storage.getRecommendationHistory).mockResolvedValue(mockHistory);

      const analytics = await recommendationService.getRecommendationAnalytics(mockUser.id);

      expect(analytics).toEqual({
        totalRecommendations: 3,
        clickedRecommendations: 2,
        clickThroughRate: 66.67,
        topCategories: ['skill', 'user'],
      });
    });

    it('should handle no recommendation history', async () => {
      vi.mocked(storage.getRecommendationHistory).mockResolvedValue([]);

      const analytics = await recommendationService.getRecommendationAnalytics(mockUser.id);

      expect(analytics).toEqual({
        totalRecommendations: 0,
        clickedRecommendations: 0,
        clickThroughRate: 0,
        topCategories: [],
      });
    });
  });

  describe('Collaborative Filtering', () => {
    it('should recommend skills based on similar users', async () => {
      const mockSimilarUsers = [
        createMockUser({ id: 'similar1' }),
        createMockUser({ id: 'similar2' }),
      ];

      // Mock user has JavaScript skill
      vi.mocked(storage.getSkillsByUser).mockImplementation((userId) => {
        if (userId === mockUser.id) {
          return Promise.resolve([mockSkills[0]]); // JavaScript
        }
        if (userId === 'similar1' || userId === 'similar2') {
          return Promise.resolve([mockSkills[0], mockSkills[1]]); // JavaScript + React
        }
        return Promise.resolve([]);
      });

      vi.mocked(storage.getSessionsByUser).mockResolvedValue([]);
      vi.mocked(storage.searchUsers).mockResolvedValue(mockSimilarUsers);
      vi.mocked(storage.searchSkills).mockResolvedValue(mockSkills);

      const recommendations = await recommendationService.getSkillRecommendations(mockUser.id);

      // React should be highly recommended due to similar users
      const reactRec = recommendations.find(r => r.skill.title === 'React Development');
      expect(reactRec).toBeDefined();
      expect(reactRec!.reason).toContain('similar users');
    });
  });

  describe('Content-Based Filtering', () => {
    it('should recommend skills based on content similarity', async () => {
      const userSkills = [mockSkills[0]]; // JavaScript (Programming)
      
      vi.mocked(storage.getSkillsByUser).mockResolvedValue(userSkills);
      vi.mocked(storage.getSessionsByUser).mockResolvedValue([]);
      vi.mocked(storage.searchSkills).mockResolvedValue(mockSkills);

      const recommendations = await recommendationService.getSkillRecommendations(mockUser.id);

      // React (same category) should score higher than UI/UX Design
      const reactRec = recommendations.find(r => r.skill.title === 'React Development');
      const designRec = recommendations.find(r => r.skill.title === 'UI/UX Design');
      
      expect(reactRec!.score).toBeGreaterThan(designRec!.score);
    });
  });

  describe('Error Handling', () => {
    it('should handle storage errors gracefully', async () => {
      vi.mocked(storage.getUser).mockRejectedValue(new Error('Database error'));

      await expect(recommendationService.getSkillRecommendations(mockUser.id))
        .rejects.toThrow('Database error');
    });

    it('should handle invalid user ID', async () => {
      vi.mocked(storage.getUser).mockResolvedValue(null);

      await expect(recommendationService.getSkillRecommendations('nonexistent'))
        .rejects.toThrow('User not found');
    });

    it('should handle empty skill database', async () => {
      vi.mocked(storage.getSkillsByUser).mockResolvedValue([]);
      vi.mocked(storage.getSessionsByUser).mockResolvedValue([]);
      vi.mocked(storage.searchSkills).mockResolvedValue([]);

      const recommendations = await recommendationService.getSkillRecommendations(mockUser.id);

      expect(recommendations).toHaveLength(0);
    });
  });

  describe('Performance Optimization', () => {
    it('should cache recommendation results', async () => {
      vi.mocked(storage.getSkillsByUser).mockResolvedValue([]);
      vi.mocked(storage.getSessionsByUser).mockResolvedValue([]);
      vi.mocked(storage.searchSkills).mockResolvedValue(mockSkills);

      // First call
      await recommendationService.getSkillRecommendations(mockUser.id);
      
      // Second call should use cache
      await recommendationService.getSkillRecommendations(mockUser.id);

      // Storage should only be called once due to caching
      expect(storage.searchSkills).toHaveBeenCalledTimes(1);
    });

    it('should handle large datasets efficiently', async () => {
      const largeSkillSet = Array(1000).fill(null).map((_, i) => 
        createMockSkill({ 
          id: `skill-${i}`,
          title: `Skill ${i}`,
        })
      );

      vi.mocked(storage.getSkillsByUser).mockResolvedValue([]);
      vi.mocked(storage.getSessionsByUser).mockResolvedValue([]);
      vi.mocked(storage.searchSkills).mockResolvedValue(largeSkillSet);

      const startTime = Date.now();
      const recommendations = await recommendationService.getSkillRecommendations(mockUser.id, 10);
      const endTime = Date.now();

      expect(recommendations).toHaveLength(10);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});