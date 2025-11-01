#!/usr/bin/env tsx

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { config } from '../server/config';

interface MetricData {
  timestamp: number;
  value: number;
  tags?: Record<string, string>;
}

interface SystemMetrics {
  cpu: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  uptime: number;
  activeConnections: number;
  requestsPerMinute: number;
  errorRate: number;
}

class MonitoringService {
  private metricsDir: string;
  private metrics: Map<string, MetricData[]> = new Map();

  constructor() {
    this.metricsDir = './logs/metrics';
    if (!existsSync(this.metricsDir)) {
      mkdirSync(this.metricsDir, { recursive: true });
    }
  }

  // Collect system metrics
  async collectSystemMetrics(): Promise<SystemMetrics> {
    const memoryUsage = process.memoryUsage();
    const totalMemory = require('os').totalmem();
    
    return {
      cpu: await this.getCPUUsage(),
      memory: {
        used: memoryUsage.heapUsed,
        total: totalMemory,
        percentage: (memoryUsage.heapUsed / totalMemory) * 100,
      },
      uptime: process.uptime(),
      activeConnections: await this.getActiveConnections(),
      requestsPerMinute: await this.getRequestsPerMinute(),
      errorRate: await this.getErrorRate(),
    };
  }

  // Record a metric
  recordMetric(name: string, value: number, tags?: Record<string, string>) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metrics = this.metrics.get(name)!;
    metrics.push({
      timestamp: Date.now(),
      value,
      tags,
    });

    // Keep only last 1000 data points per metric
    if (metrics.length > 1000) {
      metrics.splice(0, metrics.length - 1000);
    }
  }

  // Get metric statistics
  getMetricStats(name: string, timeWindow?: number): {
    count: number;
    avg: number;
    min: number;
    max: number;
    sum: number;
  } | null {
    const metrics = this.metrics.get(name);
    if (!metrics || metrics.length === 0) {
      return null;
    }

    let filteredMetrics = metrics;
    if (timeWindow) {
      const cutoff = Date.now() - timeWindow;
      filteredMetrics = metrics.filter(m => m.timestamp >= cutoff);
    }

    if (filteredMetrics.length === 0) {
      return null;
    }

    const values = filteredMetrics.map(m => m.value);
    return {
      count: values.length,
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      sum: values.reduce((a, b) => a + b, 0),
    };
  }

  // Export metrics to file
  exportMetrics(filename?: string) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const exportFile = filename || join(this.metricsDir, `metrics-${timestamp}.json`);

    const exportData = {
      timestamp: new Date().toISOString(),
      metrics: Object.fromEntries(this.metrics.entries()),
      systemInfo: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        uptime: process.uptime(),
      },
    };

    writeFileSync(exportFile, JSON.stringify(exportData, null, 2));
    console.log(`📊 Metrics exported to: ${exportFile}`);
  }

  // Alert system
  checkAlerts(): Alert[] {
    const alerts: Alert[] = [];
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    // High memory usage alert
    const memoryStats = this.getMetricStats('memory.percentage', fiveMinutes);
    if (memoryStats && memoryStats.avg > 80) {
      alerts.push({
        level: 'warning',
        message: `High memory usage: ${memoryStats.avg.toFixed(1)}%`,
        metric: 'memory.percentage',
        value: memoryStats.avg,
        threshold: 80,
      });
    }

    // High error rate alert
    const errorStats = this.getMetricStats('error.rate', fiveMinutes);
    if (errorStats && errorStats.avg > 5) {
      alerts.push({
        level: 'critical',
        message: `High error rate: ${errorStats.avg.toFixed(1)}%`,
        metric: 'error.rate',
        value: errorStats.avg,
        threshold: 5,
      });
    }

    // Low response time alert
    const responseStats = this.getMetricStats('response.time', fiveMinutes);
    if (responseStats && responseStats.avg > 2000) {
      alerts.push({
        level: 'warning',
        message: `Slow response time: ${responseStats.avg.toFixed(0)}ms`,
        metric: 'response.time',
        value: responseStats.avg,
        threshold: 2000,
      });
    }

    return alerts;
  }

  // Start monitoring loop
  startMonitoring(intervalMs: number = 60000) {
    console.log('📊 Starting monitoring service...');

    setInterval(async () => {
      try {
        const systemMetrics = await this.collectSystemMetrics();
        
        // Record system metrics
        this.recordMetric('cpu.usage', systemMetrics.cpu);
        this.recordMetric('memory.used', systemMetrics.memory.used);
        this.recordMetric('memory.percentage', systemMetrics.memory.percentage);
        this.recordMetric('uptime', systemMetrics.uptime);
        this.recordMetric('connections.active', systemMetrics.activeConnections);
        this.recordMetric('requests.per_minute', systemMetrics.requestsPerMinute);
        this.recordMetric('error.rate', systemMetrics.errorRate);

        // Check for alerts
        const alerts = this.checkAlerts();
        if (alerts.length > 0) {
          this.handleAlerts(alerts);
        }

        // Export metrics every hour
        if (Date.now() % (60 * 60 * 1000) < intervalMs) {
          this.exportMetrics();
        }

      } catch (error) {
        console.error('❌ Monitoring error:', error);
      }
    }, intervalMs);
  }

  private async getCPUUsage(): Promise<number> {
    // Simple CPU usage calculation
    const startUsage = process.cpuUsage();
    await new Promise(resolve => setTimeout(resolve, 100));
    const endUsage = process.cpuUsage(startUsage);
    
    const totalUsage = endUsage.user + endUsage.system;
    return (totalUsage / 100000) * 100; // Convert to percentage
  }

  private async getActiveConnections(): Promise<number> {
    // This would typically come from your HTTP server
    // For now, return a placeholder
    return 0;
  }

  private async getRequestsPerMinute(): Promise<number> {
    // This would typically come from request logging
    // For now, return a placeholder
    return 0;
  }

  private async getErrorRate(): Promise<number> {
    // This would typically come from error logging
    // For now, return a placeholder
    return 0;
  }

  private handleAlerts(alerts: Alert[]) {
    alerts.forEach(alert => {
      const icon = alert.level === 'critical' ? '🚨' : '⚠️';
      console.log(`${icon} ALERT [${alert.level.toUpperCase()}]: ${alert.message}`);
      
      // In production, you would send these alerts to:
      // - Slack/Discord webhook
      // - Email notifications
      // - PagerDuty/Opsgenie
      // - Monitoring dashboard
    });

    // Log alerts to file
    const alertsFile = join(this.metricsDir, 'alerts.log');
    const alertLog = alerts.map(alert => 
      `${new Date().toISOString()} [${alert.level.toUpperCase()}] ${alert.message}`
    ).join('\n') + '\n';
    
    require('fs').appendFileSync(alertsFile, alertLog);
  }
}

