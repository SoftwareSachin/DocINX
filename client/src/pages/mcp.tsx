import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Search, BarChart3 } from "lucide-react";
import SEOHead from "@/components/SEOHead";

export default function MCP() {
  const mcpItems = [
    {
      id: 1,
      name: "Tavily MCP Tool",
      description: "Internal tool that uses Tavily API for advanced web search and content extraction — best used for deep web intelligence tasks requiring API access.",
      type: "Internal",
      icon: "TM"
    },
    {
      id: 2,
      name: "web_cch",
      description: "website automation task",
      type: "external",
      icon: "W"
    },
    {
      id: 3,
      name: "Claude",
      description: "Claude's MCP",
      type: "external",
      icon: "C"
    },
    {
      id: 4,
      name: "MCPH",
      description: "tool",
      type: "external",
      icon: "M"
    },
    {
      id: 5,
      name: "MCPbb",
      description: "tool",
      type: "external",
      icon: "M"
    },
    {
      id: 6,
      name: "MCPC23",
      description: "tool",
      type: "external",
      icon: "M"
    }
  ];

  return (
    <>
      <SEOHead
        title="MCP"
        description="Manage your Model Context Protocol tools and integrations."
        keywords="MCP, model context protocol, tools, integrations"
      />
      <Layout currentPage="mcp">
        <div className="p-6">
          {/* Header Section */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <button className="text-gray-600 hover:text-gray-800">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-lg font-semibold text-gray-900">MCPs</h1>
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                22
              </span>
            </div>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2">
              Add External MCP
            </Button>
          </div>
          
          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search here"
                className="pl-10 bg-white border-gray-200"
              />
            </div>
          </div>
          
          {/* MCP Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {mcpItems.map((item) => (
              <Card key={item.id} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-semibold ${
                      item.type === "Internal" ? "bg-blue-600" : 
                      item.icon === "W" ? "bg-green-600" : 
                      item.icon === "C" ? "bg-orange-600" : 
                      item.icon === "M" ? "bg-yellow-600" : "bg-gray-600"
                    }`}>
                      {item.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{item.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                    </div>
                  </div>
                  <button className="text-gray-400 hover:text-gray-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  </button>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    item.type === "Internal" ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-800"
                  }`}>
                    <span className={`w-2 h-2 rounded-full mr-2 ${
                      item.type === "Internal" ? "bg-blue-600" : "bg-gray-600"
                    }`}></span>
                    {item.type}
                  </span>
                  <Button variant="outline" size="sm" className="text-indigo-600 border-indigo-600 hover:bg-indigo-50">
                    Show Details →
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </Layout>
    </>
  );
}