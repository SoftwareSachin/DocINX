import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Upload, Search, Eye, Download, Trash2, RotateCw, FileText, File, ChevronLeft, ChevronRight } from "lucide-react";
import FileUpload from "@/components/FileUpload";
import DocumentCard from "@/components/DocumentCard";
import SEOHead from "@/components/SEOHead";

export default function Documents() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  // Clamp page when data size or page size changes
  useEffect(() => {
    const totalPagesNew = Math.max(1, Math.ceil(filteredDocuments.length / pageSize));
    setCurrentPage((prevPage) => Math.min(prevPage, totalPagesNew));
  }, [filteredDocuments.length, pageSize]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredDocuments.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentDocuments = filteredDocuments.slice(startIndex, endIndex);
  const displayStart = filteredDocuments.length === 0 ? 0 : startIndex + 1;
  const displayEnd = Math.min(endIndex, filteredDocuments.length);

  const getFileIcon = (mimeType: string) => {
    if (mimeType === "application/pdf") return FileText;
    if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return FileText;
    return FileText;
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
    <>
      <SEOHead
        title="Document Library"
        description="Manage your document library in DocINX. Upload, search, and organize your PDF, DOCX, and text files for AI-powered analysis."
        keywords="document library, file management, PDF upload, document search, file organization"
      />
      <Layout currentPage="files">
      
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4" data-testid="header-documents">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <button className="p-1 rounded hover:bg-gray-100">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="text-xl font-semibold text-gray-900" data-testid="text-page-title">Files</h2>
            </div>
            <div className="flex items-center space-x-3">
              <div className="text-sm text-gray-600">Connected to Media</div>
              <FileUpload 
                trigger={
                  <Button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium" data-testid="button-upload">
                    + New Files
                  </Button>
                }
              />
              <Button 
                variant="outline" 
                className="px-3 py-2 text-sm border-gray-300"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/documents"] })}
              >
                <RotateCw className="w-4 h-4 mr-2" />
                Refresh Status
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto" data-testid="main-documents">
          <div className="bg-white mx-6 mt-6 rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-medium text-gray-900">Files</h3>
                <div className="text-sm text-gray-500">
                  {filteredDocuments.length === 0 ? "0 files" : 
                   `Showing ${displayStart}-${displayEnd} of ${filteredDocuments.length} files`}
                </div>
              </div>
            </div>
            
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <Input
                      type="text"
                      placeholder="Search Files"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-2 w-80 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      data-testid="input-search"
                    />
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40 border-gray-300" data-testid="select-status-filter">
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
                    {currentDocuments.map((doc: any) => (
                      <tr key={doc.id} className="hover:bg-accent transition-colors" data-testid={`row-document-${doc.id}`}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-red-100 rounded flex items-center justify-center mr-3">
                              {(() => {
                                const IconComponent = getFileIcon(doc.mimeType);
                                return <IconComponent className="w-4 h-4 text-red-600" />;
                              })()}
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
                                onClick={() => window.location.href = `/documents/${doc.id}`}
                                className="text-indigo-600 hover:text-indigo-800"
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
              
              {/* Pagination Controls */}
              {filteredDocuments.length > 0 && totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
                    <div className="flex items-center space-x-3">
                      <Select value={pageSize.toString()} onValueChange={(value) => setPageSize(Number(value))}>
                        <SelectTrigger className="w-24 border-gray-300">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="25">25</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                        </SelectContent>
                      </Select>
                      <span className="text-sm text-gray-500">per page</span>
                    </div>
                    
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious 
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              if (currentPage > 1) setCurrentPage(currentPage - 1);
                            }}
                            className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                          />
                        </PaginationItem>
                        
                        {(() => {
                          const getPageNumbers = () => {
                            const delta = 2;
                            const range = [];
                            const rangeWithDots = [];
                            
                            for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
                              range.push(i);
                            }
                            
                            if (currentPage - delta > 2) {
                              rangeWithDots.push(1, '...');
                            } else {
                              rangeWithDots.push(1);
                            }
                            
                            rangeWithDots.push(...range);
                            
                            if (currentPage + delta < totalPages - 1) {
                              rangeWithDots.push('...', totalPages);
                            } else if (totalPages > 1) {
                              rangeWithDots.push(totalPages);
                            }
                            
                            return rangeWithDots;
                          };
                          
                          return getPageNumbers().map((page, index) => {
                            if (page === '...') {
                              return (
                                <PaginationItem key={`dots-${index}`}>
                                  <span className="flex h-9 w-9 items-center justify-center text-gray-400">...</span>
                                </PaginationItem>
                              );
                            }
                            
                            return (
                              <PaginationItem key={page}>
                                <PaginationLink
                                  href="#"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    setCurrentPage(page as number);
                                  }}
                                  isActive={currentPage === page}
                                  data-testid={`pagination-page-${page}`}
                                >
                                  {page}
                                </PaginationLink>
                              </PaginationItem>
                            );
                          });
                        })()}
                        
                        <PaginationItem>
                          <PaginationNext 
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              if (currentPage < totalPages) setCurrentPage(currentPage + 1);
                            }}
                            className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
            </div>
          </div>
        </main>
      </Layout>
    </>
  );
}
