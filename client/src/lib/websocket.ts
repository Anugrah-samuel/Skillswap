import { io, Socket } from 'socket.io-client';

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  read: boolean;
  createdAt: Date;
  sender?: {
    id: string;
    username: string;
    fullName: string;
    avatarUrl?: string;
  };
}

interface TypingUser {
  userId: string;
  username: string;
  isTyping: boolean;
}

interface UserStatus {
  userId: string;
  isOnline: boolean;
  lastSeen?: Date;
}

interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  relatedId?: string;
  createdAt: Date;
}

class WebSocketClient {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  // Event listeners
  private messageListeners: ((message: Message) => void)[] = [];
  private typingListeners: ((typing: TypingUser) => void)[] = [];
  private statusListeners: ((status: UserStatus) => void)[] = [];
  private notificationListeners: ((notification: Notification) => void)[] = [];
  private connectionListeners: ((connected: boolean) => void)[] = [];

  connect() {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      console.warn('No access token found, cannot connect to WebSocket');
      this.notifyConnectionListeners(false);
      return;
    }

    if (this.socket?.connected) {
      console.log('WebSocket already connected');
      this.notifyConnectionListeners(true);
      return; // Already connected
    }

    // Clean up existing socket if any
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    console.log('Connecting to WebSocket server...');
    this.socket = io('http://localhost:3000', {
      auth: {
        token
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
      timeout: 10000, // 10 second timeout
      forceNew: true // Force new connection
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('✅ Connected to WebSocket server');
      this.reconnectAttempts = 0;
      this.notifyConnectionListeners(true);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from WebSocket server:', reason);
      this.notifyConnectionListeners(false);
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('🔄 Reconnected to WebSocket server after', attemptNumber, 'attempts');
      this.reconnectAttempts = 0;
      this.notifyConnectionListeners(true);
    });

    this.socket.on('reconnect_attempt', (attemptNumber) => {
      console.log('🔄 Reconnection attempt', attemptNumber);
    });

    this.socket.on('reconnect_error', (error) => {
      console.error('🔄 Reconnection error:', error);
    });

    this.socket.on('reconnect_failed', () => {
      console.error('🔄 Reconnection failed after maximum attempts');
      this.notifyConnectionListeners(false);
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error);
      
      // Check if it's an authentication error
      if (error.message?.includes('Authentication') || error.message?.includes('token') || error.message?.includes('expired')) {
        console.warn('🔐 WebSocket authentication failed, token may be expired');
        // Clear tokens and redirect to login
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return;
      }
      
      this.reconnectAttempts++;
      this.notifyConnectionListeners(false);
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('❌ Max reconnection attempts reached');
      }
    });

    // Message events
    this.socket.on('new_message', (message: Message) => {
      this.notifyMessageListeners(message);
    });

    this.socket.on('new_group_message', (message: Message) => {
      console.log('📨 Received new_group_message:', message);
      this.notifyMessageListeners(message);
    });

    this.socket.on('message_error', (error: { error: string }) => {
      console.error('Message error:', error.error);
    });

    // Typing events
    this.socket.on('user_typing', (typing: TypingUser) => {
      this.notifyTypingListeners(typing);
    });

    // User status events
    this.socket.on('user_status_changed', (status: UserStatus) => {
      this.notifyStatusListeners(status);
    });

    // Notification events
    this.socket.on('notification', (notification: Notification) => {
      this.notifyNotificationListeners(notification);
    });

    this.socket.on('pending_notifications', (notifications: Notification[]) => {
      notifications.forEach(notification => {
        this.notifyNotificationListeners(notification);
      });
    });
  }

  // Public methods
  sendMessage(receiverId: string, content: string) {
    if (!this.socket?.connected) {
      console.warn('WebSocket not connected, cannot send message');
      return;
    }

    this.socket.emit('send_message', {
      receiverId,
      content
    });
  }

  sendGroupMessage(content: string) {
    if (!this.socket?.connected) {
      console.warn('WebSocket not connected, cannot send group message');
      return;
    }

    console.log('📤 Emitting send_group_message:', { content });
    this.socket.emit('send_group_message', {
      content
    });
  }

  joinConversation(conversationId: string) {
    if (!this.socket?.connected) {
      console.warn('Cannot join conversation, WebSocket not connected');
      return;
    }
    console.log('🏠 Joining conversation:', conversationId);
    this.socket.emit('join_conversation', conversationId);
  }

  leaveConversation(conversationId: string) {
    if (!this.socket?.connected) return;
    this.socket.emit('leave_conversation', conversationId);
  }

  startTyping(conversationId: string) {
    if (!this.socket?.connected) return;
    this.socket.emit('typing_start', { conversationId, isTyping: true });
  }

  stopTyping(conversationId: string) {
    if (!this.socket?.connected) return;
    this.socket.emit('typing_stop', { conversationId, isTyping: false });
  }

  markNotificationAsRead(notificationId: string) {
    if (!this.socket?.connected) return;
    this.socket.emit('notification_read', notificationId);
  }

  // Event listener management
  onMessage(callback: (message: Message) => void) {
    this.messageListeners.push(callback);
    return () => {
      this.messageListeners = this.messageListeners.filter(cb => cb !== callback);
    };
  }

  onTyping(callback: (typing: TypingUser) => void) {
    this.typingListeners.push(callback);
    return () => {
      this.typingListeners = this.typingListeners.filter(cb => cb !== callback);
    };
  }

  onUserStatus(callback: (status: UserStatus) => void) {
    this.statusListeners.push(callback);
    return () => {
      this.statusListeners = this.statusListeners.filter(cb => cb !== callback);
    };
  }

  onNotification(callback: (notification: Notification) => void) {
    this.notificationListeners.push(callback);
    return () => {
      this.notificationListeners = this.notificationListeners.filter(cb => cb !== callback);
    };
  }

  onConnection(callback: (connected: boolean) => void) {
    this.connectionListeners.push(callback);
    return () => {
      this.connectionListeners = this.connectionListeners.filter(cb => cb !== callback);
    };
  }

  // Private notification methods
  private notifyMessageListeners(message: Message) {
    this.messageListeners.forEach(callback => callback(message));
  }

  private notifyTypingListeners(typing: TypingUser) {
    this.typingListeners.forEach(callback => callback(typing));
  }

  private notifyStatusListeners(status: UserStatus) {
    this.statusListeners.forEach(callback => callback(status));
  }

  private notifyNotificationListeners(notification: Notification) {
    this.notificationListeners.forEach(callback => callback(notification));
  }

  private notifyConnectionListeners(connected: boolean) {
    this.connectionListeners.forEach(callback => callback(connected));
  }

  // Cleanup
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    // Clear all listeners
    this.messageListeners = [];
    this.typingListeners = [];
    this.statusListeners = [];
    this.notificationListeners = [];
    this.connectionListeners = [];
  }

  get isConnected() {
    return this.socket?.connected || false;
  }

  // Force reconnection method
  forceReconnect() {
    console.log('🔄 Forcing WebSocket reconnection...');
    if (this.socket) {
      this.socket.disconnect();
    }
    setTimeout(() => {
      this.connect();
    }, 1000);
  }

  // Get connection status with more details
  getConnectionStatus() {
    if (!this.socket) {
      return { connected: false, status: 'not_initialized' };
    }
    
    return {
      connected: this.socket.connected,
      status: this.socket.connected ? 'connected' : 'disconnected',
      id: this.socket.id,
      transport: this.socket.io.engine?.transport?.name
    };
  }
}

// Singleton instance
export const webSocketClient = new WebSocketClient();

// Auto-connect when user is authenticated
const token = localStorage.getItem('accessToken');
if (token) {
  console.log('🔌 Auto-connecting WebSocket with existing token...');
  webSocketClient.connect();
} else {
  console.log('🔌 No token found, WebSocket will not auto-connect');
}

// Listen for login/logout events
window.addEventListener('storage', (e) => {
  if (e.key === 'accessToken') {
    if (e.newValue) {
      // User logged in
      webSocketClient.connect();
    } else {
      // User logged out
      webSocketClient.disconnect();
    }
  }
});