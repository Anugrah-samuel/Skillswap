import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest';
import { SubscriptionService } from './subscriptions';
import { storage } from '../storage';
import type { User, Subscription } from '@shared/schema';

// Mock Stripe
vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      subscriptions: {
        create: vi.fn(),
        update: vi.fn(),
      },
    })),
  };
});

describe('SubscriptionService', () => {
  let subscriptionService: SubscriptionService;
  let mockUser: User;

  beforeAll(() => {
    // Set up environment variables for testing
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key';
    process.env.STRIPE_PREMIUM_PRICE_ID = 'price_mock_premium';
  });

  beforeEach(async () => {
    // Clear storage - note: these are private properties, so we'll work around it
    // In a real implementation, we'd have a clearAll() method on storage

    // Create mock user
    mockUser = await storage.createUser({
      username: 'testuser',
      email: 'test@example.com',
      password: 'hashedpassword',
      fullName: 'Test User',
    });

    // Create fresh service instance
    subscriptionService = new SubscriptionService();
  });

  describe('createSubscription', () => {
    it('should create a basic subscription successfully', async () => {
      const subscription = await subscriptionService.createSubscription(
        mockUser.id,
        'basic',
        'pm_mock_payment_method'
      );

      expect(subscription).toBeDefined();
      expect(subscription.userId).toBe(mockUser.id);
      expect(subscription.planType).toBe('basic');
      expect(subscription.status).toBe('active');
      expect(subscription.stripeSubscriptionId).toBeNull();

      // Check user was updated
      const updatedUser = await storage.getUser(mockUser.id);
      expect(updatedUser?.subscriptionStatus).toBe('basic');
      expect(updatedUser?.subscriptionExpiresAt).toBeDefined();
    });

    it('should throw error if user not found', async () => {
      await expect(
        subscriptionService.createSubscription('nonexistent', 'basic', 'pm_test')
      ).rejects.toThrow('User not found');
    });

    it('should throw error if user already has active subscription', async () => {
      // Create initial subscription
      await subscriptionService.createSubscription(mockUser.id, 'basic', 'pm_test');

      // Try to create another
      await expect(
        subscriptionService.createSubscription(mockUser.id, 'premium', 'pm_test')
      ).rejects.toThrow('User already has an active subscription');
    });

    it('should throw error for invalid plan type', async () => {
      await expect(
        subscriptionService.createSubscription(mockUser.id, 'invalid', 'pm_test')
      ).rejects.toThrow('Invalid plan type');
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel an active subscription', async () => {
      // Create subscription first
      await subscriptionService.createSubscription(mockUser.id, 'basic', 'pm_test');

      // Cancel it
      const cancelledSubscription = await subscriptionService.cancelSubscription(mockUser.id);

      expect(cancelledSubscription.status).toBe('cancelled');

      // Check user was updated
      const updatedUser = await storage.getUser(mockUser.id);
      expect(updatedUser?.subscriptionStatus).toBe('basic');
    });

    it('should throw error if no subscription found', async () => {
      await expect(
        subscriptionService.cancelSubscription(mockUser.id)
      ).rejects.toThrow('No subscription found for user');
    });

    it('should throw error if subscription already cancelled', async () => {
      // Create and cancel subscription
      await subscriptionService.createSubscription(mockUser.id, 'basic', 'pm_test');
      await subscriptionService.cancelSubscription(mockUser.id);

      // Try to cancel again
      await expect(
        subscriptionService.cancelSubscription(mockUser.id)
      ).rejects.toThrow('Subscription is already cancelled');
    });
  });

  describe('updateSubscription', () => {
    it('should throw error if no subscription found', async () => {
      await expect(
        subscriptionService.updateSubscription(mockUser.id, 'premium')
      ).rejects.toThrow('No subscription found for user');
    });

    it('should throw error if user is already on the requested plan', async () => {
      await subscriptionService.createSubscription(mockUser.id, 'basic', 'pm_test');

      await expect(
        subscriptionService.updateSubscription(mockUser.id, 'basic')
      ).rejects.toThrow('User is already on this plan');
    });

    it('should throw error for invalid plan type', async () => {
      await subscriptionService.createSubscription(mockUser.id, 'basic', 'pm_test');

      await expect(
        subscriptionService.updateSubscription(mockUser.id, 'invalid')
      ).rejects.toThrow('Invalid plan type');
    });

    it('should cancel subscription when downgrading to basic', async () => {
      // Create premium subscription (mocked)
      const subscription = await storage.createSubscription({
        userId: mockUser.id,
        planType: 'premium',
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        stripeSubscriptionId: 'sub_mock',
      });

      const result = await subscriptionService.updateSubscription(mockUser.id, 'basic');
      expect(result.status).toBe('cancelled');
    });
  });

  describe('checkSubscriptionStatus', () => {
    it('should return inactive status for user with no subscription', async () => {
      const status = await subscriptionService.checkSubscriptionStatus(mockUser.id);

      expect(status.isActive).toBe(false);
      expect(status.planType).toBe('basic');
      expect(status.currentPeriodEnd).toBeNull();
      expect(status.status).toBe('none');
    });

    it('should return active status for user with active subscription', async () => {
      await subscriptionService.createSubscription(mockUser.id, 'basic', 'pm_test');

      const status = await subscriptionService.checkSubscriptionStatus(mockUser.id);

      expect(status.isActive).toBe(true);
      expect(status.planType).toBe('basic');
      expect(status.currentPeriodEnd).toBeDefined();
      expect(status.status).toBe('active');
    });

    it('should return inactive status for expired subscription', async () => {
      // Create subscription with past end date
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday
      await storage.createSubscription({
        userId: mockUser.id,
        planType: 'premium',
        status: 'active',
        currentPeriodStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        currentPeriodEnd: pastDate,
        stripeSubscriptionId: null,
      });

      const status = await subscriptionService.checkSubscriptionStatus(mockUser.id);

      expect(status.isActive).toBe(false);
      expect(status.planType).toBe('premium');
      expect(status.status).toBe('active');
    });
  });

  describe('handleWebhook', () => {
    it('should handle unknown event types gracefully', async () => {
      const mockEvent = {
        type: 'unknown.event',
        data: { object: {} },
      } as any;

      // Should not throw
      await expect(
        subscriptionService.handleWebhook(mockEvent)
      ).resolves.toBeUndefined();
    });

    it('should handle subscription events', async () => {
      // Create a subscription first
      const subscription = await storage.createSubscription({
        userId: mockUser.id,
        planType: 'premium',
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        stripeSubscriptionId: 'sub_mock',
      });

      const mockEvent = {
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_mock',
            status: 'active',
            current_period_start: Math.floor(Date.now() / 1000),
            current_period_end: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000),
          },
        },
      } as any;

      // Should not throw
      await expect(
        subscriptionService.handleWebhook(mockEvent)
      ).resolves.toBeUndefined();
    });
  });
});