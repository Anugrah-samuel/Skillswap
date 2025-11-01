import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { storage } from '../storage';
import type { User, InsertMessage, InsertNotification } from '@shared/schema';

import { Socket } from 'socket.io';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  user?: User;
}

interface TypingData {
  conversationId: string;
  isTyping: boolean;
}

interface MessageData {
  receiverId: string;
  content: string;
}

interface OnlineStatus {
  userId: string;
  isOnline: boolean;
  lastSeen?: Date;
}

export class WebSocketService {
  private io: SocketIOServer;
  private connectedUsers: Map<string, Set<string>> = new Map(); // userId -> Set of socketIds
  private typingUsers: Map<string, Set<string>> = new Map(); // conversationId -> Set of userIds
  private userSockets: Map<string, AuthenticatedSocket> = new Map(); // socketId -> socket

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.NODE_ENV === 'production' 
          ? process.env.FRONTEND_URL 
          : ["http://localhost:3000", "http://localhost:5173"],
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token;
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
        
        if (!decoded.userId) {
          return next(new Error('Invalid token payload'));
        }

        // Get user from database
        const user = await storage.getUser(decoded.userId);
        if (!user) {
          return next(new Error('User not found'));
        }

        // Attach user info to socket
        socket.userId = user.id;
        socket.user = user;
        
