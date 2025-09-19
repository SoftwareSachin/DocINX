import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Home, FileText, MessageSquare, Settings, LogOut } from "lucide-react";
import { Link, useLocation } from "wouter";

interface SidebarProps {
  currentPage: "dashboard" | "documents" | "chat" | "admin";
}

export default function Sidebar({ currentPage }: SidebarProps) {
  const { user } = useAuth();
  const [location] = useLocation();

  const navigation = [
    { name: "Dashboard", path: "/", icon: Home, key: "dashboard" },
    { name: "Documents", path: "/documents", icon: FileText, key: "documents" },
    { name: "Knowledge Chat", path: "/chat", icon: MessageSquare, key: "chat" },
  ];

  // Add admin page if user is admin
  if ((user as any)?.role === "admin") {
    navigation.push({ name: "Admin", path: "/admin", icon: Settings, key: "admin" });
  }

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const getUserInitials = () => {
    const typedUser = user as any;
    if (typedUser?.firstName && typedUser?.lastName) {
      return `${typedUser.firstName.charAt(0)}${typedUser.lastName.charAt(0)}`.toUpperCase();
    }
    if (typedUser?.email) {
      return typedUser.email.charAt(0).toUpperCase();
    }
    return "U";
  };

  const getUserDisplayName = () => {
    const typedUser = user as any;
    if (typedUser?.firstName && typedUser?.lastName) {
      return `${typedUser.firstName} ${typedUser.lastName}`;
    }
    if (typedUser?.firstName) {
      return typedUser.firstName;
    }
    return typedUser?.email || "User";
  };

  return (
    <div className="w-64 bg-card border-r border-border flex flex-col" data-testid="sidebar">
      <div className="flex items-center gap-3 p-4 border-b border-border bg-white/95 dark:bg-black/95 backdrop-blur-sm">
        <Link href="/" data-testid="link-home" className="flex items-center gap-3">
          <div className="h-12 w-12 overflow-hidden flex items-center justify-center shrink-0">
            <img 
              src="/assets/Transparent_DocINX_logo_design_a0f58ebd.png" 
              alt="DocINX logo" 
              className="h-full w-auto scale-[2.8] object-center dark:brightness-110 dark:contrast-110 transition-all" 
              data-testid="img-logo"
            />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold tracking-tight text-black dark:text-white" data-testid="text-brand">DocINX</span>
            <span className="text-sm text-muted-foreground">Document Intelligence</span>
          </div>
        </Link>
      </div>
      
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navigation.map((item) => {
            const isActive = currentPage === item.key;
            const Icon = item.icon;
            
            return (
              <li key={item.key}>
                <Link href={item.path}>
                  <Button
                    variant="ghost"
                    className={`w-full justify-start ${
                      isActive 
                        ? "bg-accent text-accent-foreground font-medium" 
                        : "hover:bg-accent hover:text-accent-foreground"
                    }`}
                    data-testid={`nav-${item.key}`}
                  >
                    <Icon className="mr-3 h-4 w-4" />
                    {item.name}
                  </Button>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      
      <div className="p-4 border-t border-border">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground">
            <span className="text-sm font-medium" data-testid="text-user-initials">
              {getUserInitials()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" data-testid="text-user-name">
              {getUserDisplayName()}
            </p>
            <p className="text-xs text-muted-foreground capitalize" data-testid="text-user-role">
              {(user as any)?.role || "user"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-muted-foreground hover:text-foreground p-1"
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
