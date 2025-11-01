import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, requireRole, UserRole, type AuthenticatedRequest } from './auth';
import { ContentModerationService } from './services/contentModeration';
import { rateLimiters } from './middleware/rateLimiting';

const router = Router();

// Validation schemas
const reportContentSchema = z.object({
  contentType: z.enum(['course', 'message', 'profile', 'review']),
  contentId: z.string().min(1),
  reason: z.string().min(1).max(100),
  description: z.string().max(500).optional()
});

const reviewReportSchema = z.object({
  action: z.enum(['approve', 'remove', 'warn', 'dismiss']),
  notes: z.string().max(500).optional()
});

const reviewUserFlagSchema = z.object({
  action: z.enum(['warn', 'suspend', 'ban', 'dismiss']),
  duration: z.number().min(1).max(365).optional(), // days
  notes: z.string().max(500).optional()
});

// Apply rate limiting
router.use(rateLimiters.general);

// ===== Content Reporting =====

// Report content
router.post('/reports', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const data = reportContentSchema.parse(req.body);

    const report = await ContentModerationService.reportContent(
      userId,
      data.contentType,
      data.contentId,
      data.reason,
      data.description
    );

    res.status(201).json({
      report: {
        id: report.id,
        contentType: report.contentType,
        contentId: report.contentId,
        reason: report.reason,
        status: report.status,
        createdAt: report.createdAt
      },
      message: 'Content reported successfully'
    });
  } catch (error) {
    console.error('Report content error:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Invalid data',
        errors: error.errors
      });
    }

    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error'
    });
  }
});

// Get user's reports
router.get('/reports/my', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const reports = await ContentModerationService.getContentReports();
    
    // Filter to only show user's reports
    const userReports = reports.filter(report => report.reporterId === userId);

    res.json({
      reports: userReports.map(report => ({
        id: report.id,
        contentType: report.contentType,
        contentId: report.contentId,
        reason: report.reason,
        status: report.status,
        createdAt: report.createdAt,
        reviewedAt: report.reviewedAt,
        action: report.action
      })),
      count: userReports.length
    });
  } catch (error) {
    console.error('Get user reports error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error'
    });
  }
});

// ===== Admin Moderation Functions =====

// Get all content reports (admin only)
router.get('/reports', 
  authenticateToken, 
  requireRole(UserRole.ADMIN), 
  async (req: AuthenticatedRequest, res) => {
    try {
      const status = req.query.status as string;
      const contentType = req.query.contentType as string;
      const limit = parseInt(req.query.limit as string) || 50;

      const reports = await ContentModerationService.getContentReports(status, contentType, limit);

      res.json({
        reports,
        count: reports.length
      });
    } catch (error) {
      console.error('Get content reports error:', error);
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Internal server error'
      });
    }
  }
);

// Review content report (admin only)
router.put('/reports/:reportId/review', 
  authenticateToken, 
  requireRole(UserRole.ADMIN), 
  async (req: AuthenticatedRequest, res) => {
    try {
      const reportId = req.params.reportId;
      const reviewerId = req.user!.userId;
      const data = reviewReportSchema.parse(req.body);

      const updatedReport = await ContentModerationService.reviewContentReport(
        reportId,
        reviewerId,
        data.action,
        data.notes
      );

      res.json({
        report: updatedReport,
        message: 'Report reviewed successfully'
      });
    } catch (error) {
      console.error('Review content report error:', error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          code: 'VALIDATION_ERROR',
          message: 'Invalid data',
          errors: error.errors
        });
      }

      if (error instanceof Error && error.message === 'Report not found') {
        return res.status(404).json({
          code: 'REPORT_NOT_FOUND',
          message: 'Report not found'
        });
      }

      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Internal server error'
      });
    }
  }
);

// Get user flags (admin only)
router.get('/user-flags', 
  authenticateToken, 
  requireRole(UserRole.ADMIN), 
  async (req: AuthenticatedRequest, res) => {
    try {
      const status = req.query.status as string;
      const limit = parseInt(req.query.limit as string) || 50;

      const flags = await ContentModerationService.getUserFlags(status, limit);

      res.json({
        flags,
        count: flags.length
      });
    } catch (error) {
      console.error('Get user flags error:', error);
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Internal server error'
      });
    }
  }
);

