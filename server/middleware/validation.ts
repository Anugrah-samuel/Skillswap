import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
// Removed isomorphic-dompurify for deployment compatibility

// Input validation middleware factory
export function validateInput(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Sanitize input before validation
      const sanitizedBody = sanitizeObject(req.body);
      const sanitizedQuery = sanitizeObject(req.query);
      const sanitizedParams = sanitizeObject(req.params);

      // Validate sanitized input
      req.body = schema.parse(sanitizedBody);
      req.query = sanitizedQuery;
      req.params = sanitizedParams;

      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          errors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code
          }))
        });
      }
      
      console.error('Validation middleware error:', error);
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Internal server error'
      });
    }
  };
}

// Sanitize object recursively
function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[sanitizeString(key)] = sanitizeObject(value);
    }
    return sanitized;
  }

  return obj;
}

// Sanitize string input
function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return input;
  }

  // Remove null bytes and control characters
  let sanitized = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  // Limit length to prevent DoS
  if (sanitized.length > 10000) {
    sanitized = sanitized.substring(0, 10000);
  }

  // HTML sanitization for content fields
  if (isHtmlContent(sanitized)) {
    // Basic HTML sanitization - remove dangerous tags and attributes
    sanitized = sanitized
      .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove scripts
      .replace(/<[^>]*>/g, (match) => {
        // Allow only safe tags
        const safeTags = ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li'];
        const tagName = match.match(/<\/?([a-zA-Z]+)/)?.[1]?.toLowerCase();
        return safeTags.includes(tagName || '') ? match.replace(/\s+\w+="[^"]*"/g, '') : '';
      });
  }

  return sanitized;
}

// Check if string contains HTML content
function isHtmlContent(str: string): boolean {
  return /<[^>]*>/g.test(str);
}

// SQL injection prevention middleware
export function preventSqlInjection(req: Request, res: Response, next: NextFunction) {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
    /('|(\\')|(;)|(--)|(\|)|(\*)|(%)|(\+))/,
    /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/i,
    /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/i,
    /((\%27)|(\'))union/i
  ];

  const checkForSqlInjection = (obj: any): boolean => {
    if (typeof obj === 'string') {
      return sqlPatterns.some(pattern => pattern.test(obj));
    }
    
    if (Array.isArray(obj)) {
      return obj.some(item => checkForSqlInjection(item));
    }
    
    if (typeof obj === 'object' && obj !== null) {
      return Object.values(obj).some(value => checkForSqlInjection(value));
    }
    
    return false;
  };

  if (checkForSqlInjection(req.body) || 
      checkForSqlInjection(req.query) || 
      checkForSqlInjection(req.params)) {
    return res.status(400).json({
      code: 'SECURITY_VIOLATION',
      message: 'Potentially malicious input detected'
    });
  }

  next();
}

// File upload validation
export function validateFileUpload(allowedTypes: string[], maxSize: number = 10 * 1024 * 1024) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.file && !req.files) {
      return next();
    }

    const files = req.files ? (Array.isArray(req.files) ? req.files : [req.file]) : [req.file];

    for (const file of files) {
      if (!file) continue;

      // Check file size
      if (file.size > maxSize) {
        return res.status(400).json({
          code: 'FILE_TOO_LARGE',
          message: `File size exceeds maximum allowed size of ${maxSize / (1024 * 1024)}MB`
        });
      }

      // Check file type
      if (!allowedTypes.includes(file.mimetype)) {
        return res.status(400).json({
          code: 'INVALID_FILE_TYPE',
          message: `File type ${file.mimetype} is not allowed. Allowed types: ${allowedTypes.join(', ')}`
        });
      }

      // Check for malicious file extensions
      const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com', '.jar', '.vbs', '.js', '.php'];
      const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
      
      if (dangerousExtensions.includes(fileExtension)) {
        return res.status(400).json({
          code: 'DANGEROUS_FILE_TYPE',
          message: 'File type is not allowed for security reasons'
        });
      }
    }

    next();
  };
}

// Request size limiter
export function limitRequestSize(maxSize: number = 1024 * 1024) { // 1MB default
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers['content-length'] || '0');
    
    if (contentLength > maxSize) {
      return res.status(413).json({
        code: 'REQUEST_TOO_LARGE',
        message: `Request size exceeds maximum allowed size of ${maxSize / 1024}KB`
      });
    }

    next();
  };
}

// Header validation
export function validateHeaders(req: Request, res: Response, next: NextFunction) {
  // Check for suspicious headers
  const suspiciousHeaders = ['x-forwarded-host', 'x-real-ip'];
  
  for (const header of suspiciousHeaders) {
    if (req.headers[header]) {
      console.warn(`Suspicious header detected: ${header} = ${req.headers[header]}`);
    }
  }

  // Validate User-Agent
  const userAgent = req.headers['user-agent'];
  if (userAgent && userAgent.length > 500) {
    return res.status(400).json({
      code: 'INVALID_USER_AGENT',
      message: 'User-Agent header is too long'
    });
  }

  // Check for null bytes in headers
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string' && value.includes('\0')) {
      return res.status(400).json({
        code: 'INVALID_HEADER',
        message: 'Invalid characters in header'
      });
    }
  }

  next();
}