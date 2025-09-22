import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Home, FileText, MessageSquare, Settings, LogOut, Menu, X, Search, Database, Users, Bot } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";

interface SidebarProps {
  currentPage: "dashboard" | "documents" | "chat" | "admin";
}

export default function Sidebar({ currentPage }: SidebarProps) {
  const { user } = useAuth();
  const [location] = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navigation = [
    { name: "Files", path: "/documents", icon: FileText, key: "documents" },
    { name: "Datasets", path: "/datasets", icon: Database, key: "datasets" },
    { name: "Search", path: "/search", icon: Search, key: "search" },
    { name: "MCP", path: "/mcp", icon: Settings, key: "mcp" },
    { name: "Tools", path: "/tools", icon: Settings, key: "tools" },
    { name: "Agents", path: "/agents", icon: Bot, key: "agents" },
    { name: "Chats", path: "/chat", icon: MessageSquare, key: "chat" },
    { name: "Users", path: "/users", icon: Users, key: "users" },
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
    <div className={`${isCollapsed ? 'w-16' : 'w-64'} bg-white border-r border-gray-200 flex flex-col transition-all duration-300`} data-testid="sidebar">
      <div className={`shrink-0 border-b border-gray-200 bg-white p-0 h-16 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between px-4'} overflow-hidden`}>
        {!isCollapsed && (
          <Link href="/" data-testid="link-home" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
              <span className="text-white font-bold text-sm">D</span>
            </div>
            <span className="font-semibold text-gray-900">DocINX</span>
          </Link>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex-shrink-0 p-1 hover:bg-gray-100 h-8 w-8"
          data-testid="button-hamburger"
        >
          {isCollapsed ? <Menu className="h-4 w-4" /> : <X className="h-4 w-4" />}
        </Button>
      </div>
      
      <nav className={`flex-1 ${isCollapsed ? 'px-2 py-4' : 'px-3 py-4'} pt-2`}>
        <ul className="space-y-1">
          {navigation.map((item) => {
            const isActive = currentPage === item.key;
            const Icon = item.icon;
            
            return (
              <li key={item.key}>
                <Link href={item.path}>
                  <Button
                    variant="ghost"
                    className={`w-full ${isCollapsed ? 'justify-center px-0 h-9' : 'justify-start px-3 h-9'} text-sm font-medium ${
                      isActive 
                        ? "bg-blue-50 text-blue-700 border-r-2 border-blue-600" 
                        : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                    data-testid={`nav-${item.key}`}
                    title={isCollapsed ? item.name : undefined}
                  >
                    <Icon className={`h-4 w-4 ${!isCollapsed ? 'mr-3' : ''} ${isActive ? 'text-blue-600' : 'text-gray-500'}`} />
                    {!isCollapsed && item.name}
                  </Button>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      
      <div className={`${isCollapsed ? 'p-2' : 'p-3'} border-t border-gray-200 bg-gray-50`}>
        {isCollapsed ? (
          <div className="flex flex-col items-center space-y-3">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white">
              <span className="text-sm font-medium" data-testid="text-user-initials">
                {getUserInitials()}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-gray-500 hover:text-gray-700 p-2 w-8 h-8 flex items-center justify-center"
              data-testid="button-logout"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white">
              <span className="text-sm font-medium" data-testid="text-user-initials">
                {getUserInitials()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate" data-testid="text-user-name">
                {getUserDisplayName()}
              </p>
              <p className="text-xs text-gray-500 capitalize" data-testid="text-user-role">
                {(user as any)?.role || "user"}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-gray-500 hover:text-gray-700 p-1"
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
