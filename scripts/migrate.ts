#!/usr/bin/env tsx

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { config, validateProductionConfig } from '../server/config';

async function runMigrations() {
  console.log('🚀 Starting database migrations...');
  
  // Validate production config if needed
  validateProductionConfig();

  const connection = postgres(config.DATABASE_URL, {
    max: 1,
    ssl: config.DATABASE_SSL ? 'require' : false,
  });

  const db = drizzle(connection);

  try {
    console.log('📦 Running migrations...');
    await migrate(db, { migrationsFolder: './migrations' });
    console.log('✅ Migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

// Run migrations if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations().catch((error) => {
    console.error('❌ Migration script failed:', error);
    process.exit(1);
  });
}

export { runMigrations };