import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Environment validation schema
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),
  DATABASE_MAX_CONNECTIONS: z.coerce.number().default(20),
  DATABASE_SSL: z.coerce.boolean().default(false),

  // Redis
  REDIS_URL: z.string().url().optional(),
  REDIS_TTL: z.coerce.number().default(3600),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // Stripe
  STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
  STRIPE_PUBLISHABLE_KEY: z.string().startsWith('pk_'),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),

  // Twilio
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_API_KEY: z.string().optional(),
  TWILIO_API_SECRET: z.string().optional(),

  // AWS
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().default('us-east-1'),
  AWS_S3_BUCKET: z.string().optional(),

  // Email
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().email().optional(),
  SMTP_PASS: z.string().optional(),
  FROM_EMAIL: z.string().email().default('noreply@skillswap.com'),

  // Firebase
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().email().optional(),

  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  CORS_ORIGIN: z.string().url().default('http://localhost:3000'),
  SESSION_SECRET: z.string().min(32),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(1000),

  // File Upload
  MAX_FILE_SIZE: z.coerce.number().default(10485760), // 10MB
  ALLOWED_FILE_TYPES: z.string().default('image/jpeg,image/png,image/gif,video/mp4,application/pdf'),

  // Monitoring
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  SENTRY_DSN: z.string().url().optional(),

  // Content Moderation
  CONTENT_MODERATION_API_KEY: z.string().optional(),

  // Security
  BCRYPT_ROUNDS: z.coerce.number().default(12),
  API_KEY_LENGTH: z.coerce.number().default(32),

  // Development
  VITE_DEV_SERVER: z.coerce.boolean().default(false),
});

// Validate environment variables
function validateEnv() {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    console.error('❌ Invalid environment variables:');
    if (error instanceof z.ZodError) {
      error.errors.forEach((err) => {
        console.error(`  ${err.path.join('.')}: ${err.message}`);
      });
    }
    process.exit(1);
  }
}

export const config = validateEnv();

// Type-safe config object
export type Config = z.infer<typeof envSchema>;

// Helper functions
export const isDevelopment = () => config.NODE_ENV === 'development';
export const isProduction = () => config.NODE_ENV === 'production';
export const isTest = () => config.NODE_ENV === 'test';

// Database configuration
export const getDatabaseConfig = () => ({
  url: config.DATABASE_URL,
  maxConnections: config.DATABASE_MAX_CONNECTIONS,
  ssl: config.DATABASE_SSL || isProduction(),
});

// Redis configuration
export const getRedisConfig = () => ({
  url: config.REDIS_URL,
  ttl: config.REDIS_TTL,
});

// JWT configuration
export const getJWTConfig = () => ({
  secret: config.JWT_SECRET,
  expiresIn: config.JWT_EXPIRES_IN,
  refreshExpiresIn: config.JWT_REFRESH_EXPIRES_IN,
});

// Stripe configuration
export const getStripeConfig = () => ({
  secretKey: config.STRIPE_SECRET_KEY,
  publishableKey: config.STRIPE_PUBLISHABLE_KEY,
  webhookSecret: config.STRIPE_WEBHOOK_SECRET,
});

// AWS configuration
export const getAWSConfig = () => ({
  accessKeyId: config.AWS_ACCESS_KEY_ID,
  secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
  region: config.AWS_REGION,
  s3Bucket: config.AWS_S3_BUCKET,
});

// Email configuration
export const getEmailConfig = () => ({
  host: config.SMTP_HOST,
  port: config.SMTP_PORT,
  user: config.SMTP_USER,
  pass: config.SMTP_PASS,
  from: config.FROM_EMAIL,
});

// Firebase configuration
export const getFirebaseConfig = () => ({
  projectId: config.FIREBASE_PROJECT_ID,
  privateKey: config.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  clientEmail: config.FIREBASE_CLIENT_EMAIL,
});

// CORS configuration
export const getCORSConfig = () => ({
  origin: isProduction() 
    ? [config.CORS_ORIGIN, 'https://skillswap.com', 'https://www.skillswap.com']
    : [config.CORS_ORIGIN, 'http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
});

// Rate limiting configuration
export const getRateLimitConfig = () => ({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_REQUESTS,
});

// File upload configuration
export const getFileUploadConfig = () => ({
  maxSize: config.MAX_FILE_SIZE,
  allowedTypes: config.ALLOWED_FILE_TYPES.split(','),
});

// Logging configuration
export const getLoggingConfig = () => ({
  level: config.LOG_LEVEL,
  sentryDsn: config.SENTRY_DSN,
});

// Security configuration
export const getSecurityConfig = () => ({
  bcryptRounds: config.BCRYPT_ROUNDS,
  apiKeyLength: config.API_KEY_LENGTH,
  sessionSecret: config.SESSION_SECRET,
});

// Validate required production environment variables
export const validateProductionConfig = () => {
  if (!isProduction()) return;

  const requiredProdVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'SESSION_SECRET',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
  ];

  const missing = requiredProdVars.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required production environment variables:');
    missing.forEach(key => console.error(`  ${key}`));
    process.exit(1);
  }

  // Validate secrets are not default values
  const defaultSecrets = [
    { key: 'JWT_SECRET', value: config.JWT_SECRET },
    { key: 'SESSION_SECRET', value: config.SESSION_SECRET },
  ];

  const insecureSecrets = defaultSecrets.filter(({ value }) => 
    value.includes('change-this') || value.includes('your-') || value.length < 32
  );

  if (insecureSecrets.length > 0) {
    console.error('❌ Insecure secrets detected in production:');
    insecureSecrets.forEach(({ key }) => console.error(`  ${key}`));
    process.exit(1);
  }

  console.log('✅ Production configuration validated');
};