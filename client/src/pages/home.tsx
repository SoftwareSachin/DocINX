import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import Sidebar from "@/components/Sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Cog, Search, Users, Upload } from "lucide-react";
import FileUpload from "@/components/FileUpload";
import DocumentCard from "@/components/DocumentCard";

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
    <div className="flex h-screen bg-background">
      <Sidebar currentPage="dashboard" />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-card border-b border-border px-6 py-4" data-testid="header-dashboard">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold" data-testid="text-page-title">Dashboard</h2>
            <FileUpload 
              trigger={
                <Button data-testid="button-upload">
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Documents
                </Button>
              }
            />
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto p-6" data-testid="main-dashboard">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="border-border" data-testid="card-stat-total">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Documents</p>
                    <p className="text-2xl font-semibold" data-testid="text-total-documents">
                      {statsLoading ? "..." : (stats as any)?.totalDocuments || 0}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <FileText className="text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-border" data-testid="card-stat-processing">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Processing</p>
                    <p className="text-2xl font-semibold" data-testid="text-processing-documents">
                      {statsLoading ? "..." : (stats as any)?.processing || 0}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-chart-2/10 rounded-lg flex items-center justify-center">
                    <Cog className="text-chart-2 processing-animation" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-border" data-testid="card-stat-queries">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Queries Today</p>
                    <p className="text-2xl font-semibold" data-testid="text-queries-today">
                      {statsLoading ? "..." : (stats as any)?.queriesToday || 0}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-chart-1/10 rounded-lg flex items-center justify-center">
                    <Search className="text-chart-1" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-border" data-testid="card-stat-users">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Active Users</p>
                    <p className="text-2xl font-semibold" data-testid="text-active-users">
                      {statsLoading ? "..." : (stats as any)?.activeUsers || 0}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-chart-4/10 rounded-lg flex items-center justify-center">
                    <Users className="text-chart-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity & Quick Upload */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Documents */}
            <Card className="border-border" data-testid="card-recent-documents">
              <div className="p-6 border-b border-border">
                <h3 className="text-lg font-semibold">Recent Documents</h3>
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
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No documents uploaded yet</p>
                    <p className="text-sm text-muted-foreground">Upload your first document to get started</p>
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
            <Card className="border-border" data-testid="card-quick-upload">
              <div className="p-6 border-b border-border">
                <h3 className="text-lg font-semibold">Quick Upload</h3>
              </div>
              <CardContent className="p-6">
                <FileUpload 
                  trigger={
                    <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer" data-testid="dropzone-quick-upload">
                      <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Upload className="text-2xl text-primary" />
                      </div>
                      <p className="text-lg font-medium mb-2">Drop files here to upload</p>
                      <p className="text-muted-foreground mb-4">Support for PDF, DOCX, TXT files up to 10MB</p>
                      <Button variant="outline" data-testid="button-choose-files">
                        Choose Files
                      </Button>
                    </div>
                  }
                />
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
