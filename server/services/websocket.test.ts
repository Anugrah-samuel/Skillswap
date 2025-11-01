import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createServer } from 'http';
import { WebSocketService, initializeWebSocketService } from './websocket';
import { Client as SocketIOClient } from 'socket.io-client';
import jwt from 'jsonwebtoken';

// Mock storage
vi.mock('../storage', () => ({
  storage: {
    getUser: vi.fn(),
    createMessage: vi.fn(),
    createNotification: vi.fn(),
    markNotificationAsRead: vi.fn(),
    getNotificationsByUser: vi.fn()
  }
}));

describe('WebSocketService', () => {
  let httpServer: any;
  let webSocketService: WebSocketService;
  let clientSocket: any;
  let serverPort: number;

  const mockUser = {
    id: 'user-1',
    username: 'testuser',
    fullName: 'Test User',
    email: 'test@example.com',
    avatarUrl: null
  };

  beforeEach(async () => {
    // Create HTTP server
    httpServer = createServer();
    
    // Find available port
    serverPort = 3001;
    
    // Initialize WebSocket service
    webSocketService = initializeWebSocketService(httpServer);
    
    // Start server
    await new Promise<void>((resolve) => {
      httpServer.listen(serverPort, resolve);
    });

    // Mock storage methods
    const { storage } = await import('../storage');
    vi.mocked(storage.getUser).mockResolvedValue(mockUser);
    vi.mocked(storage.createMessage).mockResolvedValue({
      id: 'msg-1',
      senderId: 'user-1',
      receiverId: 'user-2',
      content: 'Test message',
      read: false,
      createdAt: new Date()
    });
    vi.mocked(storage.getNotificationsByUser).mockResolvedValue([]);
  });

  afterEach(async () => {
    // Clean up
    if (clientSocket) {
      clientSocket.disconnect();
    }
    
    if (webSocketService) {
      webSocketService.cleanup();
    }
    
    if (httpServer) {
      await new Promise<void>((resolve) => {
        httpServer.close(resolve);
      });
    }
  });

  describe('Authentication', () => {
    it('should reject connection without token', (done) => {
      clientSocket = new SocketIOClient(`http://localhost:${serverPort}`);
      
      clientSocket.on('connect_error', (error: Error) => {
        expect(error.message).toContain('Authentication');
        done();
      });
    });

    it('should reject connection with invalid token', (done) => {
      clientSocket = new SocketIOClient(`http://localhost:${serverPort}`, {
        auth: {
          token: 'invalid-token'
        }
      });
      
      clientSocket.on('connect_error', (error: Error) => {
        expect(error.message).toContain('Authentication');
        done();
      });
    });

    it('should accept connection with valid token', (done) => {
      const token = jwt.sign(
        { userId: 'user-1' }, 
        process.env.JWT_SECRET || 'fallback-secret'
      );
      
      clientSocket = new SocketIOClient(`http://localhost:${serverPort}`, {
        auth: { token }
      });
      
      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true);
        done();
      });
    });
  });

  describe('User Status', () => {
    beforeEach((done) => {
      const token = jwt.sign(
        { userId: 'user-1' }, 
        process.env.JWT_SECRET || 'fallback-secret'
      );
      
      clientSocket = new SocketIOClient(`http://localhost:${serverPort}`, {
        auth: { token }
      });
      
      clientSocket.on('connect', done);
    });

    it('should track user as online when connected', () => {
      expect(webSocketService.isUserOnline('user-1')).toBe(true);
      expect(webSocketService.getUserSocketCount('user-1')).toBe(1);
    });

    it('should track user as offline when disconnected', (done) => {
      clientSocket.disconnect();
      
      setTimeout(() => {
        expect(webSocketService.isUserOnline('user-1')).toBe(false);
        expect(webSocketService.getUserSocketCount('user-1')).toBe(0);
        done();
      }, 100);
    });

    it('should broadcast user status changes', (done) => {
      const secondSocket = new SocketIOClient(`http://localhost:${serverPort}`, {
        auth: {
          token: jwt.sign(
            { userId: 'user-2' }, 
            process.env.JWT_SECRET || 'fallback-secret'
          )
        }
      });

      secondSocket.on('user_status_changed', (data: any) => {
        expect(data.userId).toBe('user-1');
        expect(data.isOnline).toBe(false);
        secondSocket.disconnect();
        done();
      });

      secondSocket.on('connect', () => {
        clientSocket.disconnect();
      });
    });
  });

  describe('Messaging', () => {
    beforeEach((done) => {
      const token = jwt.sign(
        { userId: 'user-1' }, 
        process.env.JWT_SECRET || 'fallback-secret'
      );
      
      clientSocket = new SocketIOClient(`http://localhost:${serverPort}`, {
        auth: { token }
      });
      
      clientSocket.on('connect', done);
    });

    it('should handle send_message event', (done) => {
      const messageData = {
        receiverId: 'user-2',
        content: 'Hello, this is a test message'
      };

      clientSocket.emit('send_message', messageData);

      // Wait for message processing
      setTimeout(() => {
        const { storage } = require('../storage');
        expect(storage.createMessage).toHaveBeenCalledWith({
          senderId: 'user-1',
          receiverId: 'user-2',
          content: 'Hello, this is a test message'
        });
        done();
      }, 100);
    });

    it('should reject empty messages', (done) => {
      clientSocket.on('message_error', (error: any) => {
        expect(error.error).toContain('Invalid message data');
        done();
      });

      clientSocket.emit('send_message', {
        receiverId: 'user-2',
        content: ''
      });
    });

    it('should reject messages that are too long', (done) => {
      clientSocket.on('message_error', (error: any) => {
        expect(error.error).toContain('Message too long');
        done();
      });

      clientSocket.emit('send_message', {
        receiverId: 'user-2',
        content: 'a'.repeat(2001) // Exceeds 2000 character limit
      });
    });
  });

  describe('Typing Indicators', () => {
    let secondSocket: any;

    beforeEach((done) => {
      const token1 = jwt.sign(
        { userId: 'user-1' }, 
        process.env.JWT_SECRET || 'fallback-secret'
      );
      
      const token2 = jwt.sign(
        { userId: 'user-2' }, 
        process.env.JWT_SECRET || 'fallback-secret'
      );

      clientSocket = new SocketIOClient(`http://localhost:${serverPort}`, {
        auth: { token: token1 }
      });

      secondSocket = new SocketIOClient(`http://localhost:${serverPort}`, {
        auth: { token: token2 }
      });

      let connectCount = 0;
      const onConnect = () => {
        connectCount++;
        if (connectCount === 2) {
          // Both sockets connected, join same conversation
          const conversationId = 'user-1:user-2';
          clientSocket.emit('join_conversation', conversationId);
          secondSocket.emit('join_conversation', conversationId);
          done();
        }
      };

      clientSocket.on('connect', onConnect);
      secondSocket.on('connect', onConnect);
    });

    afterEach(() => {
      if (secondSocket) {
        secondSocket.disconnect();
      }
    });

    it('should broadcast typing indicators', (done) => {
      secondSocket.on('user_typing', (data: any) => {
        expect(data.userId).toBe('user-1');
        expect(data.isTyping).toBe(true);
        done();
      });

      clientSocket.emit('typing_start', {
        conversationId: 'user-1:user-2',
        isTyping: true
      });
    });

    it('should broadcast typing stop', (done) => {
      secondSocket.on('user_typing', (data: any) => {
        if (!data.isTyping) {
          expect(data.userId).toBe('user-1');
          expect(data.isTyping).toBe(false);
          done();
        }
      });

      // Start typing first
      clientSocket.emit('typing_start', {
        conversationId: 'user-1:user-2',
        isTyping: true
      });

      // Then stop typing
      setTimeout(() => {
        clientSocket.emit('typing_stop', {
          conversationId: 'user-1:user-2',
          isTyping: false
        });
      }, 100);
    });
  });

  describe('Notifications', () => {
    beforeEach((done) => {
      const token = jwt.sign(
        { userId: 'user-1' }, 
        process.env.JWT_SECRET || 'fallback-secret'
      );
      
      clientSocket = new SocketIOClient(`http://localhost:${serverPort}`, {
        auth: { token }
      });
      
      clientSocket.on('connect', done);
    });

    it('should send notifications to specific users', (done) => {
      clientSocket.on('notification', (notification: any) => {
        expect(notification.title).toBe('Test Notification');
        expect(notification.message).toBe('This is a test');
        expect(notification.type).toBe('test');
        done();
      });

      webSocketService.sendNotificationToUser('user-1', {
        type: 'test',
        title: 'Test Notification',
        message: 'This is a test'
      });
    });

    it('should handle notification read acknowledgment', (done) => {
      clientSocket.on('notification_read_confirmed', (data: any) => {
        expect(data.notificationId).toBe('notif-1');
        done();
      });

      clientSocket.emit('notification_read', 'notif-1');
    });
  });

  describe('Service Methods', () => {
    it('should return correct online user count', () => {
      expect(webSocketService.getOnlineUsers()).toEqual([]);
      
      // Connect a user
      const token = jwt.sign(
        { userId: 'user-1' }, 
        process.env.JWT_SECRET || 'fallback-secret'
      );
      
      clientSocket = new SocketIOClient(`http://localhost:${serverPort}`, {
        auth: { token }
      });

      return new Promise<void>((resolve) => {
        clientSocket.on('connect', () => {
          expect(webSocketService.getOnlineUsers()).toContain('user-1');
          resolve();
        });
      });
    });

    it('should broadcast session updates', (done) => {
      const token = jwt.sign(
        { userId: 'user-1' }, 
        process.env.JWT_SECRET || 'fallback-secret'
      );
      
      clientSocket = new SocketIOClient(`http://localhost:${serverPort}`, {
        auth: { token }
      });

      clientSocket.on('session_update', (data: any) => {
        expect(data.sessionId).toBe('session-1');
        expect(data.status).toBe('started');
        done();
      });

      clientSocket.on('connect', () => {
        webSocketService.broadcastSessionUpdate('session-1', { status: 'started' });
      });
    });
  });
});