// Review user flag (admin only)
router.put('/user-flags/:flagId/review', 
  authenticateToken, 
  requireRole(UserRole.ADMIN), 
  async (req: AuthenticatedRequest, res) => {
    try {
      const flagId = req.params.flagId;
      const reviewerId = req.user!.userId;
      const data = reviewUserFlagSchema.parse(req.body);

      await ContentModerationService.reviewUserFlag(
        flagId,
        reviewerId,
        data.action,
        data.duration,
        data.notes
      );

      res.json({
        message: 'User flag reviewed successfully'
      });
    } catch (error) {
      console.error('Review user flag error:', error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          code: 'VALIDATION_ERROR',
          message: 'Invalid data',
          errors: error.errors
        });
      }

      if (error instanceof Error && error.message === 'Flag not found') {
        return res.status(404).json({
          code: 'FLAG_NOT_FOUND',
          message: 'Flag not found'
        });
      }

      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Internal server error'
      });
    }
  }
);

// ===== Content Quality Checks =====

// Moderate text content (for testing/preview)
router.post('/moderate-text', 
  authenticateToken, 
  async (req: AuthenticatedRequest, res) => {
    try {
      const { content, contentType } = req.body;

      if (!content || typeof content !== 'string') {
        return res.status(400).json({
          code: 'MISSING_CONTENT',
          message: 'Content is required'
        });
      }

      if (content.length > 10000) {
        return res.status(400).json({
          code: 'CONTENT_TOO_LONG',
          message: 'Content exceeds maximum length'
        });
      }

      const result = await ContentModerationService.moderateText(content, contentType || 'general');

      res.json({
        moderation: result,
        message: 'Content moderated successfully'
      });
    } catch (error) {
      console.error('Moderate text error:', error);
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Internal server error'
      });
    }
  }
);

// Perform quality check on course (admin or course creator)
router.get('/quality-check/course/:courseId', 
  authenticateToken, 
  async (req: AuthenticatedRequest, res) => {
    try {
      const courseId = req.params.courseId;
      const userId = req.user!.userId;
      const userRole = req.user!.role as UserRole;

      // Check if user has permission to view quality check
      if (userRole !== UserRole.ADMIN) {
        // Check if user is the course creator
        const course = await storage.getCourse(courseId);
        if (!course || course.creatorId !== userId) {
          return res.status(403).json({
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'You can only view quality checks for your own courses'
          });
        }
      }

      const qualityCheck = await ContentModerationService.performQualityCheck(courseId);

      res.json({
        qualityCheck,
        message: 'Quality check completed successfully'
      });
    } catch (error) {
      console.error('Quality check error:', error);

      if (error instanceof Error && error.message === 'Course not found') {
        return res.status(404).json({
          code: 'COURSE_NOT_FOUND',
          message: 'Course not found'
        });
      }

      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Internal server error'
      });
    }
  }
);

// ===== Moderation Statistics (Admin only) =====

// Get moderation statistics
router.get('/stats', 
  authenticateToken, 
  requireRole(UserRole.ADMIN), 
  async (req: AuthenticatedRequest, res) => {
    try {
      const reports = await ContentModerationService.getContentReports();
      const flags = await ContentModerationService.getUserFlags();

      const stats = {
        reports: {
          total: reports.length,
          pending: reports.filter(r => r.status === 'pending').length,
          reviewed: reports.filter(r => r.status === 'reviewed').length,
          byType: {
            course: reports.filter(r => r.contentType === 'course').length,
            message: reports.filter(r => r.contentType === 'message').length,
            profile: reports.filter(r => r.contentType === 'profile').length,
            review: reports.filter(r => r.contentType === 'review').length
          }
        },
        userFlags: {
          total: flags.length,
          pending: flags.filter(f => f.status === 'pending').length,
          reviewed: flags.filter(f => f.status === 'reviewed').length,
          bySeverity: {
            low: flags.filter(f => f.severity === 'low').length,
            medium: flags.filter(f => f.severity === 'medium').length,
            high: flags.filter(f => f.severity === 'high').length
          }
        }
      };

      res.json({
        stats,
        message: 'Moderation statistics retrieved successfully'
      });
    } catch (error) {
      console.error('Get moderation stats error:', error);
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Internal server error'
      });
    }
  }
);

export default router;