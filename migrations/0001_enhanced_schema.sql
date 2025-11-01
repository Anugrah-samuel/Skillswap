-- Migration: Enhanced SkillSwap Schema
-- Created: 2025-10-18
-- Description: Add new tables for credits, courses, subscriptions, sessions, and AI recommendations

-- Add new columns to users table
ALTER TABLE "users" ADD COLUMN "credit_balance" integer DEFAULT 0 NOT NULL;
ALTER TABLE "users" ADD COLUMN "subscription_status" varchar DEFAULT 'basic' NOT NULL;
ALTER TABLE "users" ADD COLUMN "subscription_expires_at" timestamp;
ALTER TABLE "users" ADD COLUMN "total_sessions_completed" integer DEFAULT 0 NOT NULL;
ALTER TABLE "users" ADD COLUMN "total_sessions_taught" integer DEFAULT 0 NOT NULL;
ALTER TABLE "users" ADD COLUMN "skill_points" integer DEFAULT 0 NOT NULL;
ALTER TABLE "users" ADD COLUMN "badges" text[] DEFAULT '{}' NOT NULL;

-- Credits and Transactions
CREATE TABLE IF NOT EXISTS "credit_transactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"amount" integer NOT NULL,
	"type" varchar NOT NULL,
	"description" text,
	"related_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Courses and Learning Content
CREATE TABLE IF NOT EXISTS "courses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" varchar NOT NULL,
	"skill_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"price_credits" integer NOT NULL,
	"price_money" integer,
	"status" varchar DEFAULT 'draft' NOT NULL,
	"total_lessons" integer DEFAULT 0 NOT NULL,
	"total_duration" integer DEFAULT 0 NOT NULL,
	"rating" integer DEFAULT 0 NOT NULL,
	"total_reviews" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "course_lessons" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"content_type" varchar NOT NULL,
	"content_url" text,
	"duration" integer,
	"order_index" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "course_enrollments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "course_enrollments_course_id_user_id_unique" UNIQUE("course_id","user_id")
);

-- Premium Subscriptions
CREATE TABLE IF NOT EXISTS "subscriptions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL UNIQUE,
	"plan_type" varchar NOT NULL,
	"status" varchar NOT NULL,
	"current_period_start" timestamp NOT NULL,
	"current_period_end" timestamp NOT NULL,
	"stripe_subscription_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Enhanced Session Tracking
CREATE TABLE IF NOT EXISTS "skill_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" varchar NOT NULL,
	"teacher_id" varchar NOT NULL,
	"student_id" varchar NOT NULL,
	"skill_id" varchar NOT NULL,
	"scheduled_start" timestamp NOT NULL,
	"scheduled_end" timestamp NOT NULL,
	"actual_start" timestamp,
	"actual_end" timestamp,
	"status" varchar DEFAULT 'scheduled' NOT NULL,
	"credits_amount" integer NOT NULL,
	"video_room_id" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- AI Recommendations
CREATE TABLE IF NOT EXISTS "user_preferences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL UNIQUE,
	"preferred_categories" text[],
	"learning_goals" text[],
	"availability_hours" text[],
	"max_session_duration" integer DEFAULT 60 NOT NULL,
	"preferred_teaching_style" varchar,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "recommendation_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"recommendation_type" varchar NOT NULL,
	"recommended_id" varchar NOT NULL,
	"score" numeric(3,2),
	"clicked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Payment Processing
CREATE TABLE IF NOT EXISTS "payment_methods" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"stripe_payment_method_id" varchar NOT NULL,
	"type" varchar NOT NULL,
	"last_four" varchar(4),
	"brand" varchar,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "idx_credit_transactions_user_id" ON "credit_transactions" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_credit_transactions_type" ON "credit_transactions" ("type");
CREATE INDEX IF NOT EXISTS "idx_credit_transactions_created_at" ON "credit_transactions" ("created_at");

CREATE INDEX IF NOT EXISTS "idx_courses_creator_id" ON "courses" ("creator_id");
CREATE INDEX IF NOT EXISTS "idx_courses_skill_id" ON "courses" ("skill_id");
CREATE INDEX IF NOT EXISTS "idx_courses_status" ON "courses" ("status");
CREATE INDEX IF NOT EXISTS "idx_courses_rating" ON "courses" ("rating");

CREATE INDEX IF NOT EXISTS "idx_course_lessons_course_id" ON "course_lessons" ("course_id");
CREATE INDEX IF NOT EXISTS "idx_course_lessons_order_index" ON "course_lessons" ("order_index");

CREATE INDEX IF NOT EXISTS "idx_course_enrollments_course_id" ON "course_enrollments" ("course_id");
CREATE INDEX IF NOT EXISTS "idx_course_enrollments_user_id" ON "course_enrollments" ("user_id");

CREATE INDEX IF NOT EXISTS "idx_subscriptions_user_id" ON "subscriptions" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_subscriptions_status" ON "subscriptions" ("status");

CREATE INDEX IF NOT EXISTS "idx_skill_sessions_teacher_id" ON "skill_sessions" ("teacher_id");
CREATE INDEX IF NOT EXISTS "idx_skill_sessions_student_id" ON "skill_sessions" ("student_id");
CREATE INDEX IF NOT EXISTS "idx_skill_sessions_skill_id" ON "skill_sessions" ("skill_id");
CREATE INDEX IF NOT EXISTS "idx_skill_sessions_status" ON "skill_sessions" ("status");
CREATE INDEX IF NOT EXISTS "idx_skill_sessions_scheduled_start" ON "skill_sessions" ("scheduled_start");

CREATE INDEX IF NOT EXISTS "idx_user_preferences_user_id" ON "user_preferences" ("user_id");

CREATE INDEX IF NOT EXISTS "idx_recommendation_history_user_id" ON "recommendation_history" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_recommendation_history_type" ON "recommendation_history" ("recommendation_type");
CREATE INDEX IF NOT EXISTS "idx_recommendation_history_created_at" ON "recommendation_history" ("created_at");

CREATE INDEX IF NOT EXISTS "idx_payment_methods_user_id" ON "payment_methods" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_payment_methods_is_default" ON "payment_methods" ("is_default");