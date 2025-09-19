import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import SEOHead from "../components/SEOHead";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../hooks/useAuth";
import { useState } from "react";

interface Document {
  id: string;
  title: string;
  filename: string;
  uploadedAt: string;
  status: string;
  fileSize: number;
  mimeType: string;
  extractedText?: string;
  errorMessage?: string;
  uploaderId: string;
}

export default function DocumentDetail() {
  const { id } = useParams();
  const [location, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();

  const { data: document, isLoading, error } = useQuery<Document>({
    queryKey: ["document", id],
    queryFn: async () => {
      const response = await fetch(`/api/documents/${id}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch document");
      }
      return response.json();
    },
    enabled: !!id && !authLoading && !!user,
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    setLocation("/");
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <SEOHead 
          title="Document Details - DocINX"
          description="View document details and content"
        />
        <div className="flex">
          <Sidebar currentPage="documents" />
          <main className="flex-1 lg:pl-72">
            <div className="px-4 py-8 sm:px-6 lg:px-8">
              <div className="flex items-center justify-center min-h-[50vh]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="min-h-screen bg-background">
        <SEOHead 
          title="Document Not Found - DocINX"
          description="The requested document could not be found"
        />
        <div className="flex">
          <Sidebar currentPage="documents" />
          <main className="flex-1 lg:pl-72">
            <div className="px-4 py-8 sm:px-6 lg:px-8">
              <div className="text-center">
                <h1 className="text-2xl font-bold text-foreground mb-4">Document Not Found</h1>
                <p className="text-muted-foreground mb-6">
                  The document you're looking for could not be found or you don't have permission to view it.
                </p>
                <button
                  onClick={() => setLocation("/documents")}
                  className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
                >
                  Back to Documents
                </button>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ready":
        return "text-green-600 bg-green-100";
      case "processing":
        return "text-blue-600 bg-blue-100";
      case "failed":
        return "text-red-600 bg-red-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead 
        title={`${document.title} - DocINX`}
        description={`View details and content for document: ${document.title}`}
      />
      <div className="flex">
        <Sidebar 
          user={user} 
          sidebarOpen={sidebarOpen} 
          setSidebarOpen={setSidebarOpen} 
        />
        <main className="flex-1 lg:pl-72">
          <div className="px-4 py-8 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
              {/* Header */}
              <div className="mb-8">
                <button
                  onClick={() => setLocation("/documents")}
                  className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-2"
                >
                  ← Back to Documents
                </button>
                <h1 className="text-3xl font-bold text-foreground mb-2">
                  {document.title}
                </h1>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>Uploaded {formatDate(document.uploadedAt)}</span>
                  <span>•</span>
                  <span>{formatFileSize(document.fileSize)}</span>
                  <span>•</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(document.status)}`}>
                    {document.status.charAt(0).toUpperCase() + document.status.slice(1)}
                  </span>
                </div>
              </div>

              {/* Document Info */}
              <div className="bg-card rounded-lg p-6 mb-8 border">
                <h2 className="text-xl font-semibold text-foreground mb-4">Document Information</h2>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Filename</dt>
                    <dd className="text-foreground font-mono text-sm">{document.filename}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">File Type</dt>
                    <dd className="text-foreground">{document.mimeType}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">File Size</dt>
                    <dd className="text-foreground">{formatFileSize(document.fileSize)}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Status</dt>
                    <dd>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(document.status)}`}>
                        {document.status.charAt(0).toUpperCase() + document.status.slice(1)}
                      </span>
                    </dd>
                  </div>
                </dl>
                
                {document.errorMessage && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
                    <h3 className="text-sm font-medium text-red-800 mb-1">Processing Error</h3>
                    <p className="text-sm text-red-700">{document.errorMessage}</p>
                  </div>
                )}
              </div>

              {/* Extracted Content */}
              {document.extractedText && (
                <div className="bg-card rounded-lg p-6 border">
                  <h2 className="text-xl font-semibold text-foreground mb-4">Extracted Content</h2>
                  <div className="bg-muted rounded-md p-4 max-h-96 overflow-y-auto">
                    <pre className="text-sm text-foreground whitespace-pre-wrap font-mono">
                      {document.extractedText}
                    </pre>
                  </div>
                </div>
              )}

              {/* No Content Message */}
              {!document.extractedText && document.status === "ready" && (
                <div className="bg-card rounded-lg p-6 border text-center">
                  <h2 className="text-xl font-semibold text-foreground mb-2">No Content Available</h2>
                  <p className="text-muted-foreground">
                    This document has been processed but no text content was extracted.
                  </p>
                </div>
              )}

              {/* Processing Message */}
              {document.status === "processing" && (
                <div className="bg-card rounded-lg p-6 border text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <h2 className="text-xl font-semibold text-foreground mb-2">Processing Document</h2>
                  <p className="text-muted-foreground">
                    This document is currently being processed. Content will appear here once processing is complete.
                  </p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}