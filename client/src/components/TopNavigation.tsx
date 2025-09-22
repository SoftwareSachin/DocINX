import { Settings, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TopNavigationProps {
  activeTab?: "workspace" | "destination" | "workflows";
}

export default function TopNavigation({ activeTab = "workspace" }: TopNavigationProps) {
  const tabs = [
    { name: "Workspace", key: "workspace" },
    { name: "Destination", key: "destination" },
    { name: "Workflows", key: "workflows" },
  ];

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-3">
      <div className="flex items-center justify-between">
        {/* Navigation Tabs */}
        <div className="flex items-center space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              className={`text-sm font-medium px-3 py-2 rounded-md transition-colors ${
                activeTab === tab.key
                  ? "text-indigo-600 bg-indigo-50"
                  : "text-gray-700 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              {tab.name}
            </button>
          ))}
        </div>

        {/* Right Section */}
        <div className="flex items-center space-x-4">
          {/* Settings */}
          <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-700">
            <Settings className="h-4 w-4" />
          </Button>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center space-x-2 text-sm">
                <span className="text-gray-700">DocINX FastAPI</span>
                <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-medium">AF</span>
                </div>
                <ChevronDown className="h-3 w-3 text-gray-500" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem>Profile Settings</DropdownMenuItem>
              <DropdownMenuItem>API Keys</DropdownMenuItem>
              <DropdownMenuItem>Logout</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}