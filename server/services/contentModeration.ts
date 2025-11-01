import { storage } from '../storage';
import { AuditLogService } from './auditLog';
import crypto from 'crypto';

// Content moderation result interface
export interface ModerationResult {
  isApproved: boolean;
  confidence: number;
  flags: string[];
  reason?: string;
  suggestedAction: 'approve' | 'review' | 'reject';
}

// Content report interface
export interface ContentReport {
  id: string;
  reporterId: string;
  contentType: 'course' | 'message' | 'profile' | 'review';
  contentId: string;
  reason: string;
  description?: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  createdAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  action?: string;
}

// User behavior tracking interface
export interface UserBehaviorEntry {
  id: string;
  userId: string;
  action: string;
  severity: 'low' | 'medium' | 'high';
  details: Record<string, any>;
  timestamp: Date;
}

// Content moderation service
export class ContentModerationService {
  // Moderate text content (courses, messages, profiles)
  static async moderateText(content: string, contentType: string): Promise<ModerationResult> {
    const flags: string[] = [];
    let confidence = 1.0;

    // Check for profanity and inappropriate content
    const profanityFlags = this.checkProfanity(content);
    flags.push(...profanityFlags);

    // Check for spam patterns
    const spamFlags = this.checkSpam(content);
    flags.push(...spamFlags);

    // Check for personal information
    const piiFlags = this.checkPersonalInfo(content);
    flags.push(...piiFlags);

    // Check for promotional content
    const promoFlags = this.checkPromotionalContent(content);
    flags.push(...promoFlags);

    // Check for harmful content
    const harmfulFlags = this.checkHarmfulContent(content);
    flags.push(...harmfulFlags);

    // Determine approval status and suggested action
    const highSeverityFlags = ['profanity', 'hate_speech', 'harassment', 'harmful_content'];
    const hasHighSeverity = flags.some(flag => highSeverityFlags.includes(flag));
    
    const mediumSeverityFlags = ['spam', 'excessive_promotion', 'personal_info'];
    const hasMediumSeverity = flags.some(flag => mediumSeverityFlags.includes(flag));

    let suggestedAction: 'approve' | 'review' | 'reject';
    let isApproved: boolean;

    if (hasHighSeverity) {
      suggestedAction = 'reject';
      isApproved = false;
      confidence = 0.9;
    } else if (hasMediumSeverity || flags.length > 2) {
      suggestedAction = 'review';
      isApproved = false;
      confidence = 0.7;
    } else {
      suggestedAction = 'approve';
      isApproved = flags.length === 0;
      confidence = flags.length === 0 ? 1.0 : 0.8;
    }

    return {
      isApproved,
      confidence,
      flags,
      suggestedAction,
      reason: flags.length > 0 ? `Content flagged for: ${flags.join(', ')}` : undefined
    };
  }

  // Check for profanity and inappropriate language
  private static checkProfanity(content: string): string[] {
    const flags: string[] = [];
    const text = content.toLowerCase();

    // Basic profanity detection (in production, use a comprehensive service)
    const profanityPatterns = [
      /\b(fuck|shit|damn|bitch|asshole|bastard)\b/gi,
      /\b(idiot|stupid|moron|retard)\b/gi
    ];

    const hatePatterns = [
      /\b(nazi|hitler|kill yourself|kys)\b/gi,
      /\b(terrorist|bomb|attack)\b/gi
    ];

    if (profanityPatterns.some(pattern => pattern.test(text))) {
      flags.push('profanity');
    }

    if (hatePatterns.some(pattern => pattern.test(text))) {
      flags.push('hate_speech');
    }

    // Check for harassment patterns
    const harassmentPatterns = [
      /\b(harass|stalk|threaten|intimidate)\b/gi,
      /you (suck|are terrible|should die)/gi
    ];

    if (harassmentPatterns.some(pattern => pattern.test(text))) {
      flags.push('harassment');
    }

    return flags;
  }

