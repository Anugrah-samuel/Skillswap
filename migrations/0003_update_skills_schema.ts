import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp } from "drizzle-orm/pg-core";

// Updated skills table schema
export const skills = pgTable("skills", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  level: text("level").notNull(),
  type: text("type").notNull(),
  availability: text("availability"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Migration function
export async function up(db: any) {
  // The SQL migration handles the schema changes
  await db.execute(sql`
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
  `);
}

export async function down(db: any) {
  // Rollback migration - restore old schema
  await db.execute(sql`
    DO $$
    BEGIN
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'skills') THEN
            -- Add old columns back
            IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'skills' AND column_name = 'is_offering') THEN
                ALTER TABLE "skills" ADD COLUMN "is_offering" boolean DEFAULT true;
            END IF;
            
            IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'skills' AND column_name = 'is_seeking') THEN
                ALTER TABLE "skills" ADD COLUMN "is_seeking" boolean DEFAULT false;
            END IF;

            -- Migrate data back from type to is_offering/is_seeking
            UPDATE "skills" SET 
                "is_offering" = CASE WHEN "type" = 'Teaching' THEN true ELSE false END,
                "is_seeking" = CASE WHEN "type" = 'Learning' THEN true ELSE false END;

            -- Rename title back to name if needed
            IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'skills' AND column_name = 'title') THEN
                ALTER TABLE "skills" RENAME COLUMN "title" TO "name";
            END IF;

            -- Remove new columns
            ALTER TABLE "skills" DROP COLUMN IF EXISTS "type";
            ALTER TABLE "skills" DROP COLUMN IF EXISTS "availability";
        END IF;
    END $$;
  `);
}