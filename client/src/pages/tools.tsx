import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Search, Settings, Bot, Cpu } from "lucide-react";
import SEOHead from "@/components/SEOHead";

export default function Tools() {
  const tools = [
    {
      id: 1,
      name: "Document Parser",
      description: "Extract and parse content from various document formats",
      icon: "📄",
      category: "Processing"
    },
    {
      id: 2,
      name: "Text Analyzer",
      description: "Analyze text content for sentiment, keywords, and themes",
      icon: "📊",
      category: "Analysis"
    },
    {
      id: 3,
      name: "OCR Engine",
      description: "Optical character recognition for image-based documents",
      icon: "👁️",
      category: "Vision"
    }
  ];

  return (
    <>
      <SEOHead
        title="Tools"
        description="Manage and configure your DocINX tools and integrations."
        keywords="tools, integrations, document processing, OCR, analysis"
      />
      <Layout currentPage="tools">
        <div className="p-6">
          {/* Header Section */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <button className="text-gray-600 hover:text-gray-800">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-lg font-semibold text-gray-900">Tools</h1>
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                {tools.length}
              </span>
            </div>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2">
              Add Tool
            </Button>
          </div>
          
          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search tools"
                className="pl-10 bg-white border-gray-200"
              />
            </div>
          </div>
          
          {/* Tools Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tools.map((tool) => (
              <Card key={tool.id} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center text-lg">
                      {tool.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{tool.name}</h3>
                      <p className="text-sm text-gray-600">{tool.category}</p>
                    </div>
                  </div>
                  <button className="text-gray-400 hover:text-gray-600">
                    <Settings className="w-4 h-4" />
                  </button>
                </div>
                
                <p className="text-sm text-gray-600 mb-4">{tool.description}</p>
                
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <span className="w-2 h-2 bg-green-600 rounded-full mr-2"></span>
                    Active
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