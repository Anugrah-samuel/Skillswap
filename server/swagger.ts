import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import type { Express } from 'express';

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SkillSwap API',
      version: '1.0.0',
      description: 'A comprehensive skill exchange platform API with credits system, course builder, premium subscriptions, AI recommendations, and more.',
      contact: {
        name: 'SkillSwap Team',
        email: 'api@skillswap.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      },
      {
        url: 'https://api.skillswap.com',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from login endpoint'
        },
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API key for mobile applications'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            username: { type: 'string' },
            email: { type: 'string', format: 'email' },
            fullName: { type: 'string' },
            bio: { type: 'string' },
            avatarUrl: { type: 'string', format: 'uri' },
            location: { type: 'string' },
            rating: { type: 'number', minimum: 0, maximum: 5 },
            totalReviews: { type: 'integer', minimum: 0 },
            creditBalance: { type: 'integer', minimum: 0 },
            subscriptionStatus: { type: 'string', enum: ['basic', 'premium'] },
            subscriptionExpiresAt: { type: 'string', format: 'date-time' },
            totalSessionsCompleted: { type: 'integer', minimum: 0 },
            totalSessionsTaught: { type: 'integer', minimum: 0 },
            skillPoints: { type: 'integer', minimum: 0 },
            badges: { type: 'array', items: { type: 'string' } },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        Skill: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            description: { type: 'string' },
            category: { type: 'string' },
            level: { type: 'string', enum: ['Beginner', 'Intermediate', 'Advanced', 'Expert'] },
            type: { type: 'string', enum: ['Teaching', 'Learning'] },
            availability: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        Course: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            creatorId: { type: 'string', format: 'uuid' },
            skillId: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            description: { type: 'string' },
            priceCredits: { type: 'integer', minimum: 0 },
            priceMoney: { type: 'integer', minimum: 0 },
            status: { type: 'string', enum: ['draft', 'published', 'archived'] },
            totalLessons: { type: 'integer', minimum: 0 },
            totalDuration: { type: 'integer', minimum: 0 },
            rating: { type: 'number', minimum: 0, maximum: 5 },
            totalReviews: { type: 'integer', minimum: 0 },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        Session: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            matchId: { type: 'string', format: 'uuid' },
            teacherId: { type: 'string', format: 'uuid' },
            studentId: { type: 'string', format: 'uuid' },
            skillId: { type: 'string', format: 'uuid' },
            scheduledStart: { type: 'string', format: 'date-time' },
            scheduledEnd: { type: 'string', format: 'date-time' },
            actualStart: { type: 'string', format: 'date-time' },
            actualEnd: { type: 'string', format: 'date-time' },
            status: { type: 'string', enum: ['scheduled', 'in_progress', 'completed', 'cancelled'] },
            creditsAmount: { type: 'integer', minimum: 0 },
            videoRoomId: { type: 'string' },
            notes: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        CreditTransaction: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            amount: { type: 'integer' },
            type: { type: 'string', enum: ['earned', 'spent', 'purchased', 'refunded'] },
            description: { type: 'string' },
            relatedId: { type: 'string', format: 'uuid' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        Subscription: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            planType: { type: 'string', enum: ['basic', 'premium'] },
            status: { type: 'string', enum: ['active', 'cancelled', 'expired'] },
            currentPeriodStart: { type: 'string', format: 'date-time' },
            currentPeriodEnd: { type: 'string', format: 'date-time' },
            stripeSubscriptionId: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        PaymentMethod: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            stripePaymentMethodId: { type: 'string' },
            type: { type: 'string', enum: ['card', 'bank_account'] },
            lastFour: { type: 'string' },
            brand: { type: 'string' },
            isDefault: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        Recommendation: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            type: { type: 'string', enum: ['skill', 'user', 'course'] },
            title: { type: 'string' },
            description: { type: 'string' },
            score: { type: 'number', minimum: 0, maximum: 1 },
            reason: { type: 'string' },
            metadata: { type: 'object' }
          }
        },
        Analytics: {
          type: 'object',
          properties: {
            totalSessions: { type: 'integer', minimum: 0 },
            totalSessionsTaught: { type: 'integer', minimum: 0 },
            totalCreditsEarned: { type: 'integer', minimum: 0 },
            totalCreditsSpent: { type: 'integer', minimum: 0 },
            averageRating: { type: 'number', minimum: 0, maximum: 5 },
            skillPoints: { type: 'integer', minimum: 0 },
            learningStreak: { type: 'integer', minimum: 0 },
            badges: { type: 'array', items: { type: 'string' } }
          }
        },
        Error: {
          type: 'object',
          properties: {
            code: { type: 'string' },
            message: { type: 'string' },
            details: { type: 'object' },
            timestamp: { type: 'string', format: 'date-time' }
          }
        }
      },
      responses: {
        UnauthorizedError: {
          description: 'Authentication token is missing or invalid',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        ForbiddenError: {
          description: 'Access forbidden - insufficient permissions',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        NotFoundError: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        ValidationError: {
          description: 'Invalid input data',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        InternalServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ],
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization endpoints'
      },
      {
        name: 'Users',
        description: 'User profile management'
      },
      {
        name: 'Skills',
        description: 'Skill management and discovery'
      },
      {
        name: 'Credits',
        description: 'Credit system for skill exchanges'
      },
      {
        name: 'Courses',
        description: 'Course creation and management'
      },
      {
        name: 'Subscriptions',
        description: 'Premium subscription management'
      },
      {
        name: 'Sessions',
        description: 'Skill exchange session management'
      },
      {
        name: 'Recommendations',
        description: 'AI-powered recommendations'
      },
      {
        name: 'Payments',
        description: 'Payment processing and methods'
      },
      {
        name: 'Analytics',
        description: 'User analytics and dashboard'
      },
      {
        name: 'Notifications',
        description: 'Notification management'
      },
      {
        name: 'Media',
        description: 'File upload and media management'
      },
      {
        name: 'Mobile',
        description: 'Mobile-optimized endpoints'
      }
    ]
  },
  apis: [
    './server/routes.ts',
    './server/*-routes.ts',
    './server/swagger-docs/*.yaml'
  ]
};

const specs = swaggerJSDoc(options);

export function setupSwagger(app: Express): void {
  // Serve Swagger UI
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'SkillSwap API Documentation',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true
    }
  }));

  // Serve raw OpenAPI spec
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });

  // Serve API playground
  app.get('/api-playground', (req, res) => {
    res.sendFile('API_PLAYGROUND.html', { root: './docs' });
  });
}

export { specs };