import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Sidebar from "@/components/Sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Search, Eye, Download, Trash2, RotateCw } from "lucide-react";
import FileUpload from "@/components/FileUpload";
import DocumentCard from "@/components/DocumentCard";

export default function Documents() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

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

  const { data: documents, isLoading: documentsLoading } = useQuery({
    queryKey: ["/api/documents"],
    enabled: isAuthenticated,
  });

  const reprocessMutation = useMutation({
    mutationFn: async (documentId: string) => {
      await apiRequest("POST", `/api/documents/${documentId}/reprocess`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Document reprocessing started",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
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
      toast({
        title: "Error",
        description: "Failed to reprocess document",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      await apiRequest("DELETE", `/api/documents/${documentId}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Document deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
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
      toast({
        title: "Error",
        description: "Failed to delete document",
        variant: "destructive",
      });
    },
  });

  // Filter documents
  const filteredDocuments = (Array.isArray(documents) ? documents : []).filter((doc: any) => {
    const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.filename.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || doc.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

  const getFileIcon = (mimeType: string) => {
    if (mimeType === "application/pdf") return "fas fa-file-pdf text-destructive";
    if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "fas fa-file-word text-primary";
    return "fas fa-file-alt text-chart-4";
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusBadge = (status: string) => {
    const statusClasses = {
      ready: "px-2 py-1 rounded-full text-xs bg-chart-2/10 text-chart-2",
      processing: "px-2 py-1 rounded-full text-xs bg-chart-1/10 text-chart-1 processing-animation",
      failed: "px-2 py-1 rounded-full text-xs bg-destructive/10 text-destructive",
    };
    
    return (
      <span className={statusClasses[status as keyof typeof statusClasses] || statusClasses.processing}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

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
      <Sidebar currentPage="documents" />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-card border-b border-border px-6 py-4" data-testid="header-documents">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold" data-testid="text-page-title">Document Library</h2>
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
        <main className="flex-1 overflow-auto p-6" data-testid="main-documents">
          <Card className="border-border">
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Document Library</h3>
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <Input
                      type="text"
                      placeholder="Search documents..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-2 w-64"
                      data-testid="input-search"
                    />
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40" data-testid="select-status-filter">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="ready">Ready</SelectItem>
                      <SelectItem value="processing">Processing</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              {documentsLoading ? (
                <div className="p-6">
                  <div className="space-y-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="flex items-center space-x-4 p-4 border border-border rounded-lg animate-pulse">
                        <div className="w-8 h-8 bg-muted rounded"></div>
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-muted rounded w-1/3"></div>
                          <div className="h-3 bg-muted rounded w-1/4"></div>
                        </div>
                        <div className="w-16 h-6 bg-muted rounded"></div>
                        <div className="w-24 h-4 bg-muted rounded"></div>
                        <div className="w-16 h-4 bg-muted rounded"></div>
                        <div className="w-20 h-8 bg-muted rounded"></div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : filteredDocuments.length === 0 ? (
                <div className="p-12 text-center">
                  <Upload className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No documents found</h3>
                  <p className="text-muted-foreground mb-4">
                    {searchTerm || statusFilter !== "all" 
                      ? "Try adjusting your search or filter criteria"
                      : "Upload your first document to get started"
                    }
                  </p>
                  <FileUpload 
                    trigger={
                      <Button data-testid="button-upload-empty">
                        <Upload className="mr-2 h-4 w-4" />
                        Upload Documents
                      </Button>
                    }
                  />
                </div>
              ) : (
                <table className="w-full" data-testid="table-documents">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Document</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Uploaded</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Size</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-card divide-y divide-border">
                    {filteredDocuments.map((doc: any) => (
                      <tr key={doc.id} className="hover:bg-accent transition-colors" data-testid={`row-document-${doc.id}`}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-muted rounded flex items-center justify-center mr-3">
                              <i className={`${getFileIcon(doc.mimeType)} text-sm`}></i>
                            </div>
                            <div>
                              <div className="text-sm font-medium" data-testid={`text-document-title-${doc.id}`}>{doc.title}</div>
                              <div className="text-sm text-muted-foreground">ID: {doc.id.slice(0, 8)}...</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {doc.mimeType === "application/pdf" ? "PDF" :
                           doc.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ? "DOCX" :
                           "TXT"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(doc.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                          {formatDate(doc.uploadedAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                          {formatFileSize(doc.fileSize)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center space-x-2">
                            {doc.status === "ready" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-primary hover:text-primary/80"
                                data-testid={`button-view-${doc.id}`}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            )}
                            {doc.status === "failed" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => reprocessMutation.mutate(doc.id)}
                                disabled={reprocessMutation.isPending}
                                className="text-primary hover:text-primary/80"
                                data-testid={`button-reprocess-${doc.id}`}
                              >
                                <RotateCw className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteMutation.mutate(doc.id)}
                              disabled={deleteMutation.isPending}
                              className="text-destructive hover:text-destructive/80"
                              data-testid={`button-delete-${doc.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        </main>
      </div>
    </div>
  );
}
