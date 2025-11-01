import { describe, it, expect, beforeEach } from 'vitest';
import { MobileOptimizationService } from './mobileOptimization';
import { storage } from '../storage';

describe('MobileOptimizationService', () => {
  let testUser: any;
  let testSkill: any;

  beforeEach(async () => {
    // Clear storage
    (storage as any).users.clear();
    (storage as any).skills.clear();
    (storage as any).matches.clear();
    (storage as any).messages.clear();
    (storage as any).notifications.clear();
    (storage as any).courses.clear();

    // Create test user
    testUser = await storage.createUser({
      username: 'testuser',
      email: 'test@example.com',
      password: 'hashedpassword',
      fullName: 'Test User',
      bio: 'Test bio',
      location: 'Test City',
      avatarUrl: null,
      creditBalance: 50,
      subscriptionStatus: 'basic'
    });

    // Create test skill
    testSkill = await storage.createSkill({
      userId: testUser.id,
      name: 'JavaScript',
      category: 'Programming',
      level: 'intermediate',
      description: 'JavaScript programming language with lots of details that should be truncated for mobile view because it is very long and contains more than one hundred characters which is the limit',
      isOffering: true,
      isLearning: false
    });
  });

  describe('paginate', () => {
    it('should paginate data correctly', () => {
      const data = Array.from({ length: 25 }, (_, i) => ({ id: i + 1 }));
      const result = MobileOptimizationService.paginate(data, 2, 10);

      expect(result.data).toHaveLength(10);
      expect(result.data[0].id).toBe(11);
      expect(result.pagination.page).toBe(2);
      expect(result.pagination.limit).toBe(10);
      expect(result.pagination.total).toBe(25);
      expect(result.pagination.totalPages).toBe(3);
      expect(result.pagination.hasNext).toBe(true);
      expect(result.pagination.hasPrev).toBe(true);
    });

    it('should handle first page', () => {
      const data = Array.from({ length: 15 }, (_, i) => ({ id: i + 1 }));
      const result = MobileOptimizationService.paginate(data, 1, 10);

      expect(result.pagination.hasNext).toBe(true);
      expect(result.pagination.hasPrev).toBe(false);
    });

    it('should handle last page', () => {
      const data = Array.from({ length: 15 }, (_, i) => ({ id: i + 1 }));
      const result = MobileOptimizationService.paginate(data, 2, 10);

      expect(result.data).toHaveLength(5);
      expect(result.pagination.hasNext).toBe(false);
      expect(result.pagination.hasPrev).toBe(true);
    });
  });

  describe('getOptimizedUserProfile', () => {
    it('should return optimized user profile', async () => {
      const profile = await MobileOptimizationService.getOptimizedUserProfile(testUser.id);

      expect(profile).toHaveProperty('id', testUser.id);
      expect(profile).toHaveProperty('username', testUser.username);
      expect(profile).toHaveProperty('creditBalance', testUser.creditBalance);
      expect(profile).not.toHaveProperty('password');
      expect(profile).not.toHaveProperty('email');
      expect(profile.badges).toHaveLength(0);
    });

    it('should throw error for non-existent user', async () => {
      await expect(
        MobileOptimizationService.getOptimizedUserProfile('non-existent')
      ).rejects.toThrow('User not found');
    });
  });

  describe('getOptimizedSkills', () => {
    it('should return optimized skills with pagination', async () => {
      const result = await MobileOptimizationService.getOptimizedSkills(testUser.id, 1, 10);

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toHaveProperty('id', testSkill.id);
      expect(result.data[0]).toHaveProperty('name', testSkill.name);
      expect(result.data[0].description).toContain('...');
      expect(result.data[0].description.length).toBeLessThanOrEqual(103); // 100 chars + "..."
      expect(result.pagination.total).toBe(1);
    });

    it('should handle empty skills list', async () => {
      const newUser = await storage.createUser({
        username: 'newuser',
        email: 'new@example.com',
        password: 'password',
        fullName: 'New User',
        bio: 'New user bio',
        location: 'New City',
        avatarUrl: null
      });

      const result = await MobileOptimizationService.getOptimizedSkills(newUser.id, 1, 10);

      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });
  });

  describe('getMobileDashboard', () => {
    it('should return complete dashboard data', async () => {
      const dashboard = await MobileOptimizationService.getMobileDashboard(testUser.id);

      expect(dashboard).toHaveProperty('user');
      expect(dashboard).toHaveProperty('stats');
      expect(dashboard).toHaveProperty('recentActivity');
      
      expect(dashboard.user.id).toBe(testUser.id);
      expect(dashboard.stats.totalSkills).toBe(1);
      expect(dashboard.stats.activeSkills).toBe(1);
      expect(dashboard.stats.totalMatches).toBe(0);
      expect(dashboard.stats.pendingMatches).toBe(0);
    });
  });

  describe('mobileSearch', () => {
    it('should search skills', async () => {
      const result = await MobileOptimizationService.mobileSearch('JavaScript', 'skills', 1, 10);

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toHaveProperty('name', 'JavaScript');
      expect(result.data[0]).toHaveProperty('category', 'Programming');
    });

    it('should search users', async () => {
      const result = await MobileOptimizationService.mobileSearch('testuser', 'users', 1, 10);

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toHaveProperty('username', 'testuser');
      expect(result.data[0]).not.toHaveProperty('password');
    });

    it('should return empty results for no matches', async () => {
      const result = await MobileOptimizationService.mobileSearch('nonexistent', 'skills', 1, 10);

      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });

    it('should handle case insensitive search', async () => {
      const result = await MobileOptimizationService.mobileSearch('javascript', 'skills', 1, 10);

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toHaveProperty('name', 'JavaScript');
    });
  });

  describe('syncData', () => {
    it('should sync user data', async () => {
      const lastSync = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      const result = await MobileOptimizationService.syncData(testUser.id, lastSync, ['users']);

      expect(result).toHaveProperty('users');
      expect(result).toHaveProperty('lastSync');
      expect(result).toHaveProperty('hasMore', false);
      expect(result.users).toHaveLength(1);
      expect(result.users![0].id).toBe(testUser.id);
    });

    it('should sync skills data', async () => {
      const lastSync = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      const result = await MobileOptimizationService.syncData(testUser.id, lastSync, ['skills']);

      expect(result).toHaveProperty('skills');
      expect(result.skills).toHaveLength(1);
      expect(result.skills![0].id).toBe(testSkill.id);
    });

    it('should sync multiple entities', async () => {
      const lastSync = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      const result = await MobileOptimizationService.syncData(testUser.id, lastSync, ['users', 'skills']);

      expect(result).toHaveProperty('users');
      expect(result).toHaveProperty('skills');
      expect(result.users).toHaveLength(1);
      expect(result.skills).toHaveLength(1);
    });

    it('should filter by lastSync date', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours in future
      const result = await MobileOptimizationService.syncData(testUser.id, futureDate, ['skills']);

      expect(result.skills).toHaveLength(0);
    });
  });

  describe('getOptimizedMatches', () => {
    it('should return empty matches for user with no matches', async () => {
      const result = await MobileOptimizationService.getOptimizedMatches(testUser.id, 1, 10);

      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });
  });

  describe('getOptimizedConversations', () => {
    it('should return empty conversations for user with no conversations', async () => {
      const result = await MobileOptimizationService.getOptimizedConversations(testUser.id, 1, 10);

      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });
  });

  describe('getOptimizedNotifications', () => {
    it('should return empty notifications for user with no notifications', async () => {
      const result = await MobileOptimizationService.getOptimizedNotifications(testUser.id, 1, 10);

      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });

    it('should truncate long notification messages', async () => {
      // Create a notification with long message
      const longMessage = 'This is a very long notification message that should be truncated for mobile display to save bandwidth and improve performance';
      await storage.createNotification({
        userId: testUser.id,
        type: 'test',
        title: 'Test Notification',
        message: longMessage,
        relatedId: null
      });

      const result = await MobileOptimizationService.getOptimizedNotifications(testUser.id, 1, 10);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].message).toContain('...');
      expect(result.data[0].message.length).toBeLessThanOrEqual(103); // 100 chars + "..."
    });
  });
});