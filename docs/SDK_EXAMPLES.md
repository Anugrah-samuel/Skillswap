# SkillSwap API SDK Examples

This document provides code examples for integrating with the SkillSwap API in various programming languages and frameworks.

## JavaScript/TypeScript SDK

### Installation
```bash
npm install axios
```

### Basic SDK Implementation

```typescript
interface SkillSwapConfig {
  baseURL: string;
  apiKey?: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

class SkillSwapSDK {
  private baseURL: string;
  private accessToken?: string;
  private refreshToken?: string;
  private apiKey?: string;

  constructor(config: SkillSwapConfig) {
    this.baseURL = config.baseURL;
    this.apiKey = config.apiKey;
  }

  // Authentication methods
  async signup(userData: {
    username: string;
    email: string;
    password: string;
    fullName: string;
    bio?: string;
    location?: string;
  }): Promise<{ user: any; accessToken: string; refreshToken: string }> {
    const response = await this.request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(userData)
    });

    this.setTokens(response.accessToken, response.refreshToken);
    return response;
  }

  async login(username: string, password: string): Promise<AuthTokens> {
    const response = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });

    this.setTokens(response.accessToken, response.refreshToken);
    return response;
  }

  async getCurrentUser() {
    return this.request('/auth/me');
  }

  // Skills methods
  async createSkill(skillData: {
    name: string;
    category: string;
    level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    description: string;
    isOffering: boolean;
    isSeeking: boolean;
  }) {
    return this.request('/skills', {
      method: 'POST',
      body: JSON.stringify(skillData)
    });
  }

  async getUserSkills(userId: string) {
    return this.request(`/skills?userId=${userId}`);
  }

  // Credits methods
  async getCreditBalance() {
    return this.request('/credits/balance');
  }

  async purchaseCredits(amount: number, paymentMethodId: string) {
    return this.request('/credits/purchase', {
      method: 'POST',
      body: JSON.stringify({ amount, paymentMethodId })
    });
  }

  // Sessions methods
  async scheduleSession(sessionData: {
    matchId: string;
    teacherId: string;
    studentId: string;
    skillId: string;
    scheduledStart: string;
    scheduledEnd: string;
    creditsAmount: number;
  }) {
    return this.request('/sessions/schedule', {
      method: 'POST',
      body: JSON.stringify(sessionData)
    });
  }

  async getUpcomingSessions() {
    return this.request('/sessions/upcoming');
  }

  // Analytics methods
  async getDashboardAnalytics() {
    return this.request('/analytics/dashboard');
  }

  async getSkillAnalytics(skillId?: string) {
    const query = skillId ? `?skillId=${skillId}` : '';
    return this.request(`/analytics/skills${query}`);
  }

  // Recommendations methods
  async getSkillRecommendations(limit = 10) {
    return this.request(`/recommendations/skills?limit=${limit}`);
  }

  async getUserRecommendations(skillId: string, filters: any = {}, limit = 10) {
    const queryParams = new URLSearchParams({
      skillId,
      limit: limit.toString(),
      ...filters
    });
    return this.request(`/recommendations/users?${queryParams}`);
  }

  // Private methods
  private setTokens(accessToken: string, refreshToken: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseURL}/api${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>
    };

    if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    } else if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (response.status === 401 && this.refreshToken) {
      await this.refreshAccessToken();
      return this.request(endpoint, options);
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`API Error: ${error.message}`);
    }

    return response.json();
  }

  private async refreshAccessToken() {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await fetch(`${this.baseURL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: this.refreshToken })
    });

    if (!response.ok) {
      throw new Error('Failed to refresh token');
    }

    const { accessToken } = await response.json();
    this.accessToken = accessToken;
  }
}

// Usage example
const sdk = new SkillSwapSDK({
  baseURL: 'http://localhost:3000'
});

// Login and use the SDK
await sdk.login('username', 'password');
const user = await sdk.getCurrentUser();
const balance = await sdk.getCreditBalance();
```

## React Hook Integration

```typescript
import { useState, useEffect, useContext, createContext } from 'react';

interface SkillSwapContextType {
  sdk: SkillSwapSDK | null;
  user: any | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const SkillSwapContext = createContext<SkillSwapContextType | null>(null);

export const SkillSwapProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sdk] = useState(() => new SkillSwapSDK({
    baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3000'
  }));
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const login = async (username: string, password: string) => {
    await sdk.login(username, password);
    const userData = await sdk.getCurrentUser();
    setUser(userData);
    setIsAuthenticated(true);
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    // Clear tokens from SDK
  };

  return (
    <SkillSwapContext.Provider value={{
      sdk,
      user,
      isAuthenticated,
      login,
      logout
    }}>
      {children}
    </SkillSwapContext.Provider>
  );
};

