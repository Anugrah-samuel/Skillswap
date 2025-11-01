import Stripe from 'stripe';
import { 
  type Subscription, 
  type InsertSubscription,
  type User 
} from "@shared/schema";
import { storage } from "../storage";

export interface SubscriptionServiceInterface {
  createSubscription(userId: string, planType: string, paymentMethodId: string): Promise<Subscription>;
  cancelSubscription(userId: string): Promise<Subscription>;
  updateSubscription(userId: string, planType: string): Promise<Subscription>;
  checkSubscriptionStatus(userId: string): Promise<SubscriptionStatus>;
  handleWebhook(event: Stripe.Event): Promise<void>;
}

export interface SubscriptionStatus {
  isActive: boolean;
  planType: string;
  currentPeriodEnd: Date | null;
  status: string;
}

export class SubscriptionService implements SubscriptionServiceInterface {
  private stripe: Stripe;

  constructor() {
    // Initialize Stripe with secret key from environment
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }
    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-06-20',
    });
  }

  /**
   * Create a new subscription for a user
   */
  async createSubscription(userId: string, planType: string, paymentMethodId: string): Promise<Subscription> {
    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Check if user already has an active subscription
    const existingSubscription = await storage.getSubscriptionByUser(userId);
    if (existingSubscription && existingSubscription.status === 'active') {
      throw new Error('User already has an active subscription');
    }

    // Validate plan type
    if (!['basic', 'premium'].includes(planType)) {
      throw new Error('Invalid plan type');
    }

    // For basic plan, create a local subscription without Stripe
    if (planType === 'basic') {
      const now = new Date();
      const oneMonthFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      
      const subscription = await storage.createSubscription({
        userId,
        planType: 'basic',
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: oneMonthFromNow,
        stripeSubscriptionId: null,
      });

      // Update user subscription status
      await storage.updateUser(userId, {
        subscriptionStatus: 'basic',
        subscriptionExpiresAt: oneMonthFromNow,
      });

      return subscription;
    }

    // For premium plan, create Stripe subscription
    try {
      // Get the price ID for premium plan (this would be configured in Stripe dashboard)
      const priceId = process.env.STRIPE_PREMIUM_PRICE_ID;
      if (!priceId) {
        throw new Error('STRIPE_PREMIUM_PRICE_ID environment variable is required');
      }

      // Create Stripe customer if not exists
      let stripeCustomerId = user.email; // In production, you'd store this in user record
      
      // Create the subscription in Stripe
      const stripeSubscription = await this.stripe.subscriptions.create({
        customer: stripeCustomerId,
        items: [{ price: priceId }],
        default_payment_method: paymentMethodId,
        expand: ['latest_invoice.payment_intent'],
      });

      // Create local subscription record
      const subscription = await storage.createSubscription({
        userId,
        planType: 'premium',
        status: 'active',
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        stripeSubscriptionId: stripeSubscription.id,
      });

      // Update user subscription status
      await storage.updateUser(userId, {
        subscriptionStatus: 'premium',
        subscriptionExpiresAt: new Date(stripeSubscription.current_period_end * 1000),
      });

      return subscription;
    } catch (error) {
      console.error('Error creating Stripe subscription:', error);
      throw new Error('Failed to create subscription');
    }
  }

  /**
   * Cancel a user's subscription
   */
  async cancelSubscription(userId: string): Promise<Subscription> {
    const subscription = await storage.getSubscriptionByUser(userId);
    if (!subscription) {
      throw new Error('No subscription found for user');
    }

    if (subscription.status === 'cancelled') {
      throw new Error('Subscription is already cancelled');
    }

    // If it's a Stripe subscription, cancel it in Stripe
    if (subscription.stripeSubscriptionId) {
      try {
        await this.stripe.subscriptions.update(subscription.stripeSubscriptionId, {
          cancel_at_period_end: true,
        });
      } catch (error) {
        console.error('Error cancelling Stripe subscription:', error);
        throw new Error('Failed to cancel subscription');
      }
    }

    // Update local subscription record
    const updatedSubscription = await storage.updateSubscription(subscription.id, {
      status: 'cancelled',
    });

    if (!updatedSubscription) {
      throw new Error('Failed to update subscription');
    }

    // Update user subscription status
    await storage.updateUser(userId, {
      subscriptionStatus: 'basic',
    });

    return updatedSubscription;
  }

  /**
   * Update a user's subscription plan
   */
  async updateSubscription(userId: string, planType: string): Promise<Subscription> {
    const subscription = await storage.getSubscriptionByUser(userId);
    if (!subscription) {
      throw new Error('No subscription found for user');
    }

    if (subscription.planType === planType) {
      throw new Error('User is already on this plan');
    }

    // Validate plan type
    if (!['basic', 'premium'].includes(planType)) {
      throw new Error('Invalid plan type');
    }

    // Handle downgrade to basic
    if (planType === 'basic') {
      return await this.cancelSubscription(userId);
    }

    // Handle upgrade to premium
    if (planType === 'premium' && subscription.stripeSubscriptionId) {
      try {
        const priceId = process.env.STRIPE_PREMIUM_PRICE_ID;
        if (!priceId) {
          throw new Error('STRIPE_PREMIUM_PRICE_ID environment variable is required');
        }

        // Update Stripe subscription
        const stripeSubscription = await this.stripe.subscriptions.update(
          subscription.stripeSubscriptionId,
          {
            items: [{ price: priceId }],
            proration_behavior: 'create_prorations',
          }
        );

        // Update local subscription record
        const updatedSubscription = await storage.updateSubscription(subscription.id, {
          planType: 'premium',
          status: 'active',
          currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
          currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        });

        if (!updatedSubscription) {
          throw new Error('Failed to update subscription');
        }

        // Update user subscription status
        await storage.updateUser(userId, {
          subscriptionStatus: 'premium',
          subscriptionExpiresAt: new Date(stripeSubscription.current_period_end * 1000),
        });

        return updatedSubscription;
      } catch (error) {
        console.error('Error updating Stripe subscription:', error);
        throw new Error('Failed to update subscription');
      }
    }

    throw new Error('Invalid subscription update request');
  }

  /**
   * Check the current subscription status for a user
   */
  async checkSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
    const subscription = await storage.getSubscriptionByUser(userId);
    
    if (!subscription) {
      return {
        isActive: false,
        planType: 'basic',
        currentPeriodEnd: null,
        status: 'none',
      };
    }

    const now = new Date();
    const isActive = subscription.status === 'active' && subscription.currentPeriodEnd > now;

    return {
      isActive,
      planType: subscription.planType,
      currentPeriodEnd: subscription.currentPeriodEnd,
      status: subscription.status,
    };
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhook(event: Stripe.Event): Promise<void> {
    try {
      switch (event.type) {
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
          await this.handleSubscriptionEvent(event.data.object as Stripe.Subscription);
          break;
        
        case 'invoice.payment_succeeded':
          await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice);
          break;
        
        case 'invoice.payment_failed':
          await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
          break;
        
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      console.error('Error handling webhook:', error);
      throw error;
    }
  }

  /**
   * Handle subscription events from Stripe
   */
  private async handleSubscriptionEvent(stripeSubscription: Stripe.Subscription): Promise<void> {
    // Find local subscription by Stripe ID
    let localSubscription: Subscription | undefined;
    for (const sub of await this.getAllSubscriptions()) {
      if (sub.stripeSubscriptionId === stripeSubscription.id) {
        localSubscription = sub;
        break;
      }
    }

    if (!localSubscription) {
      console.warn(`No local subscription found for Stripe subscription ${stripeSubscription.id}`);
      return;
    }

    // Update local subscription based on Stripe data
    const updatedSubscription = await storage.updateSubscription(localSubscription.id, {
      status: stripeSubscription.status === 'active' ? 'active' : 'cancelled',
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
    });

    if (updatedSubscription) {
      // Update user subscription status
      await storage.updateUser(localSubscription.userId, {
        subscriptionStatus: stripeSubscription.status === 'active' ? 'premium' : 'basic',
        subscriptionExpiresAt: new Date(stripeSubscription.current_period_end * 1000),
      });
    }
  }

  /**
   * Handle successful payment events
   */
  private async handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    console.log(`Payment succeeded for invoice ${invoice.id}`);
    // Additional logic for successful payments can be added here
  }

  /**
   * Handle failed payment events
   */
  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    console.log(`Payment failed for invoice ${invoice.id}`);
    // Additional logic for failed payments (e.g., notifications) can be added here
  }

  /**
   * Helper method to get all subscriptions (for webhook processing)
   */
  private async getAllSubscriptions(): Promise<Subscription[]> {
    // This is a simplified implementation for the in-memory storage
    // In a real database implementation, this would be a proper query
    const allSubscriptions: Subscription[] = [];
    // Access the private subscriptions map through the storage instance
    // Note: This is a workaround for the in-memory implementation
    return allSubscriptions;
  }
}

// Export singleton instance - created lazily to avoid environment variable issues during testing
let _subscriptionService: SubscriptionService | null = null;

export const subscriptionService = {
  getInstance(): SubscriptionService {
    if (!_subscriptionService) {
      _subscriptionService = new SubscriptionService();
    }
    return _subscriptionService;
  },
  
  // For testing - allows resetting the singleton
  resetInstance(): void {
    _subscriptionService = null;
  }
};