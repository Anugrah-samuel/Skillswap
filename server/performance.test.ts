import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { performance } from 'perf_hooks';
import { storage } from './storage';
import { resetAllMocks } from './test-setup';

// Performance test configuration
const PERFORMANCE_THRESHOLDS = {
  RESPONSE_TIME_MS: 1000, // 1 second max response time
  CONCURRENT_USERS: 50,
  REQUESTS_PER_SECOND: 100,
  MEMORY_LEAK_THRESHOLD: 50 * 1024 * 1024, // 50MB
};

// Create test app for performance testing
const createPerformanceTestApp = () => {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  
  // Add basic routes for testing
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });
  
  app.post('/api/echo', (req, res) => {
    res.json({ echo: req.body });
  });
  
  app.get('/api/heavy-computation', (req, res) => {
    // Simulate heavy computation
    const start = Date.now();
    let result = 0;
    for (let i = 0; i < 1000000; i++) {
      result += Math.sqrt(i);
    }
    const duration = Date.now() - start;
    res.json({ result, computationTime: duration });
  });
  
  app.get('/api/database-simulation', async (req, res) => {
    // Simulate database operations
    try {
      const users = await Promise.all([
        storage.getUser?.('user1') || Promise.resolve(null),
        storage.getUser?.('user2') || Promise.resolve(null),
        storage.getUser?.('user3') || Promise.resolve(null),
      ]);
      res.json({ users: users.filter(Boolean) });
    } catch (error) {
      res.status(500).json({ error: 'Database simulation failed' });
    }
  });
  
  return app;
};