export const useSkillSwap = () => {
  const context = useContext(SkillSwapContext);
  if (!context) {
    throw new Error('useSkillSwap must be used within SkillSwapProvider');
  }
  return context;
};

// Custom hooks for specific features
export const useCredits = () => {
  const { sdk } = useSkillSwap();
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const { balance } = await sdk!.getCreditBalance();
        setBalance(balance);
      } catch (error) {
        console.error('Failed to fetch credit balance:', error);
      } finally {
        setLoading(false);
      }
    };

    if (sdk) {
      fetchBalance();
    }
  }, [sdk]);

  const purchaseCredits = async (amount: number, paymentMethodId: string) => {
    const result = await sdk!.purchaseCredits(amount, paymentMethodId);
    setBalance(result.newBalance);
    return result;
  };

  return { balance, loading, purchaseCredits };
};

export const useAnalytics = () => {
  const { sdk } = useSkillSwap();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const data = await sdk!.getDashboardAnalytics();
        setAnalytics(data);
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    if (sdk) {
      fetchAnalytics();
    }
  }, [sdk]);

  return { analytics, loading };
};
```

## Python SDK

```python
import requests
import json
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta

class SkillSwapSDK:
    def __init__(self, base_url: str, api_key: Optional[str] = None):
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.access_token: Optional[str] = None
        self.refresh_token: Optional[str] = None
        self.session = requests.Session()

    def _get_headers(self) -> Dict[str, str]:
        headers = {'Content-Type': 'application/json'}
        
        if self.access_token:
            headers['Authorization'] = f'Bearer {self.access_token}'
        elif self.api_key:
            headers['X-API-Key'] = self.api_key
            
        return headers

    def _request(self, method: str, endpoint: str, data: Optional[Dict] = None) -> Dict[str, Any]:
        url = f"{self.base_url}/api{endpoint}"
        headers = self._get_headers()
        
        response = self.session.request(
            method=method,
            url=url,
            headers=headers,
            json=data
        )
        
        if response.status_code == 401 and self.refresh_token:
            self._refresh_access_token()
            headers = self._get_headers()
            response = self.session.request(
                method=method,
                url=url,
                headers=headers,
                json=data
            )
        
        if not response.ok:
            error_data = response.json() if response.content else {}
            raise Exception(f"API Error: {error_data.get('message', 'Unknown error')}")
        
        return response.json()

    def signup(self, username: str, email: str, password: str, full_name: str, 
               bio: Optional[str] = None, location: Optional[str] = None) -> Dict[str, Any]:
        data = {
            'username': username,
            'email': email,
            'password': password,
            'fullName': full_name
        }
        if bio:
            data['bio'] = bio
        if location:
            data['location'] = location
            
        response = self._request('POST', '/auth/signup', data)
        self.access_token = response['accessToken']
        self.refresh_token = response['refreshToken']
        return response

    def login(self, username: str, password: str) -> Dict[str, Any]:
        response = self._request('POST', '/auth/login', {
            'username': username,
            'password': password
        })
        self.access_token = response['accessToken']
        self.refresh_token = response['refreshToken']
        return response

    def get_current_user(self) -> Dict[str, Any]:
        return self._request('GET', '/auth/me')

    def create_skill(self, name: str, category: str, level: str, description: str,
                    is_offering: bool, is_seeking: bool) -> Dict[str, Any]:
        return self._request('POST', '/skills', {
            'name': name,
            'category': category,
            'level': level,
            'description': description,
            'isOffering': is_offering,
            'isSeeking': is_seeking
        })

    def get_user_skills(self, user_id: str) -> List[Dict[str, Any]]:
        return self._request('GET', f'/skills?userId={user_id}')

    def get_credit_balance(self) -> Dict[str, Any]:
        return self._request('GET', '/credits/balance')

    def purchase_credits(self, amount: int, payment_method_id: str) -> Dict[str, Any]:
        return self._request('POST', '/credits/purchase', {
            'amount': amount,
            'paymentMethodId': payment_method_id
        })

    def schedule_session(self, match_id: str, teacher_id: str, student_id: str,
                        skill_id: str, scheduled_start: str, scheduled_end: str,
                        credits_amount: int) -> Dict[str, Any]:
        return self._request('POST', '/sessions/schedule', {
            'matchId': match_id,
            'teacherId': teacher_id,
            'studentId': student_id,
            'skillId': skill_id,
            'scheduledStart': scheduled_start,
            'scheduledEnd': scheduled_end,
            'creditsAmount': credits_amount
        })

    def get_upcoming_sessions(self) -> List[Dict[str, Any]]:
        return self._request('GET', '/sessions/upcoming')

    def get_dashboard_analytics(self) -> Dict[str, Any]:
        return self._request('GET', '/analytics/dashboard')

    def get_skill_recommendations(self, limit: int = 10) -> Dict[str, Any]:
        return self._request('GET', f'/recommendations/skills?limit={limit}')

    def _refresh_access_token(self):
        if not self.refresh_token:
            raise Exception('No refresh token available')
            
        response = requests.post(
            f"{self.base_url}/api/auth/refresh",
            headers={'Content-Type': 'application/json'},
            json={'refreshToken': self.refresh_token}
        )
        
        if not response.ok:
            raise Exception('Failed to refresh token')
            
        data = response.json()
        self.access_token = data['accessToken']

