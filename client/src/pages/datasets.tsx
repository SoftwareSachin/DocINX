import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Search } from "lucide-react";
import SEOHead from "@/components/SEOHead";

export default function Datasets() {
  return (
    <>
      <SEOHead
        title="Datasets"
        description="Manage and explore your datasets in DocINX."
        keywords="datasets, data management, machine learning datasets"
      />
      <Layout currentPage="datasets">
        <div className="p-6">
          {/* Header Section */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <button className="text-gray-600 hover:text-gray-800">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-lg font-semibold text-gray-900">Datasets</h1>
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                0
              </span>
            </div>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2">
              Create New Dataset
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
          
          {/* Empty State */}
          <Card className="p-12 text-center">
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2 2v-5m16 0h-2M4 13h2m13-8l-4 4m0 0l-4-4m4 4V3" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No items found.</h3>
              <p className="text-gray-500 mb-4">Create your first dataset to get started.</p>
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">
                Create New Dataset
              </Button>
            </div>
          </Card>
        </div>
      </Layout>
    </>
  );
}