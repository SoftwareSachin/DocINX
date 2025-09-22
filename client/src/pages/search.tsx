import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search as SearchIcon } from "lucide-react";
import SEOHead from "@/components/SEOHead";

export default function Search() {
  return (
    <>
      <SEOHead
        title="Search"
        description="Search through your documents and datasets with AI-powered semantic search."
        keywords="search, semantic search, AI search, document search"
      />
      <Layout currentPage="search">
        <div className="p-6">
          {/* Header Section */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <button className="text-gray-600 hover:text-gray-800">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-sm text-gray-600">Datasets :</span>
              <span className="text-sm font-medium text-gray-900">Dataset selected</span>
              <button className="text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <div className="flex items-center space-x-3">
              <label className="flex items-center space-x-2 text-sm text-gray-600">
                <input type="checkbox" className="rounded border-gray-300" />
                <span>Show metrics per dataset</span>
              </label>
              <span className="text-xs text-gray-500">Currently, images and image related datasets are not supported for this functionality</span>
            </div>
          </div>
          
          {/* Search Interface */}
          <Card className="p-8 text-center mb-6">
            <div className="flex flex-col items-center">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                <SearchIcon className="w-12 h-12 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Select a search model and type your query to get the search results</h3>
              
              <div className="flex items-center space-x-4 mt-6 w-full max-w-2xl">
                <Select defaultValue="cosine">
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cosine">Cosine Distance</SelectItem>
                    <SelectItem value="euclidean">Euclidean Distance</SelectItem>
                    <SelectItem value="manhattan">Manhattan Distance</SelectItem>
                  </SelectContent>
                </Select>
                <Input 
                  placeholder="Promotion"
                  className="flex-1"
                />
                <Button className="bg-indigo-600 hover:bg-indigo-700 text-white px-8">
                  Search
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </Layout>
    </>
  );
}