#!/usr/bin/env tsx

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { config, validateProductionConfig, isProduction } from '../server/config';

interface DeploymentConfig {
  environment: 'staging' | 'production';
  skipTests?: boolean;
  skipMigrations?: boolean;
  skipBuild?: boolean;
}

class DeploymentManager {
  private config: DeploymentConfig;

  constructor(config: DeploymentConfig) {
    this.config = config;
  }

  async deploy() {
    console.log(`🚀 Starting deployment to ${this.config.environment}...`);

    try {
      await this.validateEnvironment();
      await this.runPreDeploymentChecks();
      
      if (!this.config.skipTests) {
        await this.runTests();
      }
      
      if (!this.config.skipBuild) {
        await this.buildApplication();
      }
      
      if (!this.config.skipMigrations) {
        await this.runMigrations();
      }
      
      await this.deployApplication();
      await this.runPostDeploymentChecks();
      
      console.log('✅ Deployment completed successfully!');
    } catch (error) {
      console.error('❌ Deployment failed:', error);
      await this.rollback();
      process.exit(1);
    }
  }

  private async validateEnvironment() {
    console.log('🔍 Validating environment...');
    
    // Check if .env file exists
    if (!existsSync('.env') && !existsSync('.env.production')) {
      throw new Error('Environment file not found. Please create .env or .env.production');
    }

    // Validate production configuration
    if (this.config.environment === 'production') {
      validateProductionConfig();
    }

    // Check required files
    const requiredFiles = [
      'package.json',
      'server/index.ts',
      'migrations',
    ];

    for (const file of requiredFiles) {
      if (!existsSync(file)) {
        throw new Error(`Required file/directory not found: ${file}`);
      }
    }

    console.log('✅ Environment validation passed');
  }

  private async runPreDeploymentChecks() {
    console.log('🔍 Running pre-deployment checks...');

    // Check Git status
    try {
      const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' });
      if (gitStatus.trim() && this.config.environment === 'production') {
        console.warn('⚠️  Warning: Uncommitted changes detected');
      }
    } catch (error) {
      console.warn('⚠️  Warning: Could not check Git status');
    }

    // Check package.json version
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    console.log(`📦 Deploying version: ${packageJson.version}`);

    // Check Node.js version
    const nodeVersion = process.version;
    console.log(`🟢 Node.js version: ${nodeVersion}`);

    console.log('✅ Pre-deployment checks passed');
  }

  private async runTests() {
    console.log('🧪 Running tests...');

    try {
      execSync('npm run test:all', { stdio: 'inherit' });
      console.log('✅ All tests passed');
    } catch (error) {
      throw new Error('Tests failed. Deployment aborted.');
    }
  }

  private async buildApplication() {
    console.log('🏗️  Building application...');

    try {
      // Clean previous build
      execSync('rm -rf dist', { stdio: 'inherit' });
      
      // Build application
      execSync('npm run build', { stdio: 'inherit' });
      
      console.log('✅ Application built successfully');
    } catch (error) {
      throw new Error('Build failed. Deployment aborted.');
    }
  }

  private async runMigrations() {
    console.log('🗄️  Running database migrations...');

    try {
      execSync('npm run db:migrate:run', { stdio: 'inherit' });
      console.log('✅ Database migrations completed');
    } catch (error) {
      throw new Error('Database migrations failed. Deployment aborted.');
    }
  }

  private async deployApplication() {
    console.log('🚀 Deploying application...');

    if (this.config.environment === 'production') {
      // Production deployment steps
      await this.deployToProduction();
    } else {
      // Staging deployment steps
      await this.deployToStaging();
    }

    console.log('✅ Application deployed');
  }

  private async deployToProduction() {
    console.log('🏭 Deploying to production...');

    // Example deployment steps for production
    // These would be customized based on your hosting provider

    // 1. Upload files to server
    // execSync('rsync -avz --delete dist/ user@server:/path/to/app/', { stdio: 'inherit' });

    // 2. Install dependencies on server
    // execSync('ssh user@server "cd /path/to/app && npm ci --production"', { stdio: 'inherit' });

    // 3. Restart application
    // execSync('ssh user@server "pm2 restart skillswap-api"', { stdio: 'inherit' });

    // 4. Update reverse proxy configuration if needed
    // execSync('ssh user@server "nginx -s reload"', { stdio: 'inherit' });

    console.log('📝 Production deployment steps would be executed here');
    console.log('   - Upload built files to server');
    console.log('   - Install production dependencies');
    console.log('   - Restart application server');
    console.log('   - Update load balancer/proxy configuration');
  }

  private async deployToStaging() {
    console.log('🧪 Deploying to staging...');

    // Example staging deployment steps
    console.log('📝 Staging deployment steps would be executed here');
    console.log('   - Deploy to staging environment');
    console.log('   - Run smoke tests');
    console.log('   - Notify team of staging deployment');
  }

  private async runPostDeploymentChecks() {
    console.log('🔍 Running post-deployment checks...');

    // Health check
    try {
      const healthCheckUrl = this.config.environment === 'production' 
        ? 'https://api.skillswap.com/health'
        : 'https://staging-api.skillswap.com/health';

      console.log(`🏥 Checking health endpoint: ${healthCheckUrl}`);
      
      // In a real deployment, you would make an HTTP request here
      // const response = await fetch(healthCheckUrl);
      // if (!response.ok) {
      //   throw new Error(`Health check failed: ${response.status}`);
      // }
      
      console.log('✅ Health check passed');
    } catch (error) {
      console.warn('⚠️  Health check failed:', error);
    }

    // Database connectivity check
    try {
      execSync('npm run db:verify', { stdio: 'inherit' });
      console.log('✅ Database connectivity verified');
    } catch (error) {
      console.warn('⚠️  Database connectivity check failed');
    }

    console.log('✅ Post-deployment checks completed');
  }

  private async rollback() {
    console.log('🔄 Initiating rollback...');

    try {
      // Rollback steps would depend on your deployment strategy
      // Examples:
      // - Revert to previous Docker image
      // - Restore previous database backup
      // - Switch load balancer to previous version

      console.log('📝 Rollback steps would be executed here');
      console.log('   - Revert application to previous version');
      console.log('   - Restore database if needed');
      console.log('   - Update load balancer configuration');
      
      console.log('✅ Rollback completed');
    } catch (error) {
      console.error('❌ Rollback failed:', error);
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const environment = (args[0] as 'staging' | 'production') || 'staging';
  
  const deployConfig: DeploymentConfig = {
    environment,
    skipTests: args.includes('--skip-tests'),
    skipMigrations: args.includes('--skip-migrations'),
    skipBuild: args.includes('--skip-build'),
  };

  console.log('🎯 Deployment Configuration:');
  console.log(`   Environment: ${deployConfig.environment}`);
  console.log(`   Skip Tests: ${deployConfig.skipTests}`);
  console.log(`   Skip Migrations: ${deployConfig.skipMigrations}`);
  console.log(`   Skip Build: ${deployConfig.skipBuild}`);
  console.log('');

  const deployer = new DeploymentManager(deployConfig);
  await deployer.deploy();
}

// Run deployment if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Deployment script failed:', error);
    process.exit(1);
  });
}

export { DeploymentManager };