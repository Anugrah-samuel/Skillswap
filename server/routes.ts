import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertUserSchema,
  insertSkillSchema,
  insertMatchSchema,
  insertMessageSchema,
  insertEventSchema,
  insertReviewSchema,
  insertNotificationSchema,
  insertUserPreferencesSchema,
} from "@shared/schema";
import {
  updateProfileSchema,
  updateSkillSchema,
  updateEventSchema,
  updateUserPreferencesSchema,
  changePasswordSchema,
  purchaseCreditsSchema,
  createSubscriptionSchema,
  updateSubscriptionSchema,
  createCourseSchema,
  updateCourseSchema,
  createCourseLessonSchema,
  updateCourseLessonSchema,
  enrollInCourseSchema,
  updateProgressSchema,
  courseSearchSchema,
  scheduleSessionSchema,
  addPaymentMethodSchema,
  setDefaultPaymentMethodSchema,
  processPaymentSchema,
  refundPaymentSchema
} from "@shared/validation-schemas";
import { z } from "zod";
import {
  AuthService,
  authenticateToken,
  optionalAuth,
  requireRole,
  requirePremium,
  rateLimitByUser,
  UserRole,
  type AuthenticatedRequest
} from "./auth";
import { applySecurity } from "./middleware/security";
import { rateLimiters } from "./middleware/rateLimiting";
import { validateInput, preventSqlInjection, validateHeaders, limitRequestSize } from "./middleware/validation";
import { auditLogMiddleware, AuditLogService } from "./services/auditLog";
import apiKeyRoutes from "./api-key-routes";
import moderationRoutes from "./moderation-routes";
import mediaRoutes from "./media-routes";
import mobileRoutes from "./mobile-routes";
import { ContentModerationService } from "./services/contentModeration";
import { creditsService } from "./services/credits";
import { courseService } from "./services/courses";
import { subscriptionService } from "./services/subscriptions";
import { sessionService } from "./services/sessions";
// import { recommendationService } from "./services/recommendations";
import { paymentService } from "./services/payments";
import { analyticsService } from "./services/analytics";
import { initializeWebSocketService, getWebSocketService } from "./services/websocket";
import { notificationService } from "./services/notifications";
import { recommendationService } from "./services/recommendations";

// Auth schemas
const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

