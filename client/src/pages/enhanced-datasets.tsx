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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Search, Upload, Database, BarChart3, FileSpreadsheet, 
  Users, CheckCircle, AlertCircle, Clock, 
  Activity, PieChart, LineChart, Table, GitBranch,
  Settings, Eye, Filter, MessageSquare,
  Layout as LayoutIcon
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import SEOHead from "@/components/SEOHead";
import MultiFileUpload from "@/components/MultiFileUpload";
import ERDiagram from "@/components/ERDiagram";
import ColumnSelector from "@/components/ColumnSelector";
import PowerBIDashboard from "@/components/PowerBIDashboard";
import QueryProcessor from "@/components/QueryProcessor";
import type { Dataset, Dashboard } from "@shared/schema";

// Enhanced form schemas
const projectFormSchema = z.object({
  name: z.string().min(1, "Project name is required").max(100, "Name must be less than 100 characters"),
  description: z.string().max(500, "Description must be less than 500 characters").optional(),
});

type ProjectFormData = z.infer<typeof projectFormSchema>;

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

export default function EnhancedDatasets() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDatasets, setSelectedDatasets] = useState<Dataset[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("upload");
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const [currentDashboard, setCurrentDashboard] = useState<Dashboard | null>(null);
  const { toast } = useToast();
  
  // Form instances
  const projectForm = useForm<ProjectFormData>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: "",
      description: "",
    }
  });

  // Fetch datasets
  const { data: datasets = [], isLoading: isDatasetsLoading } = useQuery({
    queryKey: ['/api/datasets?user_id=anonymous-user']
  });

  // Fetch dashboards for selected datasets
  const { data: dashboards = [] } = useQuery({
    queryKey: [`/api/dashboards?user_id=anonymous-user`],
    enabled: selectedDatasets.length > 0
  });

  // Multi-file upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (files: FileItem[]) => {
      const uploadPromises = files.map(async (fileItem) => {
        const formData = new FormData();
        formData.append('file', fileItem.file);
        formData.append('name', fileItem.name.replace(/\.[^/.]+$/, ""));
        formData.append('description', `Uploaded via multi-file upload - ${new Date().toLocaleString()}`);
        
        return apiRequest('POST', '/api/datasets/upload?user_id=anonymous-user', formData);
      });

      return Promise.all(uploadPromises);
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['/api/datasets'] });
      
      toast({
        title: "Upload successful",
        description: `${results.length} dataset${results.length !== 1 ? 's' : ''} uploaded successfully. Processing will begin shortly.`
      });
      
      // Switch to overview tab after successful upload
      setActiveTab("overview");
    },
    onError: (error: any) => {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload some files",
        variant: "destructive"
      });
    }
  });

  // Dashboard creation mutation
  const createDashboardMutation = useMutation({
    mutationFn: async (dashboardData: any) => {
      return apiRequest('POST', '/api/dashboards?user_id=anonymous-user', {
        ...dashboardData,
        datasetId: selectedDatasets[0]?.id,
        layout: {
          theme: 'corporate',
          backgroundColor: '#f8fafc',
          gridSize: 20,
          showGrid: true
        }
      });
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/dashboards'] });
      setCurrentDashboard(result);
      setActiveTab("dashboard");
      
      toast({
        title: "Dashboard created",
        description: "Your professional dashboard has been created successfully."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Dashboard creation failed",
        description: error.message || "Failed to create dashboard",
        variant: "destructive"
      });
    }
  });

  const handleFilesUpload = async (files: FileItem[]) => {
    await uploadMutation.mutateAsync(files);
  };

  const handleDatasetSelection = (dataset: Dataset) => {
    const isSelected = selectedDatasets.some(d => d.id === dataset.id);
    if (isSelected) {
      setSelectedDatasets(prev => prev.filter(d => d.id !== dataset.id));
    } else {
      setSelectedDatasets(prev => [...prev, dataset]);
    }
  };

  const handleCreateDashboard = (columns: string[]) => {
    if (selectedDatasets.length === 0) {
      toast({
        title: "No datasets selected",
        description: "Please select at least one dataset first",
        variant: "destructive"
      });
      return;
    }

    const dashboardName = `Analytics Dashboard - ${selectedDatasets.map(d => d.name).join(', ')}`;
    
    createDashboardMutation.mutate({
      name: dashboardName,
      description: `Professional analytics dashboard with ${columns.length} selected metrics`,
      selectedColumns: columns
    });
  };

  const handleCreateVisualization = (queryResult: any) => {
    // Create a new widget for the dashboard based on query result
    if (currentDashboard) {
      toast({
        title: "Visualization created",
        description: `Added ${queryResult.visualizationType} chart to your dashboard`
      });
    } else {
      // Create new dashboard with this visualization
      handleCreateDashboard(selectedColumns);
    }
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
      case 'ready': return 'bg-green-100 text-green-800 border-green-200';
      case 'processing': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'failed': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
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

  const readyDatasets = filteredDatasets.filter(d => d.status === 'ready');
  const totalSize = selectedDatasets.reduce((sum, dataset) => sum + dataset.fileSize, 0);

  // Generate column groups for the ColumnSelector
  const columnGroups = selectedDatasets.map(dataset => ({
    name: dataset.name,
    datasetId: dataset.id,
    columns: Array.isArray(dataset.columns) ? dataset.columns.map((col: any) => ({
      name: col.name || 'Unknown',
      type: col.type || 'TEXT',
      nullable: col.nullable !== false,
      unique: col.unique || false,
      samples: col.samples || [],
      statistics: col.statistics || {
        count: dataset.rowCount || 0,
        uniqueCount: col.uniqueCount || 0,
        nullCount: col.nullCount || 0
      }
    })) : []
  }));

  return (
    <>
      <SEOHead
        title="Professional Data Analytics Platform"
        description="Enterprise-grade data analytics platform with ER diagrams, PowerBI-style dashboards, and AI-powered insights."
        keywords="data analytics, business intelligence, ER diagrams, PowerBI, dashboard creation, data visualization, CSV analysis"
      />
      <Layout currentPage="datasets">
        <div className="h-full flex flex-col space-y-6 p-6">
          {/* Header Section */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Database className="h-8 w-8 text-gray-700" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Professional Data Analytics</h1>
                  <p className="text-gray-600">Enterprise-grade business intelligence platform</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  {filteredDatasets.length} Dataset{filteredDatasets.length !== 1 ? 's' : ''}
                </Badge>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  {selectedDatasets.length} Selected
                </Badge>
                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                  {selectedColumns.length} Column{selectedColumns.length !== 1 ? 's' : ''}
                </Badge>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <Dialog open={isProjectDialogOpen} onOpenChange={setIsProjectDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" data-testid="button-new-project">
                    <Settings className="h-4 w-4 mr-2" />
                    New Project
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Analytics Project</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Input placeholder="Project name" />
                    <Input placeholder="Description (optional)" />
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" onClick={() => setIsProjectDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={() => setIsProjectDialogOpen(false)}>
                        Create Project
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              
              <Button
                onClick={() => setActiveTab("upload")}
                className="bg-indigo-600 hover:bg-indigo-700"
                data-testid="button-upload-data"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload Data
              </Button>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
              <TabsList className="grid w-full grid-cols-6 mb-6">
                <TabsTrigger value="upload" className="flex items-center space-x-2">
                  <Upload className="h-4 w-4" />
                  <span>Upload</span>
                </TabsTrigger>
                <TabsTrigger value="overview" className="flex items-center space-x-2">
                  <Database className="h-4 w-4" />
                  <span>Overview</span>
                </TabsTrigger>
                <TabsTrigger value="relationships" className="flex items-center space-x-2">
                  <GitBranch className="h-4 w-4" />
                  <span>Relationships</span>
                </TabsTrigger>
                <TabsTrigger value="columns" className="flex items-center space-x-2">
                  <Filter className="h-4 w-4" />
                  <span>Columns</span>
                </TabsTrigger>
                <TabsTrigger value="queries" className="flex items-center space-x-2">
                  <MessageSquare className="h-4 w-4" />
                  <span>AI Queries</span>
                </TabsTrigger>
                <TabsTrigger value="dashboard" className="flex items-center space-x-2">
                  <BarChart3 className="h-4 w-4" />
                  <span>Dashboard</span>
                </TabsTrigger>
              </TabsList>

              {/* Upload Tab */}
              <TabsContent value="upload" className="space-y-6">
                <MultiFileUpload
                  onFilesChange={() => {}}
                  onUpload={handleFilesUpload}
                  maxFiles={20}
                  maxFileSize={100 * 1024 * 1024} // 100MB
                  acceptedTypes={['.csv', '.xlsx', '.xls', '.tsv', '.json']}
                />
              </TabsContent>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Dataset List */}
                  <Card className="lg:col-span-2">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>Datasets</span>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                          <Input
                            placeholder="Search datasets..."
                            className="pl-10 w-64"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            data-testid="input-search-datasets"
                          />
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-96">
                        <div className="space-y-3">
                          {isDatasetsLoading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                              <div key={i} className="animate-pulse">
                                <div className="h-20 bg-gray-200 rounded-lg"></div>
                              </div>
                            ))
                          ) : filteredDatasets.length === 0 ? (
                            <div className="text-center py-12">
                              <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                              <h3 className="text-lg font-medium text-gray-900 mb-2">No Datasets</h3>
                              <p className="text-gray-500 mb-4">Upload your first dataset to get started</p>
                              <Button onClick={() => setActiveTab("upload")}>
                                Upload Dataset
                              </Button>
                            </div>
                          ) : (
                            filteredDatasets.map((dataset: Dataset) => (
                              <Card 
                                key={dataset.id}
                                className={`cursor-pointer transition-all hover:shadow-md ${
                                  selectedDatasets.some(d => d.id === dataset.id) 
                                    ? 'ring-2 ring-indigo-500 bg-indigo-50' 
                                    : ''
                                }`}
                                onClick={() => handleDatasetSelection(dataset)}
                                data-testid={`card-dataset-${dataset.id}`}
                              >
                                <CardContent className="p-4">
                                  <div className="flex items-start justify-between mb-2">
                                    <h3 className="font-medium text-gray-900 truncate flex-1">{dataset.name}</h3>
                                    <Badge variant="outline" className={getStatusColor(dataset.status)}>
                                      {getStatusIcon(dataset.status)}
                                      <span className="ml-1 capitalize">{dataset.status}</span>
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
                                    <Progress value={60} className="mt-2 h-1" />
                                  )}
                                </CardContent>
                              </Card>
                            ))
                          )}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>

                  {/* Analytics Summary */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Analytics Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-indigo-600">
                            {filteredDatasets.length}
                          </div>
                          <div className="text-sm text-gray-500">Total Datasets</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">
                            {readyDatasets.length}
                          </div>
                          <div className="text-sm text-gray-500">Ready</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-purple-600">
                            {selectedDatasets.reduce((sum, d) => sum + (d.rowCount || 0), 0).toLocaleString()}
                          </div>
                          <div className="text-sm text-gray-500">Total Rows</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-orange-600">
                            {formatFileSize(totalSize)}
                          </div>
                          <div className="text-sm text-gray-500">Total Size</div>
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">Quick Actions</h4>
                        <div className="space-y-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full justify-start"
                            onClick={() => setActiveTab("relationships")}
                            disabled={selectedDatasets.length === 0}
                          >
                            <GitBranch className="h-4 w-4 mr-2" />
                            View Relationships
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full justify-start"
                            onClick={() => setActiveTab("columns")}
                            disabled={selectedDatasets.length === 0}
                          >
                            <Filter className="h-4 w-4 mr-2" />
                            Select Columns
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full justify-start"
                            onClick={() => setActiveTab("dashboard")}
                            disabled={selectedColumns.length === 0}
                          >
                            <BarChart3 className="h-4 w-4 mr-2" />
                            Create Dashboard
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Relationships Tab */}
              <TabsContent value="relationships">
                <ERDiagram
                  datasets={selectedDatasets}
                  selectedColumns={selectedColumns}
                  onColumnSelect={setSelectedColumns}
                />
              </TabsContent>

              {/* Columns Tab */}
              <TabsContent value="columns">
                <ColumnSelector
                  columnGroups={columnGroups}
                  selectedColumns={selectedColumns}
                  onSelectionChange={setSelectedColumns}
                  onCreateDashboard={handleCreateDashboard}
                  showAnalytics={true}
                />
              </TabsContent>

              {/* Queries Tab */}
              <TabsContent value="queries">
                <QueryProcessor
                  datasets={selectedDatasets}
                  selectedColumns={selectedColumns}
                  onCreateVisualization={handleCreateVisualization}
                />
              </TabsContent>

              {/* Dashboard Tab */}
              <TabsContent value="dashboard">
                <PowerBIDashboard
                  datasets={selectedDatasets}
                  selectedColumns={selectedColumns}
                  onSave={(dashboard) => {
                    toast({
                      title: "Dashboard saved",
                      description: "Your professional dashboard has been saved successfully"
                    });
                  }}
                  initialDashboard={currentDashboard}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </Layout>
    </>
  );
}