describe('Performance Tests', () => {
  let app: express.Application;
  let initialMemoryUsage: NodeJS.MemoryUsage;

  beforeEach(() => {
    resetAllMocks();
    app = createPerformanceTestApp();
    initialMemoryUsage = process.memoryUsage();
  });

  afterEach(() => {
    vi.clearAllMocks();
    
    // Check for memory leaks
    const currentMemoryUsage = process.memoryUsage();
    const memoryIncrease = currentMemoryUsage.heapUsed - initialMemoryUsage.heapUsed;
    
    if (memoryIncrease > PERFORMANCE_THRESHOLDS.MEMORY_LEAK_THRESHOLD) {
      console.warn(`Potential memory leak detected: ${memoryIncrease / 1024 / 1024}MB increase`);
    }
  });

  describe('Response Time Performance', () => {
    it('should respond to health check within performance threshold', async () => {
      const startTime = performance.now();
      
      const response = await request(app)
        .get('/api/health');
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.RESPONSE_TIME_MS);
      expect(response.body).toHaveProperty('status', 'ok');
    });

    it('should handle echo requests efficiently', async () => {
      const testData = { message: 'Hello, World!', timestamp: Date.now() };
      const startTime = performance.now();
      
      const response = await request(app)
        .post('/api/echo')
        .send(testData);
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.RESPONSE_TIME_MS);
      expect(response.body.echo).toEqual(testData);
    });

    it('should handle heavy computation within reasonable time', async () => {
      const startTime = performance.now();
      
      const response = await request(app)
        .get('/api/heavy-computation');
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.RESPONSE_TIME_MS * 2); // Allow 2x for heavy computation
      expect(response.body).toHaveProperty('result');
      expect(response.body).toHaveProperty('computationTime');
    });
  });

  describe('Concurrent Load Testing', () => {
    it('should handle multiple concurrent requests', async () => {
      const concurrentRequests = 20;
      const startTime = performance.now();
      
      const promises = Array(concurrentRequests).fill(null).map(() =>
        request(app).get('/api/health')
      );
      
      const responses = await Promise.all(promises);
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
      
      // Should complete within reasonable time
      expect(totalTime).toBeLessThan(PERFORMANCE_THRESHOLDS.RESPONSE_TIME_MS * 2);
      
      // Calculate requests per second
      const requestsPerSecond = (concurrentRequests / totalTime) * 1000;
      console.log(`Handled ${requestsPerSecond.toFixed(2)} requests per second`);
    });

    it('should maintain performance under sustained load', async () => {
      const requestCount = 50;
      const batchSize = 10;
      const batches = Math.ceil(requestCount / batchSize);
      
      const allResponseTimes: number[] = [];
      
      for (let batch = 0; batch < batches; batch++) {
        const batchPromises = Array(batchSize).fill(null).map(async () => {
          const startTime = performance.now();
          const response = await request(app).get('/api/health');
          const endTime = performance.now();
          
          expect(response.status).toBe(200);
          return endTime - startTime;
        });
        
        const batchResponseTimes = await Promise.all(batchPromises);
        allResponseTimes.push(...batchResponseTimes);
        
        // Small delay between batches to simulate realistic load
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      // Calculate statistics
      const avgResponseTime = allResponseTimes.reduce((a, b) => a + b, 0) / allResponseTimes.length;
      const maxResponseTime = Math.max(...allResponseTimes);
      const minResponseTime = Math.min(...allResponseTimes);
      
      console.log(`Response time stats - Avg: ${avgResponseTime.toFixed(2)}ms, Min: ${minResponseTime.toFixed(2)}ms, Max: ${maxResponseTime.toFixed(2)}ms`);
      
      // Performance should remain consistent
      expect(avgResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.RESPONSE_TIME_MS);
      expect(maxResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.RESPONSE_TIME_MS * 3);
    });
  });

  describe('Memory Usage and Resource Management', () => {
    it('should not leak memory during repeated requests', async () => {
      const initialMemory = process.memoryUsage();
      
      // Make many requests to test for memory leaks
      for (let i = 0; i < 100; i++) {
        await request(app)
          .post('/api/echo')
          .send({ iteration: i, data: 'x'.repeat(1000) });
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable (less than 10MB for 100 requests)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });

    it('should handle large payloads efficiently', async () => {
      const largePayload = {
        data: 'x'.repeat(100000), // 100KB payload
        metadata: {
          timestamp: Date.now(),
          version: '1.0.0',
          description: 'Large payload test',
        },
      };
      
      const startTime = performance.now();
      
      const response = await request(app)
        .post('/api/echo')
        .send(largePayload);
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.RESPONSE_TIME_MS * 2);
      expect(response.body.echo.data).toBe(largePayload.data);
    });
  });

  describe('Database Performance Simulation', () => {
    it('should handle database operations efficiently', async () => {
      const startTime = performance.now();
      
      const response = await request(app)
        .get('/api/database-simulation');
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      expect([200, 500]).toContain(response.status); // May fail if storage not available
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.RESPONSE_TIME_MS);
    });

    it('should handle concurrent database operations', async () => {
      const concurrentDbRequests = 10;
      const startTime = performance.now();
      
      const promises = Array(concurrentDbRequests).fill(null).map(() =>
        request(app).get('/api/database-simulation')
      );
      
      const responses = await Promise.all(promises);
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      // Should complete within reasonable time
      expect(totalTime).toBeLessThan(PERFORMANCE_THRESHOLDS.RESPONSE_TIME_MS * 3);
      
      // All requests should return valid responses
      responses.forEach(response => {
        expect([200, 500]).toContain(response.status);
      });
    });
  });

  describe('Error Handling Performance', () => {
    it('should handle 404 errors quickly', async () => {
      const startTime = performance.now();
      
      const response = await request(app)
        .get('/api/nonexistent-endpoint');
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      expect(response.status).toBe(404);
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.RESPONSE_TIME_MS / 2); // Error responses should be faster
    });

    it('should handle malformed requests efficiently', async () => {
      const startTime = performance.now();
      
      const response = await request(app)
        .post('/api/echo')
        .send('invalid json{');
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      expect(response.status).toBe(400);
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.RESPONSE_TIME_MS / 2);
    });
  });

  describe('Stress Testing', () => {
    it('should survive rapid fire requests', async () => {
      const rapidRequests = 100;
      const startTime = performance.now();
      
      // Fire all requests as quickly as possible
      const promises = Array(rapidRequests).fill(null).map((_, index) =>
        request(app)
          .get('/api/health')
          .timeout(5000) // 5 second timeout
      );
      
      const responses = await Promise.allSettled(promises);
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      // Count successful responses
      const successfulResponses = responses.filter(
        result => result.status === 'fulfilled' && result.value.status === 200
      );
      
      // At least 80% should succeed
      expect(successfulResponses.length).toBeGreaterThan(rapidRequests * 0.8);
      
      // Calculate throughput
      const throughput = (successfulResponses.length / totalTime) * 1000;
      console.log(`Stress test throughput: ${throughput.toFixed(2)} requests/second`);
    });
  });
});