const signupSchema = insertUserSchema.extend({
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Apply security middleware to all routes
  app.use(applySecurity());
  
  // Apply input validation and sanitization
  app.use(validateHeaders);
  app.use(preventSqlInjection);
  app.use(limitRequestSize(5 * 1024 * 1024)); // 5MB limit
  
  // Apply audit logging (temporarily disabled for PostgreSQL migration)
  // app.use(auditLogMiddleware);
  
  // Apply rate limiting to all routes
  app.use(rateLimitByUser(1000, 15 * 60 * 1000)); // 1000 requests per 15 minutes per user

  // ===== API Key Management =====
  app.use('/api/api-keys', apiKeyRoutes);

  // ===== Content Moderation =====
  app.use('/api/moderation', moderationRoutes);

  // ===== Media Management =====
  app.use('/api/media', mediaRoutes);

  // ===== Mobile API Optimization =====
  app.use('/api/mobile', mobileRoutes);

  // ===== Enhanced Authentication =====

  app.post("/api/auth/signup", rateLimiters.auth, async (req, res) => {
    try {
      const data = signupSchema.parse(req.body);

      // Check if username or email already exists
      const existingUser = await storage.getUserByUsername(data.username);
      if (existingUser) {
        return res.status(400).json({
          code: "USERNAME_EXISTS",
          message: "Username already exists"
        });
      }

      const existingEmail = await storage.getUserByEmail(data.email);
      if (existingEmail) {
        return res.status(400).json({
          code: "EMAIL_EXISTS",
          message: "Email already exists"
        });
      }

      // Hash password before storing
      const hashedPassword = await AuthService.hashPassword(data.password);
      const user = await storage.createUser({
        ...data,
        password: hashedPassword,
      });

      // Generate tokens
      const accessToken = AuthService.generateAccessToken(user);
      const refreshToken = AuthService.generateRefreshToken(user.id);

      // Create default user preferences
      await storage.createUserPreferences({
        userId: user.id,
        preferredCategories: [],
        learningGoals: [],
        availabilityHours: [],
        maxSessionDuration: 60,
        preferredTeachingStyle: null,
      });

      // Log successful signup
      await AuditLogService.logSecurityEvent(
        'user_signup',
        user.id,
        { username: user.username, email: user.email },
        { ip: req.ip, userAgent: req.headers['user-agent'] }
      );

      const { password, ...userWithoutPassword } = user;
      res.status(201).json({
        user: userWithoutPassword,
        accessToken,
        refreshToken,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          code: "VALIDATION_ERROR",
          message: "Invalid data",
          errors: error.errors
        });
      }
      console.error("Signup error:", error);
      res.status(500).json({
        code: "INTERNAL_ERROR",
        message: "Internal server error"
      });
    }
  });

  app.post("/api/auth/login", rateLimiters.auth, async (req, res) => {
    try {
      const data = loginSchema.parse(req.body);

      const user = await storage.getUserByUsername(data.username);
      if (!user) {
        // Log failed login attempt
        await AuditLogService.logAuthEvent(
          'login_failed',
          undefined,
          false,
          'User not found',
          { ip: req.ip, userAgent: req.headers['user-agent'] }
        );
        
        return res.status(401).json({
          code: "INVALID_CREDENTIALS",
          message: "Invalid username or password"
        });
      }

      // Verify password
      const isValidPassword = await AuthService.verifyPassword(data.password, user.password);
      if (!isValidPassword) {
        // Log failed login attempt
        await AuditLogService.logAuthEvent(
          'login_failed',
          user.id,
          false,
          'Invalid password',
          { ip: req.ip, userAgent: req.headers['user-agent'] }
        );
        
        return res.status(401).json({
          code: "INVALID_CREDENTIALS",
          message: "Invalid username or password"
        });
      }

      // Generate tokens
      const accessToken = AuthService.generateAccessToken(user);
      const refreshToken = AuthService.generateRefreshToken(user.id);

      // Log successful login
      await AuditLogService.logAuthEvent(
        'login',
        user.id,
        true,
        undefined,
        { ip: req.ip, userAgent: req.headers['user-agent'] }
      );

      const { password, ...userWithoutPassword } = user;
      res.json({
        user: userWithoutPassword,
        accessToken,
        refreshToken,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          code: "VALIDATION_ERROR",
          message: "Invalid data",
          errors: error.errors
        });
      }
      console.error("Login error:", error);
      res.status(500).json({
        code: "INTERNAL_ERROR",
        message: "Internal server error"
      });
    }
  });

  app.post("/api/auth/refresh", rateLimiters.auth, async (req, res) => {
    try {
      const data = refreshTokenSchema.parse(req.body);

      const payload = AuthService.verifyRefreshToken(data.refreshToken);
      if (!payload) {
        return res.status(401).json({
          code: "INVALID_REFRESH_TOKEN",
          message: "Invalid or expired refresh token"
        });
      }

      const user = await storage.getUser(payload.userId);
      if (!user) {
        return res.status(401).json({
          code: "USER_NOT_FOUND",
          message: "User not found"
        });
      }

      // Generate new tokens
      const accessToken = AuthService.generateAccessToken(user);
      const refreshToken = AuthService.generateRefreshToken(user.id, payload.tokenVersion);

      res.json({
        accessToken,
        refreshToken,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          code: "VALIDATION_ERROR",
          message: "Invalid data",
          errors: error.errors
        });
      }
      console.error("Refresh token error:", error);
      res.status(500).json({
        code: "INTERNAL_ERROR",
        message: "Internal server error"
      });
    }
  });

  app.post("/api/auth/logout", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      // In a production app, you'd invalidate the refresh token here
      // For now, just return success
      res.json({ message: "Logged out successfully" });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({
        code: "INTERNAL_ERROR",
        message: "Internal server error"
      });
    }
  });

  // Get current user info
  app.get("/api/auth/me", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const user = await storage.getUser(req.user!.userId);
      if (!user) {
        return res.status(404).json({
          code: "USER_NOT_FOUND",
          message: "User not found"
        });
      }

      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Get current user error:", error);
      res.status(500).json({
        code: "INTERNAL_ERROR",
        message: "Internal server error"
      });
    }
  });

  // Change password
  app.put("/api/auth/change-password", rateLimiters.password, authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const data = changePasswordSchema.parse(req.body);

      const user = await storage.getUser(req.user!.userId);
      if (!user) {
        return res.status(404).json({
          code: "USER_NOT_FOUND",
          message: "User not found"
        });
      }

      // Verify current password
      const isValidPassword = await AuthService.verifyPassword(data.currentPassword, user.password);
      if (!isValidPassword) {
        return res.status(400).json({
          code: "INVALID_CURRENT_PASSWORD",
          message: "Current password is incorrect"
        });
      }

      // Hash new password
      const hashedNewPassword = await AuthService.hashPassword(data.newPassword);

      // Update password
      await storage.updateUser(req.user!.userId, {
        password: hashedNewPassword,
      });

      res.json({ message: "Password changed successfully" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          code: "VALIDATION_ERROR",
          message: "Invalid data",
          errors: error.errors
        });
      }
      console.error("Change password error:", error);
      res.status(500).json({
        code: "INTERNAL_ERROR",
        message: "Internal server error"
      });
    }
  });

  // ===== Users / Profile =====

  app.get("/api/profile/:userId", optionalAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = await storage.getUser(req.params.userId);
      if (!user) {
        return res.status(404).json({
          code: "USER_NOT_FOUND",
          message: "User not found"
        });
      }

      // Return different data based on whether it's the user's own profile
      const isOwnProfile = req.user?.userId === req.params.userId;
      const { password, ...userWithoutPassword } = user;

      if (isOwnProfile) {
        // Include sensitive data for own profile
        res.json(userWithoutPassword);
      } else {
        // Public profile view - exclude sensitive information
        const {
          email,
          creditBalance,
          subscriptionStatus,
          subscriptionExpiresAt,
          ...publicProfile
        } = userWithoutPassword;
        res.json(publicProfile);
      }
    } catch (error) {
      console.error("Get profile error:", error);
      res.status(500).json({
        code: "INTERNAL_ERROR",
        message: "Internal server error"
      });
    }
  });

  app.put("/api/profile", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.userId;

      // Validate only allowed fields
      const validatedData = updateProfileSchema.parse(req.body);
      
      // Moderate profile content (bio, full name, etc.)
      const contentToModerate = [
        validatedData.bio,
        validatedData.fullName
      ].filter(Boolean).join(' ');

      if (contentToModerate) {
        const moderationResult = await ContentModerationService.moderateText(contentToModerate, 'profile');
        
        if (!moderationResult.isApproved) {
          // Track user behavior for inappropriate profile content
          await ContentModerationService.trackUserBehavior(
            userId,
            'inappropriate_profile',
            moderationResult.flags.includes('personal_info') ? 'low' : 'medium',
            {
              flags: moderationResult.flags,
              updatedFields: Object.keys(validatedData)
            }
          );

          return res.status(400).json({
            code: 'CONTENT_REJECTED',
            message: 'Profile content violates community guidelines',
            reason: moderationResult.reason,
            flags: moderationResult.flags
          });
        }
      }

      const user = await storage.updateUser(userId, validatedData);

      if (!user) {
        return res.status(404).json({
          code: "USER_NOT_FOUND",
          message: "User not found"
        });
      }

      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          code: "VALIDATION_ERROR",
          message: "Invalid data",
          errors: error.errors
        });
      }
      console.error("Update profile error:", error);
      res.status(500).json({
        code: "INTERNAL_ERROR",
        message: "Internal server error"
      });
    }
  });

  // ===== User Preferences =====

  app.get("/api/preferences", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.userId;
      const preferences = await storage.getUserPreferences(userId);

      if (!preferences) {
        // Create default preferences if they don't exist
        const defaultPreferences = await storage.createUserPreferences({
          userId,
          preferredCategories: [],
          learningGoals: [],
          availabilityHours: [],
          maxSessionDuration: 60,
          preferredTeachingStyle: null,
        });
        return res.json(defaultPreferences);
      }

      res.json(preferences);
    } catch (error) {
      console.error("Get preferences error:", error);
      res.status(500).json({
        code: "INTERNAL_ERROR",
        message: "Internal server error"
      });
    }
  });

  app.put("/api/preferences", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.userId;
      const validatedData = updateUserPreferencesSchema.parse(req.body);

      let preferences = await storage.getUserPreferences(userId);

      if (!preferences) {
        // Create preferences if they don't exist
        preferences = await storage.createUserPreferences({
          userId,
          ...validatedData,
        });
      } else {
        // Update existing preferences
        preferences = await storage.updateUserPreferences(userId, validatedData);
      }

      if (!preferences) {
        return res.status(404).json({
          code: "PREFERENCES_NOT_FOUND",
          message: "User preferences not found"
        });
      }

      res.json(preferences);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          code: "VALIDATION_ERROR",
          message: "Invalid data",
          errors: error.errors
        });
      }
      console.error("Update preferences error:", error);
      res.status(500).json({
        code: "INTERNAL_ERROR",
        message: "Internal server error"
      });
    }
  });

  // ===== Skills =====

  app.get("/api/skills", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        return res.status(400).json({
          code: "MISSING_USER_ID",
          message: "userId is required"
        });
      }

      const skills = await storage.getSkillsByUser(userId);
      res.json(skills);
    } catch (error) {
      console.error("Get skills error:", error);
      res.status(500).json({
        code: "INTERNAL_ERROR",
        message: "Internal server error"
      });
    }
  });

  app.post("/api/skills", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const data = insertSkillSchema.parse({
        ...req.body,
        userId: req.user!.userId, // Ensure skill belongs to authenticated user
      });
      const skill = await storage.createSkill(data);
      res.status(201).json(skill);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          code: "VALIDATION_ERROR",
          message: "Invalid data",
          errors: error.errors
        });
      }
      console.error("Create skill error:", error);
      res.status(500).json({
        code: "INTERNAL_ERROR",
        message: "Internal server error"
      });
    }
  });

  app.put("/api/skills/:id", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      // Verify skill belongs to authenticated user
      const existingSkill = await storage.getSkill(req.params.id);
      if (!existingSkill) {
        return res.status(404).json({
          code: "SKILL_NOT_FOUND",
          message: "Skill not found"
        });
      }

      if (existingSkill.userId !== req.user!.userId) {
        return res.status(403).json({
          code: "UNAUTHORIZED_SKILL_ACCESS",
          message: "You can only edit your own skills"
        });
      }

      const validatedData = updateSkillSchema.parse(req.body);
      const skill = await storage.updateSkill(req.params.id, validatedData);
      res.json(skill);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          code: "VALIDATION_ERROR",
          message: "Invalid data",
          errors: error.errors
        });
      }
      console.error("Update skill error:", error);
      res.status(500).json({
        code: "INTERNAL_ERROR",
        message: "Internal server error"
      });
    }
  });

  app.delete("/api/skills/:id", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      // Verify skill belongs to authenticated user
      const existingSkill = await storage.getSkill(req.params.id);
      if (!existingSkill) {
        return res.status(404).json({
          code: "SKILL_NOT_FOUND",
          message: "Skill not found"
        });
      }

      if (existingSkill.userId !== req.user!.userId) {
        return res.status(403).json({
          code: "UNAUTHORIZED_SKILL_ACCESS",
          message: "You can only delete your own skills"
        });
      }

      const deleted = await storage.deleteSkill(req.params.id);
      res.json({ message: "Skill deleted successfully" });
    } catch (error) {
      console.error("Delete skill error:", error);
      res.status(500).json({
        code: "INTERNAL_ERROR",
        message: "Internal server error"
      });
    }
  });

  // ===== Skill Matches =====

  app.get("/api/matches", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        return res.status(400).json({ message: "userId is required" });
      }

      const matches = await storage.getMatchesByUser(userId);

      // Enrich matches with user and skill details
      const enrichedMatches = await Promise.all(
        matches.map(async (match) => {
          const matchedUser = await storage.getUser(match.matchedUserId);
          const userSkill = await storage.getSkill(match.userSkillId);
          const matchedSkill = await storage.getSkill(match.matchedSkillId);

          return {
            ...match,
            matchedUser: matchedUser ? {
              id: matchedUser.id,
              username: matchedUser.username,
              fullName: matchedUser.fullName,
              avatarUrl: matchedUser.avatarUrl,
              rating: matchedUser.rating,
              totalReviews: matchedUser.totalReviews,
            } : null,
            userSkill,
            matchedSkill,
          };
        })
      );

      res.json(enrichedMatches);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/matches/request", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const data = insertMatchSchema.parse(req.body);
      const match = await storage.createMatch(data);

      // Create notification for matched user using notification service
      await notificationService.createNotification({
        userId: data.matchedUserId,
        type: "match",
        title: "New Skill Trade Request",
        message: "Someone wants to exchange skills with you",
        relatedId: match.id,
      });

      res.json(match);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/matches/:id/status", async (req, res) => {
    try {
      const { status } = req.body;
      if (!status) {
        return res.status(400).json({ message: "status is required" });
      }

      const match = await storage.updateMatch(req.params.id, status);
      if (!match) {
        return res.status(404).json({ message: "Match not found" });
      }

      res.json(match);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/matches/suggestions/:userId", async (req, res) => {
    try {
      const userId = req.params.userId;
      
      // For now, return mock data to fix the JSON parsing error
      // TODO: Implement proper matching algorithm
      const mockSuggestions = [
        {
          user: {
            id: "mock-user-1",
            fullName: "John Doe",
            bio: "Experienced developer and teacher",
            avatarUrl: null,
            rating: 45, // 4.5 stars * 10
            totalReviews: 12
          },
          teachingSkill: {
            id: "mock-skill-1",
            title: "React Development",
            description: "I can teach React fundamentals and advanced patterns",
            category: "Technology",
            level: "Advanced",
            availability: "Weekends"
          },
          learningSkill: {
            id: "mock-skill-2",
            title: "Node.js",
            description: "Want to learn backend development with Node.js",
            category: "Technology",
            level: "Intermediate",
            type: "Learning"
          },
          matchScore: 85
        }
      ];
      
      res.json(mockSuggestions);
    } catch (error) {
      console.error("Get match suggestions error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ===== Messages =====

  // ===== Group Messages (must come before parameterized routes) =====

  app.get("/api/messages/group", rateLimiters.groupMessages, authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const messages = await storage.getGroupMessages();
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/messages/group", rateLimiters.groupMessages, authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { content } = req.body;

      if (!content || content.trim().length === 0) {
        return res.status(400).json({ message: "Message content is required" });
      }

      if (content.length > 2000) {
        return res.status(400).json({ message: "Message too long" });
      }

      // Moderate message content
      const moderationResult = await ContentModerationService.moderateText(content, 'message');
      
      if (!moderationResult.isApproved) {
        // Track user behavior for sending inappropriate content
        await ContentModerationService.trackUserBehavior(
          req.user!.userId,
          'inappropriate_message',
          moderationResult.flags.includes('profanity') || moderationResult.flags.includes('hate_speech') ? 'high' : 'medium',
          {
            flags: moderationResult.flags,
            content: content.substring(0, 100) // Store first 100 chars for review
          }
        );

        return res.status(400).json({
          code: 'CONTENT_REJECTED',
          message: 'Message content violates community guidelines',
          reason: moderationResult.reason,
          flags: moderationResult.flags
        });
      }

      const message = await storage.createGroupMessage({
        senderId: req.user!.userId,
        content: content.trim(),
      });

      // Broadcast to WebSocket clients
      const webSocketService = getWebSocketService();
      if (webSocketService) {
        webSocketService.broadcastGroupMessage({
          ...message,
          sender: {
            id: req.user!.userId,
            username: req.user!.username,
            fullName: req.user!.fullName || '',
            avatarUrl: req.user!.avatarUrl || ''
          }
        });
      }

      res.json(message);
    } catch (error) {
      console.error('Group message error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/messages/:conversationPartnerId", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        return res.status(400).json({ message: "userId is required" });
      }

      const messages = await storage.getMessagesBetweenUsers(
        userId,
        req.params.conversationPartnerId
      );
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/conversations", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        return res.status(400).json({ message: "userId is required" });
      }

      const conversations = await storage.getConversationsByUser(userId);
      res.json(conversations);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/messages", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const data = insertMessageSchema.parse(req.body);
      
      // Moderate message content
      const moderationResult = await ContentModerationService.moderateText(data.content, 'message');
      
      if (!moderationResult.isApproved) {
        // Track user behavior for sending inappropriate content
        await ContentModerationService.trackUserBehavior(
          req.user!.userId,
          'inappropriate_message',
          moderationResult.flags.includes('profanity') || moderationResult.flags.includes('hate_speech') ? 'high' : 'medium',
          {
            flags: moderationResult.flags,
            content: data.content.substring(0, 100) // Store first 100 chars for review
          }
        );

        return res.status(400).json({
          code: 'CONTENT_REJECTED',
          message: 'Message content violates community guidelines',
          reason: moderationResult.reason,
          flags: moderationResult.flags
        });
      }

      const message = await storage.createMessage(data);

      // Create notification for receiver using notification service
      await notificationService.createNotification({
        userId: data.receiverId,
        type: "message",
        title: "New Message",
        message: "You have a new message",
        relatedId: message.id,
      });

      res.json(message);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/messages/:id/read", async (req, res) => {
    try {
      const message = await storage.markMessageAsRead(req.params.id);
      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }
      res.json(message);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });



  // ===== Events / Calendar =====

  app.get("/api/events", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        return res.status(400).json({ message: "userId is required" });
      }

      const events = await storage.getEventsByUser(userId);
      res.json(events);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/events", async (req, res) => {
    try {
      const data = insertEventSchema.parse(req.body);
      const event = await storage.createEvent(data);

      // Create notification for partner
      await storage.createNotification({
        userId: data.partnerId,
        type: "reminder",
        title: "New Session Scheduled",
        message: `You have a new session: ${data.title}`,
        relatedId: event.id,
      });

      res.json(event);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/events/:id", async (req, res) => {
    try {
      const validatedData = updateEventSchema.parse(req.body);
      const event = await storage.updateEvent(req.params.id, validatedData);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      res.json(event);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/events/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteEvent(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Event not found" });
      }
      res.json({ message: "Event deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ===== Reviews =====

  app.get("/api/reviews/:userId", async (req, res) => {
    try {
      const reviews = await storage.getReviewsByUser(req.params.userId);

      // Enrich reviews with reviewer details
      const enrichedReviews = await Promise.all(
        reviews.map(async (review) => {
          const reviewer = await storage.getUser(review.reviewerId);
          return {
            ...review,
            reviewer: reviewer ? {
              id: reviewer.id,
              username: reviewer.username,
              fullName: reviewer.fullName,
              avatarUrl: reviewer.avatarUrl,
            } : null,
          };
        })
      );

      res.json(enrichedReviews);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/reviews", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const data = insertReviewSchema.parse(req.body);
      
      // Moderate review content if comment is provided
      if (data.comment) {
        const moderationResult = await ContentModerationService.moderateText(data.comment, 'review');
        
        if (!moderationResult.isApproved) {
          // Track user behavior for inappropriate review
          await ContentModerationService.trackUserBehavior(
            req.user!.userId,
            'inappropriate_review',
            moderationResult.flags.includes('profanity') || moderationResult.flags.includes('harassment') ? 'high' : 'medium',
            {
              flags: moderationResult.flags,
              rating: data.rating,
              reviewedUserId: data.userId
            }
          );

          return res.status(400).json({
            code: 'CONTENT_REJECTED',
            message: 'Review content violates community guidelines',
            reason: moderationResult.reason,
            flags: moderationResult.flags
          });
        }
      }

      const review = await storage.createReview(data);

      // Create notification for reviewed user
      await storage.createNotification({
        userId: data.userId,
        type: "review",
        title: "New Review",
        message: `You received a ${data.rating}-star review`,
        relatedId: review.id,
      });

      res.json(review);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ===== Notifications =====

  app.get("/api/notifications", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        return res.status(400).json({ message: "userId is required" });
      }

      const notifications = await storage.getNotificationsByUser(userId);
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/notifications/:id/read", async (req, res) => {
    try {
      const notification = await storage.markNotificationAsRead(req.params.id);
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }
      res.json(notification);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/notifications/read-all", async (req, res) => {
    try {
      const userId = req.body.userId;
      if (!userId) {
        return res.status(400).json({ message: "userId is required" });
      }

      await storage.markAllNotificationsAsRead(userId);
      res.json({ message: "All notifications marked as read" });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ===== Credits System =====

  // Get user credit balance
  app.get("/api/credits/balance", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.userId;
      const balance = await creditsService.getUserBalance(userId);

      res.json({ balance });
    } catch (error) {
      console.error("Get credit balance error:", error);
      if (error instanceof Error && error.message === 'User not found') {
        return res.status(404).json({
          code: "USER_NOT_FOUND",
          message: "User not found"
        });
      }
      res.status(500).json({
        code: "INTERNAL_ERROR",
        message: "Internal server error"
      });
    }
  });

  // Purchase credits
  app.post("/api/credits/purchase", rateLimiters.payment, authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.userId;
      const data = purchaseCreditsSchema.parse(req.body);

      const transaction = await creditsService.purchaseCredits(
        userId,
        data.amount,
        data.paymentMethodId
      );

      // Get updated balance
      const newBalance = await creditsService.getUserBalance(userId);

      res.status(201).json({
        transaction,
        newBalance,
      });
    } catch (error) {
      console.error("Purchase credits error:", error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          code: "VALIDATION_ERROR",
          message: "Invalid data",
          errors: error.errors
        });
      }

      if (error instanceof Error) {
        if (error.message === 'User not found') {
          return res.status(404).json({
            code: "USER_NOT_FOUND",
            message: "User not found"
          });
        }
        if (error.message === 'Payment processing failed') {
          return res.status(400).json({
            code: "PAYMENT_FAILED",
            message: "Payment processing failed"
          });
        }
        if (error.message === 'Credit amount must be positive') {
          return res.status(400).json({
            code: "INVALID_AMOUNT",
            message: "Credit amount must be positive"
          });
        }
      }

      res.status(500).json({
        code: "INTERNAL_ERROR",
        message: "Internal server error"
      });
    }
  });

  // Get transaction history
  app.get("/api/credits/transactions", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.userId;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;

      // Validate limit parameter
      if (limit !== undefined && (isNaN(limit) || limit < 1 || limit > 100)) {
        return res.status(400).json({
          code: "INVALID_LIMIT",
          message: "Limit must be a number between 1 and 100"
        });
      }

      const transactions = await creditsService.getTransactionHistory(userId, limit);

      res.json({ transactions });
    } catch (error) {
      console.error("Get transaction history error:", error);
      res.status(500).json({
        code: "INTERNAL_ERROR",
        message: "Internal server error"
      });
    }
  });

  // ===== Subscription System =====

  // Create a new subscription
  app.post("/api/subscriptions", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.userId;
      const data = createSubscriptionSchema.parse(req.body);

      const subscription = await subscriptionService.getInstance().createSubscription(
        userId,
        data.planType,
        data.paymentMethodId
      );

      res.status(201).json(subscription);
    } catch (error: any) {
      console.error("Create subscription error:", error);

      if (error.message === 'User not found') {
        res.status(404).json({
          code: "USER_NOT_FOUND",
          message: "User not found"
        });
      } else if (error.message === 'User already has an active subscription') {
        res.status(409).json({
          code: "SUBSCRIPTION_EXISTS",
          message: "User already has an active subscription"
        });
      } else if (error.message === 'Invalid plan type') {
        res.status(400).json({
          code: "INVALID_PLAN_TYPE",
          message: "Invalid plan type"
        });
      } else if (error.message === 'Failed to create subscription') {
        res.status(402).json({
          code: "PAYMENT_FAILED",
          message: "Failed to process payment"
        });
      } else {
        res.status(500).json({
          code: "INTERNAL_ERROR",
          message: "Internal server error"
        });
      }
    }
  });

  // Cancel subscription
  app.put("/api/subscriptions/cancel", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.userId;

      const subscription = await subscriptionService.getInstance().cancelSubscription(userId);

      res.json(subscription);
    } catch (error: any) {
      console.error("Cancel subscription error:", error);

      if (error.message === 'No subscription found for user') {
        res.status(404).json({
          code: "SUBSCRIPTION_NOT_FOUND",
          message: "No subscription found for user"
        });
      } else if (error.message === 'Subscription is already cancelled') {
        res.status(409).json({
          code: "SUBSCRIPTION_ALREADY_CANCELLED",
          message: "Subscription is already cancelled"
        });
      } else if (error.message === 'Failed to cancel subscription') {
        res.status(500).json({
          code: "CANCELLATION_FAILED",
          message: "Failed to cancel subscription"
        });
      } else {
        res.status(500).json({
          code: "INTERNAL_ERROR",
          message: "Internal server error"
        });
      }
    }
  });

  // Get subscription status
  app.get("/api/subscriptions/status", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.userId;

      const status = await subscriptionService.getInstance().checkSubscriptionStatus(userId);

      res.json(status);
    } catch (error) {
      console.error("Get subscription status error:", error);
      res.status(500).json({
        code: "INTERNAL_ERROR",
        message: "Internal server error"
      });
    }
  });

  // Update subscription plan
  app.put("/api/subscriptions/plan", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.userId;
      const data = updateSubscriptionSchema.parse(req.body);

      const subscription = await subscriptionService.getInstance().updateSubscription(
        userId,
        data.planType
      );

      res.json(subscription);
    } catch (error: any) {
      console.error("Update subscription error:", error);

      if (error.message === 'No subscription found for user') {
        res.status(404).json({
          code: "SUBSCRIPTION_NOT_FOUND",
          message: "No subscription found for user"
        });
      } else if (error.message === 'User is already on this plan') {
        res.status(409).json({
          code: "ALREADY_ON_PLAN",
          message: "User is already on this plan"
        });
      } else if (error.message === 'Invalid plan type') {
        res.status(400).json({
          code: "INVALID_PLAN_TYPE",
          message: "Invalid plan type"
        });
      } else if (error.message === 'Failed to update subscription') {
        res.status(500).json({
          code: "UPDATE_FAILED",
          message: "Failed to update subscription"
        });
      } else {
        res.status(500).json({
          code: "INTERNAL_ERROR",
          message: "Internal server error"
        });
      }
    }
  });

  // Stripe webhook endpoint for subscription events
  app.post("/api/subscriptions/webhook", async (req, res) => {
    try {
      const signature = req.headers['stripe-signature'] as string;

      if (!signature) {
        res.status(400).json({
          code: "MISSING_SIGNATURE",
          message: "Missing Stripe signature"
        });
        return;
      }

      // In a real implementation, you would verify the webhook signature here
      // For now, we'll just process the event
      const event = req.body;

      await subscriptionService.getInstance().handleWebhook(event);

      res.json({ received: true });
    } catch (error) {
      console.error("Webhook error:", error);
      res.status(400).json({
        code: "WEBHOOK_ERROR",
        message: "Error processing webhook"
      });
    }
  });

  // ===== Session Management =====

  // Schedule a new session
  app.post("/api/sessions/schedule", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { matchId, ...sessionData } = scheduleSessionSchema.parse(req.body);
      
      // Validate that the user is either the teacher or student in the session
      const userId = req.user!.userId;
      if (sessionData.teacherId !== userId && sessionData.studentId !== userId) {
        return res.status(403).json({ 
          code: "UNAUTHORIZED_SESSION_ACCESS",
          message: "You can only schedule sessions where you are either the teacher or student" 
        });
      }

      const session = await sessionService.scheduleSession(matchId, sessionData);
      res.status(201).json(session);
    } catch (error) {
      console.error('Error scheduling session:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          code: "VALIDATION_ERROR",
          message: "Invalid input", 
          errors: error.errors 
        });
      }
      if (error instanceof Error) {
        if (error.message === 'Match not found') {
          return res.status(404).json({
            code: "MATCH_NOT_FOUND",
            message: "Match not found"
          });
        }
        if (error.message === 'Match must be accepted before scheduling a session') {
          return res.status(400).json({
            code: "MATCH_NOT_ACCEPTED",
            message: "Match must be accepted before scheduling a session"
          });
        }
        if (error.message === 'Student has insufficient credits for this session') {
          return res.status(400).json({
            code: "INSUFFICIENT_CREDITS",
            message: "Student has insufficient credits for this session"
          });
        }
        if (error.message.includes('scheduling conflict')) {
          return res.status(409).json({
            code: "SCHEDULING_CONFLICT",
            message: error.message
          });
        }
        return res.status(400).json({ 
          code: "SESSION_ERROR",
          message: error.message 
        });
      }
      res.status(500).json({ 
        code: "INTERNAL_ERROR",
        message: "Internal server error" 
      });
    }
  });

  // Start a session
  app.post("/api/sessions/:id/start", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const sessionId = req.params.id;
      const userId = req.user!.userId;

      // Get session to verify user is a participant
      const session = await sessionService.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ 
          code: "SESSION_NOT_FOUND",
          message: "Session not found" 
        });
      }

      if (session.teacherId !== userId && session.studentId !== userId) {
        return res.status(403).json({ 
          code: "UNAUTHORIZED_SESSION_ACCESS",
          message: "You can only start sessions where you are a participant" 
        });
      }

      const result = await sessionService.startSession(sessionId);
      res.json(result);
    } catch (error) {
      console.error('Error starting session:', error);
      if (error instanceof Error) {
        if (error.message === 'Session is not in scheduled status') {
          return res.status(400).json({
            code: "INVALID_SESSION_STATUS",
            message: "Session is not in scheduled status"
          });
        }
        if (error.message.includes('can only be started within')) {
          return res.status(400).json({
            code: "INVALID_START_TIME",
            message: error.message
          });
        }
        return res.status(400).json({ 
          code: "SESSION_ERROR",
          message: error.message 
        });
      }
      res.status(500).json({ 
        code: "INTERNAL_ERROR",
        message: "Internal server error" 
      });
    }
  });

  // Complete a session
  app.put("/api/sessions/:id/complete", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const sessionId = req.params.id;
      const userId = req.user!.userId;
      const { notes } = req.body;

      // Get session to verify user is a participant
      const session = await sessionService.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ 
          code: "SESSION_NOT_FOUND",
          message: "Session not found" 
        });
      }

      if (session.teacherId !== userId && session.studentId !== userId) {
        return res.status(403).json({ 
          code: "UNAUTHORIZED_SESSION_ACCESS",
          message: "You can only complete sessions where you are a participant" 
        });
      }

      // Validate notes if provided
      if (notes && typeof notes !== 'string') {
        return res.status(400).json({ 
          code: "INVALID_NOTES",
          message: "Notes must be a string" 
        });
      }

      if (notes && notes.length > 2000) {
        return res.status(400).json({ 
          code: "NOTES_TOO_LONG",
          message: "Notes cannot exceed 2000 characters" 
        });
      }

      const updatedSession = await sessionService.endSession(sessionId, notes);
      res.json(updatedSession);
    } catch (error) {
      console.error('Error completing session:', error);
      if (error instanceof Error) {
        if (error.message === 'Session is not in progress') {
          return res.status(400).json({
            code: "INVALID_SESSION_STATUS",
            message: "Session is not in progress"
          });
        }
        return res.status(400).json({ 
          code: "SESSION_ERROR",
          message: error.message 
        });
      }
      res.status(500).json({ 
        code: "INTERNAL_ERROR",
        message: "Internal server error" 
      });
    }
  });

  // Cancel a session
  app.put("/api/sessions/:id/cancel", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const sessionId = req.params.id;
      const userId = req.user!.userId;
      const { reason } = req.body;

      // Get session to verify user is a participant
      const session = await sessionService.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ 
          code: "SESSION_NOT_FOUND",
          message: "Session not found" 
        });
      }

      if (session.teacherId !== userId && session.studentId !== userId) {
        return res.status(403).json({ 
          code: "UNAUTHORIZED_SESSION_ACCESS",
          message: "You can only cancel sessions where you are a participant" 
        });
      }

      if (!reason || typeof reason !== 'string') {
        return res.status(400).json({ 
          code: "MISSING_REASON",
          message: "Cancellation reason is required" 
        });
      }

      if (reason.length > 500) {
        return res.status(400).json({ 
          code: "REASON_TOO_LONG",
          message: "Reason cannot exceed 500 characters" 
        });
      }

      await sessionService.cancelSession(sessionId, reason);
      res.json({ message: "Session cancelled successfully" });
    } catch (error) {
      console.error('Error cancelling session:', error);
      if (error instanceof Error) {
        if (error.message.includes('Cannot cancel a session')) {
          return res.status(400).json({
            code: "CANNOT_CANCEL_SESSION",
            message: error.message
          });
        }
        return res.status(400).json({ 
          code: "SESSION_ERROR",
          message: error.message 
        });
      }
      res.status(500).json({ 
        code: "INTERNAL_ERROR",
        message: "Internal server error" 
      });
    }
  });

  // Get upcoming sessions for the authenticated user
  app.get("/api/sessions/upcoming", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.userId;
      const sessions = await sessionService.getUpcomingSessions(userId);
      res.json(sessions);
    } catch (error) {
      console.error('Error fetching upcoming sessions:', error);
      res.status(500).json({ 
        code: "INTERNAL_ERROR",
        message: "Internal server error" 
      });
    }
  });

  // Get session history for the authenticated user
  app.get("/api/sessions/history", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.userId;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      
      if (limit !== undefined && (isNaN(limit) || limit < 1 || limit > 100)) {
        return res.status(400).json({ 
          code: "INVALID_LIMIT",
          message: "Limit must be a number between 1 and 100" 
        });
      }

      let sessions = await sessionService.getSessionHistory(userId);
      
      if (limit) {
        sessions = sessions.slice(0, limit);
      }

      res.json(sessions);
    } catch (error) {
      console.error('Error fetching session history:', error);
      res.status(500).json({ 
        code: "INTERNAL_ERROR",
        message: "Internal server error" 
      });
    }
  });

  // Get a specific session by ID
  app.get("/api/sessions/:id", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const sessionId = req.params.id;
      const userId = req.user!.userId;

      const session = await sessionService.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ 
          code: "SESSION_NOT_FOUND",
          message: "Session not found" 
        });
      }

      // Only allow participants to view session details
      if (session.teacherId !== userId && session.studentId !== userId) {
        return res.status(403).json({ 
          code: "UNAUTHORIZED_SESSION_ACCESS",
          message: "You can only view sessions where you are a participant" 
        });
      }

      res.json(session);
    } catch (error) {
      console.error('Error fetching session:', error);
      res.status(500).json({ 
        code: "INTERNAL_ERROR",
        message: "Internal server error" 
      });
    }
  });

  // ===== Recommendation System =====

  // Get personalized skill recommendations
  app.get("/api/recommendations/skills", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.userId;
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

  // Get user recommendations for a specific skill
  app.get("/api/recommendations/users", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.userId;
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

  // Record user interaction with recommendations
  app.post("/api/recommendations/feedback", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.userId;
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

  // Get recommendation history
  app.get("/api/recommendations/history", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.userId;
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

  // Update user preferences for recommendations
  app.put("/api/recommendations/preferences", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.userId;
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

  // Get recommendation analytics
  app.get("/api/recommendations/analytics", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.userId;

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

  // ===== Payment Processing =====

  // Add a new payment method
  app.post("/api/payments/methods", rateLimiters.payment, authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.userId;
      const data = addPaymentMethodSchema.parse(req.body);

      const paymentMethod = await paymentService.addPaymentMethod(
        userId,
        data.stripePaymentMethodId
      );

      res.status(201).json({
        paymentMethod,
        message: "Payment method added successfully"
      });
    } catch (error) {
      console.error("Add payment method error:", error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          code: "VALIDATION_ERROR",
          message: "Invalid data",
          errors: error.errors
        });
      }

      if (error instanceof Error) {
        if (error.message === 'User not found') {
          return res.status(404).json({
            code: "USER_NOT_FOUND",
            message: "User not found"
          });
        }
        if (error.message.includes('Payment method not found')) {
          return res.status(400).json({
            code: "INVALID_PAYMENT_METHOD",
            message: "Invalid payment method ID"
          });
        }
        if (error.message.includes('Failed to add payment method')) {
          return res.status(400).json({
            code: "PAYMENT_METHOD_ERROR",
            message: error.message
          });
        }
      }

      res.status(500).json({
        code: "INTERNAL_ERROR",
        message: "Internal server error"
      });
    }
  });

  // Get all payment methods for user
  app.get("/api/payments/methods", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.userId;
      const paymentMethods = await paymentService.getUserPaymentMethods(userId);

      res.json({
        paymentMethods,
        count: paymentMethods.length
      });
    } catch (error) {
      console.error("Get payment methods error:", error);
      res.status(500).json({
        code: "INTERNAL_ERROR",
        message: "Internal server error"
      });
    }
  });

  // Set default payment method
  app.put("/api/payments/methods/:id/default", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.userId;
      const paymentMethodId = req.params.id;

      if (!paymentMethodId) {
        return res.status(400).json({
          code: "MISSING_PAYMENT_METHOD_ID",
          message: "Payment method ID is required"
        });
      }

      const paymentMethod = await paymentService.setDefaultPaymentMethod(userId, paymentMethodId);

      res.json({
        paymentMethod,
        message: "Default payment method updated successfully"
      });
    } catch (error) {
      console.error("Set default payment method error:", error);

      if (error instanceof Error && error.message === 'Payment method not found') {
        return res.status(404).json({
          code: "PAYMENT_METHOD_NOT_FOUND",
          message: "Payment method not found"
        });
      }

      res.status(500).json({
        code: "INTERNAL_ERROR",
        message: "Internal server error"
      });
    }
  });

  // Remove payment method
  app.delete("/api/payments/methods/:id", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.userId;
      const paymentMethodId = req.params.id;

      if (!paymentMethodId) {
        return res.status(400).json({
          code: "MISSING_PAYMENT_METHOD_ID",
          message: "Payment method ID is required"
        });
      }

      await paymentService.removePaymentMethod(userId, paymentMethodId);

      res.json({
        message: "Payment method removed successfully"
      });
    } catch (error) {
      console.error("Remove payment method error:", error);

      if (error instanceof Error) {
        if (error.message === 'Payment method not found') {
          return res.status(404).json({
            code: "PAYMENT_METHOD_NOT_FOUND",
            message: "Payment method not found"
          });
        }
        if (error.message.includes('Failed to remove payment method')) {
          return res.status(400).json({
            code: "PAYMENT_METHOD_ERROR",
            message: error.message
          });
        }
      }

      res.status(500).json({
        code: "INTERNAL_ERROR",
        message: "Internal server error"
      });
    }
  });

  // Create setup intent for adding payment methods
  app.post("/api/payments/setup-intent", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.userId;
      const setupIntent = await paymentService.createSetupIntent(userId);

      res.json(setupIntent);
    } catch (error) {
      console.error("Create setup intent error:", error);

      if (error instanceof Error) {
        if (error.message === 'User not found') {
          return res.status(404).json({
            code: "USER_NOT_FOUND",
            message: "User not found"
          });
        }
        if (error.message.includes('Failed to create setup intent')) {
          return res.status(400).json({
            code: "SETUP_INTENT_ERROR",
            message: error.message
          });
        }
      }

      res.status(500).json({
        code: "INTERNAL_ERROR",
        message: "Internal server error"
      });
    }
  });

  // Process payment
  app.post("/api/payments/process", rateLimiters.payment, authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.userId;
      const data = processPaymentSchema.parse(req.body);

      const paymentResult = await paymentService.processPayment(
        userId,
        data.amount,
        data.description,
        data.paymentMethodId
      );

      res.status(201).json({
        payment: paymentResult,
        message: "Payment processed successfully"
      });
    } catch (error) {
      console.error("Process payment error:", error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          code: "VALIDATION_ERROR",
          message: "Invalid data",
          errors: error.errors
        });
      }

      if (error instanceof Error) {
        if (error.message === 'User not found') {
          return res.status(404).json({
            code: "USER_NOT_FOUND",
            message: "User not found"
          });
        }
        if (error.message === 'Payment amount must be positive') {
          return res.status(400).json({
            code: "INVALID_AMOUNT",
            message: "Payment amount must be positive"
          });
        }
        if (error.message === 'No payment method available') {
          return res.status(400).json({
            code: "NO_PAYMENT_METHOD",
            message: "No payment method available. Please add a payment method first."
          });
        }
        if (error.message.includes('Payment processing failed')) {
          return res.status(402).json({
            code: "PAYMENT_FAILED",
            message: "Payment processing failed. Please check your payment method."
          });
        }
      }

      res.status(500).json({
        code: "INTERNAL_ERROR",
        message: "Internal server error"
      });
    }
  });

  // Get payment history
  app.get("/api/payments/history", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.userId;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;

      // Validate limit parameter
      if (limit !== undefined && (isNaN(limit) || limit < 1 || limit > 100)) {
        return res.status(400).json({
          code: "INVALID_LIMIT",
          message: "Limit must be a number between 1 and 100"
        });
      }

      const payments = await paymentService.getPaymentHistory(userId, limit);

      res.json({
        payments,
        count: payments.length
      });
    } catch (error) {
      console.error("Get payment history error:", error);

      if (error instanceof Error && error.message === 'User not found') {
        return res.status(404).json({
          code: "USER_NOT_FOUND",
          message: "User not found"
        });
      }

      res.status(500).json({
        code: "INTERNAL_ERROR",
        message: "Internal server error"
      });
    }
  });

  // Process refund
  app.post("/api/payments/refund", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const data = refundPaymentSchema.parse(req.body);
      const paymentId = req.query.paymentId as string;

      if (!paymentId) {
        return res.status(400).json({
          code: "MISSING_PAYMENT_ID",
          message: "Payment ID is required as query parameter"
        });
      }

      const refundResult = await paymentService.handleRefund(
        paymentId,
        data.amount,
        data.reason
      );

      res.status(201).json({
        refund: refundResult,
        message: "Refund processed successfully"
      });
    } catch (error) {
      console.error("Process refund error:", error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          code: "VALIDATION_ERROR",
          message: "Invalid data",
          errors: error.errors
        });
      }

      if (error instanceof Error) {
        if (error.message === 'Payment not found') {
          return res.status(404).json({
            code: "PAYMENT_NOT_FOUND",
            message: "Payment not found"
          });
        }
        if (error.message === 'Can only refund successful payments') {
          return res.status(400).json({
            code: "INVALID_PAYMENT_STATUS",
            message: "Can only refund successful payments"
          });
        }
        if (error.message === 'Refund amount cannot exceed original payment amount') {
          return res.status(400).json({
            code: "INVALID_REFUND_AMOUNT",
            message: "Refund amount cannot exceed original payment amount"
          });
        }
        if (error.message.includes('Refund processing failed')) {
          return res.status(400).json({
            code: "REFUND_FAILED",
            message: "Refund processing failed. Please try again later."
          });
        }
      }

      res.status(500).json({
        code: "INTERNAL_ERROR",
        message: "Internal server error"
      });
    }
  });

  // Handle Stripe webhooks
  app.post("/api/payments/webhook", async (req, res) => {
    try {
      const signature = req.headers['stripe-signature'] as string;
      
      if (!signature) {
        return res.status(400).json({
          code: "MISSING_SIGNATURE",
          message: "Missing Stripe signature"
        });
      }

      // Validate webhook signature and construct event
      const event = paymentService.validateWebhookSignature(
        req.body,
        signature
      );

      // Handle the webhook event
      await paymentService.handleWebhook(event);

      res.json({ received: true });
    } catch (error) {
      console.error("Webhook error:", error);

      if (error instanceof Error && error.message === 'Invalid webhook signature') {
        return res.status(400).json({
          code: "INVALID_SIGNATURE",
          message: "Invalid webhook signature"
        });
      }

      res.status(500).json({
        code: "WEBHOOK_ERROR",
        message: "Webhook processing failed"
      });
    }
  });

  // ===== Real-time Communication and Notifications =====

  // Get notification preferences
  app.get("/api/notifications/preferences", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.userId;
      const preferences = await notificationService.getUserNotificationPreferences(userId);
      res.json(preferences);
    } catch (error) {
      console.error("Get notification preferences error:", error);
      res.status(500).json({
        code: "INTERNAL_ERROR",
        message: "Internal server error"
      });
    }
  });

  // Update notification preferences
  app.put("/api/notifications/preferences", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.userId;
      const preferences = req.body;

      // Validate preferences
      const allowedFields = [
        'emailNotifications',
        'pushNotifications', 
        'sessionReminders',
        'messageNotifications',
        'matchNotifications',
        'courseNotifications',
        'marketingEmails'
      ];

      const validatedPreferences: any = {};
      for (const [key, value] of Object.entries(preferences)) {
        if (allowedFields.includes(key) && typeof value === 'boolean') {
          validatedPreferences[key] = value;
        }
      }

      const updatedPreferences = await notificationService.updateNotificationPreferences(
        userId, 
        validatedPreferences
      );

      res.json(updatedPreferences);
    } catch (error) {
      console.error("Update notification preferences error:", error);
      res.status(500).json({
        code: "INTERNAL_ERROR",
        message: "Internal server error"
      });
    }
  });

  // Send test notification (for testing purposes)
  app.post("/api/notifications/test", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.userId;
      
      await notificationService.createNotification({
        userId,
        type: 'test',
        title: 'Test Notification',
        message: 'This is a test notification to verify the system is working correctly.'
      });

      res.json({ message: "Test notification sent successfully" });
    } catch (error) {
      console.error("Send test notification error:", error);
      res.status(500).json({
        code: "INTERNAL_ERROR",
        message: "Internal server error"
      });
    }
  });

  // Get WebSocket connection info
  app.get("/api/websocket/info", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.userId;
      const webSocketService = require('./services/websocket').getWebSocketService();
      
      const connectionInfo = {
        isOnline: webSocketService ? webSocketService.isUserOnline(userId) : false,
        socketCount: webSocketService ? webSocketService.getUserSocketCount(userId) : 0,
        onlineUsers: webSocketService ? webSocketService.getOnlineUsers().length : 0
      };

      res.json(connectionInfo);
    } catch (error) {
      console.error("Get WebSocket info error:", error);
      res.status(500).json({
        code: "INTERNAL_ERROR",
        message: "Internal server error"
      });
    }
  });

  // ===== Health Check =====

  // Health check endpoint
  app.get("/health", async (req, res) => {
    try {
      // Basic health check
      const healthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env.npm_package_version || '1.0.0',
      };

      res.json(healthStatus);
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Detailed health check endpoint
  app.get("/health/detailed", async (req, res) => {
    try {
      const { createHealthCheckEndpoint } = await import('./scripts/health-check');
      const healthCheckHandler = createHealthCheckEndpoint();
      await healthCheckHandler(req, res);
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check service unavailable',
      });
    }
  });

  // ===== Push Notification Management =====

  // Get user's push tokens
  app.get("/api/push-tokens", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.userId;
      const tokens = await storage.getUserPushTokens(userId);
      res.json({ tokens });
    } catch (error) {
      console.error("Get push tokens error:", error);
      res.status(500).json({
        code: "INTERNAL_ERROR",
        message: "Internal server error"
      });
    }
  });

  // Add a new push token
  app.post("/api/push-tokens", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.userId;
      const { token, platform } = req.body;

      if (!token || !platform) {
        return res.status(400).json({
          code: "MISSING_FIELDS",
          message: "Token and platform are required"
        });
      }

      if (!['web', 'ios', 'android'].includes(platform)) {
        return res.status(400).json({
          code: "INVALID_PLATFORM",
          message: "Platform must be one of: web, ios, android"
        });
      }

      // Check if token already exists for this user
      const existingTokens = await storage.getUserPushTokens(userId);
      const existingToken = existingTokens.find(t => t.token === token);
      
      if (existingToken) {
        return res.json({ token: existingToken, message: "Token already exists" });
      }

      const newToken = await storage.addPushToken({
        userId,
        token,
        platform
      });

      res.status(201).json({ token: newToken, message: "Push token added successfully" });
    } catch (error) {
      console.error("Add push token error:", error);
      res.status(500).json({
        code: "INTERNAL_ERROR",
        message: "Internal server error"
      });
    }
  });

  // Remove a push token
  app.delete("/api/push-tokens/:tokenId", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.userId;
      const tokenId = req.params.tokenId;

      const success = await storage.removePushToken(userId, tokenId);
      
      if (!success) {
        return res.status(404).json({
          code: "TOKEN_NOT_FOUND",
          message: "Push token not found"
        });
      }

      res.json({ message: "Push token removed successfully" });
    } catch (error) {
      console.error("Remove push token error:", error);
      res.status(500).json({
        code: "INTERNAL_ERROR",
        message: "Internal server error"
      });
    }
  });

  // ===== Analytics and Dashboard =====

  // Get user dashboard analytics
  app.get("/api/analytics/dashboard", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.userId;
      const analytics = await analyticsService.getUserAnalytics(userId);
      res.json(analytics);
    } catch (error) {
      console.error('Error fetching user analytics:', error);
      if (error instanceof Error) {
        return res.status(400).json({ 
          code: "ANALYTICS_ERROR",
          message: error.message 
        });
      }
      res.status(500).json({ 
        code: "INTERNAL_ERROR",
        message: "Internal server error" 
      });
    }
  });

  // Get skill analytics for a user
  app.get("/api/analytics/skills", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.userId;
      const skillId = req.query.skillId as string | undefined;
      
      const skillAnalytics = await analyticsService.getSkillAnalytics(userId, skillId);
      res.json(skillAnalytics);
    } catch (error) {
      console.error('Error fetching skill analytics:', error);
      if (error instanceof Error) {
        return res.status(400).json({ 
          code: "ANALYTICS_ERROR",
          message: error.message 
        });
      }
      res.status(500).json({ 
        code: "INTERNAL_ERROR",
        message: "Internal server error" 
      });
    }
  });

  // Get teaching analytics for a user
  app.get("/api/analytics/teaching", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.userId;
      const teachingAnalytics = await analyticsService.getTeachingAnalytics(userId);
      res.json(teachingAnalytics);
    } catch (error) {
      console.error('Error fetching teaching analytics:', error);
      if (error instanceof Error) {
        return res.status(400).json({ 
          code: "ANALYTICS_ERROR",
          message: error.message 
        });
      }
      res.status(500).json({ 
        code: "INTERNAL_ERROR",
        message: "Internal server error" 
      });
    }
  });

  // Get user badges
  app.get("/api/analytics/badges", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.userId;
      const badges = await analyticsService.getUserBadges(userId);
      res.json(badges);
    } catch (error) {
      console.error('Error fetching user badges:', error);
      if (error instanceof Error) {
        return res.status(400).json({ 
          code: "ANALYTICS_ERROR",
          message: error.message 
        });
      }
      res.status(500).json({ 
        code: "INTERNAL_ERROR",
        message: "Internal server error" 
      });
    }
  });

  // Get all available badges
  app.get("/api/analytics/badges/available", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const badges = await analyticsService.getAvailableBadges();
      res.json(badges);
    } catch (error) {
      console.error('Error fetching available badges:', error);
      res.status(500).json({ 
        code: "INTERNAL_ERROR",
        message: "Internal server error" 
      });
    }
  });

  // Check and award new badges for a user
  app.post("/api/analytics/badges/check", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.userId;
      const newBadges = await analyticsService.checkAndAwardBadges(userId);
      res.json({ newBadges });
    } catch (error) {
      console.error('Error checking badges:', error);
      if (error instanceof Error) {
        return res.status(400).json({ 
          code: "ANALYTICS_ERROR",
          message: error.message 
        });
      }
      res.status(500).json({ 
        code: "INTERNAL_ERROR",
        message: "Internal server error" 
      });
    }
  });

  // Get learning streak information
  app.get("/api/analytics/streak", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.userId;
      const streak = await analyticsService.updateLearningStreak(userId);
      res.json(streak);
    } catch (error) {
      console.error('Error fetching learning streak:', error);
      if (error instanceof Error) {
        return res.status(400).json({ 
          code: "ANALYTICS_ERROR",
          message: error.message 
        });
      }
      res.status(500).json({ 
        code: "INTERNAL_ERROR",
        message: "Internal server error" 
      });
    }
  });

  // Get activity summary for a specified period
  app.get("/api/analytics/activity", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.userId;
      const days = req.query.days ? parseInt(req.query.days as string) : 30;
      
      if (isNaN(days) || days <= 0 || days > 365) {
        return res.status(400).json({ 
          code: "INVALID_PARAMETER",
          message: "Days must be a number between 1 and 365" 
        });
      }
      
      const activity = await analyticsService.getActivitySummary(userId, days);
      res.json(activity);
    } catch (error) {
      console.error('Error fetching activity summary:', error);
      if (error instanceof Error) {
        return res.status(400).json({ 
          code: "ANALYTICS_ERROR",
          message: error.message 
        });
      }
      res.status(500).json({ 
        code: "INTERNAL_ERROR",
        message: "Internal server error" 
      });
    }
  });

  // Get teaching effectiveness score
  app.get("/api/analytics/teaching/effectiveness", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.userId;
      const effectiveness = await analyticsService.calculateTeachingEffectiveness(userId);
      res.json({ effectiveness });
    } catch (error) {
      console.error('Error calculating teaching effectiveness:', error);
      if (error instanceof Error) {
        return res.status(400).json({ 
          code: "ANALYTICS_ERROR",
          message: error.message 
        });
      }
      res.status(500).json({ 
        code: "INTERNAL_ERROR",
        message: "Internal server error" 
      });
    }
  });

  // Export analytics report (JSON format)
  app.get("/api/analytics/export", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.userId;
      const format = req.query.format as string || 'json';
      
      if (format !== 'json') {
        return res.status(400).json({ 
          code: "INVALID_FORMAT",
          message: "Only JSON format is currently supported" 
        });
      }
      
      // Gather comprehensive analytics data
      const [
        userAnalytics,
        skillAnalytics,
        teachingAnalytics,
        badges,
        streak,
        activity30Days,
        activity90Days
      ] = await Promise.all([
        analyticsService.getUserAnalytics(userId),
        analyticsService.getSkillAnalytics(userId),
        analyticsService.getTeachingAnalytics(userId),
        analyticsService.getUserBadges(userId),
        analyticsService.updateLearningStreak(userId),
        analyticsService.getActivitySummary(userId, 30),
        analyticsService.getActivitySummary(userId, 90)
      ]);
      
      const exportData = {
        exportDate: new Date().toISOString(),
        user: userAnalytics,
        skills: skillAnalytics,
        teaching: teachingAnalytics,
        badges,
        streak,
        activity: {
          last30Days: activity30Days,
          last90Days: activity90Days
        }
      };
      
      // Set headers for file download
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="skillswap-analytics-${userId}-${new Date().toISOString().split('T')[0]}.json"`);
      
      res.json(exportData);
    } catch (error) {
      console.error('Error exporting analytics:', error);
      if (error instanceof Error) {
        return res.status(400).json({ 
          code: "ANALYTICS_ERROR",
          message: error.message 
        });
      }
      res.status(500).json({ 
        code: "INTERNAL_ERROR",
        message: "Internal server error" 
      });
    }
  });

  const httpServer = createServer(app);
  
  // Initialize WebSocket service
  initializeWebSocketService(httpServer);
  
  return httpServer;
}
