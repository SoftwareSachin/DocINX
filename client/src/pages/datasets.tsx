import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { 
  Search, Upload, Database, BarChart3, FileSpreadsheet, 
  TrendingUp, Users, Calendar, CheckCircle, AlertCircle, 
  Clock, Eye, Settings, Trash2, Download, MessageSquare,
  Activity, PieChart, LineChart, Table
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import SEOHead from "@/components/SEOHead";
import type { Dataset, Dashboard } from "@shared/schema";

// Form schemas
const uploadFormSchema = z.object({
  name: z.string().min(1, "Dataset name is required").max(100, "Name must be less than 100 characters"),
  description: z.string().max(500, "Description must be less than 500 characters").optional(),
  file: z.instanceof(File).refine((file) => file.size > 0, "Please select a file")
    .refine((file) => file.size <= 10 * 1024 * 1024, "File must be less than 10MB")
    .refine((file) => ['text/csv', 'application/csv', 'application/vnd.ms-excel'].includes(file.type), "Only CSV files are supported")
});

const queryFormSchema = z.object({
  queryText: z.string().min(1, "Please enter a query").max(500, "Query must be less than 500 characters")
});

type UploadFormData = z.infer<typeof uploadFormSchema>;
type QueryFormData = z.infer<typeof queryFormSchema>;

export default function Datasets() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  // Form instances
  const uploadForm = useForm<UploadFormData>({
    resolver: zodResolver(uploadFormSchema),
    defaultValues: {
      name: "",
      description: "",
      file: undefined as any
    }
  });

  const queryForm = useForm<QueryFormData>({
    resolver: zodResolver(queryFormSchema),
    defaultValues: {
      queryText: ""
    }
  });

  // Fetch datasets
  const { data: datasets = [], isLoading: isDatasetsLoading } = useQuery({
    queryKey: ['/api/datasets', 'anonymous-user'],
    queryFn: () => apiRequest('/api/datasets?user_id=anonymous-user')
  });

  // Fetch dashboards for selected dataset  
  const { data: dashboards = [] } = useQuery({
    queryKey: ['/api/dashboards', selectedDataset?.id],
    queryFn: () => selectedDataset ? apiRequest(`/api/dashboards?dataset_id=${selectedDataset.id}`) : Promise.resolve([]),
    enabled: !!selectedDataset
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (data: FormData) => {
      return apiRequest('/api/datasets/upload?user_id=anonymous-user', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/datasets', 'anonymous-user'] });
      setIsUploadDialogOpen(false);
      uploadForm.reset();
      toast({
        title: "Upload successful",
        description: "Your dataset is being processed and will be available shortly."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload dataset",
        variant: "destructive"
      });
    }
  });

  // Query mutation
  const queryMutation = useMutation({
    mutationFn: async ({ datasetId, queryText }: { datasetId: string; queryText: string }) => {
      return apiRequest(`/api/datasets/${datasetId}/query?user_id=anonymous-user`, 'POST', { queryText });
    },
    onSuccess: (result: any) => {
      queryForm.reset();
      toast({
        title: "Query processed",
        description: `Generated ${result.suggestedVisualization} visualization. SQL: ${result.sql.slice(0, 50)}...`
      });
    },
    onError: (error: any) => {
      toast({
        title: "Query failed",
        description: error.message || "Failed to process query",
        variant: "destructive"
      });
    }
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadForm.setValue('file', file);
      if (!uploadForm.getValues('name')) {
        uploadForm.setValue('name', file.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const handleUpload = (data: UploadFormData) => {
    const formData = new FormData();
    formData.append('file', data.file);
    formData.append('name', data.name);
    formData.append('description', data.description || '');

    uploadMutation.mutate(formData);
  };

  const handleQuery = (data: QueryFormData) => {
    if (!selectedDataset) {
      toast({
        title: "Missing information",
        description: "Please select a dataset first",
        variant: "destructive"
      });
      return;
    }

    queryMutation.mutate({
      datasetId: selectedDataset.id,
      queryText: data.queryText
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready': return 'bg-green-100 text-green-800';
      case 'processing': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready': return <CheckCircle className="h-4 w-4" />;
      case 'processing': return <Clock className="h-4 w-4" />;
      case 'failed': return <AlertCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const filteredDatasets = (datasets as Dataset[]).filter((dataset: Dataset) =>
    dataset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dataset.originalFilename.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <SEOHead
        title="Data Analytics Platform"
        description="Professional data analytics platform for CSV analysis, dashboard creation, and business intelligence."
        keywords="data analytics, CSV analysis, business intelligence, dashboards, data visualization"
      />
      <Layout currentPage="datasets">
        <div className="h-full flex flex-col">
          {/* Header Section */}
          <div className="border-b border-gray-200 bg-white px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Database className="h-6 w-6 text-indigo-600" />
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">Data Analytics Platform</h1>
                  <p className="text-sm text-gray-500">Upload, analyze, and visualize your data</p>
                </div>
                <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                  {filteredDatasets.length} dataset{filteredDatasets.length !== 1 ? 's' : ''}
                </Badge>
              </div>
              
              <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-indigo-600 hover:bg-indigo-700" data-testid="button-upload-dataset">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Dataset
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Upload CSV Dataset</DialogTitle>
                  </DialogHeader>
                  <Form {...uploadForm}>
                    <form onSubmit={uploadForm.handleSubmit(handleUpload)} className="space-y-4">
                      <FormField
                        control={uploadForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Dataset Name</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Enter dataset name" 
                                data-testid="input-dataset-name"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={uploadForm.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description (Optional)</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Describe your dataset"
                                rows={3}
                                data-testid="textarea-dataset-description"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={uploadForm.control}
                        name="file"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CSV File</FormLabel>
                            <FormControl>
                              <div 
                                className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-indigo-400 cursor-pointer transition-colors"
                                onClick={() => fileInputRef.current?.click()}
                                data-testid="dropzone-file-upload"
                              >
                                <FileSpreadsheet className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                                {field.value ? (
                                  <div>
                                    <p className="text-sm font-medium text-gray-900">{field.value.name}</p>
                                    <p className="text-xs text-gray-500">{formatFileSize(field.value.size)}</p>
                                  </div>
                                ) : (
                                  <div>
                                    <p className="text-sm text-gray-600">Click to select CSV file</p>
                                    <p className="text-xs text-gray-400">Maximum size: 10MB</p>
                                  </div>
                                )}
                                <input
                                  ref={fileInputRef}
                                  type="file"
                                  accept=".csv,.txt"
                                  onChange={handleFileSelect}
                                  className="hidden"
                                  data-testid="input-file-upload"
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="flex justify-end space-x-2">
                        <Button variant="outline" type="button" onClick={() => setIsUploadDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button 
                          type="submit"
                          disabled={uploadMutation.isPending}
                          data-testid="button-upload-confirm"
                        >
                          {uploadMutation.isPending ? "Uploading..." : "Upload Dataset"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Search Bar */}
          <div className="px-6 py-4 bg-gray-50">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search datasets..."
                className="pl-10 bg-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="input-search-datasets"
              />
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex">
            {/* Datasets List */}
            <div className="w-1/3 border-r border-gray-200 bg-white overflow-y-auto">
              <div className="p-4">
                {isDatasetsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="animate-pulse">
                        <div className="h-20 bg-gray-200 rounded-lg"></div>
                      </div>
                    ))}
                  </div>
                ) : filteredDatasets.length === 0 ? (
                  <Card className="p-8 text-center">
                    <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Datasets</h3>
                    <p className="text-gray-500 mb-4">Upload your first CSV file to get started</p>
                    <Button 
                      onClick={() => setIsUploadDialogOpen(true)}
                      className="bg-indigo-600 hover:bg-indigo-700"
                      data-testid="button-upload-first-dataset"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Dataset
                    </Button>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {filteredDatasets.map((dataset: Dataset) => (
                      <Card 
                        key={dataset.id}
                        className={`cursor-pointer transition-all hover:shadow-md ${
                          selectedDataset?.id === dataset.id ? 'ring-2 ring-indigo-500 bg-indigo-50' : ''
                        }`}
                        onClick={() => setSelectedDataset(dataset)}
                        data-testid={`card-dataset-${dataset.id}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <h3 className="font-medium text-gray-900 truncate flex-1">{dataset.name}</h3>
                            <Badge className={`ml-2 ${getStatusColor(dataset.status)} flex items-center space-x-1`}>
                              {getStatusIcon(dataset.status)}
                              <span className="capitalize">{dataset.status}</span>
                            </Badge>
                          </div>
                          
                          <p className="text-sm text-gray-500 mb-2 truncate">{dataset.originalFilename}</p>
                          
                          <div className="flex items-center text-xs text-gray-400 space-x-4">
                            <span>{formatFileSize(dataset.fileSize)}</span>
                            {dataset.rowCount && (
                              <span>{dataset.rowCount.toLocaleString()} rows</span>
                            )}
                            {dataset.columnCount && (
                              <span>{dataset.columnCount} cols</span>
                            )}
                          </div>
                          
                          {dataset.status === 'processing' && (
                            <Progress value={33} className="mt-2 h-1" />
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Dataset Details */}
            <div className="flex-1 bg-gray-50 overflow-y-auto">
              {selectedDataset ? (
                <div className="p-6">
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900">{selectedDataset.name}</h2>
                        <p className="text-gray-500">{selectedDataset.originalFilename}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className={getStatusColor(selectedDataset.status)}>
                          {getStatusIcon(selectedDataset.status)}
                          <span className="ml-1 capitalize">{selectedDataset.status}</span>
                        </Badge>
                      </div>
                    </div>

                    {selectedDataset.description && (
                      <p className="text-gray-600 mb-4">{selectedDataset.description}</p>
                    )}

                    {selectedDataset.status === 'failed' && selectedDataset.errorMessage && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                        <div className="flex items-center">
                          <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                          <span className="text-red-700 font-medium">Processing Error</span>
                        </div>
                        <p className="text-red-600 mt-1">{selectedDataset.errorMessage}</p>
                      </div>
                    )}
                  </div>

                  {selectedDataset.status === 'ready' && (
                    <Tabs defaultValue="overview" className="w-full">
                      <TabsList className="grid w-full grid-cols-5">
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="columns">Columns</TabsTrigger>
                        <TabsTrigger value="relationships">Relationships</TabsTrigger>
                        <TabsTrigger value="dashboards">Dashboards</TabsTrigger>
                        <TabsTrigger value="queries">AI Queries</TabsTrigger>
                      </TabsList>

                      <TabsContent value="overview" className="space-y-4">
                        {selectedDataset.statistics && (
                          <Card>
                            <CardHeader>
                              <CardTitle className="flex items-center">
                                <BarChart3 className="h-5 w-5 mr-2" />
                                Dataset Statistics
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                <div className="text-center">
                                  <div className="text-2xl font-bold text-indigo-600">
                                    {selectedDataset.statistics.totalRows?.toLocaleString()}
                                  </div>
                                  <div className="text-sm text-gray-500">Total Rows</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-2xl font-bold text-green-600">
                                    {selectedDataset.statistics.totalColumns}
                                  </div>
                                  <div className="text-sm text-gray-500">Columns</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-2xl font-bold text-purple-600">
                                    {selectedDataset.statistics.completeness?.toFixed(1)}%
                                  </div>
                                  <div className="text-sm text-gray-500">Completeness</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-2xl font-bold text-orange-600">
                                    {formatFileSize(selectedDataset.statistics.memoryUsage || 0)}
                                  </div>
                                  <div className="text-sm text-gray-500">Memory Usage</div>
                                </div>
                              </div>
                              <p className="text-gray-600">{selectedDataset.statistics.overview}</p>
                            </CardContent>
                          </Card>
                        )}
                      </TabsContent>

                      <TabsContent value="columns" className="space-y-4">
                        {selectedDataset.columns && (
                          <Card>
                            <CardHeader>
                              <CardTitle>Column Analysis</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-4">
                                {selectedDataset.columns.map((column: any, index: number) => (
                                  <div key={index} className="border rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-2">
                                      <h4 className="font-medium text-gray-900">{column.name}</h4>
                                      <Badge variant="outline" className="capitalize">
                                        {column.type}
                                      </Badge>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                      <div>
                                        <span className="text-gray-500">Unique Values:</span>
                                        <div className="font-medium">{column.uniqueCount?.toLocaleString()}</div>
                                      </div>
                                      <div>
                                        <span className="text-gray-500">Null Count:</span>
                                        <div className="font-medium">{column.nullCount?.toLocaleString()}</div>
                                      </div>
                                      <div>
                                        <span className="text-gray-500">Nullable:</span>
                                        <div className="font-medium">{column.nullable ? 'Yes' : 'No'}</div>
                                      </div>
                                      <div>
                                        <span className="text-gray-500">Unique:</span>
                                        <div className="font-medium">{column.unique ? 'Yes' : 'No'}</div>
                                      </div>
                                    </div>
                                    {column.samples && column.samples.length > 0 && (
                                      <div className="mt-2">
                                        <span className="text-gray-500 text-sm">Sample Values:</span>
                                        <div className="text-sm text-gray-700 mt-1">
                                          {column.samples.slice(0, 3).join(', ')}
                                          {column.samples.length > 3 && '...'}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </TabsContent>

                      <TabsContent value="relationships" className="space-y-4">
                        {selectedDataset.relationships && (
                          <Card>
                            <CardHeader>
                              <CardTitle>Entity Relationships</CardTitle>
                            </CardHeader>
                            <CardContent>
                              {selectedDataset.relationships.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                  <Activity className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                                  <p>No relationships detected in this dataset</p>
                                </div>
                              ) : (
                                <div className="space-y-4">
                                  {selectedDataset.relationships.map((rel: any, index: number) => (
                                    <div key={index} className="border rounded-lg p-4">
                                      <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center space-x-2">
                                          <span className="font-medium text-gray-900">{rel.fromColumn}</span>
                                          <span className="text-gray-400">→</span>
                                          <span className="font-medium text-gray-900">{rel.toColumn}</span>
                                        </div>
                                        <Badge variant="outline" className="capitalize">
                                          {rel.type}
                                        </Badge>
                                      </div>
                                      <p className="text-sm text-gray-600">{rel.description}</p>
                                      <div className="mt-2">
                                        <div className="flex items-center">
                                          <span className="text-sm text-gray-500 mr-2">Confidence:</span>
                                          <Progress value={rel.confidence * 100} className="flex-1 h-2" />
                                          <span className="text-sm text-gray-600 ml-2">
                                            {(rel.confidence * 100).toFixed(1)}%
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        )}
                      </TabsContent>

                      <TabsContent value="dashboards" className="space-y-4">
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                              <span className="flex items-center">
                                <PieChart className="h-5 w-5 mr-2" />
                                Dashboards
                              </span>
                              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700">
                                <BarChart3 className="h-4 w-4 mr-2" />
                                Create Dashboard
                              </Button>
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            {(dashboards as Dashboard[]).length === 0 ? (
                              <div className="text-center py-8 text-gray-500">
                                <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                                <p className="mb-4">No dashboards created yet</p>
                                <Button className="bg-indigo-600 hover:bg-indigo-700">
                                  Create Your First Dashboard
                                </Button>
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {(dashboards as Dashboard[]).map((dashboard: Dashboard) => (
                                  <Card key={dashboard.id} className="cursor-pointer hover:shadow-md">
                                    <CardContent className="p-4">
                                      <h4 className="font-medium text-gray-900 mb-2">{dashboard.name}</h4>
                                      {dashboard.description && (
                                        <p className="text-sm text-gray-500 mb-3">{dashboard.description}</p>
                                      )}
                                      <div className="flex items-center justify-between text-xs text-gray-400">
                                        <span>Created {new Date(dashboard.createdAt).toLocaleDateString()}</span>
                                        <div className="flex items-center space-x-2">
                                          <Button size="sm" variant="outline">
                                            <Eye className="h-3 w-3 mr-1" />
                                            View
                                          </Button>
                                          <Button size="sm" variant="outline">
                                            <Settings className="h-3 w-3 mr-1" />
                                            Edit
                                          </Button>
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </TabsContent>

                      <TabsContent value="queries" className="space-y-4">
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center">
                              <MessageSquare className="h-5 w-5 mr-2" />
                              Natural Language Queries
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <Form {...queryForm}>
                              <form onSubmit={queryForm.handleSubmit(handleQuery)} className="flex space-x-2 mb-4">
                                <FormField
                                  control={queryForm.control}
                                  name="queryText"
                                  render={({ field }) => (
                                    <FormItem className="flex-1">
                                      <FormControl>
                                        <Input
                                          placeholder="Ask a question about your data (e.g., 'Show me top 5 customers by revenue')"
                                          data-testid="input-ai-query"
                                          {...field}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <Button 
                                  type="submit"
                                  disabled={queryMutation.isPending}
                                  data-testid="button-process-query"
                                >
                                  {queryMutation.isPending ? "Processing..." : "Ask AI"}
                                </Button>
                              </form>
                            </Form>
                            
                            <div className="bg-gray-50 rounded-lg p-4">
                              <h4 className="font-medium text-gray-900 mb-2">Example Queries:</h4>
                              <div className="space-y-1 text-sm text-gray-600">
                                <div>• "Show me the top 10 items by sales"</div>
                                <div>• "What is the average revenue per customer?"</div>
                                <div>• "Display trends over time"</div>
                                <div>• "Count records by category"</div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </TabsContent>
                    </Tabs>
                  )}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <Database className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-medium mb-2">Select a Dataset</p>
                    <p>Choose a dataset from the left panel to view details and create dashboards</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </Layout>
    </>
  );
}