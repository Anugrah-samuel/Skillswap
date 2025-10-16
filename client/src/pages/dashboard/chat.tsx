import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Send, Search } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import avatar1 from "@assets/generated_images/Female_professional_avatar_4d4900f0.png";
import avatar2 from "@assets/generated_images/Male_professional_avatar_492df590.png";
import avatar3 from "@assets/generated_images/Experienced_professional_avatar_13ef1d1a.png";

export default function Chat() {
  const [selectedConversation, setSelectedConversation] = useState("1");
  const [messageInput, setMessageInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const conversations = [
    {
      id: "1",
      name: "Sarah Chen",
      avatar: avatar1,
      lastMessage: "That sounds great! When would you like to start?",
      timestamp: "2m ago",
      unread: 2,
      online: true,
    },
    {
      id: "2",
      name: "Michael Ross",
      avatar: avatar2,
      lastMessage: "Thanks for reaching out!",
      timestamp: "1h ago",
      unread: 0,
      online: false,
    },
    {
      id: "3",
      name: "Emily Davis",
      avatar: avatar3,
      lastMessage: "I'm available on weekends",
      timestamp: "3h ago",
      unread: 1,
      online: true,
    },
  ];

  const messages = {
    "1": [
      { id: "1", senderId: "sarah", content: "Hi! I saw your request to learn web development.", timestamp: "10:30 AM", sent: false },
      { id: "2", senderId: "me", content: "Yes! I'm really interested in learning React.", timestamp: "10:32 AM", sent: true },
      { id: "3", senderId: "sarah", content: "Perfect! I'd love to help you with that. In exchange, could you teach me graphic design?", timestamp: "10:35 AM", sent: false },
      { id: "4", senderId: "me", content: "Absolutely! I'd be happy to teach you design principles and tools.", timestamp: "10:37 AM", sent: true },
      { id: "5", senderId: "sarah", content: "That sounds great! When would you like to start?", timestamp: "10:40 AM", sent: false },
    ],
    "2": [
      { id: "1", senderId: "michael", content: "Thanks for reaching out!", timestamp: "Yesterday", sent: false },
      { id: "2", senderId: "me", content: "Looking forward to learning photography from you!", timestamp: "Yesterday", sent: true },
    ],
    "3": [
      { id: "1", senderId: "emily", content: "I'm available on weekends", timestamp: "2:00 PM", sent: false },
    ],
  };

  const currentConversation = conversations.find(c => c.id === selectedConversation);
  const currentMessages = messages[selectedConversation as keyof typeof messages] || [];

  const handleSendMessage = () => {
    if (!messageInput.trim()) return;
    setMessageInput("");
  };

  const filteredConversations = conversations.filter(conv =>
    conv.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold mb-2">Messages</h1>
        <p className="text-muted-foreground text-lg">
          Chat with your skill exchange partners
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-240px)]">
        <Card className="lg:col-span-1 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-card-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-conversations"
              />
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {filteredConversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConversation(conv.id)}
                  className={`w-full p-3 rounded-lg text-left transition-all hover-elevate ${
                    selectedConversation === conv.id ? 'bg-accent' : ''
                  }`}
                  data-testid={`conversation-${conv.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={conv.avatar} />
                        <AvatarFallback>{conv.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                      </Avatar>
                      {conv.online && (
                        <span className="absolute bottom-0 right-0 h-3 w-3 bg-status-online rounded-full border-2 border-card"></span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="font-semibold truncate">{conv.name}</p>
                        <span className="text-xs text-muted-foreground shrink-0">{conv.timestamp}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm text-muted-foreground truncate">{conv.lastMessage}</p>
                        {conv.unread > 0 && (
                          <Badge variant="default" className="shrink-0 h-5 w-5 p-0 flex items-center justify-center text-xs">
                            {conv.unread}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </Card>

        <Card className="lg:col-span-2 overflow-hidden flex flex-col">
          {currentConversation && (
            <>
              <div className="p-4 border-b border-card-border flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={currentConversation.avatar} />
                  <AvatarFallback>{currentConversation.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-semibold">{currentConversation.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {currentConversation.online ? 'Online' : 'Offline'}
                  </p>
                </div>
              </div>

              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {currentMessages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.sent ? 'justify-end' : 'justify-start'}`}
                      data-testid={`message-${message.id}`}
                    >
                      <div className={`max-w-[70%] space-y-1 ${message.sent ? 'items-end' : 'items-start'} flex flex-col`}>
                        <div
                          className={`px-4 py-3 rounded-2xl ${
                            message.sent
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          <p className="text-sm leading-relaxed">{message.content}</p>
                        </div>
                        <span className="text-xs text-muted-foreground px-2">{message.timestamp}</span>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground pl-2">
                    <span className="inline-flex gap-1">
                      <span className="animate-bounce" style={{ animationDelay: '0ms' }}>•</span>
                      <span className="animate-bounce" style={{ animationDelay: '150ms' }}>•</span>
                      <span className="animate-bounce" style={{ animationDelay: '300ms' }}>•</span>
                    </span>
                    <span>{currentConversation.name} is typing...</span>
                  </div>
                </div>
              </ScrollArea>

              <div className="p-4 border-t border-card-border">
                <div className="flex gap-2">
                  <Input
                    placeholder="Type your message..."
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    data-testid="input-message"
                  />
                  <Button onClick={handleSendMessage} data-testid="button-send-message">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
