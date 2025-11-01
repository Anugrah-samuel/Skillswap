import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, type AuthenticatedRequest } from './auth';
import { rateLimiters } from './middleware/rateLimiting';
import { 
  apiVersioning, 
  paginationMiddleware, 
  mobileResponseFormatter,
  offlineSyncSupport,
  deviceTokenSchema,
  pushNotificationSchema,
  syncRequestSchema
} from './middleware/mobile';
import { MobileOptimizationService } from './services/mobileOptimization';
import { PushNotificationService } from './services/pushNotifications';
import { NotificationManagerService } from './services/notificationManager';

const router = Router();

// Apply mobile-specific middleware
router.use(apiVersioning);
router.use(mobileResponseFormatter);
router.use(offlineSyncSupport);

// ===== Mobile Dashboard =====

// Get mobile-optimized dashboard
router.get('/dashboard', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const dashboard = await MobileOptimizationService.getMobileDashboard(userId);
    
    res.json({
      success: true,
      data: dashboard,
      version: (req as any).apiVersion
    });
  } catch (error) {
    console.error('Mobile dashboard error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load dashboard'
    });
  }
});

// ===== Paginated Data Endpoints =====

// Get paginated skills
router.get('/skills', authenticateToken, paginationMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { page, limit } = (req as any).pagination;
    
    const result = await MobileOptimizationService.getOptimizedSkills(userId, page, limit);
    
    res.json({
      success: true,
      ...result,
      version: (req as any).apiVersion
    });
  } catch (error) {
    console.error('Mobile skills error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load skills'
    });
  }
});

// Get paginated matches
router.get('/matches', authenticateToken, paginationMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { page, limit } = (req as any).pagination;
    
    const result = await MobileOptimizationService.getOptimizedMatches(userId, page, limit);
    
    res.json({
      success: true,
      ...result,
      version: (req as any).apiVersion
    });
  } catch (error) {
    console.error('Mobile matches error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load matches'
    });
  }
});

// Get paginated conversations
router.get('/conversations', authenticateToken, paginationMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { page, limit } = (req as any).pagination;
    
    const result = await MobileOptimizationService.getOptimizedConversations(userId, page, limit);
    
    res.json({
      success: true,
      ...result,
      version: (req as any).apiVersion
    });
  } catch (error) {
    console.error('Mobile conversations error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load conversations'
    });
  }
});

// Get paginated notifications
router.get('/notifications', authenticateToken, paginationMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { page, limit } = (req as any).pagination;
    
    const result = await MobileOptimizationService.getOptimizedNotifications(userId, page, limit);
    
    res.json({
      success: true,
      ...result,
      version: (req as any).apiVersion
    });
  } catch (error) {
    console.error('Mobile notifications error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load notifications'
    });
  }
});

// ===== Mobile Search =====

// Mobile-optimized search
router.get('/search', authenticateToken, paginationMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const query = req.query.q as string;
    const type = req.query.type as 'skills' | 'users' | 'courses';
    const { page, limit } = (req as any).pagination;
    
    if (!query || !type) {
      return res.status(400).json({
        success: false,
        error: 'Query and type parameters are required'
      });
    }
    
    if (!['skills', 'users', 'courses'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Type must be one of: skills, users, courses'
      });
    }
    
    const result = await MobileOptimizationService.mobileSearch(query, type, page, limit);
    
    res.json({
      success: true,
      query,
      type,
      ...result,
      version: (req as any).apiVersion
    });
  } catch (error) {
    console.error('Mobile search error:', error);
    res.status(500).json({
      success: false,
      error: 'Search failed'
    });
  }
});

// ===== Offline Sync Support =====

// Sync data for offline support
router.post('/sync', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const data = syncRequestSchema.parse(req.body);
    
    const lastSync = new Date(data.lastSync);
    const syncResponse = await MobileOptimizationService.syncData(userId, lastSync, data.entities);
    
    res.json({
      success: true,
      data: syncResponse,
      version: (req as any).apiVersion
    });
  } catch (error) {
    console.error('Mobile sync error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid sync request',
        details: error.errors
      });
    }
    res.status(500).json({
      success: false,
      error: 'Sync failed'
    });
  }
});

