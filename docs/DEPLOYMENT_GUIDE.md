# SkillSwap API Deployment Guide

This guide covers deploying the SkillSwap API to production environments with proper security, monitoring, and backup procedures.

## Prerequisites

- Node.js 18+ 
- PostgreSQL 15+
- Redis 7+ (optional but recommended)
- Docker & Docker Compose (for containerized deployment)
- SSL certificates for HTTPS
- Domain name configured

## Environment Setup

### 1. Environment Variables

Copy the example environment file and configure for production:

```bash
cp .env.example .env.production
```

**Critical Production Variables:**

```bash
# Database
DATABASE_URL=postgresql://username:password@host:5432/skillswap
DATABASE_SSL=true

# Security
JWT_SECRET=your-super-secure-jwt-secret-64-characters-minimum
SESSION_SECRET=your-super-secure-session-secret-64-characters-minimum
BCRYPT_ROUNDS=12

# Stripe
STRIPE_SECRET_KEY=sk_live_your_live_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_live_your_live_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_live_webhook_secret

# AWS S3
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_S3_BUCKET=skillswap-production-files

# Application
NODE_ENV=production
PORT=3000
CORS_ORIGIN=https://skillswap.com
```

### 2. Security Checklist

- [ ] Use strong, unique secrets for JWT and sessions
- [ ] Enable SSL/TLS for all connections
- [ ] Configure proper CORS origins
- [ ] Set up rate limiting
- [ ] Enable database SSL connections
- [ ] Use environment variables for all secrets
- [ ] Configure proper file upload restrictions
- [ ] Set up content security policies

## Deployment Methods

### Method 1: Docker Deployment (Recommended)

#### 1. Build and Deploy with Docker Compose

```bash
# Clone repository
git clone https://github.com/your-org/skillswap-api.git
cd skillswap-api

# Create production environment file
cp .env.example .env.production
# Edit .env.production with your production values

# Build and start services
docker-compose -f docker-compose.yml --env-file .env.production up -d

# Run database migrations
docker-compose exec app npm run db:migrate:run

# Check health
curl http://localhost:3000/health
```

#### 2. SSL Certificate Setup

```bash
# Create SSL directory
mkdir -p ssl

# Copy your SSL certificates
cp your-domain.crt ssl/skillswap.crt
cp your-domain.key ssl/skillswap.key

# Or use Let's Encrypt
certbot certonly --webroot -w /var/www/html -d skillswap.com -d www.skillswap.com
cp /etc/letsencrypt/live/skillswap.com/fullchain.pem ssl/skillswap.crt
cp /etc/letsencrypt/live/skillswap.com/privkey.pem ssl/skillswap.key
```

### Method 2: Traditional Server Deployment

#### 1. Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# Install Redis
sudo apt install redis-server

# Install Nginx
sudo apt install nginx
```

#### 2. Application Deployment

```bash
# Clone and setup application
git clone https://github.com/your-org/skillswap-api.git /var/www/skillswap-api
cd /var/www/skillswap-api

# Install dependencies
npm ci --production

# Build application
npm run build

# Setup environment
cp .env.example .env.production
# Edit .env.production

# Run database migrations
npm run db:migrate:run

# Start with PM2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

#### 3. PM2 Configuration

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'skillswap-api',
    script: 'dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024'
  }]
};
```

### Method 3: Cloud Platform Deployment

#### AWS ECS Deployment

1. **Create ECS Task Definition:**

```json
{
  "family": "skillswap-api",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "skillswap-api",
      "image": "your-account.dkr.ecr.region.amazonaws.com/skillswap-api:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:skillswap/database-url"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/skillswap-api",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

2. **Deploy with AWS CLI:**

```bash
# Build and push Docker image
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin your-account.dkr.ecr.us-east-1.amazonaws.com
docker build -t skillswap-api .
docker tag skillswap-api:latest your-account.dkr.ecr.us-east-1.amazonaws.com/skillswap-api:latest
docker push your-account.dkr.ecr.us-east-1.amazonaws.com/skillswap-api:latest

# Update ECS service
aws ecs update-service --cluster skillswap-cluster --service skillswap-api-service --force-new-deployment
```

## Database Setup

### 1. PostgreSQL Configuration

```sql
-- Create database and user
CREATE DATABASE skillswap;
CREATE USER skillswap WITH ENCRYPTED PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE skillswap TO skillswap;

-- Enable required extensions
\c skillswap;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
```

### 2. Run Migrations

```bash
# Production migration
NODE_ENV=production npm run db:migrate:run

# Verify schema
npm run db:verify
```

### 3. Database Backup Setup

```bash
# Setup automated backups
crontab -e

# Add backup job (daily at 2 AM)
0 2 * * * /usr/local/bin/tsx /var/www/skillswap-api/scripts/backup.ts database --compress --retention 30

# Weekly full backup
0 2 * * 0 /usr/local/bin/tsx /var/www/skillswap-api/scripts/backup.ts full --compress --retention 90
```

## Monitoring and Logging

### 1. Application Monitoring

```bash
# Start monitoring service
npm run monitoring:start

# Or with PM2
pm2 start scripts/monitoring.ts --name skillswap-monitoring
```

### 2. Log Management

```bash
# Setup log rotation
sudo nano /etc/logrotate.d/skillswap

# Add configuration:
/var/www/skillswap-api/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
    postrotate
        pm2 reloadLogs
    endscript
}
```

### 3. Health Checks

```bash
# Manual health check
npm run health:check

# Setup automated health monitoring
crontab -e

# Add health check (every 5 minutes)
*/5 * * * * curl -f http://localhost:3000/health || echo "Health check failed" | mail -s "SkillSwap API Down" admin@skillswap.com
```

## Security Configuration

### 1. Firewall Setup

```bash
# Configure UFW
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 2. Nginx Security Configuration

```nginx
# Add to nginx.conf
server_tokens off;
add_header X-Frame-Options DENY;
add_header X-Content-Type-Options nosniff;
add_header X-XSS-Protection "1; mode=block";
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

# Rate limiting
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;
```

### 3. SSL/TLS Configuration

```bash
# Test SSL configuration
curl -I https://skillswap.com
openssl s_client -connect skillswap.com:443 -servername skillswap.com

# Check SSL rating
curl -s "https://api.ssllabs.com/api/v3/analyze?host=skillswap.com"
```

## Performance Optimization

### 1. Database Optimization

```sql
-- Add indexes for performance
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);
CREATE INDEX CONCURRENTLY idx_skills_user_id ON skills(user_id);
CREATE INDEX CONCURRENTLY idx_sessions_status ON skill_sessions(status);
CREATE INDEX CONCURRENTLY idx_transactions_user_id ON credit_transactions(user_id);

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'user@example.com';
```

### 2. Application Performance

```bash
# Enable Node.js performance monitoring
NODE_OPTIONS="--max-old-space-size=1024 --optimize-for-size" npm start

