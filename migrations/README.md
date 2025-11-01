# Database Migrations

This directory contains database migration files for the SkillSwap backend enhancement.

## Migration Files

### 0001_enhanced_schema
- **File**: `0001_enhanced_schema.sql`
- **Description**: Adds new database tables and columns for the enhanced SkillSwap features
- **Features Added**:
  - Credits system with transaction tracking
  - Course builder with lessons and enrollments
  - Premium subscription management
  - Enhanced session tracking with video integration
  - AI recommendation system with user preferences
  - Payment method management

## New Tables Added

1. **credit_transactions** - Tracks all credit transactions (earned, spent, purchased, refunded)
2. **courses** - Stores course information created by users
3. **course_lessons** - Individual lessons within courses
4. **course_enrollments** - User enrollments in courses with progress tracking
5. **subscriptions** - Premium subscription management
6. **skill_sessions** - Enhanced session tracking with video room integration
7. **user_preferences** - AI recommendation preferences for users
8. **recommendation_history** - Tracks recommendation interactions
9. **payment_methods** - Stripe payment method storage

## Enhanced Tables

### users
Added new columns:
- `credit_balance` - User's current credit balance
- `subscription_status` - Current subscription level (basic/premium)
- `subscription_expires_at` - When premium subscription expires
- `total_sessions_completed` - Count of completed sessions as student
- `total_sessions_taught` - Count of completed sessions as teacher
- `skill_points` - Gamification points
- `badges` - Array of earned badges

## Running Migrations

### Using Drizzle Kit (Recommended)
```bash
npm run db:generate  # Generate migration files
npm run db:migrate   # Apply migrations to database
```

### Using Custom Migration Script
```bash
npm run db:migrate:run  # Run migrations using custom script
```

### Manual Migration
You can also run the SQL file directly against your PostgreSQL database:
```bash
psql -d your_database_url -f migrations/0001_enhanced_schema.sql
```

## Environment Variables Required

Make sure you have the following environment variable set:
- `DATABASE_URL` - PostgreSQL connection string

## Indexes Created

The migration includes performance indexes on:
- User ID columns for all user-related tables
- Status columns for filtering
- Date columns for time-based queries
- Foreign key relationships

## Notes

- All new tables use UUID primary keys with `gen_random_uuid()`
- Timestamps use PostgreSQL's `now()` function for defaults
- Array columns are used for flexible data storage (categories, goals, badges)
- Unique constraints ensure data integrity (e.g., one enrollment per user per course)
- Indexes are created for optimal query performance