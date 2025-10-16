import { Bell, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";

export function NotificationsDropdown() {
  const [notifications, setNotifications] = useState([
    {
      id: "1",
      type: "match",
      title: "New Match Found!",
      message: "Sarah Chen is a great match for your React skills",
      time: "5m ago",
      read: false,
    },
    {
      id: "2",
      type: "message",
      title: "New Message",
      message: "Michael Ross sent you a message",
      time: "1h ago",
      read: false,
    },
    {
      id: "3",
      type: "request",
      title: "Skill Trade Request",
      message: "Emily Davis wants to learn from you",
      time: "2h ago",
      read: false,
    },
    {
      id: "4",
      type: "reminder",
      title: "Session Reminder",
      message: "Your session with Sarah starts in 1 hour",
      time: "3h ago",
      read: true,
    },
    {
      id: "5",
      type: "review",
      title: "New Review",
      message: "You received a 5-star review from Michael",
      time: "1d ago",
      read: true,
    },
  ]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications(notifications.map(n => 
      n.id === id ? { ...n, read: true } : n
    ));
  };

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative hover-elevate active-elevate-2" data-testid="button-notifications">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="default" 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {unreadCount}
            </Badge>
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b border-popover-border">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="text-xs h-auto py-1"
              data-testid="button-mark-all-read"
            >
              <Check className="h-3 w-3 mr-1" />
              Mark all as read
            </Button>
          )}
        </div>
        <ScrollArea className="h-96">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y divide-popover-border">
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => markAsRead(notification.id)}
                  className={`w-full p-4 text-left transition-colors hover-elevate ${
                    !notification.read ? 'bg-muted/50' : ''
                  }`}
                  data-testid={`notification-${notification.id}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-semibold text-sm">{notification.title}</p>
                    <span className="text-xs text-muted-foreground shrink-0">{notification.time}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{notification.message}</p>
                  {!notification.read && (
                    <div className="mt-2">
                      <Badge variant="secondary" className="text-xs">New</Badge>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
