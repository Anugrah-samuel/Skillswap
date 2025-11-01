import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./server/test-setup.ts'],
    testTimeout: 30000, // 30 seconds for E2E tests
    hookTimeout: 10000, // 10 seconds for setup/teardown
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/test-setup.ts',
        '**/*.test.ts',
        'migrations/**',
        'scripts/**',
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70,
        },
      },
    },
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 4,
        minThreads: 1,
      },
    },
    // Separate configurations for different test types
    workspace: [
      {
        test: {
          name: 'unit',
          include: ['server/**/*.test.ts'],
          exclude: [
            'server/e2e*.test.ts',
            'server/integration.test.ts',
            'server/performance.test.ts',
            'server/security.test.ts',
          ],
          testTimeout: 10000,
        },
      },
      {
        test: {
          name: 'integration',
          include: ['server/integration.test.ts'],
          testTimeout: 20000,
        },
      },
      {
        test: {
          name: 'e2e',
          include: ['server/e2e*.test.ts'],
          testTimeout: 60000,
          maxConcurrency: 2, // Limit concurrency for E2E tests
        },
      },
      {
        test: {
          name: 'security',
          include: ['server/security.test.ts'],
          testTimeout: 30000,
        },
      },
      {
        test: {
          name: 'performance',
          include: ['server/performance.test.ts'],
          testTimeout: 120000, // 2 minutes for performance tests
          maxConcurrency: 1, // Run performance tests sequentially
        },
      },
    ],
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './shared'),
      '@server': path.resolve(__dirname, './server'),
    },
  },
});