#!/usr/bin/env tsx

import { execSync } from 'child_process';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { config } from '../server/config';

interface BackupConfig {
  type: 'database' | 'files' | 'full';
  destination?: string;
  compress?: boolean;
  retention?: number; // days
}

class BackupManager {
  private config: BackupConfig;
  private backupDir: string;

  constructor(config: BackupConfig) {
    this.config = config;
    this.backupDir = config.destination || './backups';
    
    // Ensure backup directory exists
    if (!existsSync(this.backupDir)) {
      mkdirSync(this.backupDir, { recursive: true });
    }
  }

  async createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `skillswap-${this.config.type}-${timestamp}`;

    console.log(`🗄️  Creating ${this.config.type} backup: ${backupName}`);

    try {
      switch (this.config.type) {
        case 'database':
          await this.backupDatabase(backupName);
          break;
        case 'files':
          await this.backupFiles(backupName);
          break;
        case 'full':
          await this.backupDatabase(`${backupName}-db`);
          await this.backupFiles(`${backupName}-files`);
          break;
      }

      if (this.config.retention) {
        await this.cleanupOldBackups();
      }

      console.log('✅ Backup completed successfully');
    } catch (error) {
      console.error('❌ Backup failed:', error);
      throw error;
    }
  }

  private async backupDatabase(backupName: string) {
    console.log('🗃️  Backing up database...');

    const backupFile = join(this.backupDir, `${backupName}.sql`);
    
    // Parse database URL to extract connection details
    const dbUrl = new URL(config.DATABASE_URL);
    const host = dbUrl.hostname;
    const port = dbUrl.port || '5432';
    const database = dbUrl.pathname.slice(1);
    const username = dbUrl.username;
    const password = dbUrl.password;

    // Set environment variables for pg_dump
    const env = {
      ...process.env,
      PGPASSWORD: password,
    };

    try {
      // Create database dump
      const dumpCommand = [
        'pg_dump',
        `-h ${host}`,
        `-p ${port}`,
        `-U ${username}`,
        `-d ${database}`,
        '--verbose',
        '--clean',
        '--if-exists',
        '--no-owner',
        '--no-privileges',
        `--file=${backupFile}`,
      ].join(' ');

      execSync(dumpCommand, { env, stdio: 'inherit' });

      // Compress if requested
      if (this.config.compress) {
        execSync(`gzip ${backupFile}`, { stdio: 'inherit' });
        console.log(`📦 Database backup compressed: ${backupFile}.gz`);
      } else {
        console.log(`💾 Database backup created: ${backupFile}`);
      }

      // Create metadata file
      const metadata = {
        type: 'database',
        timestamp: new Date().toISOString(),
        database: database,
        size: this.getFileSize(this.config.compress ? `${backupFile}.gz` : backupFile),
        compressed: this.config.compress,
      };

      writeFileSync(
        join(this.backupDir, `${backupName}.metadata.json`),
        JSON.stringify(metadata, null, 2)
      );

    } catch (error) {
      throw new Error(`Database backup failed: ${error}`);
    }
  }

  private async backupFiles(backupName: string) {
    console.log('📁 Backing up files...');

    const backupFile = join(this.backupDir, `${backupName}.tar`);
    
    // Directories to backup
    const filesToBackup = [
      './uploads',
      './logs',
      './docs',
      './.env.production',
      './package.json',
      './package-lock.json',
    ].filter(path => existsSync(path));

    if (filesToBackup.length === 0) {
      console.log('⚠️  No files to backup');
      return;
    }

    try {
      // Create tar archive
      const tarCommand = [
        'tar',
        '-cf',
        backupFile,
        ...filesToBackup,
      ].join(' ');

      execSync(tarCommand, { stdio: 'inherit' });

      // Compress if requested
      if (this.config.compress) {
        execSync(`gzip ${backupFile}`, { stdio: 'inherit' });
        console.log(`📦 Files backup compressed: ${backupFile}.gz`);
      } else {
        console.log(`💾 Files backup created: ${backupFile}`);
      }

      // Create metadata file
      const metadata = {
        type: 'files',
        timestamp: new Date().toISOString(),
        files: filesToBackup,
        size: this.getFileSize(this.config.compress ? `${backupFile}.gz` : backupFile),
        compressed: this.config.compress,
      };

      writeFileSync(
        join(this.backupDir, `${backupName}.metadata.json`),
        JSON.stringify(metadata, null, 2)
      );

    } catch (error) {
      throw new Error(`Files backup failed: ${error}`);
    }
  }

  private async cleanupOldBackups() {
    console.log(`🧹 Cleaning up backups older than ${this.config.retention} days...`);

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retention!);

      // Find and remove old backup files
      const findCommand = [
        'find',
        this.backupDir,
        '-name "skillswap-*"',
        '-type f',
        `-mtime +${this.config.retention}`,
        '-delete',
      ].join(' ');

      execSync(findCommand, { stdio: 'inherit' });
      console.log('✅ Old backups cleaned up');
    } catch (error) {
      console.warn('⚠️  Failed to cleanup old backups:', error);
    }
  }

  private getFileSize(filePath: string): string {
    try {
      const stats = require('fs').statSync(filePath);
      const bytes = stats.size;
      
      if (bytes === 0) return '0 Bytes';
      
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    } catch (error) {
      return 'Unknown';
    }
  }

  async restoreBackup(backupPath: string) {
    console.log(`🔄 Restoring backup from: ${backupPath}`);

    try {
      // Check if backup file exists
      if (!existsSync(backupPath)) {
        throw new Error(`Backup file not found: ${backupPath}`);
      }

      // Read metadata if available
      const metadataPath = backupPath.replace(/\.(sql|tar)(\.gz)?$/, '.metadata.json');
      let metadata = null;
      
      if (existsSync(metadataPath)) {
        metadata = JSON.parse(require('fs').readFileSync(metadataPath, 'utf8'));
        console.log(`📋 Backup metadata:`, metadata);
      }

      // Determine backup type from filename or metadata
      const isDatabase = backupPath.includes('.sql') || metadata?.type === 'database';
      const isCompressed = backupPath.endsWith('.gz');

      if (isDatabase) {
        await this.restoreDatabase(backupPath, isCompressed);
      } else {
        await this.restoreFiles(backupPath, isCompressed);
      }

      console.log('✅ Backup restored successfully');
    } catch (error) {
      console.error('❌ Backup restoration failed:', error);
      throw error;
    }
  }

  private async restoreDatabase(backupPath: string, isCompressed: boolean) {
    console.log('🗃️  Restoring database...');

    // Parse database URL
    const dbUrl = new URL(config.DATABASE_URL);
    const host = dbUrl.hostname;
    const port = dbUrl.port || '5432';
    const database = dbUrl.pathname.slice(1);
    const username = dbUrl.username;
    const password = dbUrl.password;

    const env = {
      ...process.env,
      PGPASSWORD: password,
    };

    try {
      let restoreCommand: string;

      if (isCompressed) {
        // Decompress and restore
        restoreCommand = [
          `gunzip -c ${backupPath}`,
          '|',
          'psql',
          `-h ${host}`,
          `-p ${port}`,
          `-U ${username}`,
          `-d ${database}`,
        ].join(' ');
      } else {
        // Direct restore
        restoreCommand = [
          'psql',
          `-h ${host}`,
          `-p ${port}`,
          `-U ${username}`,
          `-d ${database}`,
          `-f ${backupPath}`,
        ].join(' ');
      }

      execSync(restoreCommand, { env, stdio: 'inherit' });
      console.log('✅ Database restored successfully');
    } catch (error) {
      throw new Error(`Database restoration failed: ${error}`);
    }
  }

  private async restoreFiles(backupPath: string, isCompressed: boolean) {
    console.log('📁 Restoring files...');

    try {
      let extractCommand: string;

      if (isCompressed) {
        extractCommand = `tar -xzf ${backupPath}`;
      } else {
        extractCommand = `tar -xf ${backupPath}`;
      }

      execSync(extractCommand, { stdio: 'inherit' });
      console.log('✅ Files restored successfully');
    } catch (error) {
      throw new Error(`Files restoration failed: ${error}`);
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'restore') {
    const backupPath = args[1];
    if (!backupPath) {
      console.error('❌ Please provide backup file path');
      process.exit(1);
    }

    const manager = new BackupManager({ type: 'full' });
    await manager.restoreBackup(backupPath);
    return;
  }

  // Create backup
  const type = (args[0] as 'database' | 'files' | 'full') || 'full';
  const compress = args.includes('--compress');
  const retention = args.includes('--retention') 
    ? parseInt(args[args.indexOf('--retention') + 1]) 
    : undefined;

  const backupConfig: BackupConfig = {
    type,
    compress,
    retention,
  };

  console.log('🎯 Backup Configuration:');
  console.log(`   Type: ${backupConfig.type}`);
  console.log(`   Compress: ${backupConfig.compress}`);
  console.log(`   Retention: ${backupConfig.retention || 'None'} days`);
  console.log('');

  const manager = new BackupManager(backupConfig);
  await manager.createBackup();
}

// Run backup if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Backup script failed:', error);
    process.exit(1);
  });
}

export { BackupManager };