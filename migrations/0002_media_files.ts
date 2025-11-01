import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const mediaFiles = pgTable("media_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: varchar("mime_type").notNull(),
  fileSize: integer("file_size").notNull(), // In bytes
  fileType: varchar("file_type").notNull(), // 'image', 'video', 'document', 'audio'
  s3Key: text("s3_key").notNull(),
  s3Bucket: varchar("s3_bucket").notNull(),
  cdnUrl: text("cdn_url"),
  thumbnailUrl: text("thumbnail_url"),
  processedUrl: text("processed_url"), // For transcoded videos or resized images
  processingStatus: varchar("processing_status").default("pending").notNull(), // 'pending', 'processing', 'completed', 'failed'
  metadata: text("metadata"), // JSON string for additional file metadata
  relatedType: varchar("related_type"), // 'course', 'lesson', 'profile', 'message'
  relatedId: varchar("related_id"), // ID of the related entity
  isPublic: boolean("is_public").default(false).notNull(),
  virusScanStatus: varchar("virus_scan_status").default("pending").notNull(), // 'pending', 'clean', 'infected'
  virusScanResult: text("virus_scan_result"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export async function up(db: any) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS media_files (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type VARCHAR NOT NULL,
      file_size INTEGER NOT NULL,
      file_type VARCHAR NOT NULL,
      s3_key TEXT NOT NULL,
      s3_bucket VARCHAR NOT NULL,
      cdn_url TEXT,
      thumbnail_url TEXT,
      processed_url TEXT,
      processing_status VARCHAR DEFAULT 'pending' NOT NULL,
      metadata TEXT,
      related_type VARCHAR,
      related_id VARCHAR,
      is_public BOOLEAN DEFAULT false NOT NULL,
      virus_scan_status VARCHAR DEFAULT 'pending' NOT NULL,
      virus_scan_result TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `);

  // Create indexes for better performance
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_media_files_user_id ON media_files(user_id);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_media_files_related ON media_files(related_type, related_id);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_media_files_file_type ON media_files(file_type);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_media_files_created_at ON media_files(created_at);
  `);
}

export async function down(db: any) {
  await db.execute(sql`DROP TABLE IF EXISTS media_files;`);
}