  // Check for spam patterns
  private static checkSpam(content: string): string[] {
    const flags: string[] = [];
    const text = content.toLowerCase();

    // Excessive repetition
    const words = text.split(/\s+/);
    const wordCount = new Map<string, number>();
    
    words.forEach(word => {
      if (word.length > 2) {
        wordCount.set(word, (wordCount.get(word) || 0) + 1);
      }
    });

    const maxRepeats = Math.max(...Array.from(wordCount.values()));
    if (maxRepeats > words.length * 0.3) {
      flags.push('excessive_repetition');
    }

    // Excessive capitalization
    const capsRatio = (content.match(/[A-Z]/g) || []).length / content.length;
    if (capsRatio > 0.5 && content.length > 20) {
      flags.push('excessive_caps');
    }

    // Excessive punctuation
    const punctRatio = (content.match(/[!?]{2,}/g) || []).length;
    if (punctRatio > 3) {
      flags.push('excessive_punctuation');
    }

    // Generic spam patterns
    const spamPatterns = [
      /\b(buy now|click here|limited time|act fast|guaranteed)\b/gi,
      /\b(make money|work from home|earn \$\d+)\b/gi,
      /\b(free trial|no obligation|risk free)\b/gi
    ];

    if (spamPatterns.some(pattern => pattern.test(text))) {
      flags.push('spam');
    }

    return flags;
  }

  // Check for personal information
  private static checkPersonalInfo(content: string): string[] {
    const flags: string[] = [];

    // Email addresses
    if (/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g.test(content)) {
      flags.push('email_address');
    }

    // Phone numbers
    if (/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g.test(content)) {
      flags.push('phone_number');
    }

    // Social security numbers (US format)
    if (/\b\d{3}-\d{2}-\d{4}\b/g.test(content)) {
      flags.push('ssn');
    }

    // Credit card patterns
    if (/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g.test(content)) {
      flags.push('credit_card');
    }

    if (flags.length > 0) {
      flags.push('personal_info');
    }

    return flags;
  }

