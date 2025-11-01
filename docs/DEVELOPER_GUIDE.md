# SkillSwap API Developer Integration Guide

## Quick Start

This guide will help you integrate with the SkillSwap API in just a few steps.

### 1. Authentication Setup

First, register a user and obtain an access token:

```javascript
// Register a new user
const registerResponse = await fetch('/api/auth/signup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'developer',
    email: 'dev@example.com',
    password: 'securepassword123',
    fullName: 'Developer User'
  })
});

const { user, accessToken, refreshToken } = await registerResponse.json();

// Store tokens securely
localStorage.setItem('accessToken', accessToken);
localStorage.setItem('refreshToken', refreshToken);
```

### 2. Making Authenticated Requests

Include the JWT token in your requests:

```javascript
const apiCall = async (endpoint, options = {}) => {
  const token = localStorage.getItem('accessToken');
  
  const response = await fetch(`/api${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers
    }
  });

  if (response.status === 401) {
    // Token expired, refresh it
    await refreshAccessToken();
    return apiCall(endpoint, options); // Retry
  }

  return response.json();
};

const refreshAccessToken = async () => {
  const refreshToken = localStorage.getItem('refreshToken');
  
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  });

  const { accessToken: newAccessToken } = await response.json();
  localStorage.setItem('accessToken', newAccessToken);
};
```

### 3. Core Integration Patterns

#### User Profile Management
```javascript
// Get current user profile
const currentUser = await apiCall('/auth/me');

// Update profile
const updatedUser = await apiCall('/profile', {
  method: 'PUT',
  body: JSON.stringify({
    fullName: 'Updated Name',
    bio: 'Updated bio'
  })
});
```

#### Skills Management
```javascript
// Create a new skill
const skill = await apiCall('/skills', {
  method: 'POST',
  body: JSON.stringify({
    name: 'React Development',
    category: 'Programming',
    level: 'intermediate',
    description: 'Frontend development with React',
    isOffering: true,
    isSeeking: false
  })
});

// Get user skills
const skills = await apiCall(`/skills?userId=${currentUser.id}`);
```

#### Credits System
```javascript
// Check credit balance
const { balance } = await apiCall('/credits/balance');

// Purchase credits
const transaction = await apiCall('/credits/purchase', {
  method: 'POST',
  body: JSON.stringify({
    amount: 100,
    paymentMethodId: 'pm_1234567890'
  })
});
```

#### Session Management
```javascript
// Schedule a session
const session = await apiCall('/sessions/schedule', {
  method: 'POST',
  body: JSON.stringify({
    matchId: 'match-id',
    teacherId: 'teacher-id',
    studentId: 'student-id',
    skillId: 'skill-id',
    scheduledStart: '2024-01-15T10:00:00Z',
    scheduledEnd: '2024-01-15T11:00:00Z',
    creditsAmount: 10
  })
});

// Start a session
const { roomId, token } = await apiCall(`/sessions/${session.id}/start`, {
  method: 'POST'
});
```

## Advanced Integration Patterns

### Real-time Features with WebSocket

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: {
    token: localStorage.getItem('accessToken')
  }
});

// Listen for notifications
socket.on('notification', (notification) => {
  console.log('New notification:', notification);
  showNotification(notification);
});

// Listen for messages
socket.on('message', (message) => {
  console.log('New message:', message);
  updateChatUI(message);
});

// Send a message
const sendMessage = (receiverId, content) => {
  socket.emit('sendMessage', {
    receiverId,
    content
  });
};
```

### File Upload Integration

```javascript
const uploadFile = async (file, type = 'course-material') => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', type);

  const response = await fetch('/api/media/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
    },
    body: formData
  });

  return response.json();
};

// Usage
const fileInput = document.getElementById('file-input');
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  const result = await uploadFile(file, 'avatar');
  console.log('File uploaded:', result.url);
});
```

### Payment Integration

```javascript
// Stripe integration for payment methods
import { loadStripe } from '@stripe/stripe-js';

const stripe = await loadStripe('pk_test_...');

const addPaymentMethod = async () => {
  // Create setup intent
  const { clientSecret } = await apiCall('/payments/setup-intent', {
    method: 'POST'
  });

  // Confirm setup intent with Stripe
  const { setupIntent, error } = await stripe.confirmCardSetup(clientSecret, {
    payment_method: {
      card: cardElement,
      billing_details: {
        name: 'Customer Name'
      }
    }
  });

  if (error) {
    console.error('Payment method setup failed:', error);
    return;
  }

  // Add payment method to user account
  await apiCall('/payments/methods', {
    method: 'POST',
    body: JSON.stringify({
      stripePaymentMethodId: setupIntent.payment_method
    })
  });
};
```

### Analytics Integration

```javascript
// Dashboard analytics
const getDashboardData = async () => {
  const [analytics, skills, teaching, badges] = await Promise.all([
    apiCall('/analytics/dashboard'),
    apiCall('/analytics/skills'),
    apiCall('/analytics/teaching'),
    apiCall('/analytics/badges')
  ]);

  return { analytics, skills, teaching, badges };
};

// Export analytics
const exportAnalytics = async () => {
  const response = await fetch('/api/analytics/export', {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
    }
  });

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'skillswap-analytics.json';
  a.click();
};
```

## Mobile App Integration

### React Native Example

