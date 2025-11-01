import { z } from "zod";

// Update schemas for routes
export const updateProfileSchema = z.object({
  fullName: z.string().min(2).optional(),
  bio: z.string().optional(),
  avatarUrl: z.string().optional(),
  // Explicitly exclude protected fields
}).strict();

export const updateSkillSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  level: z.string().optional(),
  type: z.string().optional(),
  availability: z.string().optional(),
}).strict();

export const updateEventSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  startTime: z.string().or(z.date()).optional(),
  endTime: z.string().or(z.date()).optional(),
  skillId: z.string().optional(),
}).strict();

// Credits System Validation
export const creditTransactionSchema = z.object({
  amount: z.number().int(),
  type: z.enum(["earned", "spent", "purchased", "refunded"]),
  description: z.string().optional(),
  relatedId: z.string().optional(),
});

export const purchaseCreditsSchema = z.object({
  amount: z.number().int().min(1).max(10000),
  paymentMethodId: z.string().min(1),
});

// Course System Validation
export const createCourseSchema = z.object({
  skillId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().min(10).max(2000),
  priceCredits: z.number().int().min(0),
  priceMoney: z.number().int().min(0).optional(),
});

export const updateCourseSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(10).max(2000).optional(),
  priceCredits: z.number().int().min(0).optional(),
  priceMoney: z.number().int().min(0).optional(),
}).strict();

export const createCourseLessonSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  contentType: z.enum(["video", "text", "file"]),
  contentUrl: z.string().url().optional(),
  duration: z.number().int().min(0).optional(),
  orderIndex: z.number().int().min(0),
});

export const updateCourseLessonSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  contentType: z.enum(["video", "text", "file"]).optional(),
  contentUrl: z.string().url().optional(),
  duration: z.number().int().min(0).optional(),
  orderIndex: z.number().int().min(0).optional(),
}).strict();

export const enrollInCourseSchema = z.object({
  paymentMethod: z.enum(["credits", "money"]),
});

export const updateProgressSchema = z.object({
  progress: z.number().int().min(0).max(100),
});

// Subscription System Validation
export const createSubscriptionSchema = z.object({
  planType: z.enum(["basic", "premium"]),
  paymentMethodId: z.string().min(1),
});

export const updateSubscriptionSchema = z.object({
  planType: z.enum(["basic", "premium"]),
});

// Session Management Validation
export const scheduleSessionSchema = z.object({
  matchId: z.string().min(1),
  teacherId: z.string().min(1),
  studentId: z.string().min(1),
  skillId: z.string().min(1),
  scheduledStart: z.string().datetime().or(z.date()),
  scheduledEnd: z.string().datetime().or(z.date()),
  creditsAmount: z.number().int().min(1),
});

export const updateSessionSchema = z.object({
  status: z.enum(["scheduled", "in_progress", "completed", "cancelled"]).optional(),
  actualStart: z.string().datetime().or(z.date()).optional(),
  actualEnd: z.string().datetime().or(z.date()).optional(),
  videoRoomId: z.string().optional(),
  notes: z.string().max(2000).optional(),
}).strict();

// User Preferences Validation
export const updateUserPreferencesSchema = z.object({
  preferredCategories: z.array(z.string()).optional(),
  learningGoals: z.array(z.string()).optional(),
  availabilityHours: z.array(z.string()).optional(),
  maxSessionDuration: z.number().int().min(15).max(240).optional(),
  preferredTeachingStyle: z.string().optional(),
});

// Enhanced Authentication Validation
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Password confirmation is required"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const resetPasswordRequestSchema = z.object({
  email: z.string().email("Valid email is required"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Password confirmation is required"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Recommendation System Validation
export const recordRecommendationInteractionSchema = z.object({
  recommendationType: z.enum(["skill", "user", "course"]),
  recommendedId: z.string().min(1),
  clicked: z.boolean().default(false),
});

// Payment Method Validation
export const addPaymentMethodSchema = z.object({
  stripePaymentMethodId: z.string().min(1),
  type: z.enum(["card", "bank_account"]),
  lastFour: z.string().length(4).optional(),
  brand: z.string().optional(),
});

export const setDefaultPaymentMethodSchema = z.object({
  paymentMethodId: z.string().min(1),
});

// Payment Processing Validation
export const processPaymentSchema = z.object({
  amount: z.number().min(0.01).max(10000),
  description: z.string().min(1).max(500),
  paymentMethodId: z.string().optional(),
});

export const refundPaymentSchema = z.object({
  amount: z.number().min(0.01).optional(),
  reason: z.string().max(500).optional(),
});

// Search and Filter Validation
export const courseSearchSchema = z.object({
  query: z.string().optional(),
  category: z.string().optional(),
  minPrice: z.number().int().min(0).optional(),
  maxPrice: z.number().int().min(0).optional(),
  level: z.string().optional(),
  sortBy: z.enum(["rating", "price", "created", "popularity"]).default("rating"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(50).default(20),
});

export const userMatchingSchema = z.object({
  skillId: z.string().min(1),
  level: z.string().optional(),
  availability: z.string().optional(),
  maxDistance: z.number().int().min(0).optional(),
  sortBy: z.enum(["rating", "distance", "compatibility"]).default("compatibility"),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(50).default(20),
});