# Use clustering for better CPU utilization
pm2 start ecosystem.config.js --instances max
```

### 3. Caching Strategy

```javascript
// Redis caching configuration
const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
});

// Cache frequently accessed data
app.use('/api/skills', cacheMiddleware(300)); // 5 minutes
app.use('/api/analytics', cacheMiddleware(600)); // 10 minutes
```

## Backup and Recovery

### 1. Automated Backups

```bash
# Database backup script
#!/bin/bash
BACKUP_DIR="/var/backups/skillswap"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup
pg_dump -h localhost -U skillswap skillswap | gzip > "$BACKUP_DIR/db_backup_$DATE.sql.gz"

# Upload to S3
aws s3 cp "$BACKUP_DIR/db_backup_$DATE.sql.gz" s3://skillswap-backups/database/

# Cleanup old backups (keep 30 days)
find "$BACKUP_DIR" -name "db_backup_*.sql.gz" -mtime +30 -delete
```

### 2. Disaster Recovery Plan

1. **Database Recovery:**
   ```bash
   # Restore from backup
   gunzip -c backup.sql.gz | psql -h localhost -U skillswap skillswap
   ```

2. **Application Recovery:**
   ```bash
   # Restore application files
   tar -xzf app_backup.tar.gz -C /var/www/
   
   # Restart services
   pm2 restart all
   nginx -s reload
   ```

3. **File Storage Recovery:**
   ```bash
   # Restore from S3
   aws s3 sync s3://skillswap-backups/files/ /var/www/skillswap-api/uploads/
   ```

## Deployment Automation

### 1. CI/CD Pipeline (GitHub Actions)

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run tests
        run: npm run test:all
        
      - name: Build application
        run: npm run build
        
      - name: Deploy to production
        run: npm run deploy:production
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          JWT_SECRET: ${{ secrets.JWT_SECRET }}
```

### 2. Blue-Green Deployment

```bash
# Deploy to staging slot
npm run deploy:staging

# Run smoke tests
npm run test:smoke

# Switch traffic to new version
npm run deploy:switch

# Monitor for issues
npm run monitoring:check

# Rollback if needed
npm run deploy:rollback
```

## Troubleshooting

### Common Issues

1. **Database Connection Issues:**
   ```bash
   # Check database connectivity
   psql -h localhost -U skillswap -d skillswap -c "SELECT 1;"
   
   # Check connection pool
   npm run db:verify
   ```

2. **Memory Issues:**
   ```bash
   # Monitor memory usage
   pm2 monit
   
   # Restart if memory leak detected
   pm2 restart skillswap-api
   ```

3. **SSL Certificate Issues:**
   ```bash
   # Check certificate expiry
   openssl x509 -in ssl/skillswap.crt -text -noout | grep "Not After"
   
   # Renew Let's Encrypt certificate
   certbot renew --dry-run
   ```

### Log Analysis

```bash
# Check application logs
tail -f logs/combined.log

# Check error logs
grep "ERROR" logs/combined.log | tail -20

# Check database logs
sudo tail -f /var/log/postgresql/postgresql-15-main.log

# Check nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## Maintenance

### Regular Maintenance Tasks

1. **Weekly:**
   - Review application logs
   - Check disk space usage
   - Verify backup integrity
   - Update security patches

2. **Monthly:**
   - Database maintenance (VACUUM, ANALYZE)
   - SSL certificate renewal check
   - Performance review
   - Security audit

3. **Quarterly:**
   - Dependency updates
   - Load testing
   - Disaster recovery testing
   - Security penetration testing

### Maintenance Scripts

```bash
# Database maintenance
npm run db:maintenance

# Log cleanup
npm run logs:cleanup

# Security updates
npm audit fix
npm update

# Performance analysis
npm run performance:analyze
```

This deployment guide provides comprehensive instructions for deploying the SkillSwap API to production with proper security, monitoring, and maintenance procedures.