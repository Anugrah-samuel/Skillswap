import { PushNotificationPayload } from './pushNotifications';

export interface FCMConfig {
  serverKey: string;
  projectId?: string;
}

export interface FCMResponse {
  success: number;
  failure: number;
  results: FCMResult[];
  multicast_id?: number;
}

export interface FCMResult {
  message_id?: string;
  registration_id?: string;
  error?: string;
}

export class FirebaseMessagingService {
  private static instance: FirebaseMessagingService;
  private config: FCMConfig;
  private fcmUrl = 'https://fcm.googleapis.com/fcm/send';

  private constructor(config: FCMConfig) {
    this.config = config;
  }

  static getInstance(config?: FCMConfig): FirebaseMessagingService {
    if (!FirebaseMessagingService.instance) {
      if (!config) {
        throw new Error('FCM config is required for first initialization');
      }
      FirebaseMessagingService.instance = new FirebaseMessagingService(config);
    }
    return FirebaseMessagingService.instance;
  }

  // Send notification to a single device
  async sendToDevice(token: string, payload: PushNotificationPayload): Promise<FCMResult> {
    const fcmPayload = this.buildFCMPayload(token, payload);
    
    try {
      const response = await this.sendFCMRequest(fcmPayload);
      
      if (response.failure > 0 && response.results[0]?.error) {
        return {
          error: response.results[0].error,
          registration_id: token
        };
      }
      
      return {
        message_id: response.results[0]?.message_id,
        registration_id: token
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        registration_id: token
      };
    }
  }

  // Send notification to multiple devices
  async sendToDevices(tokens: string[], payload: PushNotificationPayload): Promise<FCMResponse> {
    if (tokens.length === 0) {
      return { success: 0, failure: 0, results: [] };
    }

    const fcmPayload = this.buildFCMPayload(tokens, payload);
    
    try {
      return await this.sendFCMRequest(fcmPayload);
    } catch (error) {
      // Return failure for all tokens
      return {
        success: 0,
        failure: tokens.length,
        results: tokens.map(token => ({
          error: error instanceof Error ? error.message : 'Unknown error',
          registration_id: token
        }))
      };
    }
  }

  // Send notification to a topic
  async sendToTopic(topic: string, payload: PushNotificationPayload): Promise<FCMResult> {
    const fcmPayload = this.buildFCMPayload(`/topics/${topic}`, payload);
    
    try {
      const response = await this.sendFCMRequest(fcmPayload);
      
      if (response.failure > 0 && response.results[0]?.error) {
        return {
          error: response.results[0].error
        };
      }
      
      return {
        message_id: response.results[0]?.message_id
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Subscribe device to topic
  async subscribeToTopic(tokens: string[], topic: string): Promise<{ success: number; failure: number }> {
    const url = `https://iid.googleapis.com/iid/v1:batchAdd`;
    
    const payload = {
      to: `/topics/${topic}`,
      registration_tokens: tokens
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `key=${this.config.serverKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`FCM subscription failed: ${response.statusText}`);
      }

      const result = await response.json();
      return {
        success: result.results?.filter((r: any) => !r.error).length || 0,
        failure: result.results?.filter((r: any) => r.error).length || 0
      };
    } catch (error) {
      return {
        success: 0,
        failure: tokens.length
      };
    }
  }

  // Unsubscribe device from topic
  async unsubscribeFromTopic(tokens: string[], topic: string): Promise<{ success: number; failure: number }> {
    const url = `https://iid.googleapis.com/iid/v1:batchRemove`;
    
    const payload = {
      to: `/topics/${topic}`,
      registration_tokens: tokens
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `key=${this.config.serverKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`FCM unsubscription failed: ${response.statusText}`);
      }

      const result = await response.json();
      return {
        success: result.results?.filter((r: any) => !r.error).length || 0,
        failure: result.results?.filter((r: any) => r.error).length || 0
      };
    } catch (error) {
      return {
        success: 0,
        failure: tokens.length
      };
    }
  }

  // Validate registration token
  async validateToken(token: string): Promise<boolean> {
    try {
      const result = await this.sendToDevice(token, {
        title: 'Validation',
        body: 'Token validation',
        data: { validation: 'true' }
      });
      
      return !result.error;
    } catch (error) {
      return false;
    }
  }

  // Build FCM payload
  private buildFCMPayload(to: string | string[], payload: PushNotificationPayload): any {
    const fcmPayload: any = {
      notification: {
        title: payload.title,
        body: payload.body,
        sound: payload.sound || 'default'
      },
      data: payload.data || {},
      priority: 'high',
      content_available: true
    };

    // Handle single token vs multiple tokens
    if (Array.isArray(to)) {
      fcmPayload.registration_ids = to;
    } else {
      fcmPayload.to = to;
    }

    // Add platform-specific options
    fcmPayload.android = {
      notification: {
        icon: 'ic_notification',
        color: '#2196F3',
        sound: payload.sound || 'default',
        badge: payload.badge
      },
      priority: 'high'
    };

    fcmPayload.apns = {
      payload: {
        aps: {
          alert: {
            title: payload.title,
            body: payload.body
          },
          sound: payload.sound || 'default',
          badge: payload.badge,
          category: payload.category,
          'thread-id': payload.threadId
        }
      }
    };

    fcmPayload.webpush = {
      notification: {
        title: payload.title,
        body: payload.body,
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png',
        tag: payload.category,
        data: payload.data
      }
    };

    return fcmPayload;
  }

  // Send FCM request
  private async sendFCMRequest(payload: any): Promise<FCMResponse> {
    const response = await fetch(this.fcmUrl, {
      method: 'POST',
      headers: {
        'Authorization': `key=${this.config.serverKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`FCM request failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    
    // Handle FCM error responses
    if (result.error) {
      throw new Error(`FCM error: ${result.error}`);
    }

    return result;
  }

  // Get error details for common FCM errors
  static getErrorDetails(error: string): { isRetryable: boolean; description: string } {
    const errorMap: Record<string, { isRetryable: boolean; description: string }> = {
      'MissingRegistration': {
        isRetryable: false,
        description: 'Missing registration token'
      },
      'InvalidRegistration': {
        isRetryable: false,
        description: 'Invalid registration token'
      },
      'NotRegistered': {
        isRetryable: false,
        description: 'Device not registered'
      },
      'InvalidPackageName': {
        isRetryable: false,
        description: 'Invalid package name'
      },
      'MismatchSenderId': {
        isRetryable: false,
        description: 'Mismatched sender ID'
      },
      'MessageTooBig': {
        isRetryable: false,
        description: 'Message payload too large'
      },
      'InvalidDataKey': {
        isRetryable: false,
        description: 'Invalid data key'
      },
      'InvalidTtl': {
        isRetryable: false,
        description: 'Invalid time to live'
      },
      'Unavailable': {
        isRetryable: true,
        description: 'FCM service unavailable'
      },
      'InternalServerError': {
        isRetryable: true,
        description: 'FCM internal server error'
      },
      'DeviceMessageRateExceeded': {
        isRetryable: true,
        description: 'Device message rate exceeded'
      },
      'TopicsMessageRateExceeded': {
        isRetryable: true,
        description: 'Topics message rate exceeded'
      }
    };

    return errorMap[error] || {
      isRetryable: false,
      description: 'Unknown error'
    };
  }
}