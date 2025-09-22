import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Search, Bot, Play, Pause } from "lucide-react";
import SEOHead from "@/components/SEOHead";

export default function Agents() {
  const agents = [
    {
      id: 1,
      name: "Document Classifier",
      description: "Automatically classify and tag incoming documents",
      status: "running",
      lastActive: "2 minutes ago"
    },
    {
      id: 2,
      name: "Content Summarizer",
      description: "Generate summaries for long documents",
      status: "idle",
      lastActive: "1 hour ago"
    },
    {
      id: 3,
      name: "Data Extractor",
      description: "Extract structured data from unstructured documents",
      status: "running",
      lastActive: "5 minutes ago"
    }
  ];

  return (
    <>
      <SEOHead
        title="Agents"
        description="Manage your AI agents for automated document processing and analysis."
        keywords="AI agents, automation, document processing, classification"
      />
      <Layout currentPage="agents">
        <div className="p-6">
          {/* Header Section */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <button className="text-gray-600 hover:text-gray-800">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-lg font-semibold text-gray-900">Agents</h1>
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                {agents.length}
              </span>
            </div>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2">
              Create Agent
            </Button>
          </div>
          
          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search agents"
                className="pl-10 bg-white border-gray-200"
              />
            </div>
          </div>
          
          {/* Agents Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {agents.map((agent) => (
              <Card key={agent.id} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                      <Bot className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{agent.name}</h3>
                      <p className="text-sm text-gray-500">{agent.lastActive}</p>
                    </div>
                  </div>
                  <button className={`p-2 rounded-lg ${
                    agent.status === "running" 
                      ? "bg-red-100 text-red-600 hover:bg-red-200" 
                      : "bg-green-100 text-green-600 hover:bg-green-200"
                  }`}>
                    {agent.status === "running" ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                </div>
                
                <p className="text-sm text-gray-600 mb-4">{agent.description}</p>
                
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    agent.status === "running" 
                      ? "bg-green-100 text-green-800" 
                      : "bg-gray-100 text-gray-800"
                  }`}>
                    <span className={`w-2 h-2 rounded-full mr-2 ${
                      agent.status === "running" ? "bg-green-600" : "bg-gray-600"
                    }`}></span>
                    {agent.status === "running" ? "Running" : "Idle"}
                  </span>
                  <Button variant="outline" size="sm" className="text-indigo-600 border-indigo-600 hover:bg-indigo-50">
                    Configure
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