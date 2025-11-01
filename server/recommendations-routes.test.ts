import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import recommendationsRouter from './recommendations-routes';
import { RecommendationService } from './services/recommendations';

// Mock the recommendation service
vi.mock('./services/recommendations', () => ({
  RecommendationService: vi.fn().mockImplementation(() => ({
    getSkillRecommendations: vi.fn(),
    getUserRecommendations: vi.fn(),
    recordInteraction: vi.fn(),
    getRecommendationHistory: vi.fn(),
    updateUserPreferences: vi.fn(),
    getRecommendationAnalytics: vi.fn(),
  }))
}));

// Mock the auth middleware
vi.mock('./auth', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = { id: 'test-user-id' };
    next();
  }
}));

describe('Recommendations Routes', () => {
  let app: express.Application;
  let mockRecommendationService: any;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/recommendations', recommendationsRouter);
    
    // Get the mocked service instance
    mockRecommendationService = new (RecommendationService as any)();
    vi.clearAllMocks();
  });

  describe('GET /api/recommendations/skills', () => {
    it('should return skill recommendations', async () => {
      const mockRecommendations = [
        {
          skill: {
            id: 'skill1',
            title: 'JavaScript',
            category: 'Programming'
          },
          score: 0.8,
          reason: 'Matches your interests'
        }
      ];

      mockRecommendationService.getSkillRecommendations.mockResolvedValue(mockRecommendations);

      const response = await request(app)
        .get('/api/recommendations/skills')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockRecommendations);
      expect(mockRecommendationService.getSkillRecommendations).toHaveBeenCalledWith('test-user-id', 10);
    });

    it('should handle custom limit parameter', async () => {
      mockRecommendationService.getSkillRecommendations.mockResolvedValue([]);

      await request(app)
        .get('/api/recommendations/skills?limit=5')
        .expect(200);

      expect(mockRecommendationService.getSkillRecommendations).toHaveBeenCalledWith('test-user-id', 5);
    });

    it('should handle service errors', async () => {
      mockRecommendationService.getSkillRecommendations.mockRejectedValue(new Error('Service error'));

      const response = await request(app)
        .get('/api/recommendations/skills')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to get skill recommendations');
    });
  });

  describe('GET /api/recommendations/users', () => {
    it('should return user recommendations for a skill', async () => {
      const mockRecommendations = [
        {
          user: {
            id: 'user1',
            username: 'teacher1',
            rating: 45
          },
          skill: {
            id: 'skill1',
            title: 'JavaScript'
          },
          compatibilityScore: 0.9,
          reasons: ['Highly rated teacher']
        }
      ];

      mockRecommendationService.getUserRecommendations.mockResolvedValue(mockRecommendations);

      const response = await request(app)
        .get('/api/recommendations/users?skillId=skill1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockRecommendations);
      expect(mockRecommendationService.getUserRecommendations).toHaveBeenCalledWith(
        'test-user-id',
        'skill1',
        {},
        10
      );
    });

    it('should require skillId parameter', async () => {
      const response = await request(app)
        .get('/api/recommendations/users')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('skillId is required');
    });

    it('should handle filters', async () => {
      mockRecommendationService.getUserRecommendations.mockResolvedValue([]);

      await request(app)
        .get('/api/recommendations/users?skillId=skill1&categories=Programming,Design&minRating=4.0&limit=5')
        .expect(200);

      expect(mockRecommendationService.getUserRecommendations).toHaveBeenCalledWith(
        'test-user-id',
        'skill1',
        {
          categories: ['Programming', 'Design'],
          minRating: 4.0
        },
        5
      );
    });

    it('should handle skill not found error', async () => {
      mockRecommendationService.getUserRecommendations.mockRejectedValue(new Error('Skill not found'));

      const response = await request(app)
        .get('/api/recommendations/users?skillId=nonexistent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Skill not found');
    });
  });

  describe('POST /api/recommendations/feedback', () => {
    it('should record interaction feedback', async () => {
      mockRecommendationService.recordInteraction.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/recommendations/feedback')
        .send({
          recommendationType: 'skill',
          recommendedId: 'skill1',
          interactionType: 'click'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockRecommendationService.recordInteraction).toHaveBeenCalledWith(
        'test-user-id',
        'skill',
        'skill1',
        'click'
      );
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/recommendations/feedback')
        .send({
          recommendationType: 'skill'
          // missing recommendedId and interactionType
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('recommendationType, recommendedId, and interactionType are required');
    });

    it('should validate recommendationType values', async () => {
      const response = await request(app)
        .post('/api/recommendations/feedback')
        .send({
          recommendationType: 'invalid',
          recommendedId: 'skill1',
          interactionType: 'click'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('recommendationType must be one of: skill, user, course');
    });

    it('should validate interactionType values', async () => {
      const response = await request(app)
        .post('/api/recommendations/feedback')
        .send({
          recommendationType: 'skill',
          recommendedId: 'skill1',
          interactionType: 'invalid'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('interactionType must be one of: click, view, ignore');
    });
  });

  describe('GET /api/recommendations/history', () => {
    it('should return recommendation history', async () => {
      const mockHistory = [
        {
          id: 'rec1',
          userId: 'test-user-id',
          recommendationType: 'skill',
          recommendedId: 'skill1',
          score: '0.8',
          clicked: true,
          createdAt: new Date()
        }
      ];

      mockRecommendationService.getRecommendationHistory.mockResolvedValue(mockHistory);

      const response = await request(app)
        .get('/api/recommendations/history')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockHistory);
      expect(mockRecommendationService.getRecommendationHistory).toHaveBeenCalledWith(
        'test-user-id',
        undefined,
        50
      );
    });

    it('should handle type filter', async () => {
      mockRecommendationService.getRecommendationHistory.mockResolvedValue([]);

      await request(app)
        .get('/api/recommendations/history?type=skill&limit=20')
        .expect(200);

      expect(mockRecommendationService.getRecommendationHistory).toHaveBeenCalledWith(
        'test-user-id',
        'skill',
        20
      );
    });

    it('should validate type parameter', async () => {
      const response = await request(app)
        .get('/api/recommendations/history?type=invalid')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('type must be one of: skill, user, course');
    });
  });

  describe('PUT /api/recommendations/preferences', () => {
    it('should update user preferences', async () => {
      const mockPreferences = {
        id: 'pref1',
        userId: 'test-user-id',
        preferredCategories: ['Programming'],
        updatedAt: new Date()
      };

      mockRecommendationService.updateUserPreferences.mockResolvedValue(mockPreferences);

      const response = await request(app)
        .put('/api/recommendations/preferences')
        .send({
          preferredCategories: ['Programming'],
          sessionDuration: 60
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockPreferences);
      expect(mockRecommendationService.updateUserPreferences).toHaveBeenCalledWith(
        'test-user-id',
        {
          preferredCategories: ['Programming'],
          sessionDuration: 60
        }
      );
    });

    it('should filter out invalid preference fields', async () => {
      mockRecommendationService.updateUserPreferences.mockResolvedValue({});

      await request(app)
        .put('/api/recommendations/preferences')
        .send({
          preferredCategories: ['Programming'],
          invalidField: 'should be filtered out',
          sessionDuration: 60
        })
        .expect(200);

      expect(mockRecommendationService.updateUserPreferences).toHaveBeenCalledWith(
        'test-user-id',
        {
          preferredCategories: ['Programming'],
          sessionDuration: 60
        }
      );
    });
  });

  describe('GET /api/recommendations/analytics', () => {
    it('should return recommendation analytics', async () => {
      const mockAnalytics = {
        totalRecommendations: 100,
        clickedRecommendations: 25,
        clickThroughRate: 25.0,
        topCategories: ['Programming', 'Design']
      };

      mockRecommendationService.getRecommendationAnalytics.mockResolvedValue(mockAnalytics);

      const response = await request(app)
        .get('/api/recommendations/analytics')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockAnalytics);
      expect(mockRecommendationService.getRecommendationAnalytics).toHaveBeenCalledWith('test-user-id');
    });

    it('should handle service errors', async () => {
      mockRecommendationService.getRecommendationAnalytics.mockRejectedValue(new Error('Service error'));

      const response = await request(app)
        .get('/api/recommendations/analytics')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to get recommendation analytics');
    });
  });
});