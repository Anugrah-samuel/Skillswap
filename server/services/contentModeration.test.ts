import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContentModerationService } from './contentModeration';
import { storage } from '../storage';
import { AuditLogService } from './auditLog';

// Mock dependencies
vi.mock('../storage', () => ({
  storage: {
    createContentReport: vi.fn(),
    getContentReports: vi.fn(),
    getContentReport: vi.fn(),
    updateContentReport: vi.fn(),
    createUserBehaviorEntry: vi.fn(),
    getUserBehaviorEntries: vi.fn(),
    createUserFlag: vi.fn(),
    getUserFlags: vi.fn(),
    getUserFlag: vi.fn(),
    updateUserFlag: vi.fn(),
    updateUser: vi.fn(),
    getCourse: vi.fn(),
    getLessonsByCourse: vi.fn(),
  },
}));

vi.mock('./auditLog', () => ({
  AuditLogService: {
    logSecurityEvent: vi.fn(),
    logAdminAction: vi.fn(),
  },
}));

describe('ContentModerationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('moderateText', () => {
    it('should approve clean content', async () => {
      const result = await ContentModerationService.moderateText(
        'This is a clean and appropriate message about learning JavaScript.',
        'message'
      );

      expect(result.isApproved).toBe(true);
      expect(result.flags).toHaveLength(0);
      expect(result.suggestedAction).toBe('approve');
      expect(result.confidence).toBe(1.0);
    });

    it('should flag profanity', async () => {
      const result = await ContentModerationService.moderateText(
        'This is a fucking terrible course.',
        'message'
      );

      expect(result.isApproved).toBe(false);
      expect(result.flags).toContain('profanity');
      expect(result.suggestedAction).toBe('reject');
      expect(result.confidence).toBe(0.9);
    });

    it('should flag spam patterns', async () => {
      const result = await ContentModerationService.moderateText(
        'BUY NOW!!! LIMITED TIME OFFER!!! CLICK HERE!!!',
        'message'
      );

      expect(result.isApproved).toBe(false);
      expect(result.flags).toContain('spam');
      expect(result.suggestedAction).toBe('review');
    });

    it('should flag personal information', async () => {
      const result = await ContentModerationService.moderateText(
        'Contact me at john.doe@example.com or call 555-123-4567',
        'message'
      );

      expect(result.isApproved).toBe(false);
      expect(result.flags).toContain('email_address');
      expect(result.flags).toContain('phone_number');
      expect(result.flags).toContain('personal_info');
    });

    it('should flag excessive repetition', async () => {
      const result = await ContentModerationService.moderateText(
        'amazing amazing amazing amazing amazing amazing amazing',
        'message'
      );

      expect(result.isApproved).toBe(false);
      expect(result.flags).toContain('excessive_repetition');
    });

    it('should flag hate speech', async () => {
      const result = await ContentModerationService.moderateText(
        'You should kill yourself, nazi scum',
        'message'
      );

      expect(result.isApproved).toBe(false);
      expect(result.flags).toContain('hate_speech');
      expect(result.suggestedAction).toBe('reject');
    });
  });

  describe('moderateCourse', () => {
    it('should moderate course content', async () => {
      const courseData = {
        title: 'Learn JavaScript Programming',
        description: 'A comprehensive course on JavaScript fundamentals',
        lessons: [
          { title: 'Variables and Functions', description: 'Learn about JS variables' },
          { title: 'DOM Manipulation', description: 'Working with the DOM' },
        ],
      };

      const result = await ContentModerationService.moderateCourse(courseData);

      expect(result.isApproved).toBe(true);
      expect(result.flags).toHaveLength(0);
    });

    it('should flag unrealistic promises', async () => {
      const courseData = {
        title: 'Become a Millionaire Overnight',
        description: 'Guaranteed 100% success with no effort required',
        lessons: [],
      };

      const result = await ContentModerationService.moderateCourse(courseData);

      expect(result.isApproved).toBe(false);
      expect(result.flags).toContain('unrealistic_promises');
      expect(result.flags).toContain('incomplete_content');
    });

    it('should flag excessive pricing', async () => {
      const courseData = {
        title: 'Basic HTML Course',
        description: 'Learn HTML basics',
        lessons: [{ title: 'HTML Tags', description: 'Basic tags' }],
        priceCredits: 1500,
      };

      const result = await ContentModerationService.moderateCourse(courseData);

      expect(result.flags).toContain('excessive_pricing');
    });
  });

  describe('reportContent', () => {
    it('should create content report', async () => {
      const mockReport = {
        id: 'report-123',
        reporterId: 'user-123',
        contentType: 'course',
        contentId: 'course-456',
        reason: 'inappropriate',
        status: 'pending',
        createdAt: new Date(),
      };

      vi.mocked(storage.createContentReport).mockResolvedValue(undefined);
      vi.mocked(AuditLogService.logSecurityEvent).mockResolvedValue(undefined);

      const result = await ContentModerationService.reportContent(
        'user-123',
        'course',
        'course-456',
        'inappropriate',
        'Contains offensive language'
      );

      expect(result).toMatchObject({
        reporterId: 'user-123',
        contentType: 'course',
        contentId: 'course-456',
        reason: 'inappropriate',
        description: 'Contains offensive language',
        status: 'pending',
      });

      expect(storage.createContentReport).toHaveBeenCalled();
      expect(AuditLogService.logSecurityEvent).toHaveBeenCalledWith(
        'content_reported',
        'user-123',
        expect.objectContaining({
          contentType: 'course',
          contentId: 'course-456',
          reason: 'inappropriate',
        })
      );
    });
  });

  describe('reviewContentReport', () => {
    it('should review and update content report', async () => {
      const mockReport = {
        id: 'report-123',
        reporterId: 'user-123',
        contentType: 'course',
        contentId: 'course-456',
        reason: 'inappropriate',
        status: 'pending',
        createdAt: new Date(),
      };

      vi.mocked(storage.getContentReport).mockResolvedValue(mockReport as any);
      vi.mocked(storage.updateContentReport).mockResolvedValue(undefined);
      vi.mocked(AuditLogService.logAdminAction).mockResolvedValue(undefined);

      const result = await ContentModerationService.reviewContentReport(
        'report-123',
        'admin-789',
        'remove',
        'Content violates community guidelines'
      );

      expect(result.status).toBe('reviewed');
      expect(result.reviewedBy).toBe('admin-789');
      expect(result.action).toBe('remove');

      expect(storage.updateContentReport).toHaveBeenCalledWith(
        'report-123',
        expect.objectContaining({
          status: 'reviewed',
          reviewedBy: 'admin-789',
          action: 'remove',
        })
      );

      expect(AuditLogService.logAdminAction).toHaveBeenCalled();
    });

    it('should throw error for non-existent report', async () => {
      vi.mocked(storage.getContentReport).mockResolvedValue(null);

      await expect(
        ContentModerationService.reviewContentReport('nonexistent', 'admin-789', 'dismiss')
      ).rejects.toThrow('Report not found');
    });
  });

  describe('trackUserBehavior', () => {
    it('should track user behavior and check for flagging', async () => {
      vi.mocked(storage.createUserBehaviorEntry).mockResolvedValue(undefined);
      vi.mocked(storage.getUserBehaviorEntries).mockResolvedValue([]);

      await ContentModerationService.trackUserBehavior(
        'user-123',
        'inappropriate_message',
        'medium',
        { messageId: 'msg-456' }
      );

      expect(storage.createUserBehaviorEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          action: 'inappropriate_message',
          severity: 'medium',
          details: { messageId: 'msg-456' },
        })
      );

      expect(storage.getUserBehaviorEntries).toHaveBeenCalledWith(
        'user-123',
        expect.any(Date)
      );
    });
  });

  describe('performQualityCheck', () => {
    it('should perform quality check on course', async () => {
      const mockCourse = {
        id: 'course-123',
        title: 'JavaScript Fundamentals',
        description: 'A comprehensive course covering JavaScript basics, variables, functions, and DOM manipulation. Perfect for beginners.',
        priceCredits: 50,
      };

      const mockLessons = [
        { id: 'lesson-1', contentUrl: 'video1.mp4', duration: 30 },
        { id: 'lesson-2', contentUrl: 'video2.mp4', duration: 45 },
        { id: 'lesson-3', contentUrl: 'video3.mp4', duration: 25 },
      ];

      vi.mocked(storage.getCourse).mockResolvedValue(mockCourse as any);
      vi.mocked(storage.getLessonsByCourse).mockResolvedValue(mockLessons as any);

      const result = await ContentModerationService.performQualityCheck('course-123');

      expect(result.score).toBeGreaterThan(80);
      expect(result.issues).toHaveLength(0);
      expect(result.recommendations).toHaveLength(0);
    });

    it('should identify quality issues', async () => {
      const mockCourse = {
        id: 'course-123',
        title: 'Bad Course',
        description: 'Short',
        priceCredits: 200, // Too expensive for content
      };

      const mockLessons = [
        { id: 'lesson-1', contentUrl: null, duration: 0 }, // Missing content
      ];

      vi.mocked(storage.getCourse).mockResolvedValue(mockCourse as any);
      vi.mocked(storage.getLessonsByCourse).mockResolvedValue(mockLessons as any);

      const result = await ContentModerationService.performQualityCheck('course-123');

      expect(result.score).toBeLessThan(50);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should throw error for non-existent course', async () => {
      vi.mocked(storage.getCourse).mockResolvedValue(null);

      await expect(
        ContentModerationService.performQualityCheck('nonexistent')
      ).rejects.toThrow('Course not found');
    });
  });
});