# Usage example
sdk = SkillSwapSDK('http://localhost:3000')

# Login
user_data = sdk.login('username', 'password')
print(f"Logged in as: {user_data['user']['username']}")

# Get credit balance
balance = sdk.get_credit_balance()
print(f"Credit balance: {balance['balance']}")

# Create a skill
skill = sdk.create_skill(
    name='Python Programming',
    category='Programming',
    level='intermediate',
    description='Backend development with Python',
    is_offering=True,
    is_seeking=False
)
print(f"Created skill: {skill['name']}")
```

## React Native SDK

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging from '@react-native-firebase/messaging';

class SkillSwapMobileSDK extends SkillSwapSDK {
  constructor(config: SkillSwapConfig) {
    super(config);
    this.initializeTokens();
  }

  private async initializeTokens() {
    const accessToken = await AsyncStorage.getItem('skillswap_access_token');
    const refreshToken = await AsyncStorage.getItem('skillswap_refresh_token');
    
    if (accessToken && refreshToken) {
      this.setTokens(accessToken, refreshToken);
    }
  }

  async login(username: string, password: string) {
    const response = await super.login(username, password);
    
    // Store tokens securely
    await AsyncStorage.setItem('skillswap_access_token', response.accessToken);
    await AsyncStorage.setItem('skillswap_refresh_token', response.refreshToken);
    
    // Register for push notifications
    await this.registerPushToken();
    
    return response;
  }

  async logout() {
    await AsyncStorage.removeItem('skillswap_access_token');
    await AsyncStorage.removeItem('skillswap_refresh_token');
    
    // Unregister push token
    await this.unregisterPushToken();
    
    this.accessToken = undefined;
    this.refreshToken = undefined;
  }

  private async registerPushToken() {
    try {
      const authStatus = await messaging().requestPermission();
      
      if (authStatus === messaging.AuthorizationStatus.AUTHORIZED) {
        const token = await messaging().getToken();
        
        await this.request('/push-tokens', {
          method: 'POST',
          body: JSON.stringify({
            token,
            platform: Platform.OS
          })
        });
      }
    } catch (error) {
      console.error('Failed to register push token:', error);
    }
  }

  private async unregisterPushToken() {
    try {
      const token = await messaging().getToken();
      // Implementation to remove token from server
    } catch (error) {
      console.error('Failed to unregister push token:', error);
    }
  }

  // Mobile-specific methods
  async syncOfflineData() {
    return this.request('/mobile/sync');
  }

  async getOfflineData() {
    return this.request('/mobile/offline-data');
  }
}

// React Native hook
export const useSkillSwapMobile = () => {
  const [sdk] = useState(() => new SkillSwapMobileSDK({
    baseURL: 'https://api.skillswap.com'
  }));

  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check if user is already logged in
    const checkAuthStatus = async () => {
      try {
        const userData = await sdk.getCurrentUser();
        setUser(userData);
        setIsAuthenticated(true);
      } catch (error) {
        // User not authenticated
      }
    };

    checkAuthStatus();
  }, []);

  const login = async (username: string, password: string) => {
    const response = await sdk.login(username, password);
    setUser(response.user);
    setIsAuthenticated(true);
    return response;
  };

  const logout = async () => {
    await sdk.logout();
    setUser(null);
    setIsAuthenticated(false);
  };

  return {
    sdk,
    user,
    isAuthenticated,
    login,
    logout
  };
};
```

