import type { Express } from "express";
import { subscriptionService } from "./services/subscriptions";
import { 
  createSubscriptionSchema,
  updateSubscriptionSchema
} from "@shared/validation-schemas";
import { 
  authenticateToken,
  type AuthenticatedRequest 
} from "./auth";

export function registerSubscriptionRoutes(app: Express): void {
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
}