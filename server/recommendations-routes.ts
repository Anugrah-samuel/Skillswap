import express from 'express';
import { RecommendationService } from './services/recommendations';
import { authenticateToken } from './auth';

const router = express.Router();
const recommendationService = new RecommendationService();

/**
 * GET /api/recommendations/skills
 * Get personalized skill recommendations for the authenticated user
 */
router.get('/skills', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const limit = parseInt(req.query.limit as string) || 10;

    const recommendations = await recommendationService.getSkillRecommendations(userId, limit);

    res.json({
      success: true,
      data: recommendations,
      message: 'Skill recommendations retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting skill recommendations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get skill recommendations'
    });
  }
});

/**
 * GET /api/recommendations/users
 * Get user recommendations for a specific skill
 */
router.get('/users', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const skillId = req.query.skillId as string;
    const limit = parseInt(req.query.limit as string) || 10;
    
    if (!skillId) {
      return res.status(400).json({
        success: false,
        message: 'skillId is required'
      });
    }

    // Parse filters from query parameters
    const filters: any = {};
    if (req.query.categories) {
      filters.categories = (req.query.categories as string).split(',');
    }
    if (req.query.minRating) {
      filters.minRating = parseFloat(req.query.minRating as string);
    }
    if (req.query.maxDistance) {
      filters.maxDistance = parseFloat(req.query.maxDistance as string);
    }
    if (req.query.availabilityMatch) {
      filters.availabilityMatch = req.query.availabilityMatch === 'true';
    }

    const recommendations = await recommendationService.getUserRecommendations(
      userId, 
      skillId, 
      filters, 
      limit
    );

    res.json({
      success: true,
      data: recommendations,
      message: 'User recommendations retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting user recommendations:', error);
    if (error instanceof Error && error.message === 'Skill not found') {
      return res.status(404).json({
        success: false,
        message: 'Skill not found'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to get user recommendations'
    });
  }
});

/**
 * POST /api/recommendations/feedback
 * Record user interaction with recommendations for feedback learning
 */
router.post('/feedback', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { recommendationType, recommendedId, interactionType } = req.body;

    if (!recommendationType || !recommendedId || !interactionType) {
      return res.status(400).json({
        success: false,
        message: 'recommendationType, recommendedId, and interactionType are required'
      });
    }

    if (!['skill', 'user', 'course'].includes(recommendationType)) {
      return res.status(400).json({
        success: false,
        message: 'recommendationType must be one of: skill, user, course'
      });
    }

    if (!['click', 'view', 'ignore'].includes(interactionType)) {
      return res.status(400).json({
        success: false,
        message: 'interactionType must be one of: click, view, ignore'
      });
    }

    await recommendationService.recordInteraction(
      userId,
      recommendationType,
      recommendedId,
      interactionType
    );

    res.json({
      success: true,
      message: 'Interaction recorded successfully'
    });
  } catch (error) {
    console.error('Error recording recommendation interaction:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record interaction'
    });
  }
});

/**
 * GET /api/recommendations/history
 * Get recommendation history for the authenticated user
 */
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const type = req.query.type as 'skill' | 'user' | 'course' | undefined;
    const limit = parseInt(req.query.limit as string) || 50;

    if (type && !['skill', 'user', 'course'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'type must be one of: skill, user, course'
      });
    }

    const history = await recommendationService.getRecommendationHistory(userId, type, limit);

    res.json({
      success: true,
      data: history,
      message: 'Recommendation history retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting recommendation history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get recommendation history'
    });
  }
});

/**
 * PUT /api/recommendations/preferences
 * Update user preferences for better recommendations
 */
router.put('/preferences', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const preferences = req.body;

    // Validate preferences structure
    const allowedFields = [
      'preferredCategories',
      'availabilityHours', 
      'learningGoals',
      'teachingInterests',
      'communicationStyle',
      'sessionDuration'
    ];

    const filteredPreferences: any = {};
    for (const [key, value] of Object.entries(preferences)) {
      if (allowedFields.includes(key)) {
        filteredPreferences[key] = value;
      }
    }

    const updatedPreferences = await recommendationService.updateUserPreferences(
      userId, 
      filteredPreferences
    );

    res.json({
      success: true,
      data: updatedPreferences,
      message: 'User preferences updated successfully'
    });
  } catch (error) {
    console.error('Error updating user preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user preferences'
    });
  }
});

/**
 * GET /api/recommendations/analytics
 * Get analytics on recommendation effectiveness for the authenticated user
 */
router.get('/analytics', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;

    const analytics = await recommendationService.getRecommendationAnalytics(userId);

    res.json({
      success: true,
      data: analytics,
      message: 'Recommendation analytics retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting recommendation analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get recommendation analytics'
    });
  }
});

export default router;