import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FirebaseMessagingService } from './firebaseMessaging';

// Mock fetch globally
global.fetch = vi.fn();

describe('FirebaseMessagingService', () => {
  let fcmService: FirebaseMessagingService;
  const mockConfig = {
    serverKey: 'test-server-key',
    projectId: 'test-project',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    fcmService = FirebaseMessagingService.getInstance(mockConfig);
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = FirebaseMessagingService.getInstance();
      const instance2 = FirebaseMessagingService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should throw error if no config provided on first call', () => {
      // Reset singleton
      (FirebaseMessagingService as any).instance = null;
      
      expect(() => FirebaseMessagingService.getInstance()).toThrow(
        'FCM config is required for first initialization'
      );
    });
  });

  describe('sendToDevice', () => {
    it('should send notification to single device successfully', async () => {
      const mockResponse = {
        success: 1,
        failure: 0,
        results: [{ message_id: 'msg-123' }],
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const payload = {
        title: 'Test Notification',
        body: 'This is a test',
        data: { type: 'test' },
      };

      const result = await fcmService.sendToDevice('device-token-123', payload);

      expect(result.message_id).toBe('msg-123');
      expect(result.registration_id).toBe('device-token-123');
      expect(result.error).toBeUndefined();
    });

    it('should handle FCM errors', async () => {
      const mockResponse = {
        success: 0,
        failure: 1,
        results: [{ error: 'InvalidRegistration' }],
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const payload = {
        title: 'Test Notification',
        body: 'This is a test',
      };

      const result = await fcmService.sendToDevice('invalid-token', payload);

      expect(result.error).toBe('InvalidRegistration');
      expect(result.registration_id).toBe('invalid-token');
    });

    it('should handle network errors', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

      const payload = {
        title: 'Test Notification',
        body: 'This is a test',
      };

      const result = await fcmService.sendToDevice('device-token-123', payload);

      expect(result.error).toBe('Network error');
      expect(result.registration_id).toBe('device-token-123');
    });
  });

  describe('sendToDevices', () => {
    it('should send notification to multiple devices', async () => {
      const mockResponse = {
        success: 2,
        failure: 0,
        results: [
          { message_id: 'msg-123' },
          { message_id: 'msg-456' },
        ],
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const payload = {
        title: 'Test Notification',
        body: 'This is a test',
      };

      const tokens = ['token-1', 'token-2'];
      const result = await fcmService.sendToDevices(tokens, payload);

      expect(result.success).toBe(2);
      expect(result.failure).toBe(0);
      expect(result.results).toHaveLength(2);
    });

    it('should handle empty token array', async () => {
      const payload = {
        title: 'Test Notification',
        body: 'This is a test',
      };

      const result = await fcmService.sendToDevices([], payload);

      expect(result.success).toBe(0);
      expect(result.failure).toBe(0);
      expect(result.results).toHaveLength(0);
    });

    it('should handle request failure', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Request failed'));

      const payload = {
        title: 'Test Notification',
        body: 'This is a test',
      };

      const tokens = ['token-1', 'token-2'];
      const result = await fcmService.sendToDevices(tokens, payload);

      expect(result.success).toBe(0);
      expect(result.failure).toBe(2);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].error).toBe('Request failed');
    });
  });

  describe('sendToTopic', () => {
    it('should send notification to topic successfully', async () => {
      const mockResponse = {
        success: 1,
        failure: 0,
        results: [{ message_id: 'msg-topic-123' }],
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const payload = {
        title: 'Topic Notification',
        body: 'This is a topic notification',
      };

      const result = await fcmService.sendToTopic('general', payload);

      expect(result.message_id).toBe('msg-topic-123');
      expect(result.error).toBeUndefined();
    });

    it('should handle topic errors', async () => {
      const mockResponse = {
        success: 0,
        failure: 1,
        results: [{ error: 'TopicMessageRateExceeded' }],
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const payload = {
        title: 'Topic Notification',
        body: 'This is a topic notification',
      };

      const result = await fcmService.sendToTopic('general', payload);

      expect(result.error).toBe('TopicMessageRateExceeded');
    });
  });

  describe('subscribeToTopic', () => {
    it('should subscribe devices to topic successfully', async () => {
      const mockResponse = {
        results: [
          { error: null },
          { error: null },
        ],
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const tokens = ['token-1', 'token-2'];
      const result = await fcmService.subscribeToTopic(tokens, 'news');

      expect(result.success).toBe(2);
      expect(result.failure).toBe(0);
    });

    it('should handle subscription failures', async () => {
      const mockResponse = {
        results: [
          { error: null },
          { error: 'InvalidRegistration' },
        ],
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const tokens = ['token-1', 'invalid-token'];
      const result = await fcmService.subscribeToTopic(tokens, 'news');

      expect(result.success).toBe(1);
      expect(result.failure).toBe(1);
    });

    it('should handle network errors', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

      const tokens = ['token-1', 'token-2'];
      const result = await fcmService.subscribeToTopic(tokens, 'news');

      expect(result.success).toBe(0);
      expect(result.failure).toBe(2);
    });
  });

  describe('validateToken', () => {
    it('should validate token successfully', async () => {
      const mockResponse = {
        success: 1,
        failure: 0,
        results: [{ message_id: 'validation-msg' }],
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const isValid = await fcmService.validateToken('valid-token');

      expect(isValid).toBe(true);
    });

    it('should return false for invalid token', async () => {
      const mockResponse = {
        success: 0,
        failure: 1,
        results: [{ error: 'InvalidRegistration' }],
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const isValid = await fcmService.validateToken('invalid-token');

      expect(isValid).toBe(false);
    });

    it('should handle validation errors', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

      const isValid = await fcmService.validateToken('test-token');

      expect(isValid).toBe(false);
    });
  });

  describe('getErrorDetails', () => {
    it('should return error details for known errors', () => {
      const details = FirebaseMessagingService.getErrorDetails('InvalidRegistration');
      
      expect(details.isRetryable).toBe(false);
      expect(details.description).toBe('Invalid registration token');
    });

    it('should return default for unknown errors', () => {
      const details = FirebaseMessagingService.getErrorDetails('UnknownError');
      
      expect(details.isRetryable).toBe(false);
      expect(details.description).toBe('Unknown error');
    });

    it('should identify retryable errors', () => {
      const details = FirebaseMessagingService.getErrorDetails('Unavailable');
      
      expect(details.isRetryable).toBe(true);
      expect(details.description).toBe('FCM service unavailable');
    });
  });
});