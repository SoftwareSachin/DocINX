import { ReactNode } from "react";
import Sidebar from "./Sidebar";
import TopNavigation from "./TopNavigation";

interface LayoutProps {
  children: ReactNode;
  currentPage: "files" | "datasets" | "search" | "mcp" | "tools" | "agents" | "chats" | "users" | "admin";
  topNavTab?: "workspace" | "destination" | "workflows";
}

export default function Layout({ children, currentPage, topNavTab = "workspace" }: LayoutProps) {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar currentPage={currentPage} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopNavigation activeTab={topNavTab} />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}