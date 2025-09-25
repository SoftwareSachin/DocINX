import { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Upload, FileSpreadsheet, X, CheckCircle, AlertCircle, 
  FileText, Trash2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface FileItem {
  id: string;
  file: File;
  name: string;
  size: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
  preview?: any[];
}

interface MultiFileUploadProps {
  onFilesChange: (files: FileItem[]) => void;
  onUpload: (files: FileItem[]) => Promise<void>;
  maxFiles?: number;
  maxFileSize?: number;
  acceptedTypes?: string[];
}

export default function MultiFileUpload({
  onFilesChange,
  onUpload,
  maxFiles = 10,
  maxFileSize = 50 * 1024 * 1024, // 50MB
  acceptedTypes = ['.csv', '.xlsx', '.xls', '.tsv', '.txt']
}: MultiFileUploadProps) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const generateId = () => Math.random().toString(36).substr(2, 9);

  const validateFile = (file: File): string | null => {
    if (file.size > maxFileSize) {
      return `File size exceeds ${formatFileSize(maxFileSize)}`;
    }

    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!acceptedTypes.includes(extension)) {
      return `File type not supported. Accepted: ${acceptedTypes.join(', ')}`;
    }

    return null;
  };

  const readFilePreview = async (file: File): Promise<any[]> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const lines = text.split('\n').slice(0, 5); // First 5 rows
          const preview = lines.map(line => 
            line.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''))
          );
          resolve(preview);
        } catch (error) {
          resolve([]);
        }
      };
      reader.onerror = () => resolve([]);
      reader.readAsText(file.slice(0, 10000)); // Read first 10KB for preview
    });
  };

  const processFiles = async (fileList: FileList | File[]) => {
    const fileArray = Array.from(fileList);
    
    if (files.length + fileArray.length > maxFiles) {
      toast({
        title: "Too many files",
        description: `Maximum ${maxFiles} files allowed`,
        variant: "destructive"
      });
      return;
    }

    const newFiles: FileItem[] = [];

    for (const file of fileArray) {
      const error = validateFile(file);
      const id = generateId();
      
      const fileItem: FileItem = {
        id,
        file,
        name: file.name,
        size: file.size,
        status: error ? 'error' : 'pending',
        progress: 0,
        error
      };

      if (!error) {
        try {
          fileItem.preview = await readFilePreview(file);
        } catch (err) {
          console.warn('Failed to generate preview for', file.name);
        }
      }

      newFiles.push(fileItem);
    }

    const updatedFiles = [...files, ...newFiles];
    setFiles(updatedFiles);
    onFilesChange(updatedFiles);

    // Show success message for valid files
    const validFiles = newFiles.filter(f => f.status !== 'error');
    if (validFiles.length > 0) {
      toast({
        title: "Files added",
        description: `${validFiles.length} file${validFiles.length !== 1 ? 's' : ''} ready for upload`
      });
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      processFiles(files);
    }
    // Reset input value to allow selecting the same files again
    event.target.value = '';
  };

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
    
    const files = event.dataTransfer.files;
    if (files) {
      processFiles(files);
    }
  }, [files.length]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
  }, []);

  const removeFile = (id: string) => {
    const updatedFiles = files.filter(f => f.id !== id);
    setFiles(updatedFiles);
    onFilesChange(updatedFiles);
    
    toast({
      title: "File removed",
      description: "File has been removed from upload queue"
    });
  };

  const clearAllFiles = () => {
    setFiles([]);
    onFilesChange([]);
    
    toast({
      title: "All files cleared",
      description: "Upload queue has been cleared"
    });
  };

  const startUpload = async () => {
    const validFiles = files.filter(f => f.status === 'pending');
    if (validFiles.length === 0) {
      toast({
        title: "No files to upload",
        description: "Please add valid files to upload",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);
    
    try {
      // Update status to uploading
      const updatedFiles = files.map(f => 
        f.status === 'pending' ? { ...f, status: 'uploading' as const } : f
      );
      setFiles(updatedFiles);
      onFilesChange(updatedFiles);

      await onUpload(validFiles);

      // Update status to success
      const successFiles = files.map(f => 
        f.status === 'uploading' ? { ...f, status: 'success' as const, progress: 100 } : f
      );
      setFiles(successFiles);
      onFilesChange(successFiles);

      toast({
        title: "Upload successful",
        description: `${validFiles.length} file${validFiles.length !== 1 ? 's' : ''} uploaded successfully`
      });
    } catch (error) {
      // Update status to error
      const errorFiles = files.map(f => 
        f.status === 'uploading' ? { 
          ...f, 
          status: 'error' as const, 
          error: error instanceof Error ? error.message : 'Upload failed' 
        } : f
      );
      setFiles(errorFiles);
      onFilesChange(errorFiles);

      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload files",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const getStatusIcon = (status: FileItem['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'uploading':
        return <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />;
      default:
        return <FileSpreadsheet className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: FileItem['status']) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'uploading':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const validFilesCount = files.filter(f => f.status !== 'error').length;
  const uploadedFilesCount = files.filter(f => f.status === 'success').length;
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Upload className="h-5 w-5" />
              <span>Multi-File Upload</span>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                {files.length} file{files.length !== 1 ? 's' : ''}
              </Badge>
            </div>
            {files.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearAllFiles}
                data-testid="button-clear-all"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Clear All
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
              ${isDragOver 
                ? 'border-blue-400 bg-blue-50' 
                : 'border-gray-300 hover:border-gray-400'
              }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            data-testid="dropzone-multi-upload"
          >
            <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Drop files here or click to browse
            </h3>
            <p className="text-gray-500 mb-4">
              Support for CSV, Excel, TSV files up to {formatFileSize(maxFileSize)} each
            </p>
            <div className="flex justify-center space-x-4 text-sm text-gray-400">
              <span>Max {maxFiles} files</span>
              <span>•</span>
              <span>{acceptedTypes.join(', ')}</span>
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={acceptedTypes.join(',')}
              onChange={handleFileSelect}
              className="hidden"
              data-testid="input-multi-file"
            />
          </div>

          {/* Upload Summary */}
          {files.length > 0 && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm">
                  <span className="font-medium">{validFilesCount} valid files</span>
                  <span className="text-gray-500"> • {formatFileSize(totalSize)} total</span>
                  {uploadedFilesCount > 0 && (
                    <span className="text-green-600"> • {uploadedFilesCount} uploaded</span>
                  )}
                </div>
                <Button
                  onClick={startUpload}
                  disabled={isUploading || validFilesCount === 0}
                  className="bg-indigo-600 hover:bg-indigo-700"
                  data-testid="button-start-upload"
                >
                  {isUploading ? 'Uploading...' : `Upload ${validFilesCount} Files`}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* File List */}
      {files.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upload Queue</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-80">
              <div className="space-y-2 p-4">
                {files.map((fileItem, index) => (
                  <div key={fileItem.id}>
                    <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-gray-50">
                      <div className="flex-shrink-0 mt-1">
                        {getStatusIcon(fileItem.status)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-sm font-medium text-gray-900 truncate">
                            {fileItem.name}
                          </h4>
                          <div className="flex items-center space-x-2">
                            <Badge 
                              variant="outline" 
                              className={getStatusColor(fileItem.status)}
                            >
                              {fileItem.status}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFile(fileItem.id)}
                              data-testid={`button-remove-${fileItem.id}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                          <span>{formatFileSize(fileItem.size)}</span>
                          <span>{fileItem.file.type || 'Unknown type'}</span>
                        </div>

                        {fileItem.status === 'uploading' && (
                          <Progress value={fileItem.progress} className="h-1 mb-2" />
                        )}

                        {fileItem.error && (
                          <p className="text-xs text-red-600 mt-1">{fileItem.error}</p>
                        )}

                        {/* File Preview */}
                        {fileItem.preview && fileItem.preview.length > 0 && (
                          <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                            <div className="font-medium text-gray-700 mb-1">Preview:</div>
                            <div className="space-y-1 font-mono">
                              {fileItem.preview.slice(0, 3).map((row, rowIndex) => (
                                <div key={rowIndex} className="truncate">
                                  {row.slice(0, 4).join(' | ')}
                                  {row.length > 4 && '...'}
                                </div>
                              ))}
                              {fileItem.preview.length > 3 && (
                                <div className="text-gray-500">...</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    {index < files.length - 1 && <Separator className="my-2" />}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}