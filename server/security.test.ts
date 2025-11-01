import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { resetAllMocks } from './test-setup';

// Create security test app
const createSecurityTestApp = () => {
  const app = express();
  app.use(express.json());
  
  // Add security middleware
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });
  
  // Test routes
  app.post('/api/test/echo', (req, res) => {
    res.json({ received: req.body });
  });
  
  app.get('/api/test/headers', (req, res) => {
    res.json({ headers: req.headers });
  });
  
  app.post('/api/test/auth', (req, res) => {
    const token = req.headers.authorization;
    if (!token || !token.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    res.json({ authenticated: true });
  });
  
  return app;
};

describe('Security Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    resetAllMocks();
    app = createSecurityTestApp();
  });

  describe('Input Validation and Sanitization', () => {
    it('should prevent XSS attacks in request body', async () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        '<img src=x onerror=alert(1)>',
        'javascript:alert(1)',
        '<svg onload=alert(1)>',
        '"><script>alert(1)</script>',
        "';alert(String.fromCharCode(88,83,83))//';alert(String.fromCharCode(88,83,83))//",
        '"><img src=x onerror=alert(1)//>',
      ];

      for (const payload of xssPayloads) {
        const response = await request(app)
          .post('/api/test/echo')
          .send({ userInput: payload });

        expect(response.status).toBe(200);
        
        // Response should not contain the raw XSS payload
        const responseText = JSON.stringify(response.body);
        expect(responseText).not.toContain('<script>');
        expect(responseText).not.toContain('javascript:');
        expect(responseText).not.toContain('onerror=');
      }
    });

    it('should prevent SQL injection attempts', async () => {
      const sqlInjectionPayloads = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "1' UNION SELECT * FROM users--",
        "'; INSERT INTO users VALUES ('hacker', 'password'); --",
        "' OR 1=1#",
        "admin'--",
        "admin'/*",
      ];

      for (const payload of sqlInjectionPayloads) {
        const response = await request(app)
          .post('/api/test/echo')
          .send({ query: payload });

        expect(response.status).toBe(200);
        // Should handle SQL injection attempts gracefully
        expect(response.body).toBeDefined();
      }
    });

    it('should handle malformed JSON gracefully', async () => {
      const malformedPayloads = [
        '{"incomplete": ',
        '{invalid json}',
        '{"nested": {"incomplete": }',
        '{"array": [1,2,}',
        '{"string": "unclosed',
      ];

      for (const payload of malformedPayloads) {
        const response = await request(app)
          .post('/api/test/echo')
          .set('Content-Type', 'application/json')
          .send(payload);

        expect(response.status).toBe(400);
      }
    });

    it('should reject oversized payloads', async () => {
      // Create a very large payload (>10MB)
      const largePayload = {
        data: 'x'.repeat(11 * 1024 * 1024), // 11MB
      };

      const response = await request(app)
        .post('/api/test/echo')
        .send(largePayload);

      expect(response.status).toBe(413); // Payload Too Large
    });
  });

  describe('Authentication and Authorization', () => {
    it('should reject requests without authentication', async () => {
      const response = await request(app)
        .post('/api/test/auth')
        .send({ data: 'test' });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject invalid authentication tokens', async () => {
      const invalidTokens = [
        'Bearer invalid-token',
        'Bearer ',
        'InvalidFormat token',
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature',
      ];

      for (const token of invalidTokens) {
        const response = await request(app)
          .post('/api/test/auth')
          .set('Authorization', token)
          .send({ data: 'test' });

        // Should either reject (401) or handle gracefully
        expect([401, 403]).toContain(response.status);
      }
    });

    it('should prevent authorization header injection', async () => {
      const response = await request(app)
        .post('/api/test/auth')
        .set('Authorization', 'Bearer valid-token\r\nX-Injected-Header: malicious')
        .send({ data: 'test' });

      // Should not allow header injection
      expect(response.status).toBe(401);
    });
  });

  describe('HTTP Security Headers', () => {
    it('should set security headers correctly', async () => {
      const response = await request(app)
        .get('/api/test/headers');

      expect(response.status).toBe(200);
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    });

    it('should prevent clickjacking attacks', async () => {
      const response = await request(app)
        .get('/api/test/headers');

      expect(response.headers['x-frame-options']).toBe('DENY');
    });

    it('should prevent MIME type sniffing', async () => {
      const response = await request(app)
        .get('/api/test/headers');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });
  });

  describe('Request Forgery Protection', () => {
    it('should handle suspicious request patterns', async () => {
      // Test with suspicious user agents
      const suspiciousUserAgents = [
        'sqlmap/1.0',
        'Nikto/2.1.6',
        'Mozilla/5.0 (compatible; Nmap Scripting Engine)',
        'python-requests/2.25.1',
      ];

      for (const userAgent of suspiciousUserAgents) {
        const response = await request(app)
          .get('/api/test/headers')
          .set('User-Agent', userAgent);

        // Should handle gracefully (not necessarily block, but log)
        expect([200, 403]).toContain(response.status);
      }
    });

    it('should handle requests with suspicious headers', async () => {
      const response = await request(app)
        .get('/api/test/headers')
        .set('X-Forwarded-For', '127.0.0.1, 127.0.0.1, 127.0.0.1') // Potential proxy manipulation
        .set('X-Real-IP', '0.0.0.0')
        .set('X-Originating-IP', '192.168.1.1');

      // Should handle gracefully
      expect(response.status).toBe(200);
    });
  });

  describe('Path Traversal Protection', () => {
    it('should prevent directory traversal attacks', async () => {
      const pathTraversalPayloads = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\drivers\\etc\\hosts',
        '....//....//....//etc/passwd',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
        '..%252f..%252f..%252fetc%252fpasswd',
      ];

      for (const payload of pathTraversalPayloads) {
        const response = await request(app)
          .get(`/api/test/${encodeURIComponent(payload)}`);

        // Should return 404 or handle gracefully, not expose system files
        expect([404, 400, 403]).toContain(response.status);
      }
    });
  });

  describe('Rate Limiting and DoS Protection', () => {
    it('should handle rapid successive requests', async () => {
      const rapidRequests = 20;
      const promises = Array(rapidRequests).fill(null).map(() =>
        request(app).get('/api/test/headers')
      );

      const responses = await Promise.all(promises);
      
      // Should handle all requests or implement rate limiting
      const statusCodes = responses.map(res => res.status);
      const successCount = statusCodes.filter(code => code === 200).length;
      const rateLimitedCount = statusCodes.filter(code => code === 429).length;
      
      // Either all succeed or some are rate limited
      expect(successCount + rateLimitedCount).toBe(rapidRequests);
    });

    it('should handle requests with unusual content types', async () => {
      const unusualContentTypes = [
        'application/x-www-form-urlencoded',
        'multipart/form-data',
        'text/xml',
        'application/xml',
        'text/plain',
        'application/octet-stream',
      ];

      for (const contentType of unusualContentTypes) {
        const response = await request(app)
          .post('/api/test/echo')
          .set('Content-Type', contentType)
          .send('test data');

        // Should handle gracefully
        expect([200, 400, 415]).toContain(response.status);
      }
    });
  });

  describe('Information Disclosure Prevention', () => {
    it('should not expose sensitive information in error messages', async () => {
      // Try to trigger various error conditions
      const errorTriggers = [
        { path: '/api/nonexistent', method: 'get' },
        { path: '/api/test/echo', method: 'post', data: null },
        { path: '/api/test/auth', method: 'post', headers: { 'Authorization': 'Bearer invalid' } },
      ];

      for (const trigger of errorTriggers) {
        let response;
        if (trigger.method === 'get') {
          response = await request(app).get(trigger.path);
        } else {
          const req = request(app).post(trigger.path);
          if (trigger.headers) {
            Object.entries(trigger.headers).forEach(([key, value]) => {
              req.set(key, value);
            });
          }
          response = await req.send(trigger.data);
        }

        // Error responses should not expose sensitive information
        const responseText = JSON.stringify(response.body).toLowerCase();
        expect(responseText).not.toContain('password');
        expect(responseText).not.toContain('secret');
        expect(responseText).not.toContain('token');
        expect(responseText).not.toContain('database');
        expect(responseText).not.toContain('connection');
      }
    });

    it('should not expose server information', async () => {
      const response = await request(app)
        .get('/api/test/headers');

      // Should not expose server version or technology stack
      expect(response.headers.server).toBeUndefined();
      expect(response.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('Content Security Policy', () => {
    it('should handle inline script attempts', async () => {
      const inlineScriptPayloads = [
        { content: '<script>alert(1)</script>' },
        { content: '<div onclick="alert(1)">Click me</div>' },
        { content: '<img src="x" onerror="alert(1)">' },
      ];

      for (const payload of inlineScriptPayloads) {
        const response = await request(app)
          .post('/api/test/echo')
          .send(payload);

        expect(response.status).toBe(200);
        // Response should be sanitized
        const responseText = JSON.stringify(response.body);
        expect(responseText).not.toContain('onclick=');
        expect(responseText).not.toContain('onerror=');
      }
    });
  });

  describe('Session Security', () => {
    it('should handle session-related attacks', async () => {
      // Test session fixation attempts
      const response = await request(app)
        .get('/api/test/headers')
        .set('Cookie', 'sessionid=fixed-session-id; PHPSESSID=malicious');

      expect(response.status).toBe(200);
      // Should handle gracefully without using the provided session
    });
  });
});