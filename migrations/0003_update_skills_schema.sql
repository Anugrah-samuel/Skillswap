-- Migration: Update Skills Schema to Match Frontend
-- Created: 2025-10-26
-- Description: Update skills table to use title instead of name, and add type/availability fields

-- Check if skills table exists and update it
DO $$
BEGIN
    -- Check if the skills table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'skills') THEN
        
        -- Add title column if it doesn't exist (rename from name if needed)
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'skills' AND column_name = 'title') THEN
            -- If name column exists, rename it to title
            IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'skills' AND column_name = 'name') THEN
                ALTER TABLE "skills" RENAME COLUMN "name" TO "title";
            ELSE
                -- Add title column if neither exists
                ALTER TABLE "skills" ADD COLUMN "title" text NOT NULL DEFAULT '';
            END IF;
        END IF;

        -- Add type column if it doesn't exist
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'skills' AND column_name = 'type') THEN
            ALTER TABLE "skills" ADD COLUMN "type" text NOT NULL DEFAULT 'Teaching';
        END IF;

        -- Add availability column if it doesn't exist
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'skills' AND column_name = 'availability') THEN
            ALTER TABLE "skills" ADD COLUMN "availability" text;
        END IF;

        -- Remove old columns if they exist
        IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'skills' AND column_name = 'is_offering') THEN
            -- Migrate data from is_offering/is_seeking to type field
            UPDATE "skills" SET "type" = CASE 
                WHEN "is_offering" = true THEN 'Teaching'
                WHEN "is_seeking" = true THEN 'Learning'
                ELSE 'Teaching'
            END;
            
            -- Drop old columns
            ALTER TABLE "skills" DROP COLUMN IF EXISTS "is_offering";
            ALTER TABLE "skills" DROP COLUMN IF EXISTS "is_seeking";
        END IF;

        -- Remove tags column if it exists (not used in new schema)
        IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'skills' AND column_name = 'tags') THEN
            ALTER TABLE "skills" DROP COLUMN "tags";
        END IF;

    ELSE
        -- Create the skills table with the correct schema
        CREATE TABLE "skills" (
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
    END IF;
END $$;