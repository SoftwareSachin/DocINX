import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Cog, Search, Users, Upload, BarChart3 } from "lucide-react";
import FileUpload from "@/components/FileUpload";
import DocumentCard from "@/components/DocumentCard";
import SEOHead from "@/components/SEOHead";

export default function Home() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/stats/dashboard"],
    enabled: isAuthenticated,
  });

  const { data: recentDocuments, isLoading: documentsLoading } = useQuery({
    queryKey: ["/api/documents"],
    enabled: isAuthenticated,
    select: (data: any) => (Array.isArray(data) ? data.slice(0, 3) : []), // Get only the 3 most recent
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect to login
  }

  return (
    <>
      <SEOHead
        title="Dashboard"
        description="DocINX dashboard - view your document processing statistics, recent uploads, and manage your document intelligence workflow."
        keywords="document dashboard, file management, document statistics, upload documents"
      />
      <Layout currentPage="files">
        {/* Header */}
        <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4 shadow-sm" data-testid="header-dashboard">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900 rounded-lg flex items-center justify-center">
                <BarChart3 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100" data-testid="text-page-title">Dashboard</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Overview of your document library</p>
              </div>
            </div>
            <FileUpload 
              trigger={
                <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" data-testid="button-upload">
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Documents
                </Button>
              }
            />
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 overflow-auto p-6" data-testid="main-dashboard">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm" data-testid="card-stat-total">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Total Documents</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100" data-testid="text-total-documents">
                      {statsLoading ? "..." : (stats as any)?.total_documents || 0}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900 rounded-lg flex items-center justify-center">
                    <FileText className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm" data-testid="card-stat-processing">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Processing</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100" data-testid="text-processing-documents">
                      {statsLoading ? "..." : (stats as any)?.processing || 0}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                    <BarChart3 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm" data-testid="card-stat-queries">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Queries Today</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100" data-testid="text-queries-today">
                      {statsLoading ? "..." : (stats as any)?.queries_today || 0}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                    <Search className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm" data-testid="card-stat-users">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Active Users</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100" data-testid="text-active-users">
                      {statsLoading ? "..." : (stats as any)?.active_users || 0}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
                    <Users className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity & Quick Upload */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Documents */}
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm" data-testid="card-recent-documents">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Recent Documents</h3>
              </div>
              <CardContent className="p-6">
                {documentsLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center space-x-4 p-3">
                        <div className="w-10 h-10 bg-muted rounded-lg animate-pulse"></div>
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-muted rounded animate-pulse"></div>
                          <div className="h-3 bg-muted rounded w-1/2 animate-pulse"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : recentDocuments?.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">No documents uploaded yet</p>
                    <p className="text-sm text-gray-500 dark:text-gray-500">Upload your first document to get started</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentDocuments?.map((doc: any) => (
                      <DocumentCard key={doc.id} document={doc} showActions={false} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Upload */}
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm" data-testid="card-quick-upload">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Quick Upload</h3>
              </div>
              <CardContent className="p-6">
                <FileUpload 
                  trigger={
                    <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors cursor-pointer" data-testid="dropzone-quick-upload">
                      <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Upload className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Drop files here to upload</p>
                      <p className="text-gray-600 dark:text-gray-400 mb-4">Support for PDF, DOCX, TXT, CSV files up to 10MB</p>
                      <Button variant="outline" className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300" data-testid="button-choose-files">
                        Choose Files
                      </Button>
                    </div>
                  }
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </Layout>
    </>
  );
}
