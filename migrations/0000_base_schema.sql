-- Base Schema Creation
-- This creates all the base tables needed for SkillSwap

-- Users table
CREATE TABLE IF NOT EXISTS "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text UNIQUE NOT NULL,
	"email" text UNIQUE NOT NULL,
	"password" text NOT NULL,
	"full_name" text NOT NULL,
	"bio" text,
	"avatar_url" text,
	"rating" integer DEFAULT 0,
	"total_reviews" integer DEFAULT 0,
	"credit_balance" integer DEFAULT 0 NOT NULL,
	"subscription_status" varchar DEFAULT 'basic' NOT NULL,
	"subscription_expires_at" timestamp,
	"total_sessions_completed" integer DEFAULT 0 NOT NULL,
	"total_sessions_taught" integer DEFAULT 0 NOT NULL,
	"skill_points" integer DEFAULT 0 NOT NULL,
	"badges" text[] DEFAULT '{}' NOT NULL,
	"stripe_customer_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Skills table
CREATE TABLE IF NOT EXISTS "skills" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"level" text NOT NULL,
	"type" text NOT NULL,
	"availability" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Skill matches table
CREATE TABLE IF NOT EXISTS "skill_matches" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"matched_user_id" varchar NOT NULL,
	"user_skill_id" varchar NOT NULL,
	"matched_skill_id" varchar NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Messages table
CREATE TABLE IF NOT EXISTS "messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender_id" varchar NOT NULL,
	"receiver_id" varchar NOT NULL,
	"content" text NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Events table
CREATE TABLE IF NOT EXISTS "events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"partner_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"skill_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Reviews table
CREATE TABLE IF NOT EXISTS "reviews" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"reviewer_id" varchar NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Notifications table
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"related_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Create basic indexes
CREATE INDEX IF NOT EXISTS "idx_users_username" ON "users" ("username");
CREATE INDEX IF NOT EXISTS "idx_users_email" ON "users" ("email");
CREATE INDEX IF NOT EXISTS "idx_skills_user_id" ON "skills" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_skills_category" ON "skills" ("category");
CREATE INDEX IF NOT EXISTS "idx_skill_matches_user_id" ON "skill_matches" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_skill_matches_matched_user_id" ON "skill_matches" ("matched_user_id");
CREATE INDEX IF NOT EXISTS "idx_messages_sender_id" ON "messages" ("sender_id");
CREATE INDEX IF NOT EXISTS "idx_messages_receiver_id" ON "messages" ("receiver_id");
CREATE INDEX IF NOT EXISTS "idx_events_user_id" ON "events" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_events_partner_id" ON "events" ("partner_id");
CREATE INDEX IF NOT EXISTS "idx_reviews_user_id" ON "reviews" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_notifications_user_id" ON "notifications" ("user_id");