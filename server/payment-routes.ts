import type { Express } from "express";
import { z } from "zod";
import {
  authenticateToken,
  type AuthenticatedRequest
} from "./auth";
import { paymentService } from "./services/payments";
import {
  addPaymentMethodSchema,
  processPaymentSchema,
  refundPaymentSchema
} from "../shared/validation-schemas";

/**
 * Register payment-related API routes
 */
export function registerPaymentRoutes(app: Express): void {
  
  // ===== Payment Methods Management =====

  /**
   * POST /api/payments/methods
   * Add a new payment method for the authenticated user
   */
  app.post("/api/payments/methods", authenticateToken, async (req: AuthenticatedRequest, res) => {
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

  /**
   * GET /api/payments/methods
   * Get all payment methods for the authenticated user
   */
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

  /**
   * PUT /api/payments/methods/:id/default
   * Set a payment method as default
   */
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

  /**
   * DELETE /api/payments/methods/:id
   * Remove a payment method
   */
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

  /**
   * POST /api/payments/setup-intent
   * Create a setup intent for adding payment methods
   */
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

  // ===== Payment Processing =====

  /**
   * POST /api/payments/process
   * Process a payment for the authenticated user
   */
  app.post("/api/payments/process", authenticateToken, async (req: AuthenticatedRequest, res) => {
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

  /**
   * GET /api/payments/history
   * Get payment history for the authenticated user
   */
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

  // ===== Refund Processing =====

  /**
   * POST /api/payments/refund
   * Process a refund for a payment
   */
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

  // ===== Stripe Webhooks =====

  /**
   * POST /api/payments/webhook
   * Handle Stripe webhooks for payment events
   */
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
}