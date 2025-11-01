import Stripe from 'stripe';
import { storage } from '../storage';
import { randomUUID } from 'crypto';

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_...', {
  apiVersion: '2024-06-20',
});

interface PaymentMethod {
  id: string;
  userId: string;
  stripePaymentMethodId: string;
  type: 'card' | 'bank_account';
  lastFour: string;
  brand?: string;
  isDefault: boolean;
  createdAt: Date;
}

interface PaymentResult {
  id: string;
  amount: number;
  status: 'succeeded' | 'failed' | 'pending';
  stripePaymentIntentId: string;
  description: string;
  createdAt: Date;
}

interface RefundResult {
  id: string;
  amount: number;
  status: 'succeeded' | 'failed' | 'pending';
  stripeRefundId: string;
  reason?: string;
  createdAt: Date;
}

export class PaymentService {
  private paymentMethods: Map<string, PaymentMethod> = new Map();
  private paymentHistory: Map<string, PaymentResult> = new Map();

  /**
   * Add a payment method for a user
   */
  async addPaymentMethod(userId: string, paymentMethodId: string): Promise<PaymentMethod> {
    try {
      // Verify user exists
      const user = await storage.getUser(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Retrieve payment method from Stripe
      const stripePaymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
      
      if (!stripePaymentMethod) {
        throw new Error('Payment method not found');
      }

      // Create customer in Stripe if doesn't exist
      let stripeCustomerId = user.stripeCustomerId;
      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.fullName,
          metadata: {
            userId: user.id
          }
        });
        stripeCustomerId = customer.id;
        
        // Update user with Stripe customer ID
        await storage.updateUser(userId, { stripeCustomerId });
      }