        next();
      } catch (error) {
        console.error('WebSocket authentication error:', error);
        if (error.name === 'TokenExpiredError') {
          next(new Error('Token expired'));
        } else if (error.name === 'JsonWebTokenError') {
          next(new Error('Invalid token'));
        } else {
          next(new Error('Authentication failed'));
        }
      }
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      console.log(`User ${socket.userId} connected with socket ${socket.id}`);
      
      this.handleUserConnection(socket);
      this.setupSocketEventHandlers(socket);
    });
  }

  private handleUserConnection(socket: AuthenticatedSocket) {
    if (!socket.userId) return;

    // Track connected user
    if (!this.connectedUsers.has(socket.userId)) {
      this.connectedUsers.set(socket.userId, new Set());
    }
    this.connectedUsers.get(socket.userId)!.add(socket.id);
    this.userSockets.set(socket.id, socket);

    // Join user's personal room for notifications
    socket.join(`user:${socket.userId}`);

    // Broadcast user online status
    this.broadcastUserStatus(socket.userId, true);

    // Send pending notifications
    this.sendPendingNotifications(socket.userId);
  }

  private setupSocketEventHandlers(socket: AuthenticatedSocket) {
    // Handle disconnection
    socket.on('disconnect', () => {
      this.handleUserDisconnection(socket);
    });

    // Handle real-time messaging
    socket.on('send_message', async (data: MessageData) => {
      await this.handleSendMessage(socket, data);
    });

    // Handle group message events
    socket.on('send_group_message', async (data: { content: string }) => {
      await this.handleSendGroupMessage(socket, data);
    });

    // Handle typing indicators
    socket.on('typing_start', (data: TypingData) => {
      this.handleTypingStart(socket, data);
    });

    socket.on('typing_stop', (data: TypingData) => {
      this.handleTypingStop(socket, data);
    });

    // Handle joining conversation rooms
    socket.on('join_conversation', (conversationId: string) => {
      console.log(`User ${socket.userId} joining conversation: ${conversationId}`);
      if (conversationId === 'group') {
        socket.join('group_chat');
        console.log(`User ${socket.userId} joined group_chat room`);
      } else {
        socket.join(`conversation:${conversationId}`);
        console.log(`User ${socket.userId} joined conversation:${conversationId} room`);
      }
    });

    socket.on('leave_conversation', (conversationId: string) => {
      if (conversationId === 'group') {
        socket.leave('group_chat');
      } else {
        socket.leave(`conversation:${conversationId}`);
      }
    });

    // Handle notification acknowledgment
    socket.on('notification_read', async (notificationId: string) => {
      await this.handleNotificationRead(socket, notificationId);
    });

    // Handle session events
    socket.on('session_started', (sessionId: string) => {
      this.handleSessionEvent(socket, 'session_started', sessionId);
    });

    socket.on('session_ended', (sessionId: string) => {
      this.handleSessionEvent(socket, 'session_ended', sessionId);
    });
  }

  private handleUserDisconnection(socket: AuthenticatedSocket) {
    if (!socket.userId) return;

    console.log(`User ${socket.userId} disconnected from socket ${socket.id}`);

    // Remove socket from tracking
    const userSockets = this.connectedUsers.get(socket.userId);
    if (userSockets) {
      userSockets.delete(socket.id);
      if (userSockets.size === 0) {
        this.connectedUsers.delete(socket.userId);
        // User is completely offline
        this.broadcastUserStatus(socket.userId, false);
      }
    }

    this.userSockets.delete(socket.id);

    // Clean up typing indicators
    this.cleanupTypingForUser(socket.userId);
  }

  private async handleSendMessage(socket: AuthenticatedSocket, data: MessageData) {
    if (!socket.userId) return;

    try {
      // Validate message data
      if (!data.receiverId || !data.content || data.content.trim().length === 0) {
        socket.emit('message_error', { error: 'Invalid message data' });
        return;
      }

      if (data.content.length > 2000) {
        socket.emit('message_error', { error: 'Message too long' });
        return;
      }

      // Create message in database
      const messageData: InsertMessage = {
        senderId: socket.userId,
        receiverId: data.receiverId,
        content: data.content.trim()
      };

      const message = await storage.createMessage(messageData);

      // Create conversation ID (consistent ordering)
      const conversationId = [socket.userId, data.receiverId].sort().join(':');

      // Emit message to conversation participants
      this.io.to(`conversation:${conversationId}`).emit('new_message', {
        ...message,
        sender: {
          id: socket.user!.id,
          username: socket.user!.username,
          fullName: socket.user!.fullName,
          avatarUrl: socket.user!.avatarUrl
        }
      });

      // Send notification to receiver if they're not in the conversation
      const receiverSockets = this.connectedUsers.get(data.receiverId);
      if (receiverSockets && receiverSockets.size > 0) {
        // Check if receiver is in the conversation room
        const receiverInConversation = Array.from(receiverSockets).some(socketId => {
          const receiverSocket = this.userSockets.get(socketId);
          return receiverSocket && this.io.sockets.adapter.rooms.get(`conversation:${conversationId}`)?.has(socketId);
        });

        if (!receiverInConversation) {
          // Send push notification
          this.sendNotificationToUser(data.receiverId, {
            type: 'message',
            title: 'New Message',
            message: `${socket.user!.fullName}: ${data.content.substring(0, 50)}${data.content.length > 50 ? '...' : ''}`,
            relatedId: message.id
          });
        }
      } else {
        // Receiver is offline, create notification in database
        await storage.createNotification({
          userId: data.receiverId,
          type: 'message',
          title: 'New Message',
          message: `${socket.user!.fullName} sent you a message`,
          relatedId: message.id
        });
      }

    } catch (error) {
      console.error('Error handling send message:', error);
      socket.emit('message_error', { error: 'Failed to send message' });
    }
  }

  private async handleSendGroupMessage(socket: AuthenticatedSocket, data: { content: string }) {
    if (!socket.userId) return;

    try {
      console.log(`📤 User ${socket.userId} sending group message:`, data.content);
      
      // Validate message data
      if (!data.content || data.content.trim().length === 0) {
        socket.emit('message_error', { error: 'Message content is required' });
        return;
      }

      if (data.content.length > 2000) {
        socket.emit('message_error', { error: 'Message too long' });
        return;
      }

      // Create group message in database
      const message = await storage.createGroupMessage({
        senderId: socket.userId,
        content: data.content.trim()
      });

      console.log(`📤 Created message in database:`, message.id);

      const messageWithSender = {
        ...message,
        sender: {
          id: socket.user!.id,
          username: socket.user!.username,
          fullName: socket.user!.fullName,
          avatarUrl: socket.user!.avatarUrl
        }
      };

      // Broadcast message to all users in group chat
      console.log(`📤 Broadcasting to group_chat room`);
      this.io.to('group_chat').emit('new_group_message', messageWithSender);

    } catch (error) {
      console.error('Error handling group message:', error);
      socket.emit('message_error', { error: 'Failed to send message' });
    }
  }

  private handleTypingStart(socket: AuthenticatedSocket, data: TypingData) {
    if (!socket.userId || !data.conversationId) return;

    // Add user to typing set for this conversation
    const roomName = data.conversationId === 'group' ? 'group_chat' : `conversation:${data.conversationId}`;
    
    if (!this.typingUsers.has(data.conversationId)) {
      this.typingUsers.set(data.conversationId, new Set());
    }
    this.typingUsers.get(data.conversationId)!.add(socket.userId);

    // Broadcast typing indicator to conversation participants (except sender)
    socket.to(roomName).emit('user_typing', {
      userId: socket.userId,
      username: socket.user!.username,
      isTyping: true
    });
  }

  private handleTypingStop(socket: AuthenticatedSocket, data: TypingData) {
    if (!socket.userId || !data.conversationId) return;

    // Remove user from typing set
    const roomName = data.conversationId === 'group' ? 'group_chat' : `conversation:${data.conversationId}`;
    const typingSet = this.typingUsers.get(data.conversationId);
    if (typingSet) {
      typingSet.delete(socket.userId);
      if (typingSet.size === 0) {
        this.typingUsers.delete(data.conversationId);
      }
    }

    // Broadcast typing stop to conversation participants
    socket.to(roomName).emit('user_typing', {
      userId: socket.userId,
      username: socket.user!.username,
      isTyping: false
    });
  }

  private cleanupTypingForUser(userId: string) {
    // Remove user from all typing indicators
    const entries = Array.from(this.typingUsers.entries());
    for (const [conversationId, typingSet] of entries) {
      if (typingSet.has(userId)) {
        typingSet.delete(userId);
        
        const roomName = conversationId === 'group' ? 'group_chat' : `conversation:${conversationId}`;
        
        // Broadcast typing stop
        this.io.to(roomName).emit('user_typing', {
          userId,
          isTyping: false
        });

        if (typingSet.size === 0) {
          this.typingUsers.delete(conversationId);
        }
      }
    }
  }

  private async handleNotificationRead(socket: AuthenticatedSocket, notificationId: string) {
    if (!socket.userId) return;

    try {
      await storage.markNotificationAsRead(notificationId);
      socket.emit('notification_read_confirmed', { notificationId });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      socket.emit('notification_error', { error: 'Failed to mark notification as read' });
    }
  }

  private handleSessionEvent(socket: AuthenticatedSocket, eventType: string, sessionId: string) {
    if (!socket.userId) return;

    // Broadcast session event to relevant users
    // This would typically involve getting session participants and notifying them
    socket.broadcast.emit(eventType, {
      sessionId,
      userId: socket.userId,
      timestamp: new Date()
    });
  }

  private broadcastUserStatus(userId: string, isOnline: boolean) {
    const statusData: OnlineStatus = {
      userId,
      isOnline,
      lastSeen: isOnline ? undefined : new Date()
    };

    // Broadcast to all connected users (could be optimized to only friends/contacts)
    this.io.emit('user_status_changed', statusData);
  }

  private async sendPendingNotifications(userId: string) {
    try {
      const notifications = await storage.getNotificationsByUser(userId);
      const unreadNotifications = notifications.filter(n => !n.read);

      if (unreadNotifications.length > 0) {
        this.io.to(`user:${userId}`).emit('pending_notifications', unreadNotifications);
      }
    } catch (error) {
      console.error('Error sending pending notifications:', error);
    }
  }

  // Public methods for external services to use

  public sendNotificationToUser(userId: string, notification: Omit<InsertNotification, 'userId'>) {
    this.io.to(`user:${userId}`).emit('notification', {
      ...notification,
      userId,
      id: `temp_${Date.now()}`, // Temporary ID for real-time display
      createdAt: new Date(),
      read: false
    });
  }

  public sendMessageNotification(userId: string, message: any) {
    this.io.to(`user:${userId}`).emit('message_notification', message);
  }

  public broadcastSessionUpdate(sessionId: string, update: any) {
    this.io.emit('session_update', {
      sessionId,
      ...update,
      timestamp: new Date()
    });
  }

  public notifySessionParticipants(participantIds: string[], event: string, data: any) {
    participantIds.forEach(userId => {
      this.io.to(`user:${userId}`).emit(event, {
        ...data,
        timestamp: new Date()
      });
    });
  }

  public isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  public getOnlineUsers(): string[] {
    return Array.from(this.connectedUsers.keys());
  }

  public getUserSocketCount(userId: string): number {
    return this.connectedUsers.get(userId)?.size || 0;
  }

  public broadcastGroupMessage(message: any) {
    this.io.to('group_chat').emit('new_group_message', message);
  }

  // Cleanup method
  public cleanup() {
    this.connectedUsers.clear();
    this.typingUsers.clear();
    this.userSockets.clear();
    this.io.close();
  }
}

// Singleton instance
let webSocketService: WebSocketService | null = null;

export function initializeWebSocketService(httpServer: HTTPServer): WebSocketService {
  if (webSocketService) {
    webSocketService.cleanup();
  }
  webSocketService = new WebSocketService(httpServer);
  return webSocketService;
}

export function getWebSocketService(): WebSocketService | null {
  return webSocketService;
}