interface Alert {
  level: 'warning' | 'critical';
  message: string;
  metric: string;
  value: number;
  threshold: number;
}

// Express middleware for request monitoring
export function createMonitoringMiddleware(monitoring: MonitoringService) {
  return (req: any, res: any, next: any) => {
    const startTime = Date.now();
    
    // Record request
    monitoring.recordMetric('requests.total', 1, {
      method: req.method,
      path: req.path,
    });

    // Monitor response
    res.on('finish', () => {
      const responseTime = Date.now() - startTime;
      const statusCode = res.statusCode;
      
      monitoring.recordMetric('response.time', responseTime, {
        method: req.method,
        path: req.path,
        status: statusCode.toString(),
      });

      if (statusCode >= 400) {
        monitoring.recordMetric('errors.total', 1, {
          method: req.method,
          path: req.path,
          status: statusCode.toString(),
        });
      }
    });

    next();
  };
}

// Performance monitoring decorator
export function monitor(target: any, propertyName: string, descriptor: PropertyDescriptor) {
  const method = descriptor.value;
  
  descriptor.value = async function (...args: any[]) {
    const startTime = Date.now();
    const className = target.constructor.name;
    
    try {
      const result = await method.apply(this, args);
      const duration = Date.now() - startTime;
      
      // Record successful operation
      global.monitoring?.recordMetric(`${className}.${propertyName}.duration`, duration);
      global.monitoring?.recordMetric(`${className}.${propertyName}.success`, 1);
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Record failed operation
      global.monitoring?.recordMetric(`${className}.${propertyName}.duration`, duration);
      global.monitoring?.recordMetric(`${className}.${propertyName}.error`, 1);
      
      throw error;
    }
  };
}

// CLI interface
async function main() {
  const monitoring = new MonitoringService();
  
  // Make monitoring globally available
  (global as any).monitoring = monitoring;
  
  const command = process.argv[2];
  
  if (command === 'start') {
    monitoring.startMonitoring();
    
    // Keep process alive
    process.on('SIGINT', () => {
      console.log('\n📊 Exporting final metrics...');
      monitoring.exportMetrics();
      process.exit(0);
    });
    
    // Prevent process from exiting
    setInterval(() => {}, 1000);
  } else if (command === 'export') {
    monitoring.exportMetrics();
  } else if (command === 'stats') {
    const metricName = process.argv[3];
    if (!metricName) {
      console.error('Please provide metric name');
      process.exit(1);
    }
    
    const stats = monitoring.getMetricStats(metricName);
    if (stats) {
      console.log(`📊 Stats for ${metricName}:`, stats);
    } else {
      console.log(`No data found for metric: ${metricName}`);
    }
  } else {
    console.log('Usage: tsx monitoring.ts [start|export|stats <metric_name>]');
  }
}

// Run monitoring if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Monitoring script failed:', error);
    process.exit(1);
  });
}

export { MonitoringService, createMonitoringMiddleware, monitor };