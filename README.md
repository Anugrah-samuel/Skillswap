# 🚀 Skillswap - Skill Exchange Platform

A modern full-stack platform for exchanging skills and knowledge with real-time messaging, user profiles, and comprehensive skill management.

## ✨ Features

- **Real-time Messaging** - Community chat with WebSocket integration
- **User Profiles** - Complete profile management with avatar uploads
- **Skill Exchange** - Browse and exchange skills with other users
- **Authentication** - Secure JWT-based authentication system
- **Payment Integration** - Stripe integration for premium features
- **Mobile Optimized** - Responsive design for all devices
- **Analytics Dashboard** - Comprehensive analytics and reporting
- **Content Moderation** - AI-powered content filtering
- **Push Notifications** - Real-time notifications system

## 🛠️ Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development
- **TailwindCSS** for styling
- **Radix UI** for components
- **TanStack Query** for data fetching
- **Socket.IO Client** for real-time features

### Backend
- **Node.js** with Express
- **TypeScript** for type safety
- **PostgreSQL** with Drizzle ORM
- **Socket.IO** for WebSocket connections
- **JWT** for authentication
- **Stripe** for payments
- **Redis** for caching and sessions

### Infrastructure
- **Docker** & Docker Compose
- **Nginx** for reverse proxy
- **AWS S3** for file storage
- **CI/CD** with GitHub Actions

## 🚀 Quick Start (Docker - Recommended)

**Prerequisites:** Only Docker Desktop installed

### Option 1: One-Command Setup

```bash
# Clone the repository
git clone <your-repo-url>
cd skillswap

# Run setup script (Windows)
setup.bat

# Or run setup script (Mac/Linux)
chmod +x setup.sh
./setup.sh
```

### Option 2: Manual Docker Setup

```bash
# Clone the repository
git clone <your-repo-url>
cd skillswap

# Create environment file
cp .env.example .env
# Edit .env with your configuration (defaults work for local development)

# Start all services
docker-compose up -d

# Access the application
open http://localhost:3000
```

That's it! Docker will automatically:
- Build the application
- Set up PostgreSQL database
- Set up Redis cache
- Run database migrations
- Start all services

## 🔧 Manual Development Setup

If you prefer to run without Docker:

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- Redis 7+

### Installation

```bash
# Clone and install dependencies
git clone <your-repo-url>
cd skillswap
npm install

# Set up environment
cp .env.example .env
# Configure your database and other settings in .env

# Run database migrations
npm run db:migrate:run

# Start development server
npm run dev
```

## 📱 Available Scripts

```bash
# Development
npm run dev              # Start development server
npm run build           # Build for production
npm run start           # Start production server

# Database
npm run db:migrate      # Run database migrations
npm run db:generate     # Generate new migrations
npm run db:push         # Push schema changes

# Testing
npm run test            # Run all tests
npm run test:unit       # Run unit tests
npm run test:e2e        # Run end-to-end tests
npm run test:coverage   # Run tests with coverage

# Docker
npm run docker:build    # Build Docker image
npm run docker:run      # Run Docker container
docker-compose up -d    # Start all services
docker-compose down     # Stop all services
```

## 🌐 API Documentation

- **Swagger UI**: http://localhost:3000/api-docs
- **API Playground**: Open `docs/API_PLAYGROUND.html` in browser
- **Developer Guide**: See `docs/DEVELOPER_GUIDE.md`

## 🔐 Environment Variables

Key environment variables (see `.env.example` for complete list):

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/skillswap

# Authentication
JWT_SECRET=your-secret-key

# Payments (optional)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# File Storage (optional)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET=your-bucket-name

# Redis (optional - defaults to localhost)
REDIS_URL=redis://localhost:6379
```

## 📊 Project Structure

```
skillswap/
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/         # Page components
│   │   ├── lib/           # Utilities and configurations
│   │   └── hooks/         # Custom React hooks
├── server/                # Backend Node.js application
│   ├── services/          # Business logic services
│   ├── middleware/        # Express middleware
│   ├── routes/           # API route handlers
│   └── migrations/       # Database migrations
├── shared/               # Shared types and schemas
├── docs/                 # Documentation
├── scripts/              # Utility scripts
├── docker-compose.yml    # Docker services configuration
└── Dockerfile           # Application container
```

## 🧪 Testing

```bash
# Run all tests
npm run test

# Run specific test suites
npm run test:unit           # Unit tests
npm run test:integration    # Integration tests
npm run test:e2e           # End-to-end tests
npm run test:security      # Security tests
npm run test:performance   # Performance tests

# Test with coverage
npm run test:coverage
```

## 🚀 Deployment

### Docker Deployment (Recommended)

```bash
# Build and deploy
docker-compose -f docker-compose.prod.yml up -d

# Or use deployment script
npm run deploy:production
```

### Manual Deployment

```bash
# Build application
npm run build

# Start production server
npm start
```

## 🔧 Key Features Implementation

### Real-time Messaging
- WebSocket connections with Socket.IO
- Optimistic updates for instant message display
- Automatic reconnection and fallback mechanisms
- Typing indicators and online status

### User Authentication
- JWT-based authentication
- Secure password hashing with bcrypt
- Session management with Redis
- Rate limiting for security

### File Uploads
- AWS S3 integration for scalable storage
- Image processing with Sharp
- Video processing with FFmpeg
- Secure presigned URLs

### Payment Processing
- Stripe integration for subscriptions
- Webhook handling for payment events
- Credit system for skill exchanges

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check the `docs/` folder
- **Issues**: Open an issue on GitHub
- **API Reference**: Visit `/api-docs` when running the server

## 🔄 Recent Updates

- ✅ Real-time messaging with WebSocket integration
- ✅ Enhanced user profiles with avatar uploads
- ✅ Improved Docker setup for easy deployment
- ✅ Comprehensive test suite
- ✅ Mobile-optimized responsive design
- ✅ Advanced analytics and reporting

---

**Made with ❤️ for the developer community**