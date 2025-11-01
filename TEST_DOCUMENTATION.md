# SkillSwap Backend Testing Documentation

## Overview

This document describes the comprehensive testing strategy for the SkillSwap backend enhancement project. The testing suite includes unit tests, integration tests, end-to-end tests, security tests, and performance tests.

## Test Types

### 1. Unit Tests
- **Purpose**: Test individual functions, classes, and modules in isolation
- **Location**: `server/**/*.test.ts` (excluding E2E, integration, security, and performance tests)
- **Command**: `npm run test:unit`
- **Coverage**: All service classes, utility functions, and business logic
- **Timeout**: 10 seconds per test

### 2. Integration Tests
- **Purpose**: Test interactions between different components and external services
- **Location**: `server/integration.test.ts`
- **Command**: `npm run test:integration`
- **Coverage**: Database operations, API integrations, service interactions
- **Timeout**: 20 seconds per test

### 3. End-to-End Tests
- **Purpose**: Test complete user workflows and system behavior
- **Location**: `server/e2e*.test.ts`
- **Command**: `npm run test:e2e`
- **Coverage**: Complete user journeys, API workflows, cross-service functionality
- **Timeout**: 60 seconds per test

### 4. Security Tests
- **Purpose**: Test security measures, authentication, and authorization
- **Location**: `server/security.test.ts`
- **Command**: `npm run test:security`
- **Coverage**: Authentication, authorization, input validation, XSS/SQL injection prevention
- **Timeout**: 30 seconds per test

### 5. Performance Tests
- **Purpose**: Test system performance under load and stress conditions
- **Location**: `server/performance.test.ts`
- **Command**: `npm run test:performance`
- **Coverage**: Load testing, concurrent user handling, response times
- **Timeout**: 2 minutes per test

## Test Environment Setup

### Prerequisites
- Node.js 18+ or 20+
- PostgreSQL 15+
- Redis 7+
- Docker (optional, for containerized testing)

### Environment Variables
```bash
NODE_ENV=test
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/skillswap_test
REDIS_URL=redis://localhost:6379
JWT_SECRET=test-jwt-secret-key
STRIPE_SECRET_KEY=sk_test_fake_key_for_testing
STRIPE_WEBHOOK_SECRET=whsec_test_webhook_secret
AWS_ACCESS_KEY_ID=test-access-key
AWS_SECRET_ACCESS_KEY=test-secret-key
AWS_S3_BUCKET=test-bucket
```

### Database Setup
1. Create test database: `createdb skillswap_test`
2. Run migrations: `npm run db:migrate`
3. Verify schema: `npm run db:verify`

## Running Tests

### Local Development
```bash
# Run all tests
npm run test:all

# Run specific test types
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:security
npm run test:performance

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

### Docker Environment
```bash
# Start test services
docker-compose --profile test up -d postgres-test redis-test

