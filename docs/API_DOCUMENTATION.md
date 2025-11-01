# SkillSwap API Documentation

## Overview

The SkillSwap API is a comprehensive RESTful API that powers a skill exchange platform. It provides endpoints for user management, skill trading, course creation, payment processing, AI recommendations, and analytics.

## Base URL

- **Development**: `http://localhost:3000`
- **Production**: `https://api.skillswap.com`

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. Most endpoints require authentication.

### Authentication Methods

1. **Bearer Token**: Include JWT token in the Authorization header
   ```
   Authorization: Bearer <your-jwt-token>
   ```

2. **API Key**: For mobile applications, use API key in header
   ```
   X-API-Key: <your-api-key>
   ```

### Getting Started

1. **Register**: `POST /api/auth/signup`
2. **Login**: `POST /api/auth/login`
3. **Use the returned JWT token** in subsequent requests

## Interactive Documentation

Visit the interactive API documentation at:
- **Development**: http://localhost:3000/api-docs
- **Production**: https://api.skillswap.com/api-docs

## API Endpoints Overview

### Authentication & Users
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/me` - Get current user info
- `PUT /api/auth/change-password` - Change password
- `GET /api/profile/:userId` - Get user profile
- `PUT /api/profile` - Update user profile

### Skills Management
- `GET /api/skills` - Get user skills
- `POST /api/skills` - Create new skill
- `PUT /api/skills/:id` - Update skill
- `DELETE /api/skills/:id` - Delete skill

### Credits System
- `GET /api/credits/balance` - Get credit balance
- `POST /api/credits/purchase` - Purchase credits
- `GET /api/credits/transactions` - Get transaction history

### Course Builder
- `POST /api/courses` - Create course
- `GET /api/courses/search` - Search courses
- `POST /api/courses/:id/enroll` - Enroll in course
- `PUT /api/courses/enrollments/:id/progress` - Update progress

### Premium Subscriptions
- `POST /api/subscriptions` - Create subscription
- `GET /api/subscriptions/status` - Get subscription status
- `PUT /api/subscriptions/cancel` - Cancel subscription
- `PUT /api/subscriptions/plan` - Update subscription plan

### Session Management
- `POST /api/sessions/schedule` - Schedule session
- `POST /api/sessions/:id/start` - Start session
- `PUT /api/sessions/:id/complete` - Complete session
- `GET /api/sessions/upcoming` - Get upcoming sessions
- `GET /api/sessions/history` - Get session history

### AI Recommendations
- `GET /api/recommendations/skills` - Get skill recommendations
- `GET /api/recommendations/users` - Get user recommendations
- `POST /api/recommendations/feedback` - Record interaction feedback

### Payment Processing
- `POST /api/payments/methods` - Add payment method
- `GET /api/payments/methods` - Get payment methods
- `POST /api/payments/process` - Process payment
- `GET /api/payments/history` - Get payment history

### Analytics & Dashboard
- `GET /api/analytics/dashboard` - Get dashboard analytics
- `GET /api/analytics/skills` - Get skill analytics
- `GET /api/analytics/teaching` - Get teaching analytics
- `GET /api/analytics/badges` - Get user badges
- `GET /api/analytics/export` - Export analytics report

### Media Management
- `POST /api/media/upload` - Upload file
- `GET /api/media/:id` - Get file
- `DELETE /api/media/:id` - Delete file

### Mobile Optimization
- `GET /api/mobile/sync` - Sync data for mobile
- `POST /api/mobile/push-tokens` - Register push token
- `GET /api/mobile/offline-data` - Get offline data

## Rate Limiting

The API implements rate limiting to ensure fair usage:

- **Authentication endpoints**: 5 requests per minute
- **Payment endpoints**: 10 requests per minute
- **General endpoints**: 1000 requests per 15 minutes per user
- **Password change**: 3 requests per hour

## Error Handling

The API uses standard HTTP status codes and returns consistent error responses:

```json
{
  "code": "ERROR_CODE",
  "message": "Human readable error message",
  "details": {},
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Common Error Codes

- `VALIDATION_ERROR` - Invalid input data
- `UNAUTHORIZED` - Authentication required
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `INSUFFICIENT_CREDITS` - Not enough credits
- `PAYMENT_FAILED` - Payment processing failed
- `RATE_LIMIT_EXCEEDED` - Too many requests

## Data Formats

### Dates
All dates are in ISO 8601 format: `2024-01-15T10:30:00Z`

### Pagination
List endpoints support pagination:
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### Currency
- Credits: Integer values (1 credit = 1 unit)
- Money: Integer values in cents (100 = $1.00)

## Webhooks

The API supports webhooks for real-time notifications:

### Stripe Webhooks
- `POST /api/payments/webhook` - Payment events
- `POST /api/subscriptions/webhook` - Subscription events

### Webhook Security
All webhooks include signature verification for security.

## SDKs and Code Examples

### JavaScript/Node.js
```javascript
const response = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    username: 'johndoe',
    password: 'password123'
  })
});

const { user, accessToken } = await response.json();
```

### Python
```python
import requests

response = requests.post('http://localhost:3000/api/auth/login', json={
    'username': 'johndoe',
    'password': 'password123'
})

data = response.json()
access_token = data['accessToken']
```

### cURL
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"johndoe","password":"password123"}'
```

## Testing

### Postman Collection
Import the Postman collection for easy API testing:
- Collection URL: `http://localhost:3000/api-docs.json`

### Test Environment
Use the development server for testing:
```bash
npm run dev
```

## Support

For API support and questions:
- Email: api-support@skillswap.com
- Documentation: https://docs.skillswap.com
- GitHub Issues: https://github.com/skillswap/api/issues

## Changelog

### Version 1.0.0
- Initial API release
- Authentication system
- Credits and payment processing
- Course builder functionality
- AI recommendations
- Analytics dashboard
- Mobile optimization

## License

This API is licensed under the MIT License. See LICENSE file for details.