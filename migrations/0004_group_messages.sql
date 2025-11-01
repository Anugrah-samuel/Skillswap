-- Migration to support group messages
-- Make receiver_id nullable to support group messages

ALTER TABLE "messages" ALTER COLUMN "receiver_id" DROP NOT NULL;

-- Add index for group messages (where receiver_id is null)
CREATE INDEX IF NOT EXISTS "idx_messages_group" ON "messages" ("receiver_id") WHERE "receiver_id" IS NULL;

-- Add index for better performance on group message queries
CREATE INDEX IF NOT EXISTS "idx_messages_created_at" ON "messages" ("created_at");