import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Send, Users, MessageCircle, Loader2, Wifi, WifiOff, User, MessageSquareMore, Star, Crown } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { webSocketClient } from "@/lib/websocket";

interface Message {
  id: string;
  senderId: string;
  receiverId?: string;
  content: string;
  read: boolean;
  createdAt: Date;
  sender?: {
    id: string;
    username: string;
    fullName: string;
    avatarUrl?: string;
    role?: string;
    isPremium?: boolean;
    rating?: number;
    completedExchanges?: number;
  };
}

export default function Chat() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("group");
  const [groupMessageInput, setGroupMessageInput] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [realtimeMessages, setRealtimeMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [messageCache, setMessageCache] = useState<Map<string, Message>>(new Map());
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const lastMessageRef = useRef<HTMLDivElement>(null);

  // Get user ID from localStorage
  const getUserId = () => {
    try {
      const user = localStorage.getItem('user');
      return user ? JSON.parse(user).id : null;
    } catch {
      return null;
    }
  };
  
  const userId = getUserId();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!userId) {
      toast({
        title: "Authentication required",
        description: "Please log in to access messages",
        variant: "destructive",
      });
      setLocation("/login");
      return;
    }
  }, [userId, setLocation, toast]);

  // WebSocket connection and real-time messaging
  useEffect(() => {
    if (!userId) return;

    // Connect to WebSocket
    webSocketClient.connect();
    
    // Set initial connection status after a brief delay to allow connection
    setTimeout(() => {
      setIsConnected(webSocketClient.isConnected);
    }, 500);

    // Listen for connection status
    const unsubscribeConnection = webSocketClient.onConnection((connected) => {
      setIsConnected(connected);
      if (connected) {
        // Join group chat room
        webSocketClient.joinConversation('group');
      }
    });

    // Listen for new group messages
    const unsubscribeMessages = webSocketClient.onMessage((message) => {
      // Only add group messages (no receiverId means it's a group message)
      if (!message.receiverId) {
        setRealtimeMessages(prev => {
          // Check if message already exists to avoid duplicates
          const exists = prev.some(m => m.id === message.id);
          if (exists) {
            return prev;
          }
          
          // Remove any temporary messages that match this real message
          const filteredPrev = prev.filter(m => {
            if (m.id.startsWith('temp_') && 
                m.content === message.content && 
                m.senderId === message.senderId) {
              return false; // Remove temporary message
            }
            return true;
          });
          
          return [...filteredPrev, message];
        });
        
        // Auto-scroll to bottom when new message arrives
        setTimeout(() => {
          if (lastMessageRef.current) {
            lastMessageRef.current.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'end' 
            });
          }
        }, 100);
      }
    });

    // Listen for typing indicators
    const unsubscribeTyping = webSocketClient.onTyping((typing) => {
      if (typing.userId !== userId) {
        setTypingUsers(prev => {
          if (typing.isTyping) {
            return prev.includes(typing.userId) ? prev : [...prev, typing.userId];
          } else {
            return prev.filter(id => id !== typing.userId);
          }
        });
      }
    });

    // Listen for user status changes
    const unsubscribeStatus = webSocketClient.onUserStatus((status) => {
      setOnlineUsers(prev => {
        const newSet = new Set(prev);
        if (status.isOnline) {
          newSet.add(status.userId);
        } else {
          newSet.delete(status.userId);
        }
        return newSet;
      });
    });

    return () => {
      unsubscribeConnection();
      unsubscribeMessages();
      unsubscribeTyping();
      unsubscribeStatus();
      webSocketClient.leaveConversation('group');
    };
  }, [userId]);

  // Don't render anything if not authenticated
  if (!userId) {
    return null;
  }

  // Fetch initial group messages (only once)
  const { data: initialMessages = [], isLoading: groupMessagesLoading, error } = useQuery<Message[]>({
    queryKey: ["/api/messages/group"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/messages/group");
      return response.json();
    },
    refetchOnWindowFocus: false,
    refetchInterval: false,
    staleTime: Infinity, // Don't refetch automatically
    retry: (failureCount, error: any) => {
      if (error?.status === 429) {
        return false;
      }
      return failureCount < 3;
    },
  });

  // Efficient message deduplication using Map
  const groupMessages = React.useMemo(() => {
    const messageMap = new Map<string, Message>();
    
    // Add initial messages
    initialMessages.forEach(message => {
      messageMap.set(message.id, message);
    });
    
    // Add real-time messages
    realtimeMessages.forEach(message => {
      // If this is a real message (not temporary), it should replace any temporary message
      if (!message.id.startsWith('temp_')) {
        // Remove any temporary messages with similar content and timestamp
        const tempMessages = Array.from(messageMap.entries()).filter(([id, msg]) => 
          id.startsWith('temp_') && 
          msg.content === message.content &&
          msg.senderId === message.senderId &&
          Math.abs(new Date(msg.createdAt).getTime() - new Date(message.createdAt).getTime()) < 5000 // Within 5 seconds
        );
        
        tempMessages.forEach(([tempId]) => {
          messageMap.delete(tempId);
        });
      }
      
      messageMap.set(message.id, message);
    });
    
    // Convert to array and sort by timestamp
    return Array.from(messageMap.values())
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [initialMessages, realtimeMessages]);

  // Auto-scroll to bottom when messages change (optimized)
  useEffect(() => {
    if (groupMessages.length > 0) {
      requestAnimationFrame(() => {
        if (lastMessageRef.current) {
          lastMessageRef.current.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'end' 
          });
        }
      });
    }
  }, [groupMessages.length]);

  // Send group message mutation (fallback for when WebSocket is not available)
  const sendGroupMessageMutation = useMutation({
    mutationFn: async (data: { content: string }) => {
      const response = await apiRequest("POST", "/api/messages/group", data);
      return response.json();
    },
    onSuccess: (newMessage) => {
      setGroupMessageInput("");
      // Add message to real-time messages if not already there
      setRealtimeMessages(prev => {
        if (prev.some(m => m.id === newMessage.id)) {
          return prev;
        }
        return [...prev, newMessage];
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send message",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle typing indicators
  const handleInputChange = useCallback((value: string) => {
    setGroupMessageInput(value);
    
    if (value.trim() && !isTyping) {
      setIsTyping(true);
      webSocketClient.startTyping('group');
    }
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set new timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      webSocketClient.stopTyping('group');
    }, 1000);
  }, [isTyping]);

  const handleSendGroupMessage = useCallback(() => {
    if (!groupMessageInput.trim()) return;
    
    const messageContent = groupMessageInput.trim();
    
    // Clear typing indicator
    if (isTyping) {
      setIsTyping(false);
      webSocketClient.stopTyping('group');
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }
    
    // Clear input immediately for better UX
    setGroupMessageInput("");
    
    // Use WebSocket for real-time messaging when connected
    if (isConnected) {
      webSocketClient.sendGroupMessage(messageContent);
      
      // Optimistic update: Add message immediately for better UX
      const userData = JSON.parse(localStorage.getItem('user') || '{}');
      const optimisticMessage: Message = {
        id: `temp_${Date.now()}_${Math.random()}`, // Temporary ID
        senderId: userId!,
        content: messageContent,
        read: false,
        createdAt: new Date(),
        sender: {
          id: userId!,
          username: userData.username || 'You',
          fullName: userData.fullName || 'You',
          avatarUrl: userData.avatarUrl
        }
      };
      
      setRealtimeMessages(prev => [...prev, optimisticMessage]);
    } else {
      // Fallback to HTTP when WebSocket is not connected
      sendGroupMessageMutation.mutate({
        content: messageContent
      });
    }
  }, [groupMessageInput, isConnected, isTyping, userId]);

  // Memoized timestamp formatter for better performance
  const formatTimestamp = React.useCallback((date: Date) => {
    const now = new Date();
    const messageDate = new Date(date);
    const diffInHours = (now.getTime() - messageDate.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInHours * 60);
      return diffInMinutes < 1 ? 'Just now' : `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return messageDate.toLocaleDateString();
    }
  }, []);

  // Interactive User Component
  const InteractiveUser = React.memo(({ sender, isOnline }: { sender: any, isOnline: boolean }) => {
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    
    const handleStartPrivateChat = () => {
      // TODO: Implement private chat functionality
      toast({
        title: "Private Chat",
        description: `Starting private chat with ${sender.fullName}...`,
      });
      setIsPopoverOpen(false);
    };

    const handleViewProfile = () => {
      // TODO: Navigate to user profile
      toast({
        title: "User Profile",
        description: `Viewing ${sender.fullName}'s profile...`,
      });
      setIsPopoverOpen(false);
    };

    return (
      <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        <PopoverTrigger asChild>
          <div className="flex items-center gap-2 px-2 cursor-pointer hover:bg-muted/50 rounded-md py-1 transition-colors group">
            <div className="relative">
              <Avatar className="h-6 w-6 ring-2 ring-transparent group-hover:ring-primary/20 transition-all">
                <AvatarImage src={sender?.avatarUrl} />
                <AvatarFallback className="text-xs bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                  {sender?.fullName?.split(' ').map((n: string) => n[0]).join('') || 'U'}
                </AvatarFallback>
              </Avatar>
              {/* Online status indicator */}
              <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${
                isOnline ? 'bg-green-500' : 'bg-gray-400'
              }`} />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                {sender?.fullName || 'Unknown User'}
              </span>
              {/* User badges */}
              {sender?.role === 'admin' && (
                <Crown className="h-3 w-3 text-yellow-500" />
              )}
              {sender?.isPremium && (
                <Star className="h-3 w-3 text-purple-500" />
              )}
              {isOnline && (
                <Badge variant="outline" className="text-xs px-1 py-0 h-4">
                  Online
                </Badge>
              )}
            </div>
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="start">
          <div className="space-y-3">
            {/* User info header */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={sender?.avatarUrl} />
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                    {sender?.fullName?.split(' ').map((n: string) => n[0]).join('') || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-background ${
                  isOnline ? 'bg-green-500' : 'bg-gray-400'
                }`} />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-sm">{sender?.fullName || 'Unknown User'}</h4>
                <p className="text-xs text-muted-foreground">@{sender?.username || 'username'}</p>
                <div className="flex items-center gap-1 mt-1">
                  {sender?.role === 'admin' && (
                    <Badge variant="secondary" className="text-xs px-1 py-0 h-4">
                      <Crown className="h-2 w-2 mr-1" />
                      Admin
                    </Badge>
                  )}
                  {sender?.isPremium && (
                    <Badge variant="secondary" className="text-xs px-1 py-0 h-4">
                      <Star className="h-2 w-2 mr-1" />
                      Premium
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            
            {/* User stats */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="text-center p-2 bg-muted/50 rounded">
                <div className="font-semibold">{sender?.rating || '0.0'}</div>
                <div className="text-muted-foreground">Rating</div>
              </div>
              <div className="text-center p-2 bg-muted/50 rounded">
                <div className="font-semibold">{sender?.completedExchanges || '0'}</div>
                <div className="text-muted-foreground">Exchanges</div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="outline" 
                className="flex-1 text-xs h-8"
                onClick={handleViewProfile}
              >
                <User className="h-3 w-3 mr-1" />
                Profile
              </Button>
              <Button 
                size="sm" 
                className="flex-1 text-xs h-8"
                onClick={handleStartPrivateChat}
              >
                <MessageSquareMore className="h-3 w-3 mr-1" />
                Message
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold mb-2">Messages</h1>
        <p className="text-muted-foreground text-lg">
          Chat with your skill exchange partners and the community
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="group" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Community Chat
          </TabsTrigger>
          <TabsTrigger value="private" className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            Private Messages
          </TabsTrigger>
        </TabsList>

        <TabsContent value="group" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3">
              <Card className="overflow-hidden flex flex-col h-[calc(100vh-320px)]">
            <div className="p-4 border-b border-card-border">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold flex items-center gap-2">
                    Community Chat
                    {isConnected ? (
                      <Wifi className="h-4 w-4 text-green-500" />
                    ) : (
                      <WifiOff className="h-4 w-4 text-red-500" />
                    )}
                  </h3>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      {isConnected 
                        ? "🟢 Real-time messaging active • Messages appear instantly"
                        : "🟡 Reconnecting... • Messages may be delayed"
                      }
                    </p>
                    {!isConnected && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => {
                          console.log('Manual reconnect triggered');
                          webSocketClient.forceReconnect();
                          toast({
                            title: "Reconnecting...",
                            description: "Attempting to reconnect to chat server",
                          });
                        }}
                        className="text-xs h-6 px-2"
                      >
                        Reconnect
                      </Button>
                    )}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {groupMessages.length} messages
                </div>
              </div>
            </div>

            <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
              {groupMessagesLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="ml-2">Loading messages...</span>
                </div>
              ) : error ? (
                <div className="text-center text-muted-foreground py-8">
                  <p>Unable to load messages.</p>
                  <p className="text-sm mt-2">
                    {(error as any)?.status === 429 ? 'Rate limit exceeded. Please wait a moment.' : 'Please try refreshing the page.'}
                  </p>
                </div>
              ) : groupMessages.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No messages yet. Start the conversation!
                </div>
              ) : (
                <div className="space-y-4">
                  {groupMessages.map((message, index) => {
                    const isOwnMessage = message.senderId === userId;
                    const isLastMessage = index === groupMessages.length - 1;
                    return (
                      <div
                        key={message.id}
                        ref={isLastMessage ? lastMessageRef : undefined}
                        className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300 ${
                          message.sender?.role === 'admin' ? 'bg-yellow-50/50 dark:bg-yellow-950/20 rounded-lg p-2 -mx-2' : ''
                        } ${
                          message.sender?.isPremium ? 'bg-purple-50/50 dark:bg-purple-950/20 rounded-lg p-2 -mx-2' : ''
                        }`}
                      >
                        <div className={`max-w-[70%] space-y-1 ${isOwnMessage ? 'items-end' : 'items-start'} flex flex-col`}>
                          {!isOwnMessage && (
                            <InteractiveUser 
                              sender={message.sender} 
                              isOnline={onlineUsers.has(message.senderId)} 
                            />
                          )}
                          <div
                            className={`px-4 py-3 rounded-2xl transition-all duration-200 relative group ${
                              isOwnMessage
                                ? 'bg-primary text-primary-foreground shadow-md'
                                : 'bg-muted hover:bg-muted/80 shadow-sm'
                            }`}
                          >
                            <p className="text-sm leading-relaxed">{message.content}</p>
                            
                            {/* Message actions (visible on hover) */}
                            <div className={`absolute top-1 ${isOwnMessage ? 'left-1' : 'right-1'} opacity-0 group-hover:opacity-100 transition-opacity`}>
                              <div className="flex items-center gap-1 bg-background/90 backdrop-blur-sm rounded-full px-2 py-1 shadow-sm">
                                <button 
                                  className="text-xs hover:text-primary transition-colors"
                                  onClick={() => {
                                    // TODO: Add reaction functionality
                                    toast({
                                      title: "Coming Soon",
                                      description: "Message reactions will be available soon!",
                                    });
                                  }}
                                >
                                  👍
                                </button>
                                <button 
                                  className="text-xs hover:text-primary transition-colors"
                                  onClick={() => {
                                    // TODO: Add reply functionality
                                    toast({
                                      title: "Coming Soon", 
                                      description: "Message replies will be available soon!",
                                    });
                                  }}
                                >
                                  ↩️
                                </button>
                              </div>
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground px-2">
                            {formatTimestamp(message.createdAt)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Enhanced Typing indicators */}
                  {typingUsers.length > 0 && (
                    <div className="flex justify-start animate-in slide-in-from-bottom-2 duration-300">
                      <div className="max-w-[70%] space-y-1 items-start flex flex-col">
                        <div className="flex items-center gap-2 px-2">
                          <div className="flex -space-x-1">
                            {typingUsers.slice(0, 3).map((typingUserId, index) => {
                              const typingUserMessage = groupMessages.find(msg => msg.senderId === typingUserId);
                              const typingSender = typingUserMessage?.sender;
                              return (
                                <Avatar key={typingUserId} className="h-5 w-5 border-2 border-background">
                                  <AvatarImage src={typingSender?.avatarUrl} />
                                  <AvatarFallback className="text-xs bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                                    {typingSender?.fullName?.split(' ').map((n: string) => n[0]).join('') || 'U'}
                                  </AvatarFallback>
                                </Avatar>
                              );
                            })}
                            {typingUsers.length > 3 && (
                              <div className="h-5 w-5 bg-muted rounded-full border-2 border-background flex items-center justify-center">
                                <span className="text-xs font-medium">+{typingUsers.length - 3}</span>
                              </div>
                            )}
                          </div>
                          <span className="text-xs font-medium text-muted-foreground">
                            {typingUsers.length === 1 ? 'is typing...' : 'are typing...'}
                          </span>
                        </div>
                        <div className="px-4 py-3 rounded-2xl bg-muted/70">
                          <div className="flex items-center gap-1">
                            <div className="flex gap-1">
                              <div className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                              <div className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                              <div className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>

            <div className="p-4 border-t border-card-border">
              <div className="flex gap-2">
                <Input
                  placeholder={isConnected ? "Type your message to the community..." : "Reconnecting... Please wait"}
                  value={groupMessageInput}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendGroupMessage();
                    }
                  }}
                  disabled={sendGroupMessageMutation.isPending || !isConnected}
                  className="transition-all duration-200"
                />
                <Button 
                  onClick={handleSendGroupMessage} 
                  disabled={!groupMessageInput.trim() || sendGroupMessageMutation.isPending || !isConnected}
                  className="transition-all duration-200"
                >
                  {sendGroupMessageMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {isTyping && (
                <div className="text-xs text-muted-foreground mt-2 animate-in slide-in-from-bottom-1 duration-200">
                  You are typing...
                </div>
              )}
            </div>
          </Card>
        </div>
        
        {/* Online Users Sidebar */}
        <div className="lg:col-span-1">
          <Card className="h-[calc(100vh-320px)] flex flex-col">
            <div className="p-4 border-b border-card-border">
              <h3 className="font-semibold flex items-center gap-2">
                <Users className="h-4 w-4" />
                Online Users
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                {onlineUsers.size} user{onlineUsers.size !== 1 ? 's' : ''} online
              </p>
            </div>
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-2">
                {/* Current user */}
                <div className="flex items-center gap-3 p-2 bg-primary/5 rounded-lg border border-primary/20">
                  <div className="relative">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={""} />
                      <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                        You
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">You</p>
                    <p className="text-xs text-muted-foreground">Online</p>
                  </div>
                </div>

                {/* Other online users from recent messages */}
                {Array.from(new Set(
                  groupMessages
                    .filter(msg => msg.senderId !== userId && onlineUsers.has(msg.senderId))
                    .map(msg => msg.senderId)
                )).map(senderId => {
                  const userMessage = groupMessages.find(msg => msg.senderId === senderId);
                  const sender = userMessage?.sender;
                  
                  return (
                    <div key={senderId} className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded-lg cursor-pointer transition-colors">
                      <div className="relative">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={sender?.avatarUrl} />
                          <AvatarFallback className="text-xs bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                            {sender?.fullName?.split(' ').map((n: string) => n[0]).join('') || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{sender?.fullName || 'Unknown User'}</p>
                        <div className="flex items-center gap-1">
                          <p className="text-xs text-muted-foreground">Online</p>
                          {sender?.role === 'admin' && (
                            <Crown className="h-3 w-3 text-yellow-500" />
                          )}
                          {sender?.isPremium && (
                            <Star className="h-3 w-3 text-purple-500" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Show message if no other users online */}
                {onlineUsers.size <= 1 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No other users online</p>
                    <p className="text-xs">Be the first to start chatting!</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </Card>
        </div>
      </div>
    </TabsContent>

        <TabsContent value="private" className="mt-6">
          <Card className="p-8 text-center">
            <h3 className="text-lg font-semibold mb-2">Private Messages</h3>
            <p className="text-muted-foreground">Private messaging feature coming soon!</p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}