# Run tests in container
docker-compose run --rm app npm run test:all
```

## CI/CD Pipeline

### GitHub Actions Workflow
The CI/CD pipeline (`.github/workflows/ci.yml`) includes:

1. **Test Matrix**: Tests run on Node.js 18.x and 20.x
2. **Services**: PostgreSQL and Redis containers
3. **Test Stages**:
   - Linting and type checking
   - Unit tests
   - Integration tests
   - E2E tests
   - Security tests
   - Performance tests
   - Coverage reporting

### Pipeline Triggers
- Push to `main` or `develop` branches
- Pull requests to `main` branch

### Deployment
- **Staging**: Automatic deployment on `develop` branch
- **Production**: Automatic deployment on `main` branch (after all tests pass)

## Test Coverage Requirements

### Minimum Coverage Thresholds
- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%
- **Statements**: 70%

### Coverage Exclusions
- Node modules
- Build artifacts
- Type definitions
- Configuration files
- Test files themselves
- Database migrations
- Build scripts

## Test Data Management

### Test Users
Tests create temporary users with predictable data:
- Username: `test_user_*`
- Email: `test*@example.com`
- Password: `ValidPass123!`

### Data Cleanup
- Each test suite clears data before and after execution
- In-memory storage is reset between test runs
- Database transactions are rolled back in integration tests

## Security Testing

### Test Categories
1. **Authentication**: Login, registration, token validation
2. **Authorization**: Role-based access, resource permissions
3. **Input Validation**: XSS prevention, SQL injection protection
4. **Rate Limiting**: API throttling, brute force protection
5. **File Upload**: Malicious file detection, path traversal prevention
6. **Session Management**: Token expiration, concurrent sessions

### Security Test Data
- Malicious payloads for XSS testing
- SQL injection attempts
- Invalid authentication tokens
- Oversized request payloads
- Malicious file uploads

## Performance Testing

### Test Scenarios
1. **Load Testing**: Multiple concurrent users
2. **Stress Testing**: High-volume API requests
3. **Database Performance**: Complex queries under load
4. **Response Time**: API endpoint latency
5. **Memory Usage**: Resource consumption monitoring

### Performance Metrics
- **Response Time**: < 500ms average, < 2s maximum
- **Throughput**: 100+ requests/second
- **Concurrent Users**: 50+ simultaneous users
- **Error Rate**: < 1% under normal load

## Troubleshooting

### Common Issues

#### Test Database Connection
```bash
# Check PostgreSQL is running
pg_isready -h localhost -p 5432

# Verify test database exists
psql -h localhost -p 5432 -l | grep skillswap_test
```

#### Redis Connection
```bash
# Check Redis is running
redis-cli ping

# Verify Redis connection
redis-cli -h localhost -p 6379 info
```

#### Environment Variables
```bash
# Check required environment variables
echo $NODE_ENV
echo $DATABASE_URL
echo $JWT_SECRET
```

### Test Failures

#### Flaky Tests
- Increase test timeouts for slow operations
- Add proper wait conditions for async operations
- Ensure proper test isolation and cleanup

#### Memory Issues
- Reduce concurrent test execution
- Implement proper resource cleanup
- Monitor memory usage during test runs

#### External Service Failures
- Use mocks for external API calls
- Implement circuit breakers for resilience
- Add retry logic for transient failures

## Best Practices

### Writing Tests
1. **Descriptive Names**: Use clear, descriptive test names
2. **Single Responsibility**: Each test should verify one specific behavior
3. **Arrange-Act-Assert**: Structure tests with clear setup, execution, and verification
4. **Test Isolation**: Tests should not depend on each other
5. **Proper Cleanup**: Always clean up resources after tests

### Test Data
1. **Predictable Data**: Use consistent test data patterns
2. **Minimal Data**: Create only the data needed for each test
3. **Data Factories**: Use helper functions to create test data
4. **Cleanup**: Always clean up test data after execution

### Performance
1. **Parallel Execution**: Run independent tests in parallel
2. **Resource Management**: Properly manage database connections and memory
3. **Selective Testing**: Run only relevant tests during development
4. **Caching**: Cache expensive setup operations when possible

## Monitoring and Reporting

### Test Results
- Test results are reported in JUnit XML format
- Coverage reports are generated in multiple formats (HTML, LCOV, JSON)
- Performance metrics are logged and tracked over time

### Continuous Monitoring
- Test execution times are monitored for performance regression
- Coverage trends are tracked to ensure quality maintenance
- Flaky test detection and reporting

### Integration with Tools
- **Codecov**: Coverage reporting and tracking
- **GitHub Actions**: Automated test execution
- **Docker**: Containerized test environments
- **Vitest**: Test runner and coverage provider

## Future Enhancements

### Planned Improvements
1. **Visual Regression Testing**: Screenshot comparison for UI components
2. **Contract Testing**: API contract validation with consumers
3. **Chaos Engineering**: Fault injection and resilience testing
4. **Load Testing**: More comprehensive performance testing
5. **Accessibility Testing**: Automated accessibility compliance checks

### Tool Upgrades
- Migration to newer testing frameworks as they mature
- Integration with additional monitoring and observability tools
- Enhanced CI/CD pipeline with more sophisticated deployment strategies