## Flutter/Dart SDK

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class SkillSwapSDK {
  final String baseUrl;
  final String? apiKey;
  String? _accessToken;
  String? _refreshToken;

  SkillSwapSDK({required this.baseUrl, this.apiKey});

  Future<void> _loadTokens() async {
    final prefs = await SharedPreferences.getInstance();
    _accessToken = prefs.getString('skillswap_access_token');
    _refreshToken = prefs.getString('skillswap_refresh_token');
  }

  Future<void> _saveTokens(String accessToken, String refreshToken) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('skillswap_access_token', accessToken);
    await prefs.setString('skillswap_refresh_token', refreshToken);
    _accessToken = accessToken;
    _refreshToken = refreshToken;
  }

  Map<String, String> _getHeaders() {
    final headers = <String, String>{
      'Content-Type': 'application/json',
    };

    if (_accessToken != null) {
      headers['Authorization'] = 'Bearer $_accessToken';
    } else if (apiKey != null) {
      headers['X-API-Key'] = apiKey!;
    }

    return headers;
  }

  Future<Map<String, dynamic>> _request(
    String method,
    String endpoint, {
    Map<String, dynamic>? data,
  }) async {
    final url = Uri.parse('$baseUrl/api$endpoint');
    final headers = _getHeaders();

    http.Response response;
    switch (method.toUpperCase()) {
      case 'GET':
        response = await http.get(url, headers: headers);
        break;
      case 'POST':
        response = await http.post(
          url,
          headers: headers,
          body: data != null ? jsonEncode(data) : null,
        );
        break;
      case 'PUT':
        response = await http.put(
          url,
          headers: headers,
          body: data != null ? jsonEncode(data) : null,
        );
        break;
      case 'DELETE':
        response = await http.delete(url, headers: headers);
        break;
      default:
        throw Exception('Unsupported HTTP method: $method');
    }

    if (response.statusCode == 401 && _refreshToken != null) {
      await _refreshAccessToken();
      return _request(method, endpoint, data: data);
    }

    if (response.statusCode >= 400) {
      final errorData = jsonDecode(response.body);
      throw Exception('API Error: ${errorData['message']}');
    }

    return jsonDecode(response.body);
  }

  Future<Map<String, dynamic>> login(String username, String password) async {
    final response = await _request('POST', '/auth/login', data: {
      'username': username,
      'password': password,
    });

    await _saveTokens(response['accessToken'], response['refreshToken']);
    return response;
  }

  Future<Map<String, dynamic>> getCurrentUser() async {
    return _request('GET', '/auth/me');
  }

  Future<Map<String, dynamic>> createSkill({
    required String name,
    required String category,
    required String level,
    required String description,
    required bool isOffering,
    required bool isSeeking,
  }) async {
    return _request('POST', '/skills', data: {
      'name': name,
      'category': category,
      'level': level,
      'description': description,
      'isOffering': isOffering,
      'isSeeking': isSeeking,
    });
  }

  Future<Map<String, dynamic>> getCreditBalance() async {
    return _request('GET', '/credits/balance');
  }

  Future<List<dynamic>> getUpcomingSessions() async {
    return await _request('GET', '/sessions/upcoming');
  }

  Future<void> _refreshAccessToken() async {
    if (_refreshToken == null) {
      throw Exception('No refresh token available');
    }

    final response = await http.post(
      Uri.parse('$baseUrl/api/auth/refresh'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'refreshToken': _refreshToken}),
    );

    if (response.statusCode != 200) {
      throw Exception('Failed to refresh token');
    }

    final data = jsonDecode(response.body);
    _accessToken = data['accessToken'];

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('skillswap_access_token', _accessToken!);
  }
}

// Usage in Flutter
class SkillSwapService {
  static final SkillSwapSDK _sdk = SkillSwapSDK(
    baseUrl: 'https://api.skillswap.com',
  );

  static SkillSwapSDK get sdk => _sdk;

  static Future<void> initialize() async {
    await _sdk._loadTokens();
  }
}

// In your main.dart
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SkillSwapService.initialize();
  runApp(MyApp());
}
```

## Testing Examples

### Jest Testing for JavaScript SDK

```typescript
import { SkillSwapSDK } from './skillswap-sdk';

// Mock fetch
global.fetch = jest.fn();

describe('SkillSwapSDK', () => {
  let sdk: SkillSwapSDK;

  beforeEach(() => {
    sdk = new SkillSwapSDK({ baseURL: 'http://localhost:3000' });
    (fetch as jest.Mock).mockClear();
  });

  test('should login successfully', async () => {
    const mockResponse = {
      user: { id: '123', username: 'testuser' },
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token'
    };

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    const result = await sdk.login('testuser', 'password');

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json'
        }),
        body: JSON.stringify({ username: 'testuser', password: 'password' })
      })
    );

    expect(result).toEqual(mockResponse);
  });

  test('should handle API errors', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'Invalid credentials' })
    });

    await expect(sdk.login('invalid', 'credentials'))
      .rejects.toThrow('API Error: Invalid credentials');
  });
});
```

These SDK examples provide comprehensive integration patterns for different platforms and use cases. Each SDK includes authentication, error handling, token refresh, and platform-specific features like push notifications for mobile apps.