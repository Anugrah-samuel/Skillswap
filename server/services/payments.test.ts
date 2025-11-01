import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { PaymentService } from './payments';
import { storage } from '../storage';
import Stripe from 'stripe';

// Mock Stripe
vi.mock('stripe');
const MockedStripe = vi.mocked(Stripe);

// Mock storage
vi.mock('../storage', () => ({
  storage: {
    getUser: vi.fn(),
    updateUser: vi.fn(),
    createNotification: vi.fn(),
  }
}));

describe('PaymentService', () => {
  let paymentService: PaymentService;
  let mockStripe: {
    paymentMethods: {
      retrieve: Mock;
      attach: Mock;
      detach: Mock;
    };
    customers: {
      create: Mock;
    };
    paymentIntents: {
      create: Mock;
    };
    setupIntents: {
      create: Mock;
    };
    refunds: {
      create: Mock;
    };
    webhooks: {
      constructEvent: Mock;
    };
  };

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    fullName: 'Test User',
    stripeCustomerId: 'cus_test123',
    username: 'testuser',
    password: 'hashedpassword',
    bio: 'Test bio',
    location: 'Test City',
    avatarUrl: null,
    rating: 45,
    totalReviews: 10,
    totalSessionsCompleted: 5,
    totalSessionsTaught: 3,
    creditBalance: 100,
    subscriptionStatus: 'basic' as const,
    subscriptionExpiresAt: null,
    skillPoints: 150,
    badges: [],
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create mock Stripe instance
    mockStripe = {
      paymentMethods: {
        retrieve: vi.fn(),
        attach: vi.fn(),
        detach: vi.fn(),
      },
      customers: {
        create: vi.fn(),
      },
      paymentIntents: {
        create: vi.fn(),
      },
      setupIntents: {
        create: vi.fn(),
      },
      refunds: {
        create: vi.fn(),
      },
      webhooks: {
        constructEvent: vi.fn(),
      },
    };

    // Mock Stripe constructor
    MockedStripe.mockImplementation(() => mockStripe as any);

    paymentService = new PaymentService();
  });

  describe('addPaymentMethod', () => {
    it('should add a payment method successfully', async () => {
      // Setup mocks
      (storage.getUser as Mock).mockResolvedValue(mockUser);
      mockStripe.paymentMethods.retrieve.mockResolvedValue({
        id: 'pm_test123',
        type: 'card',
        card: {
          last4: '4242',
          brand: 'visa'
        }
      });
      mockStripe.paymentMethods.attach.mockResolvedValue({});

      // Execute
      const result = await paymentService.addPaymentMethod('user-1', 'pm_test123');

      // Verify
      expect(result).toMatchObject({
        userId: 'user-1',
        stripePaymentMethodId: 'pm_test123',
        type: 'card',
        lastFour: '4242',
        brand: 'visa',
        isDefault: true
      });

      expect(mockStripe.paymentMethods.retrieve).toHaveBeenCalledWith('pm_test123');
      expect(mockStripe.paymentMethods.attach).toHaveBeenCalledWith('pm_test123', {
        customer: 'cus_test123'
      });
    });

    it('should create Stripe customer if user does not have one', async () => {
      // Setup mocks
      const userWithoutStripeId = { ...mockUser, stripeCustomerId: undefined };
      (storage.getUser as Mock).mockResolvedValue(userWithoutStripeId);
      (storage.updateUser as Mock).mockResolvedValue(mockUser);
      
      mockStripe.customers.create.mockResolvedValue({
        id: 'cus_new123'
      });
      mockStripe.paymentMethods.retrieve.mockResolvedValue({
        id: 'pm_test123',
        type: 'card',
        card: { last4: '4242', brand: 'visa' }
      });
      mockStripe.paymentMethods.attach.mockResolvedValue({});

      // Execute
      await paymentService.addPaymentMethod('user-1', 'pm_test123');

      // Verify
      expect(mockStripe.customers.create).toHaveBeenCalledWith({
        email: 'test@example.com',
        name: 'Test User',
        metadata: { userId: 'user-1' }
      });
      expect(storage.updateUser).toHaveBeenCalledWith('user-1', {
        stripeCustomerId: 'cus_new123'
      });
    });

    it('should throw error if user not found', async () => {
      (storage.getUser as Mock).mockResolvedValue(null);

      await expect(paymentService.addPaymentMethod('user-1', 'pm_test123'))
        .rejects.toThrow('User not found');
    });

    it('should throw error if payment method not found in Stripe', async () => {
      (storage.getUser as Mock).mockResolvedValue(mockUser);
      mockStripe.paymentMethods.retrieve.mockResolvedValue(null);

      await expect(paymentService.addPaymentMethod('user-1', 'pm_test123'))
        .rejects.toThrow('Payment method not found');
    });
  });

  describe('removePaymentMethod', () => {
    it('should remove a payment method successfully', async () => {
      // First add a payment method
      (storage.getUser as Mock).mockResolvedValue(mockUser);
      mockStripe.paymentMethods.retrieve.mockResolvedValue({
        id: 'pm_test123',
        type: 'card',
        card: { last4: '4242', brand: 'visa' }
      });
      mockStripe.paymentMethods.attach.mockResolvedValue({});
      mockStripe.paymentMethods.detach.mockResolvedValue({});

      const paymentMethod = await paymentService.addPaymentMethod('user-1', 'pm_test123');

      // Execute removal
      await paymentService.removePaymentMethod('user-1', paymentMethod.id);

      // Verify
      expect(mockStripe.paymentMethods.detach).toHaveBeenCalledWith('pm_test123');

      // Check that payment method is removed
      const userMethods = await paymentService.getUserPaymentMethods('user-1');
      expect(userMethods).toHaveLength(0);
    });

    it('should throw error if payment method not found', async () => {
      await expect(paymentService.removePaymentMethod('user-1', 'nonexistent'))
        .rejects.toThrow('Payment method not found');
    });
  });

  describe('processPayment', () => {
    it('should process payment successfully', async () => {
      // Setup: Add a payment method first
      (storage.getUser as Mock).mockResolvedValue(mockUser);
      mockStripe.paymentMethods.retrieve.mockResolvedValue({
        id: 'pm_test123',
        type: 'card',
        card: { last4: '4242', brand: 'visa' }
      });
      mockStripe.paymentMethods.attach.mockResolvedValue({});

      const paymentMethod = await paymentService.addPaymentMethod('user-1', 'pm_test123');

      // Setup payment intent mock
      mockStripe.paymentIntents.create.mockResolvedValue({
        id: 'pi_test123',
        status: 'succeeded',
        amount: 2000
      });

      // Execute
      const result = await paymentService.processPayment('user-1', 20.00, 'Test payment');

      // Verify
      expect(result).toMatchObject({
        amount: 20.00,
        status: 'succeeded',
        stripePaymentIntentId: 'pi_test123',
        description: 'Test payment'
      });

      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith({
        amount: 2000, // $20.00 in cents
        currency: 'usd',
        customer: 'cus_test123',
        payment_method: 'pm_test123',
        description: 'Test payment',
        confirm: true,
        return_url: `${process.env.FRONTEND_URL}/payment/return`,
        metadata: {
          userId: 'user-1',
          description: 'Test payment'
        }
      });
    });

    it('should throw error for invalid amount', async () => {
      (storage.getUser as Mock).mockResolvedValue(mockUser);

      await expect(paymentService.processPayment('user-1', -10, 'Invalid payment'))
        .rejects.toThrow('Payment amount must be positive');
    });

    it('should throw error if no payment method available', async () => {
      (storage.getUser as Mock).mockResolvedValue(mockUser);

      await expect(paymentService.processPayment('user-1', 20.00, 'Test payment'))
        .rejects.toThrow('No payment method available');
    });
  });

  describe('createSetupIntent', () => {
    it('should create setup intent successfully', async () => {
      (storage.getUser as Mock).mockResolvedValue(mockUser);
      mockStripe.setupIntents.create.mockResolvedValue({
        client_secret: 'seti_test123_secret'
      });

      const result = await paymentService.createSetupIntent('user-1');

      expect(result).toEqual({
        clientSecret: 'seti_test123_secret'
      });

      expect(mockStripe.setupIntents.create).toHaveBeenCalledWith({
        customer: 'cus_test123',
        payment_method_types: ['card'],
        usage: 'off_session'
      });
    });

    it('should create customer if user does not have Stripe customer ID', async () => {
      const userWithoutStripeId = { ...mockUser, stripeCustomerId: undefined };
      (storage.getUser as Mock).mockResolvedValue(userWithoutStripeId);
      (storage.updateUser as Mock).mockResolvedValue(mockUser);
      
      mockStripe.customers.create.mockResolvedValue({
        id: 'cus_new123'
      });
      mockStripe.setupIntents.create.mockResolvedValue({
        client_secret: 'seti_test123_secret'
      });

      await paymentService.createSetupIntent('user-1');

      expect(mockStripe.customers.create).toHaveBeenCalled();
      expect(storage.updateUser).toHaveBeenCalledWith('user-1', {
        stripeCustomerId: 'cus_new123'
      });
    });
  });

  describe('handleRefund', () => {
    it('should process refund successfully', async () => {
      // Setup: Create a successful payment first
      (storage.getUser as Mock).mockResolvedValue(mockUser);
      mockStripe.paymentMethods.retrieve.mockResolvedValue({
        id: 'pm_test123',
        type: 'card',
        card: { last4: '4242', brand: 'visa' }
      });
      mockStripe.paymentMethods.attach.mockResolvedValue({});
      mockStripe.paymentIntents.create.mockResolvedValue({
        id: 'pi_test123',
        status: 'succeeded',
        amount: 2000
      });

      await paymentService.addPaymentMethod('user-1', 'pm_test123');
      const payment = await paymentService.processPayment('user-1', 20.00, 'Test payment');

      // Setup refund mock
      mockStripe.refunds.create.mockResolvedValue({
        id: 're_test123',
        status: 'succeeded',
        amount: 1000
      });

      // Execute refund
      const result = await paymentService.handleRefund(payment.id, 10.00, 'Customer request');

      // Verify
      expect(result).toMatchObject({
        amount: 10.00,
        status: 'succeeded',
        stripeRefundId: 're_test123',
        reason: 'Customer request'
      });

      expect(mockStripe.refunds.create).toHaveBeenCalledWith({
        payment_intent: 'pi_test123',
        amount: 1000, // $10.00 in cents
        reason: 'requested_by_customer',
        metadata: {
          originalPaymentId: payment.id,
          reason: 'Customer request'
        }
      });
    });

    it('should throw error if payment not found', async () => {
      await expect(paymentService.handleRefund('nonexistent'))
        .rejects.toThrow('Payment not found');
    });
  });

  describe('validateWebhookSignature', () => {
    it('should validate webhook signature successfully', () => {
      const mockEvent = { type: 'payment_intent.succeeded' };
      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent as any);

      const result = paymentService.validateWebhookSignature('payload', 'signature');

      expect(result).toEqual(mockEvent);
      expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(
        'payload',
        'signature',
        process.env.STRIPE_WEBHOOK_SECRET
      );
    });

    it('should throw error for invalid signature', () => {
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      expect(() => paymentService.validateWebhookSignature('payload', 'invalid'))
        .toThrow('Invalid webhook signature');
    });
  });
});