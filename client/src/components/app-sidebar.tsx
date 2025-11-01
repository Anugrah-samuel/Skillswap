import { Home, Lightbulb, Search, MessageSquare, Calendar, User, Settings, LogOut, BookOpen, Users, FolderGit, Play, ShoppingCart, BarChart } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";

const menuItems = [
  { title: "Home", url: "/dashboard", icon: Home },
  { title: "My Skills", url: "/dashboard/skills", icon: Lightbulb },
  { title: "Find Skills", url: "/dashboard/discover", icon: Search },
  { title: "Messages", url: "/dashboard/chat", icon: MessageSquare },
  { title: "Calendar", url: "/dashboard/calendar", icon: Calendar },
  { title: "Learning Paths", url: "/dashboard/learning-paths", icon: BookOpen },
  { title: "Skill Circles", url: "/dashboard/groups", icon: Users },
  { title: "Projects", url: "/dashboard/projects", icon: FolderGit },
  { title: "Course Builder", url: "/dashboard/course-builder", icon: Play },
  { title: "Marketplace", url: "/dashboard/course-marketplace", icon: ShoppingCart },
  { title: "Instructor Dashboard", url: "/dashboard/instructor-dashboard", icon: BarChart },
  { title: "Profile", url: "/dashboard/profile", icon: User },
  { title: "Settings", url: "/dashboard/settings", icon: Settings },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState({
    name: "User",
    username: "user",
    avatar: "",
  });

  // Load user data from localStorage and listen for changes
  useEffect(() => {
    const loadUserData = () => {
      try {
        const user = localStorage.getItem('user');
        if (user) {
          const userData = JSON.parse(user);
          setCurrentUser({
            name: userData.fullName || userData.name || "User",
            username: userData.username || "user",
            avatar: userData.avatarUrl || userData.avatar || "",
          });
        }
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    };

    loadUserData();

    // Listen for storage changes (when user data is updated)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'user') {
        loadUserData();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    toast({
      title: "Logged out",
      description: "You've been successfully logged out.",
    });
    window.location.href = "/";
  };

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-lg font-bold px-4 py-3 mb-2">
            SkillSwap
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <Link href={item.url}>
                      <SidebarMenuButton isActive={isActive} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                        <item.icon className="h-5 w-5" />
                        <span className="font-medium">{item.title}</span>
                      </SidebarMenuButton>
                    </Link>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={currentUser.avatar} />
            <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
              {currentUser.name.split(' ').map(n => n[0]).join('') || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-medium truncate">{currentUser.name}</p>
            <p className="text-xs text-muted-foreground truncate">@{currentUser.username}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover-elevate active-elevate-2 rounded-lg transition-colors"
          data-testid="button-logout"
        >
          <LogOut className="h-4 w-4" />
          <span>Log Out</span>
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