      // Attach payment method to customer
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: stripeCustomerId,
      });

      // Check if this should be the default payment method
      const existingMethods = Array.from(this.paymentMethods.values())
        .filter(pm => pm.userId === userId);
      const isDefault = existingMethods.length === 0;

      // If setting as default, update other methods
      if (isDefault) {
        existingMethods.forEach(method => {
          method.isDefault = false;
          this.paymentMethods.set(method.id, method);
        });
      }

      // Create payment method record
      const paymentMethod: PaymentMethod = {
        id: randomUUID(),
        userId,
        stripePaymentMethodId: paymentMethodId,
        type: stripePaymentMethod.type as 'card' | 'bank_account',
        lastFour: stripePaymentMethod.card?.last4 || stripePaymentMethod.us_bank_account?.last4 || '****',
        brand: stripePaymentMethod.card?.brand,
        isDefault,
        createdAt: new Date()
      };

      this.paymentMethods.set(paymentMethod.id, paymentMethod);
      return paymentMethod;

    } catch (error) {
      console.error('Error adding payment method:', error);
      if (error instanceof Error) {
        throw new Error(`Failed to add payment method: ${error.message}`);
      }
      throw new Error('Failed to add payment method');
    }
  }

  /**
   * Remove a payment method
   */
  async removePaymentMethod(userId: string, paymentMethodId: string): Promise<void> {
    try {
      // Find the payment method
      const paymentMethod = Array.from(this.paymentMethods.values())
        .find(pm => pm.id === paymentMethodId && pm.userId === userId);

      if (!paymentMethod) {
        throw new Error('Payment method not found');
      }

      // Detach from Stripe
      await stripe.paymentMethods.detach(paymentMethod.stripePaymentMethodId);

      // Remove from local storage
      this.paymentMethods.delete(paymentMethodId);

      // If this was the default method, set another as default
      if (paymentMethod.isDefault) {
        const remainingMethods = Array.from(this.paymentMethods.values())
          .filter(pm => pm.userId === userId);
        
        if (remainingMethods.length > 0) {
          remainingMethods[0].isDefault = true;
          this.paymentMethods.set(remainingMethods[0].id, remainingMethods[0]);
        }
      }

    } catch (error) {
      console.error('Error removing payment method:', error);
      if (error instanceof Error) {
        throw new Error(`Failed to remove payment method: ${error.message}`);
      }
      throw new Error('Failed to remove payment method');
    }
  }

  /**
   * Get user's payment methods
   */
  async getUserPaymentMethods(userId: string): Promise<PaymentMethod[]> {
    return Array.from(this.paymentMethods.values())
      .filter(pm => pm.userId === userId)
      .sort((a, b) => {
        if (a.isDefault && !b.isDefault) return -1;
        if (!a.isDefault && b.isDefault) return 1;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
  }

  /**
   * Set default payment method
   */
  async setDefaultPaymentMethod(userId: string, paymentMethodId: string): Promise<PaymentMethod> {
    const paymentMethod = Array.from(this.paymentMethods.values())
      .find(pm => pm.id === paymentMethodId && pm.userId === userId);

    if (!paymentMethod) {
      throw new Error('Payment method not found');
    }

    // Update all user's payment methods
    const userMethods = Array.from(this.paymentMethods.values())
      .filter(pm => pm.userId === userId);

    userMethods.forEach(method => {
      method.isDefault = method.id === paymentMethodId;
      this.paymentMethods.set(method.id, method);
    });

    return paymentMethod;
  }

  /**
   * Process a payment
   */
  async processPayment(
    userId: string, 
    amount: number, 
    description: string,
    paymentMethodId?: string
  ): Promise<PaymentResult> {
    try {
      // Verify user exists
      const user = await storage.getUser(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (amount <= 0) {
        throw new Error('Payment amount must be positive');
      }

      // Get payment method
      let paymentMethod: PaymentMethod | undefined;
      if (paymentMethodId) {
        paymentMethod = Array.from(this.paymentMethods.values())
          .find(pm => pm.id === paymentMethodId && pm.userId === userId);
      } else {
        // Use default payment method
        paymentMethod = Array.from(this.paymentMethods.values())
          .find(pm => pm.userId === userId && pm.isDefault);
      }

      if (!paymentMethod) {
        throw new Error('No payment method available');
      }

      // Create payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: 'usd',
        customer: user.stripeCustomerId,
        payment_method: paymentMethod.stripePaymentMethodId,
        description,
        confirm: true,
        return_url: `${process.env.FRONTEND_URL}/payment/return`,
        metadata: {
          userId,
          description
        }
      });

      // Create payment result
      const paymentResult: PaymentResult = {
        id: randomUUID(),
        amount,
        status: paymentIntent.status === 'succeeded' ? 'succeeded' : 
                paymentIntent.status === 'requires_action' ? 'pending' : 'failed',
        stripePaymentIntentId: paymentIntent.id,
        description,
        createdAt: new Date()
      };

      this.paymentHistory.set(paymentResult.id, paymentResult);
      return paymentResult;

    } catch (error) {
      console.error('Error processing payment:', error);
      
      // Create failed payment record
      const failedPayment: PaymentResult = {
        id: randomUUID(),
        amount,
        status: 'failed',
        stripePaymentIntentId: '',
        description,
        createdAt: new Date()
      };

      this.paymentHistory.set(failedPayment.id, failedPayment);

      if (error instanceof Error) {
        throw new Error(`Payment processing failed: ${error.message}`);
      }
      throw new Error('Payment processing failed');
    }
  }

  /**
   * Create setup intent for adding payment methods
   */
  async createSetupIntent(userId: string): Promise<{ clientSecret: string }> {
    try {
      const user = await storage.getUser(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Create customer if doesn't exist
      let stripeCustomerId = user.stripeCustomerId;
      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.fullName,
          metadata: {
            userId: user.id
          }
        });
        stripeCustomerId = customer.id;
        
        // Update user with Stripe customer ID
        await storage.updateUser(userId, { stripeCustomerId });
      }

      const setupIntent = await stripe.setupIntents.create({
        customer: stripeCustomerId,
        payment_method_types: ['card'],
        usage: 'off_session'
      });

      return {
        clientSecret: setupIntent.client_secret!
      };

    } catch (error) {
      console.error('Error creating setup intent:', error);
      if (error instanceof Error) {
        throw new Error(`Failed to create setup intent: ${error.message}`);
      }
      throw new Error('Failed to create setup intent');
    }
  }

  /**
   * Handle refund processing
   */
  async handleRefund(
    paymentId: string, 
    amount?: number, 
    reason?: string
  ): Promise<RefundResult> {
    try {
      // Find the original payment
      const payment = this.paymentHistory.get(paymentId);
      if (!payment) {
        throw new Error('Payment not found');
      }

      if (payment.status !== 'succeeded') {
        throw new Error('Can only refund successful payments');
      }

      const refundAmount = amount || payment.amount;
      if (refundAmount > payment.amount) {
        throw new Error('Refund amount cannot exceed original payment amount');
      }

      // Process refund with Stripe
      const refund = await stripe.refunds.create({
        payment_intent: payment.stripePaymentIntentId,
        amount: Math.round(refundAmount * 100), // Convert to cents
        reason: reason as Stripe.RefundCreateParams.Reason || 'requested_by_customer',
        metadata: {
          originalPaymentId: paymentId,
          reason: reason || 'User requested refund'
        }
      });

      // Create refund result
      const refundResult: RefundResult = {
        id: randomUUID(),
        amount: refundAmount,
        status: refund.status === 'succeeded' ? 'succeeded' : 
                refund.status === 'pending' ? 'pending' : 'failed',
        stripeRefundId: refund.id,
        reason,
        createdAt: new Date()
      };

      return refundResult;

    } catch (error) {
      console.error('Error processing refund:', error);
      if (error instanceof Error) {
        throw new Error(`Refund processing failed: ${error.message}`);
      }
      throw new Error('Refund processing failed');
    }
  }

  /**
   * Get payment history for a user
   */
  async getPaymentHistory(userId: string, limit: number = 50): Promise<PaymentResult[]> {
    // In a real implementation, this would query the database
    // For now, return from memory with user validation
    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    return Array.from(this.paymentHistory.values())
      .filter(payment => {
        // This is a simplified check - in reality we'd store userId with payments
        return true; // For now, return all payments
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  /**
   * Handle Stripe webhooks
   */
  async handleWebhook(event: Stripe.Event): Promise<void> {
    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
          break;
        
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
          break;
        
        case 'payment_method.attached':
          await this.handlePaymentMethodAttached(event.data.object as Stripe.PaymentMethod);
          break;
        
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
          // These would be handled by the subscription service
          console.log(`Subscription webhook received: ${event.type}`);
          break;
        
        default:
          console.log(`Unhandled webhook event type: ${event.type}`);
      }
    } catch (error) {
      console.error('Error handling webhook:', error);
      throw error;
    }
  }

  /**
   * Handle successful payment webhook
   */
  private async handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const userId = paymentIntent.metadata?.userId;
    if (!userId) return;

    // Find and update payment record
    const payment = Array.from(this.paymentHistory.values())
      .find(p => p.stripePaymentIntentId === paymentIntent.id);

    if (payment) {
      payment.status = 'succeeded';
      this.paymentHistory.set(payment.id, payment);
    }

    // Create notification for user
    await storage.createNotification({
      userId,
      type: 'payment',
      title: 'Payment Successful',
      message: `Your payment of $${(paymentIntent.amount / 100).toFixed(2)} was processed successfully`,
      relatedId: paymentIntent.id,
    });
  }

  /**
   * Handle failed payment webhook
   */
  private async handlePaymentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const userId = paymentIntent.metadata?.userId;
    if (!userId) return;

    // Find and update payment record
    const payment = Array.from(this.paymentHistory.values())
      .find(p => p.stripePaymentIntentId === paymentIntent.id);

    if (payment) {
      payment.status = 'failed';
      this.paymentHistory.set(payment.id, payment);
    }

    // Create notification for user
    await storage.createNotification({
      userId,
      type: 'payment',
      title: 'Payment Failed',
      message: 'Your payment could not be processed. Please check your payment method.',
      relatedId: paymentIntent.id,
    });
  }

  /**
   * Handle payment method attached webhook
   */
  private async handlePaymentMethodAttached(paymentMethod: Stripe.PaymentMethod): Promise<void> {
    // This webhook confirms that a payment method was successfully attached
    // We can use this to sync our local records if needed
    console.log(`Payment method ${paymentMethod.id} attached to customer ${paymentMethod.customer}`);
  }

  /**
   * Validate webhook signature
   */
  validateWebhookSignature(payload: string, signature: string): Stripe.Event {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error('Stripe webhook secret not configured');
    }

    try {
      return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      throw new Error('Invalid webhook signature');
    }
  }
}

// Export singleton instance
export const paymentService = new PaymentService();