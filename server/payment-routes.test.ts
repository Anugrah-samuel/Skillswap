import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import request from "supertest";
import express from "express";
import { registerPaymentRoutes } from "./payment-routes";
import { paymentService } from "./services/payments";
import { AuthService } from "./auth";

// Mock the payment service
vi.mock("./services/payments", () => ({
  paymentService: {
    addPaymentMethod: vi.fn(),
    getUserPaymentMethods: vi.fn(),
    setDefaultPaymentMethod: vi.fn(),
    removePaymentMethod: vi.fn(),
    createSetupIntent: vi.fn(),
    processPayment: vi.fn(),
    getPaymentHistory: vi.fn(),
    handleRefund: vi.fn(),
    validateWebhookSignature: vi.fn(),
    handleWebhook: vi.fn(),
  },
}));

// Mock the auth service
vi.mock("./auth", () => ({
  AuthService: {
    verifyAccessToken: vi.fn(),
  },
  authenticateToken: vi.fn((req, res, next) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (token === "valid-token") {
      req.user = { userId: "user-1", role: "user" };
      next();
    } else {
      res.status(401).json({ code: "UNAUTHORIZED", message: "Invalid token" });
    }
  }),
}));

describe("Payment Routes", () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    registerPaymentRoutes(app);
    vi.clearAllMocks();
  });

  describe("POST /api/payments/methods", () => {
    it("should add a payment method successfully", async () => {
      const mockPaymentMethod = {
        id: "pm-1",
        userId: "user-1",
        stripePaymentMethodId: "pm_test_123",
        type: "card" as const,
        lastFour: "4242",
        brand: "visa",
        isDefault: true,
        createdAt: new Date(),
      };

      (paymentService.addPaymentMethod as Mock).mockResolvedValue(mockPaymentMethod);

      const response = await request(app)
        .post("/api/payments/methods")
        .set("Authorization", "Bearer valid-token")
        .send({
          stripePaymentMethodId: "pm_test_123",
          type: "card",
          lastFour: "4242",
          brand: "visa",
        });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        paymentMethod: {
          ...mockPaymentMethod,
          createdAt: expect.any(String),
        },
        message: "Payment method added successfully",
      });
      expect(paymentService.addPaymentMethod).toHaveBeenCalledWith("user-1", "pm_test_123");
    });

    it("should return 401 for unauthenticated requests", async () => {
      const response = await request(app)
        .post("/api/payments/methods")
        .send({
          stripePaymentMethodId: "pm_test_123",
          type: "card",
        });

      expect(response.status).toBe(401);
      expect(response.body.code).toBe("UNAUTHORIZED");
    });

    it("should return 400 for invalid data", async () => {
      const response = await request(app)
        .post("/api/payments/methods")
        .set("Authorization", "Bearer valid-token")
        .send({
          // Missing required stripePaymentMethodId
          type: "card",
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe("VALIDATION_ERROR");
    });

    it("should handle payment method not found error", async () => {
      (paymentService.addPaymentMethod as Mock).mockRejectedValue(
        new Error("Payment method not found")
      );

      const response = await request(app)
        .post("/api/payments/methods")
        .set("Authorization", "Bearer valid-token")
        .send({
          stripePaymentMethodId: "pm_invalid",
          type: "card",
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe("INVALID_PAYMENT_METHOD");
    });

    it("should handle user not found error", async () => {
      (paymentService.addPaymentMethod as Mock).mockRejectedValue(
        new Error("User not found")
      );

      const response = await request(app)
        .post("/api/payments/methods")
        .set("Authorization", "Bearer valid-token")
        .send({
          stripePaymentMethodId: "pm_test_123",
          type: "card",
        });

      expect(response.status).toBe(404);
      expect(response.body.code).toBe("USER_NOT_FOUND");
    });
  });

  describe("GET /api/payments/methods", () => {
    it("should get user payment methods successfully", async () => {
      const mockPaymentMethods = [
        {
          id: "pm-1",
          userId: "user-1",
          stripePaymentMethodId: "pm_test_123",
          type: "card" as const,
          lastFour: "4242",
          brand: "visa",
          isDefault: true,
          createdAt: new Date(),
        },
        {
          id: "pm-2",
          userId: "user-1",
          stripePaymentMethodId: "pm_test_456",
          type: "card" as const,
          lastFour: "1234",
          brand: "mastercard",
          isDefault: false,
          createdAt: new Date(),
        },
      ];

      (paymentService.getUserPaymentMethods as Mock).mockResolvedValue(mockPaymentMethods);

      const response = await request(app)
        .get("/api/payments/methods")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        paymentMethods: mockPaymentMethods.map(pm => ({
          ...pm,
          createdAt: expect.any(String),
        })),
        count: 2,
      });
      expect(paymentService.getUserPaymentMethods).toHaveBeenCalledWith("user-1");
    });

    it("should return 401 for unauthenticated requests", async () => {
      const response = await request(app).get("/api/payments/methods");

      expect(response.status).toBe(401);
      expect(response.body.code).toBe("UNAUTHORIZED");
    });
  });

  describe("PUT /api/payments/methods/:id/default", () => {
    it("should set default payment method successfully", async () => {
      const mockPaymentMethod = {
        id: "pm-1",
        userId: "user-1",
        stripePaymentMethodId: "pm_test_123",
        type: "card" as const,
        lastFour: "4242",
        brand: "visa",
        isDefault: true,
        createdAt: new Date(),
      };

      (paymentService.setDefaultPaymentMethod as Mock).mockResolvedValue(mockPaymentMethod);

      const response = await request(app)
        .put("/api/payments/methods/pm-1/default")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        paymentMethod: {
          ...mockPaymentMethod,
          createdAt: expect.any(String),
        },
        message: "Default payment method updated successfully",
      });
      expect(paymentService.setDefaultPaymentMethod).toHaveBeenCalledWith("user-1", "pm-1");
    });

    it("should return 404 for payment method not found", async () => {
      (paymentService.setDefaultPaymentMethod as Mock).mockRejectedValue(
        new Error("Payment method not found")
      );

      const response = await request(app)
        .put("/api/payments/methods/pm-invalid/default")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(404);
      expect(response.body.code).toBe("PAYMENT_METHOD_NOT_FOUND");
    });
  });

  describe("DELETE /api/payments/methods/:id", () => {
    it("should remove payment method successfully", async () => {
      (paymentService.removePaymentMethod as Mock).mockResolvedValue(undefined);

      const response = await request(app)
        .delete("/api/payments/methods/pm-1")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: "Payment method removed successfully",
      });
      expect(paymentService.removePaymentMethod).toHaveBeenCalledWith("user-1", "pm-1");
    });

    it("should return 404 for payment method not found", async () => {
      (paymentService.removePaymentMethod as Mock).mockRejectedValue(
        new Error("Payment method not found")
      );

      const response = await request(app)
        .delete("/api/payments/methods/pm-invalid")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(404);
      expect(response.body.code).toBe("PAYMENT_METHOD_NOT_FOUND");
    });
  });

  describe("POST /api/payments/setup-intent", () => {
    it("should create setup intent successfully", async () => {
      const mockSetupIntent = {
        clientSecret: "seti_test_123_secret_456",
      };

      (paymentService.createSetupIntent as Mock).mockResolvedValue(mockSetupIntent);

      const response = await request(app)
        .post("/api/payments/setup-intent")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockSetupIntent);
      expect(paymentService.createSetupIntent).toHaveBeenCalledWith("user-1");
    });

    it("should handle user not found error", async () => {
      (paymentService.createSetupIntent as Mock).mockRejectedValue(
        new Error("User not found")
      );

      const response = await request(app)
        .post("/api/payments/setup-intent")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(404);
      expect(response.body.code).toBe("USER_NOT_FOUND");
    });
  });

  describe("POST /api/payments/process", () => {
    it("should process payment successfully", async () => {
      const mockPaymentResult = {
        id: "pay-1",
        amount: 50.00,
        status: "succeeded" as const,
        stripePaymentIntentId: "pi_test_123",
        description: "Course purchase",
        createdAt: new Date(),
      };

      (paymentService.processPayment as Mock).mockResolvedValue(mockPaymentResult);

      const response = await request(app)
        .post("/api/payments/process")
        .set("Authorization", "Bearer valid-token")
        .send({
          amount: 50.00,
          description: "Course purchase",
          paymentMethodId: "pm-1",
        });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        payment: {
          ...mockPaymentResult,
          createdAt: expect.any(String),
        },
        message: "Payment processed successfully",
      });
      expect(paymentService.processPayment).toHaveBeenCalledWith(
        "user-1",
        50.00,
        "Course purchase",
        "pm-1"
      );
    });

    it("should return 400 for invalid amount", async () => {
      const response = await request(app)
        .post("/api/payments/process")
        .set("Authorization", "Bearer valid-token")
        .send({
          amount: -10, // Invalid negative amount
          description: "Course purchase",
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe("VALIDATION_ERROR");
    });

    it("should handle no payment method error", async () => {
      (paymentService.processPayment as Mock).mockRejectedValue(
        new Error("No payment method available")
      );

      const response = await request(app)
        .post("/api/payments/process")
        .set("Authorization", "Bearer valid-token")
        .send({
          amount: 50.00,
          description: "Course purchase",
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe("NO_PAYMENT_METHOD");
    });

    it("should handle payment processing failure", async () => {
      (paymentService.processPayment as Mock).mockRejectedValue(
        new Error("Payment processing failed: Card declined")
      );

      const response = await request(app)
        .post("/api/payments/process")
        .set("Authorization", "Bearer valid-token")
        .send({
          amount: 50.00,
          description: "Course purchase",
          paymentMethodId: "pm-1",
        });

      expect(response.status).toBe(402);
      expect(response.body.code).toBe("PAYMENT_FAILED");
    });
  });

  describe("GET /api/payments/history", () => {
    it("should get payment history successfully", async () => {
      const mockPayments = [
        {
          id: "pay-1",
          amount: 50.00,
          status: "succeeded" as const,
          stripePaymentIntentId: "pi_test_123",
          description: "Course purchase",
          createdAt: new Date(),
        },
        {
          id: "pay-2",
          amount: 25.00,
          status: "succeeded" as const,
          stripePaymentIntentId: "pi_test_456",
          description: "Credit purchase",
          createdAt: new Date(),
        },
      ];

      (paymentService.getPaymentHistory as Mock).mockResolvedValue(mockPayments);

      const response = await request(app)
        .get("/api/payments/history")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        payments: mockPayments.map(payment => ({
          ...payment,
          createdAt: expect.any(String),
        })),
        count: 2,
      });
      expect(paymentService.getPaymentHistory).toHaveBeenCalledWith("user-1", undefined);
    });

    it("should handle limit parameter", async () => {
      const mockPayments = [
        {
          id: "pay-1",
          amount: 50.00,
          status: "succeeded" as const,
          stripePaymentIntentId: "pi_test_123",
          description: "Course purchase",
          createdAt: new Date(),
        },
      ];

      (paymentService.getPaymentHistory as Mock).mockResolvedValue(mockPayments);

      const response = await request(app)
        .get("/api/payments/history?limit=10")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(200);
      expect(paymentService.getPaymentHistory).toHaveBeenCalledWith("user-1", 10);
    });

    it("should return 400 for invalid limit", async () => {
      const response = await request(app)
        .get("/api/payments/history?limit=invalid")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(400);
      expect(response.body.code).toBe("INVALID_LIMIT");
    });
  });

  describe("POST /api/payments/refund", () => {
    it("should process refund successfully", async () => {
      const mockRefundResult = {
        id: "ref-1",
        amount: 25.00,
        status: "succeeded" as const,
        stripeRefundId: "re_test_123",
        reason: "Customer requested refund",
        createdAt: new Date(),
      };

      (paymentService.handleRefund as Mock).mockResolvedValue(mockRefundResult);

      const response = await request(app)
        .post("/api/payments/refund?paymentId=pay-1")
        .set("Authorization", "Bearer valid-token")
        .send({
          amount: 25.00,
          reason: "Customer requested refund",
        });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        refund: {
          ...mockRefundResult,
          createdAt: expect.any(String),
        },
        message: "Refund processed successfully",
      });
      expect(paymentService.handleRefund).toHaveBeenCalledWith(
        "pay-1",
        25.00,
        "Customer requested refund"
      );
    });

    it("should return 400 for missing payment ID", async () => {
      const response = await request(app)
        .post("/api/payments/refund")
        .set("Authorization", "Bearer valid-token")
        .send({
          amount: 25.00,
          reason: "Customer requested refund",
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe("MISSING_PAYMENT_ID");
    });

    it("should handle payment not found error", async () => {
      (paymentService.handleRefund as Mock).mockRejectedValue(
        new Error("Payment not found")
      );

      const response = await request(app)
        .post("/api/payments/refund?paymentId=pay-invalid")
        .set("Authorization", "Bearer valid-token")
        .send({
          amount: 25.00,
          reason: "Customer requested refund",
        });

      expect(response.status).toBe(404);
      expect(response.body.code).toBe("PAYMENT_NOT_FOUND");
    });

    it("should handle invalid payment status error", async () => {
      (paymentService.handleRefund as Mock).mockRejectedValue(
        new Error("Can only refund successful payments")
      );

      const response = await request(app)
        .post("/api/payments/refund?paymentId=pay-1")
        .set("Authorization", "Bearer valid-token")
        .send({
          amount: 25.00,
          reason: "Customer requested refund",
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe("INVALID_PAYMENT_STATUS");
    });

    it("should handle invalid refund amount error", async () => {
      (paymentService.handleRefund as Mock).mockRejectedValue(
        new Error("Refund amount cannot exceed original payment amount")
      );

      const response = await request(app)
        .post("/api/payments/refund?paymentId=pay-1")
        .set("Authorization", "Bearer valid-token")
        .send({
          amount: 100.00, // Exceeds original payment
          reason: "Customer requested refund",
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe("INVALID_REFUND_AMOUNT");
    });
  });

  describe("POST /api/payments/webhook", () => {
    it("should handle webhook successfully", async () => {
      const mockEvent = {
        id: "evt_test_123",
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: "pi_test_123",
            amount: 5000,
            status: "succeeded",
          },
        },
      };

      (paymentService.validateWebhookSignature as Mock).mockReturnValue(mockEvent);
      (paymentService.handleWebhook as Mock).mockResolvedValue(undefined);

      const response = await request(app)
        .post("/api/payments/webhook")
        .set("stripe-signature", "t=123,v1=signature")
        .send("webhook_payload");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ received: true });
      expect(paymentService.validateWebhookSignature).toHaveBeenCalledWith(
        expect.any(Object),
        "t=123,v1=signature"
      );
      expect(paymentService.handleWebhook).toHaveBeenCalledWith(mockEvent);
    });

    it("should return 400 for missing signature", async () => {
      const response = await request(app)
        .post("/api/payments/webhook")
        .send("webhook_payload");

      expect(response.status).toBe(400);
      expect(response.body.code).toBe("MISSING_SIGNATURE");
    });

    it("should handle invalid signature error", async () => {
      (paymentService.validateWebhookSignature as Mock).mockImplementation(() => {
        throw new Error("Invalid webhook signature");
      });

      const response = await request(app)
        .post("/api/payments/webhook")
        .set("stripe-signature", "invalid_signature")
        .send("webhook_payload");

      expect(response.status).toBe(400);
      expect(response.body.code).toBe("INVALID_SIGNATURE");
    });

    it("should handle webhook processing error", async () => {
      const mockEvent = {
        id: "evt_test_123",
        type: "payment_intent.succeeded",
        data: { object: {} },
      };

      (paymentService.validateWebhookSignature as Mock).mockReturnValue(mockEvent);
      (paymentService.handleWebhook as Mock).mockRejectedValue(
        new Error("Webhook processing failed")
      );

      const response = await request(app)
        .post("/api/payments/webhook")
        .set("stripe-signature", "t=123,v1=signature")
        .send("webhook_payload");

      expect(response.status).toBe(500);
      expect(response.body.code).toBe("WEBHOOK_ERROR");
    });
  });
});