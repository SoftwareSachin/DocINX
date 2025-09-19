import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Eye, Download, Trash2, RotateCw } from "lucide-react";

interface DocumentCardProps {
  document: {
    id: string;
    title: string;
    filename: string;
    mimeType: string;
    fileSize: number;
    status: string;
    uploadedAt: string;
  };
  showActions?: boolean;
  onView?: (id: string) => void;
  onDownload?: (id: string) => void;
  onDelete?: (id: string) => void;
  onReprocess?: (id: string) => void;
}

export default function DocumentCard({ 
  document, 
  showActions = true,
  onView,
  onDownload,
  onDelete,
  onReprocess
}: DocumentCardProps) {
  const getFileIcon = (mimeType: string) => {
    if (mimeType === "application/pdf") return "fas fa-file-pdf text-destructive";
    if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "fas fa-file-word text-primary";
    return "fas fa-file-alt text-chart-4";
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      return "Just now";
    } else if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours === 1 ? "" : "s"} ago`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays} day${diffInDays === 1 ? "" : "s"} ago`;
    }
  };

  return (
    <div 
      className="flex items-center space-x-4 p-3 rounded-lg hover:bg-accent transition-colors"
      data-testid={`document-card-${document.id}`}
    >
      <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
        <i className={`${getFileIcon(document.mimeType)} text-sm`}></i>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate" data-testid={`document-title-${document.id}`}>
          {document.title}
        </p>
        <p className="text-sm text-muted-foreground" data-testid={`document-date-${document.id}`}>
          {formatDate(document.uploadedAt)}
        </p>
      </div>
      <div className="flex items-center space-x-2">
        {getStatusBadge(document.status)}
        {showActions && (
          <div className="flex items-center space-x-1">
            {document.status === "ready" && onView && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onView(document.id)}
                className="text-primary hover:text-primary/80 h-8 w-8 p-0"
                data-testid={`button-view-${document.id}`}
              >
                <Eye className="h-4 w-4" />
              </Button>
            )}
            {document.status === "ready" && onDownload && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDownload(document.id)}
                className="text-primary hover:text-primary/80 h-8 w-8 p-0"
                data-testid={`button-download-${document.id}`}
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
            {document.status === "failed" && onReprocess && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onReprocess(document.id)}
                className="text-primary hover:text-primary/80 h-8 w-8 p-0"
                data-testid={`button-reprocess-${document.id}`}
              >
                <RotateCw className="h-4 w-4" />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(document.id)}
                className="text-destructive hover:text-destructive/80 h-8 w-8 p-0"
                data-testid={`button-delete-${document.id}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