  // Check for promotional content
  private static checkPromotionalContent(content: string): string[] {
    const flags: string[] = [];
    const text = content.toLowerCase();

    // URL patterns
    const urlCount = (content.match(/https?:\/\/[^\s]+/g) || []).length;
    if (urlCount > 2) {
      flags.push('excessive_links');
    }

    // Promotional language
    const promoPatterns = [
      /\b(discount|sale|offer|deal|promo|coupon)\b/gi,
      /\b(visit my|check out my|follow me)\b/gi,
      /\b(subscribe|like and share|don't forget to)\b/gi
    ];

    const promoMatches = promoPatterns.reduce((count, pattern) => {
      return count + (content.match(pattern) || []).length;
    }, 0);

    if (promoMatches > 2) {
      flags.push('excessive_promotion');
    }

    return flags;
  }

  // Check for harmful content
  private static checkHarmfulContent(content: string): string[] {
    const flags: string[] = [];
    const text = content.toLowerCase();

    // Self-harm patterns
    const selfHarmPatterns = [
      /\b(suicide|kill myself|end it all|self harm)\b/gi,
      /\b(cut myself|hurt myself|want to die)\b/gi
    ];

    if (selfHarmPatterns.some(pattern => pattern.test(text))) {
      flags.push('self_harm');
    }

    // Violence patterns
    const violencePatterns = [
      /\b(kill|murder|assault|attack|violence)\b/gi,
      /\b(weapon|gun|knife|bomb)\b/gi
    ];

    if (violencePatterns.some(pattern => pattern.test(text))) {
      flags.push('violence');
    }

    // Illegal activity
    const illegalPatterns = [
      /\b(drugs|cocaine|heroin|meth|marijuana)\b/gi,
      /\b(hack|crack|pirate|steal|fraud)\b/gi
    ];

    if (illegalPatterns.some(pattern => pattern.test(text))) {
      flags.push('illegal_activity');
    }

    if (flags.length > 0) {
      flags.push('harmful_content');
    }

    return flags;
  }

  // Moderate course content specifically
  static async moderateCourse(courseData: any): Promise<ModerationResult> {
    const contentToCheck = [
      courseData.title,
      courseData.description,
      ...(courseData.lessons || []).map((lesson: any) => lesson.title + ' ' + lesson.description)
    ].join(' ');

    const result = await this.moderateText(contentToCheck, 'course');

    // Additional course-specific checks
    const additionalFlags: string[] = [];

    // Check for unrealistic promises
    const unrealisticPatterns = [
      /\b(guaranteed|100% success|instant results|overnight)\b/gi,
      /\b(make millions|get rich quick|no effort required)\b/gi
    ];

    if (unrealisticPatterns.some(pattern => pattern.test(contentToCheck))) {
      additionalFlags.push('unrealistic_promises');
    }

    // Check for incomplete content
    if (!courseData.lessons || courseData.lessons.length === 0) {
      additionalFlags.push('incomplete_content');
    }

    // Check for appropriate pricing
    if (courseData.priceCredits && courseData.priceCredits > 1000) {
      additionalFlags.push('excessive_pricing');
    }

    result.flags.push(...additionalFlags);

    // Recalculate approval based on additional flags
    if (additionalFlags.includes('unrealistic_promises')) {
      result.isApproved = false;
      result.suggestedAction = 'review';
    }

    return result;
  }

  // Report content
  static async reportContent(
    reporterId: string,
    contentType: 'course' | 'message' | 'profile' | 'review',
    contentId: string,
    reason: string,
    description?: string
  ): Promise<ContentReport> {
    const report: ContentReport = {
      id: crypto.randomUUID(),
      reporterId,
      contentType,
      contentId,
      reason,
      description,
      status: 'pending',
      createdAt: new Date()
    };

    await storage.createContentReport(report);

    // Log the report
    await AuditLogService.logSecurityEvent(
      'content_reported',
      reporterId,
      {
        contentType,
        contentId,
        reason,
        reportId: report.id
      }
    );

    return report;
  }

  // Get content reports (admin function)
  static async getContentReports(
    status?: string,
    contentType?: string,
    limit: number = 50
  ): Promise<ContentReport[]> {
    return await storage.getContentReports(status, contentType, limit);
  }

  // Review content report (admin function)
  static async reviewContentReport(
    reportId: string,
    reviewerId: string,
    action: 'approve' | 'remove' | 'warn' | 'dismiss',
    notes?: string
  ): Promise<ContentReport> {
    const report = await storage.getContentReport(reportId);
    if (!report) {
      throw new Error('Report not found');
    }

    const updatedReport: ContentReport = {
      ...report,
      status: 'reviewed',
      reviewedAt: new Date(),
      reviewedBy: reviewerId,
      action
    };

    await storage.updateContentReport(reportId, updatedReport);

    // Log the review action
    await AuditLogService.logAdminAction(
      'review_content_report',
      reviewerId,
      undefined,
      'content_report',
      reportId,
      { action, notes, originalReason: report.reason }
    );

    return updatedReport;
  }

  // Track user behavior
  static async trackUserBehavior(
    userId: string,
    action: string,
    severity: 'low' | 'medium' | 'high',
    details: Record<string, any>
  ): Promise<void> {
    const entry: UserBehaviorEntry = {
      id: crypto.randomUUID(),
      userId,
      action,
      severity,
      details,
      timestamp: new Date()
    };

    await storage.createUserBehaviorEntry(entry);

    // Check if user should be flagged
    await this.checkUserForFlagging(userId);
  }

  // Check if user should be flagged based on behavior
  private static async checkUserForFlagging(userId: string): Promise<void> {
    const recentBehavior = await storage.getUserBehaviorEntries(
      userId,
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
    );

    const highSeverityCount = recentBehavior.filter(entry => entry.severity === 'high').length;
    const mediumSeverityCount = recentBehavior.filter(entry => entry.severity === 'medium').length;
    const totalCount = recentBehavior.length;

    let shouldFlag = false;
    let flagReason = '';

    if (highSeverityCount >= 3) {
      shouldFlag = true;
      flagReason = 'Multiple high-severity violations';
    } else if (mediumSeverityCount >= 5) {
      shouldFlag = true;
      flagReason = 'Multiple medium-severity violations';
    } else if (totalCount >= 10) {
      shouldFlag = true;
      flagReason = 'Excessive violation count';
    }

    if (shouldFlag) {
      await this.flagUser(userId, flagReason, recentBehavior);
    }
  }

  // Flag user for review
  private static async flagUser(
    userId: string,
    reason: string,
    behaviorHistory: UserBehaviorEntry[]
  ): Promise<void> {
    await storage.createUserFlag({
      id: crypto.randomUUID(),
      userId,
      reason,
      severity: 'high',
      status: 'pending',
      createdAt: new Date(),
      details: {
        behaviorCount: behaviorHistory.length,
        recentViolations: behaviorHistory.slice(0, 5)
      }
    });

    // Log the flagging
    await AuditLogService.logSecurityEvent(
      'user_flagged',
      userId,
      {
        reason,
        behaviorCount: behaviorHistory.length
      }
    );
  }

  // Get user flags (admin function)
  static async getUserFlags(status?: string, limit: number = 50): Promise<any[]> {
    return await storage.getUserFlags(status, limit);
  }

  // Review user flag (admin function)
  static async reviewUserFlag(
    flagId: string,
    reviewerId: string,
    action: 'warn' | 'suspend' | 'ban' | 'dismiss',
    duration?: number, // in days for suspension
    notes?: string
  ): Promise<void> {
    const flag = await storage.getUserFlag(flagId);
    if (!flag) {
      throw new Error('Flag not found');
    }

    // Update flag status
    await storage.updateUserFlag(flagId, {
      status: 'reviewed',
      reviewedAt: new Date(),
      reviewedBy: reviewerId,
      action,
      notes
    });

    // Apply action to user
    if (action === 'suspend' || action === 'ban') {
      const suspendUntil = action === 'ban' ? null : 
        new Date(Date.now() + (duration || 7) * 24 * 60 * 60 * 1000);

      await storage.updateUser(flag.userId, {
        accountStatus: action === 'ban' ? 'banned' : 'suspended',
        suspendedUntil: suspendUntil
      });
    }

    // Log the action
    await AuditLogService.logAdminAction(
      'review_user_flag',
      reviewerId,
      flag.userId,
      'user_flag',
      flagId,
      { action, duration, notes }
    );
  }

  // Quality check for course content
  static async performQualityCheck(courseId: string): Promise<{
    score: number;
    issues: string[];
    recommendations: string[];
  }> {
    const course = await storage.getCourse(courseId);
    if (!course) {
      throw new Error('Course not found');
    }

    const lessons = await storage.getLessonsByCourse(courseId);
    
    let score = 100;
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check course completeness
    if (!course.description || course.description.length < 100) {
      score -= 15;
      issues.push('Course description is too short');
      recommendations.push('Add a detailed course description (at least 100 characters)');
    }

    if (lessons.length === 0) {
      score -= 30;
      issues.push('Course has no lessons');
      recommendations.push('Add at least one lesson to the course');
    } else if (lessons.length < 3) {
      score -= 10;
      issues.push('Course has very few lessons');
      recommendations.push('Consider adding more lessons for better value');
    }

    // Check lesson quality
    const lessonsWithoutContent = lessons.filter(lesson => 
      !lesson.contentUrl || lesson.duration === 0
    );

    if (lessonsWithoutContent.length > 0) {
      score -= lessonsWithoutContent.length * 5;
      issues.push(`${lessonsWithoutContent.length} lessons missing content`);
      recommendations.push('Ensure all lessons have content and proper duration');
    }

    // Check total course duration
    const totalDuration = lessons.reduce((sum, lesson) => sum + (lesson.duration || 0), 0);
    if (totalDuration < 30) {
      score -= 15;
      issues.push('Course is too short');
      recommendations.push('Aim for at least 30 minutes of total content');
    }

    // Check pricing reasonableness
    if (course.priceCredits && course.priceCredits > totalDuration * 2) {
      score -= 10;
      issues.push('Course pricing may be too high for content length');
      recommendations.push('Consider adjusting pricing based on content value');
    }

    return {
      score: Math.max(0, score),
      issues,
      recommendations
    };
  }
}