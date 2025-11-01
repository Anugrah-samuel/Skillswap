import { vi } from 'vitest';

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.STRIPE_SECRET_KEY = 'sk_test_123';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_123';
process.env.AWS_ACCESS_KEY_ID = 'test-access-key';
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';
process.env.AWS_S3_BUCKET = 'test-bucket';
process.env.TWILIO_ACCOUNT_SID = 'test-twilio-sid';
process.env.TWILIO_AUTH_TOKEN = 'test-twilio-token';
process.env.TWILIO_API_KEY = 'test-twilio-api-key';

// Global test utilities
export const createMockUser = (overrides = {}) => ({
  id: 'test-user-id',
  username: 'testuser',
  email: 'test@example.com',
  password: 'hashedpassword',
  fullName: 'Test User',
  bio: null,
  avatarUrl: null,
  rating: 0,
  totalReviews: 0,
  creditBalance: 100,
  subscriptionStatus: 'basic' as const,
  subscriptionExpiresAt: null,
  totalSessionsCompleted: 0,
  totalSessionsTaught: 0,
  skillPoints: 0,
  badges: [],
  createdAt: new Date(),
  ...overrides,
});

export const createMockSkill = (overrides = {}) => ({
  id: 'test-skill-id',
  userId: 'test-user-id',
  title: 'Test Skill',
  description: 'Test skill description',
  category: 'Technology',
  level: 'intermediate' as const,
  type: 'teach' as const,
  createdAt: new Date(),
  ...overrides,
});

export const createMockCourse = (overrides = {}) => ({
  id: 'test-course-id',
  creatorId: 'test-user-id',
  skillId: 'test-skill-id',
  title: 'Test Course',
  description: 'Test course description',
  priceCredits: 50,
  priceMoney: null,
  status: 'draft' as const,
  totalLessons: 0,
  totalDuration: 0,
  rating: 0,
  totalReviews: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockSession = (overrides = {}) => ({
  id: 'test-session-id',
  matchId: 'test-match-id',
  teacherId: 'test-teacher-id',
  studentId: 'test-student-id',
  skillId: 'test-skill-id',
  scheduledStart: new Date(),
  scheduledEnd: new Date(Date.now() + 3600000),
  actualStart: null,
  actualEnd: null,
  status: 'scheduled' as const,
  creditsAmount: 20,
  videoRoomId: null,
  notes: null,
  createdAt: new Date(),
  ...overrides,
});

// Mock external services
export const mockStripe = {
  paymentMethods: {
    retrieve: vi.fn(),
    attach: vi.fn(),
    detach: vi.fn(),
  },
  customers: {
    create: vi.fn(),
    retrieve: vi.fn(),
    update: vi.fn(),
  },
  setupIntents: {
    create: vi.fn(),
  },
  paymentIntents: {
    create: vi.fn(),
    confirm: vi.fn(),
  },
  refunds: {
    create: vi.fn(),
  },
  webhooks: {
    constructEvent: vi.fn(),
  },
};

export const mockS3Client = {
  send: vi.fn(),
};

export const mockTwilioVideo = {
  rooms: {
    create: vi.fn(),
    get: vi.fn(),
  },
  accessTokens: {
    create: vi.fn(),
  },
};

// Reset all mocks before each test
export const resetAllMocks = () => {
  vi.clearAllMocks();
  Object.values(mockStripe).forEach(service => {
    if (typeof service === 'object') {
      Object.values(service).forEach(method => {
        if (vi.isMockFunction(method)) {
          method.mockReset();
        }
      });
    }
  });
  mockS3Client.send.mockReset();
  Object.values(mockTwilioVideo).forEach(service => {
    if (typeof service === 'object') {
      Object.values(service).forEach(method => {
        if (vi.isMockFunction(method)) {
          method.mockReset();
        }
      });
    }
  });
};