// ===== Push Notifications =====

// Register device token
router.post('/device-tokens', rateLimiters.auth, authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const data = deviceTokenSchema.parse(req.body);
    
    const pushService = PushNotificationService.getInstance();
    const deviceToken = await pushService.registerDeviceToken(
      userId,
      data.token,
      data.platform,
      data.deviceId,
      data.appVersion
    );
    
    res.status(201).json({
      success: true,
      data: deviceToken,
      message: 'Device token registered successfully'
    });
  } catch (error) {
    console.error('Register device token error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid device token data',
        details: error.errors
      });
    }
    res.status(500).json({
      success: false,
      error: 'Failed to register device token'
    });
  }
});

// Get user's device tokens
router.get('/device-tokens', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const pushService = PushNotificationService.getInstance();
    const tokens = await pushService.getUserDeviceTokens(userId);
    
    res.json({
      success: true,
      data: tokens
    });
  } catch (error) {
    console.error('Get device tokens error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get device tokens'
    });
  }
});

// Remove device token
router.delete('/device-tokens/:tokenId', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const tokenId = req.params.tokenId;
    
    const pushService = PushNotificationService.getInstance();
    const success = await pushService.removeDeviceToken(userId, tokenId);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Device token not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Device token removed successfully'
    });
  } catch (error) {
    console.error('Remove device token error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove device token'
    });
  }
});

// Send test notification
router.post('/test-notification', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const pushService = PushNotificationService.getInstance();
    const deliveries = await pushService.sendTestNotification(userId);
    
    res.json({
      success: true,
      data: deliveries,
      message: 'Test notification sent'
    });
  } catch (error) {
    console.error('Send test notification error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send test notification'
    });
  }
});

// Get notification analytics
router.get('/notification-analytics', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const days = parseInt(req.query.days as string) || 30;
    
    const notificationManager = NotificationManagerService.getInstance();
    const analytics = await notificationManager.getNotificationStats(userId, days);
    
    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Get notification analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get notification analytics'
    });
  }
});

// Get notification preferences
router.get('/notification-preferences', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const notificationManager = NotificationManagerService.getInstance();
    const preferences = await notificationManager.getUserPreferences(userId);
    
    res.json({
      success: true,
      data: preferences
    });
  } catch (error) {
    console.error('Get notification preferences error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get notification preferences'
    });
  }
});

// Update notification preferences
router.put('/notification-preferences', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const preferences = req.body;
    
    const notificationManager = NotificationManagerService.getInstance();
    await notificationManager.updateUserPreferences(userId, preferences);
    
    res.json({
      success: true,
      message: 'Notification preferences updated successfully'
    });
  } catch (error) {
    console.error('Update notification preferences error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update notification preferences'
    });
  }
});

// Send targeted notification (admin only)
router.post('/send-notification', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { userIds, payload } = req.body;
    
    if (!userIds || !Array.isArray(userIds) || !payload) {
      return res.status(400).json({
        success: false,
        error: 'userIds array and payload are required'
      });
    }
    
    const notificationManager = NotificationManagerService.getInstance();
    await notificationManager.sendBulkNotification(userIds, payload);
    
    res.json({
      success: true,
      message: 'Notifications sent successfully'
    });
  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send notifications'
    });
  }
});

// ===== Mobile-Specific User Profile =====

// Get mobile-optimized user profile
router.get('/profile', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const profile = await MobileOptimizationService.getOptimizedUserProfile(userId);
    
    res.json({
      success: true,
      data: profile,
      version: (req as any).apiVersion
    });
  } catch (error) {
    console.error('Mobile profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load profile'
    });
  }
});

// ===== API Version Information =====

// Get API version info
router.get('/version', (req, res) => {
  res.json({
    version: (req as any).apiVersion || 'v1',
    supportedVersions: ['v1'],
    deprecatedVersions: [],
    features: {
      pagination: true,
      offlineSync: true,
      pushNotifications: true,
      mobileOptimization: true
    }
  });
});

// ===== Health Check =====

// Mobile API health check
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: (req as any).apiVersion || 'v1',
    services: {
      pushNotifications: true,
      offlineSync: true,
      mobileOptimization: true
    }
  });
});

export default router;