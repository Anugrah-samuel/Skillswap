# SkillSwap - Community Skill Exchange Platform

## Overview
SkillSwap is a professional skill exchange platform with a minimalist black and white design. Users can exchange skills, find learning partners, schedule sessions, and build a trusted community through ratings and reviews.

## Current Status
**Phase:** Backend Complete, Frontend-Backend Integration In Progress
**Last Updated:** October 16, 2025

## Project Architecture

### Frontend (Complete)
- **Framework:** React 18+ with TypeScript
- **Routing:** Wouter
- **Styling:** Tailwind CSS with custom design system
- **UI Components:** shadcn/ui
- **State Management:** TanStack Query v5
- **Theme:** Dark/Light mode with black and white minimalist aesthetic

### Backend (Complete)
- **Framework:** Express.js
- **Storage:** In-memory storage (MemStorage) - full CRUD for all entities
- **Schema:** Drizzle ORM with PostgreSQL types
- **Validation:** Zod schemas for all endpoints
- **Security:** Protected fields, password exclusion, rating integrity (stored as integer * 10)

## Key Features Implemented

### Landing Page
- Hero section with generated background image
- Feature highlights in cards
- Call-to-action buttons for signup/login
- Fully responsive design

### Authentication System
- Signup page with validation
- Login page with password toggle
- Forgot password flow
- Form validation and error handling

### Dashboard
- Sidebar navigation with 7 sections
- Home page with stats, latest matches, and pending requests
- Fully responsive layout with theme toggle and notifications

### Skill Management
- Add, edit, delete skills (teaching or learning)
- Search and filter by category, type
- Skill cards with level, category, availability badges
- Empty states and loading states

### Skill Discovery
- Browse and search skill matches
- Filter by category
- View detailed match profiles with ratings
- Request skill trade functionality
- Match scoring system (percentage match)

### Real-time Chat UI
- Conversation list with search
- Message interface with sent/received states
- Typing indicators
- Online/offline status
- Unread message badges

### Calendar System
- View upcoming and past sessions
- Create, edit, delete skill exchange events
- Session details with partner, skill, time, duration
- Quick stats sidebar

### Profile Management
- Public profile with avatar, bio, ratings
- Skills teaching and learning lists
- Reviews and ratings display
- Edit profile modal
- Achievement stats

### Settings
- Password change functionality
- Notification preferences (email, push)
- Privacy settings (profile visibility, email display, ratings)
- All settings persist with toast notifications

### Additional Features
- Notifications dropdown with unread count
- Dark/Light theme toggle
- Responsive design for mobile, tablet, desktop
- Comprehensive data-testid attributes for testing

## Data Models

### User
- id, username, email, password, fullName, bio, avatarUrl
- rating, totalReviews, createdAt

### Skill
- id, userId, title, description, category, level, type, availability

### SkillMatch
- id, userId, matchedUserId, userSkillId, matchedSkillId, status

### Message
- id, senderId, receiverId, content, read, createdAt

### Event
- id, userId, partnerId, title, description, startTime, endTime, skillId

### Review
- id, userId, reviewerId, rating, comment, createdAt

### Notification
- id, userId, type, title, message, read, relatedId

## Design System

### Colors
- Background: hsl(0 0% 9%) in dark mode
- Card: hsl(0 0% 12%)
- Foreground: hsl(0 0% 95%)
- Muted foreground: hsl(0 0% 65%)
- Borders: hsl(0 0% 20%)

### Typography
- Font: Inter
- Headings: Bold, tight tracking
- Body: Regular, 16px base size

### Components
- Custom elevation system (hover-elevate, active-elevate-2)
- Consistent spacing (p-6 to p-8 for cards)
- Rounded corners (rounded-lg default)
- Smooth transitions (200ms)

## File Structure

```
client/
├── src/
│   ├── components/
│   │   ├── ui/               # shadcn components
│   │   ├── app-sidebar.tsx
│   │   ├── theme-provider.tsx
│   │   ├── theme-toggle.tsx
│   │   └── notifications-dropdown.tsx
│   ├── pages/
│   │   ├── dashboard/
│   │   │   ├── layout.tsx
│   │   │   ├── home.tsx
│   │   │   ├── skills.tsx
│   │   │   ├── discover.tsx
│   │   │   ├── chat.tsx
│   │   │   ├── calendar.tsx
│   │   │   ├── profile.tsx
│   │   │   └── settings.tsx
│   │   ├── landing.tsx
│   │   ├── signup.tsx
│   │   ├── login.tsx
│   │   └── forgot-password.tsx
│   ├── App.tsx
│   └── index.css
├── index.html
└── package.json

server/
├── routes.ts         # API routes (to be implemented)
└── storage.ts        # Storage interface and MemStorage

shared/
└── schema.ts         # Complete data models
```

## API Endpoints (Implemented)

### Authentication
- ✅ POST /api/auth/signup - User registration with validation
- ✅ POST /api/auth/login - User login (passwords never returned in responses)
- ✅ GET /api/auth/me - Get current user

### Skills
- ✅ GET /api/skills?userId=:id - Get skills by user
- ✅ POST /api/skills - Create skill with validation
- ✅ PUT /api/skills/:id - Update skill (validated, only allowed fields)
- ✅ DELETE /api/skills/:id - Delete skill

### Matches
- ✅ GET /api/matches?userId=:id - Get user's matches
- ✅ POST /api/matches - Create match request
- ✅ PUT /api/matches/:id/status - Update match status (pending/accepted/rejected)
- ✅ GET /api/matches/suggestions/:userId - Get match suggestions

### Messages
- ✅ GET /api/messages?userId=:id&partnerId=:id - Get conversation messages
- ✅ POST /api/messages - Send message (creates notification)
- ✅ PUT /api/messages/:id/read - Mark message as read

### Events
- ✅ GET /api/events?userId=:id - Get user's events
- ✅ POST /api/events - Create event (creates notification)
- ✅ PUT /api/events/:id - Update event (validated, only allowed fields)
- ✅ DELETE /api/events/:id - Delete event

### Profile
- ✅ GET /api/profile/:userId - Get user profile
- ✅ PUT /api/profile - Update profile (validated, protected fields excluded)
- ✅ GET /api/reviews/:userId - Get user reviews

### Reviews
- ✅ POST /api/reviews - Create review (auto-updates user rating as integer * 10)

### Notifications
- ✅ GET /api/notifications?userId=:id - Get user notifications
- ✅ PUT /api/notifications/:id/read - Mark notification as read
- ✅ PUT /api/notifications/read-all - Mark all as read

## Development Guidelines

### Frontend Standards
- Follow design_guidelines.md for all UI
- Use existing shadcn components
- Add data-testid to all interactive elements
- Maintain consistent spacing and typography
- Use hover-elevate and active-elevate-2 classes

### Backend Standards
- Use storage interface for all CRUD operations
- Validate request bodies with Zod schemas
- Keep routes thin, logic in storage layer
- Return proper error responses

## Implementation Progress
1. ✅ Complete frontend components
2. ✅ Implement backend API routes with validation
3. ✅ Fix backend security (rating integrity, field protection, password exclusion)
4. ✅ Integrate auth pages (signup, login) with backend
5. ✅ Integrate Skills page with react-hook-form + API
6. ⏳ Integrate remaining dashboard pages (Discover, Chat, Calendar, Profile)
7. ⏳ Add comprehensive error handling and loading states
8. ⏳ Test all critical user journeys with e2e tests

## User Preferences
- Minimalist black and white design
- Professional, modern aesthetic
- Smooth animations and transitions
- Comprehensive feature set
- Production-ready quality