```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';

class SkillSwapAPI {
  constructor(baseURL = 'https://api.skillswap.com') {
    this.baseURL = baseURL;
  }

  async request(endpoint, options = {}) {
    const token = await AsyncStorage.getItem('accessToken');
    
    const response = await fetch(`${this.baseURL}/api${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers
      }
    });

    if (response.status === 401) {
      await this.refreshToken();
      return this.request(endpoint, options);
    }

    return response.json();
  }

  async login(username, password) {
    const response = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });

    await AsyncStorage.setItem('accessToken', response.accessToken);
    await AsyncStorage.setItem('refreshToken', response.refreshToken);
    
    return response;
  }

  async refreshToken() {
    const refreshToken = await AsyncStorage.getItem('refreshToken');
    
    const response = await fetch(`${this.baseURL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });

    const { accessToken } = await response.json();
    await AsyncStorage.setItem('accessToken', accessToken);
  }
}

// Usage
const api = new SkillSwapAPI();

// Login
await api.login('username', 'password');

// Get user data
const user = await api.request('/auth/me');
```

### Push Notifications

```javascript
import messaging from '@react-native-firebase/messaging';

const setupPushNotifications = async () => {
  // Request permission
  const authStatus = await messaging().requestPermission();
  
  if (authStatus === messaging.AuthorizationStatus.AUTHORIZED) {
    // Get FCM token
    const token = await messaging().getToken();
    
    // Register token with API
    await api.request('/push-tokens', {
      method: 'POST',
      body: JSON.stringify({
        token,
        platform: 'ios' // or 'android'
      })
    });
  }
};

// Handle foreground messages
messaging().onMessage(async remoteMessage => {
  console.log('Foreground message:', remoteMessage);
  // Show local notification
});
```

## Error Handling Best Practices

```javascript
class APIError extends Error {
  constructor(response, data) {
    super(data.message || 'API Error');
    this.name = 'APIError';
    this.code = data.code;
    this.status = response.status;
    this.details = data.details;
  }
}

const handleAPICall = async (apiFunction) => {
  try {
    return await apiFunction();
  } catch (error) {
    if (error instanceof APIError) {
      switch (error.code) {
        case 'INSUFFICIENT_CREDITS':
          showCreditsPurchaseModal();
          break;
        case 'SUBSCRIPTION_REQUIRED':
          showUpgradeModal();
          break;
        case 'VALIDATION_ERROR':
          showValidationErrors(error.details);
          break;
        default:
          showGenericError(error.message);
      }
    } else {
      showNetworkError();
    }
    throw error;
  }
};
```

## Testing Your Integration

### Unit Tests

```javascript
import { jest } from '@jest/globals';

// Mock API responses
const mockApiCall = jest.fn();

describe('SkillSwap Integration', () => {
  test('should authenticate user', async () => {
    mockApiCall.mockResolvedValue({
      user: { id: '123', username: 'testuser' },
      accessToken: 'mock-token'
    });

    const result = await login('testuser', 'password');
    expect(result.user.username).toBe('testuser');
  });

  test('should handle authentication errors', async () => {
    mockApiCall.mockRejectedValue(new APIError(
      { status: 401 },
      { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' }
    ));

    await expect(login('invalid', 'credentials')).rejects.toThrow('Invalid credentials');
  });
});
```

### Integration Tests

```javascript
describe('API Integration Tests', () => {
  let accessToken;

  beforeAll(async () => {
    // Setup test user
    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'testuser',
        email: 'test@example.com',
        password: 'testpassword123',
        fullName: 'Test User'
      })
    });

    const data = await response.json();
    accessToken = data.accessToken;
  });

  test('should create and retrieve skills', async () => {
    // Create skill
    const createResponse = await fetch('/api/skills', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        name: 'Test Skill',
        category: 'Testing',
        level: 'beginner',
        isOffering: true
      })
    });

    const skill = await createResponse.json();
    expect(skill.name).toBe('Test Skill');

    // Retrieve skills
    const getResponse = await fetch(`/api/skills?userId=${skill.userId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    const skills = await getResponse.json();
    expect(skills).toContainEqual(expect.objectContaining({ name: 'Test Skill' }));
  });
});
```

## Performance Optimization

### Caching Strategies

```javascript
class CachedAPI {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  async cachedRequest(endpoint, options = {}) {
    const cacheKey = `${endpoint}-${JSON.stringify(options)}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    const data = await apiCall(endpoint, options);
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });

    return data;
  }

  clearCache() {
    this.cache.clear();
  }
}
```

### Batch Requests

```javascript
const batchRequests = async (requests) => {
  const results = await Promise.allSettled(
    requests.map(({ endpoint, options }) => apiCall(endpoint, options))
  );

  return results.map((result, index) => ({
    request: requests[index],
    success: result.status === 'fulfilled',
    data: result.status === 'fulfilled' ? result.value : null,
    error: result.status === 'rejected' ? result.reason : null
  }));
};

// Usage
const results = await batchRequests([
  { endpoint: '/analytics/dashboard' },
  { endpoint: '/analytics/skills' },
  { endpoint: '/analytics/badges' }
]);
```

## Security Best Practices

1. **Token Storage**: Use secure storage (Keychain on iOS, Keystore on Android)
2. **HTTPS Only**: Always use HTTPS in production
3. **Token Refresh**: Implement automatic token refresh
4. **Input Validation**: Validate all user inputs before sending to API
5. **Error Handling**: Don't expose sensitive information in error messages

## Support and Resources

- **API Documentation**: http://localhost:3000/api-docs
- **GitHub Repository**: https://github.com/skillswap/api
- **Developer Forum**: https://forum.skillswap.com/developers
- **Email Support**: developers@skillswap.com

## Changelog

### v1.0.0
- Initial API release
- Complete authentication system
- Credits and payment processing
- Course builder functionality
- AI recommendations
- Analytics dashboard