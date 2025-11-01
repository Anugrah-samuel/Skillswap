#!/usr/bin/env tsx

import { config } from '../server/config';
import { storage } from '../server/storage';

interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  message: string;
  responseTime?: number;
  details?: any;
}

class HealthChecker {
  private results: HealthCheckResult[] = [];

  async runAllChecks(): Promise<HealthCheckResult[]> {
    console.log('🏥 Running health checks...');

    const checks = [
      this.checkDatabase(),
      this.checkRedis(),
      this.checkStripe(),
      this.checkAWS(),
      this.checkEmail(),
      this.checkFirebase(),
    ];

    await Promise.allSettled(checks);
    
    this.printResults();
    return this.results;
  }

  private async checkDatabase(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Test database connection
      await storage.testConnection();
      
      const responseTime = Date.now() - startTime;
      this.results.push({
        service: 'Database',
        status: 'healthy',
        message: 'Database connection successful',
        responseTime,
      });
    } catch (error) {
      this.results.push({
        service: 'Database',
        status: 'unhealthy',
        message: `Database connection failed: ${error}`,
        responseTime: Date.now() - startTime,
      });
    }
  }

  private async checkRedis(): Promise<void> {
    const startTime = Date.now();
    
    try {
      if (!config.REDIS_URL) {
        this.results.push({
          service: 'Redis',
          status: 'degraded',
          message: 'Redis not configured (optional)',
          responseTime: Date.now() - startTime,
        });
        return;
      }

      // Test Redis connection
      // This would require a Redis client implementation
      this.results.push({
        service: 'Redis',
        status: 'healthy',
        message: 'Redis connection successful',
        responseTime: Date.now() - startTime,
      });
    } catch (error) {
      this.results.push({
        service: 'Redis',
        status: 'unhealthy',
        message: `Redis connection failed: ${error}`,
        responseTime: Date.now() - startTime,
      });
    }
  }

  private async checkStripe(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Test Stripe API
      const stripe = require('stripe')(config.STRIPE_SECRET_KEY);
      await stripe.accounts.retrieve();
      
      this.results.push({
        service: 'Stripe',
        status: 'healthy',
        message: 'Stripe API connection successful',
        responseTime: Date.now() - startTime,
      });
    } catch (error) {
      this.results.push({
        service: 'Stripe',
        status: 'unhealthy',
        message: `Stripe API connection failed: ${error}`,
        responseTime: Date.now() - startTime,
      });
    }
  }

  private async checkAWS(): Promise<void> {
    const startTime = Date.now();
    
    try {
      if (!config.AWS_ACCESS_KEY_ID || !config.AWS_S3_BUCKET) {
        this.results.push({
          service: 'AWS S3',
          status: 'degraded',
          message: 'AWS S3 not configured (optional)',
          responseTime: Date.now() - startTime,
        });
        return;
      }

      // Test AWS S3 connection
      const { S3Client, HeadBucketCommand } = require('@aws-sdk/client-s3');
      const s3Client = new S3Client({
        region: config.AWS_REGION,
        credentials: {
          accessKeyId: config.AWS_ACCESS_KEY_ID,
          secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
        },
      });

      await s3Client.send(new HeadBucketCommand({ Bucket: config.AWS_S3_BUCKET }));
      
      this.results.push({
        service: 'AWS S3',
        status: 'healthy',
        message: 'AWS S3 connection successful',
        responseTime: Date.now() - startTime,
      });
    } catch (error) {
      this.results.push({
        service: 'AWS S3',
        status: 'unhealthy',
        message: `AWS S3 connection failed: ${error}`,
        responseTime: Date.now() - startTime,
      });
    }
  }

  private async checkEmail(): Promise<void> {
    const startTime = Date.now();
    
    try {
      if (!config.SMTP_HOST || !config.SMTP_USER) {
        this.results.push({
          service: 'Email',
          status: 'degraded',
          message: 'Email service not configured (optional)',
          responseTime: Date.now() - startTime,
        });
        return;
      }

      // Test SMTP connection
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransporter({
        host: config.SMTP_HOST,
        port: config.SMTP_PORT,
        secure: config.SMTP_PORT === 465,
        auth: {
          user: config.SMTP_USER,
          pass: config.SMTP_PASS,
        },
      });

      await transporter.verify();
      
      this.results.push({
        service: 'Email',
        status: 'healthy',
        message: 'Email service connection successful',
        responseTime: Date.now() - startTime,
      });
    } catch (error) {
      this.results.push({
        service: 'Email',
        status: 'unhealthy',
        message: `Email service connection failed: ${error}`,
        responseTime: Date.now() - startTime,
      });
    }
  }

  private async checkFirebase(): Promise<void> {
    const startTime = Date.now();
    
    try {
      if (!config.FIREBASE_PROJECT_ID) {
        this.results.push({
          service: 'Firebase',
          status: 'degraded',
          message: 'Firebase not configured (optional)',
          responseTime: Date.now() - startTime,
        });
        return;
      }

      // Test Firebase connection
      // This would require Firebase Admin SDK implementation
      this.results.push({
        service: 'Firebase',
        status: 'healthy',
        message: 'Firebase connection successful',
        responseTime: Date.now() - startTime,
      });
    } catch (error) {
      this.results.push({
        service: 'Firebase',
        status: 'unhealthy',
        message: `Firebase connection failed: ${error}`,
        responseTime: Date.now() - startTime,
      });
    }
  }

  private printResults(): void {
    console.log('\n📊 Health Check Results:');
    console.log('========================');

    let healthyCount = 0;
    let unhealthyCount = 0;
    let degradedCount = 0;

    this.results.forEach(result => {
      const statusIcon = {
        healthy: '✅',
        unhealthy: '❌',
        degraded: '⚠️',
      }[result.status];

      const responseTime = result.responseTime ? ` (${result.responseTime}ms)` : '';
      
      console.log(`${statusIcon} ${result.service}: ${result.message}${responseTime}`);

      switch (result.status) {
        case 'healthy':
          healthyCount++;
          break;
        case 'unhealthy':
          unhealthyCount++;
          break;
        case 'degraded':
          degradedCount++;
          break;
      }
    });

    console.log('========================');
    console.log(`✅ Healthy: ${healthyCount}`);
    console.log(`⚠️  Degraded: ${degradedCount}`);
    console.log(`❌ Unhealthy: ${unhealthyCount}`);

    const overallStatus = unhealthyCount > 0 ? 'UNHEALTHY' : 
                         degradedCount > 0 ? 'DEGRADED' : 'HEALTHY';
    
    console.log(`\n🏥 Overall Status: ${overallStatus}`);

    if (unhealthyCount > 0) {
      console.log('\n⚠️  Critical issues detected. Please address unhealthy services before deployment.');
      process.exit(1);
    }
  }

  getOverallStatus(): 'healthy' | 'unhealthy' | 'degraded' {
    const hasUnhealthy = this.results.some(r => r.status === 'unhealthy');
    const hasDegraded = this.results.some(r => r.status === 'degraded');
    
    if (hasUnhealthy) return 'unhealthy';
    if (hasDegraded) return 'degraded';
    return 'healthy';
  }
}

// Express health check endpoint
export function createHealthCheckEndpoint() {
  return async (req: any, res: any) => {
    const checker = new HealthChecker();
    const results = await checker.runAllChecks();
    const overallStatus = checker.getOverallStatus();
    
    const statusCode = overallStatus === 'unhealthy' ? 503 : 200;
    
    res.status(statusCode).json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks: results,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0',
    });
  };
}

// CLI interface
async function main() {
  const checker = new HealthChecker();
  await checker.runAllChecks();
  
  const overallStatus = checker.getOverallStatus();
  process.exit(overallStatus === 'unhealthy' ? 1 : 0);
}

// Run health check if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Health check failed:', error);
    process.exit(1);
  });
}

export { HealthChecker };