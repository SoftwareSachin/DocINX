import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart3, LineChart, PieChart, TrendingUp, Database, 
  Settings, Download, Share2, Maximize2, Minimize2,
  Filter, Calendar, Hash, Type, Target, Activity,
  Grid3x3, Layout, Palette, Eye, Save, Plus, X,
  RefreshCw, ZoomIn, ZoomOut, Move, RotateCw
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js';
import { Bar, Line, Pie, Doughnut } from 'react-chartjs-2';
import { useToast } from '@/hooks/use-toast';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface ChartWidget {
  id: string;
  type: 'bar' | 'line' | 'pie' | 'doughnut' | 'kpi' | 'table';
  title: string;
  position: { x: number; y: number; width: number; height: number };
  data: any;
  config: any;
  filters?: any[];
}

interface DashboardData {
  id: string;
  name: string;
  description?: string;
  widgets: ChartWidget[];
  layout: {
    theme: 'light' | 'dark' | 'corporate';
    backgroundColor: string;
    gridSize: number;
    showGrid: boolean;
  };
  filters: any[];
}

interface PowerBIDashboardProps {
  datasets: any[];
  selectedColumns: string[];
  onSave?: (dashboard: DashboardData) => void;
  initialDashboard?: DashboardData;
}

export default function PowerBIDashboard({
  datasets,
  selectedColumns,
  onSave,
  initialDashboard
}: PowerBIDashboardProps) {
  const [dashboard, setDashboard] = useState<DashboardData>(
    initialDashboard || {
      id: `dashboard_${Date.now()}`,
      name: 'New Dashboard',
      description: '',
      widgets: [],
      layout: {
        theme: 'corporate',
        backgroundColor: '#f8fafc',
        gridSize: 20,
        showGrid: true
      },
      filters: []
    }
  );

  const [selectedWidget, setSelectedWidget] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null);
  const [showWidgetDialog, setShowWidgetDialog] = useState(false);
  const [newWidgetType, setNewWidgetType] = useState<ChartWidget['type']>('bar');
  const canvasRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Professional color schemes
  const colorSchemes = {
    corporate: ['#1e40af', '#3b82f6', '#60a5fa', '#93c5fd', '#dbeafe'],
    modern: ['#6366f1', '#8b5cf6', '#a855f7', '#c084fc', '#e879f9'],
    nature: ['#059669', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0'],
    warm: ['#dc2626', '#ef4444', '#f87171', '#fca5a5', '#fecaca']
  };

  const generateSampleData = (type: ChartWidget['type'], columns: string[]) => {
    if (columns.length === 0) {
      return {
        labels: ['No Data'],
        datasets: [{
          label: 'Sample Data',
          data: [0],
          backgroundColor: colorSchemes.corporate[0]
        }]
      };
    }

    const labels = ['Q1', 'Q2', 'Q3', 'Q4'];
    const dataPoints = [65, 59, 80, 81];

    switch (type) {
      case 'bar':
      case 'line':
        return {
          labels,
          datasets: [{
            label: columns[0] || 'Data',
            data: dataPoints,
            backgroundColor: type === 'bar' ? colorSchemes.corporate : undefined,
            borderColor: type === 'line' ? colorSchemes.corporate[0] : undefined,
            borderWidth: type === 'line' ? 2 : undefined,
            fill: type === 'line' ? false : undefined
          }]
        };
      
      case 'pie':
      case 'doughnut':
        return {
          labels: columns.slice(0, 4) || ['Category A', 'Category B', 'Category C', 'Category D'],
          datasets: [{
            data: dataPoints,
            backgroundColor: colorSchemes.corporate
          }]
        };
      
      default:
        return { labels: [], datasets: [] };
    }
  };

  const getChartOptions = (type: ChartWidget['type']): ChartOptions<any> => {
    const baseOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top' as const,
          labels: {
            font: {
              family: 'ui-sans-serif, system-ui, sans-serif',
              size: 12
            }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: 'white',
          bodyColor: 'white',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1
        }
      }
    };

    if (type === 'line' || type === 'bar') {
      return {
        ...baseOptions,
        scales: {
          x: {
            grid: {
              color: 'rgba(0, 0, 0, 0.1)'
            }
          },
          y: {
            grid: {
              color: 'rgba(0, 0, 0, 0.1)'
            }
          }
        }
      };
    }

    return baseOptions;
  };

  const createNewWidget = () => {
    const newWidget: ChartWidget = {
      id: `widget_${Date.now()}`,
      type: newWidgetType,
      title: `${newWidgetType.charAt(0).toUpperCase() + newWidgetType.slice(1)} Chart`,
      position: { x: 0, y: 0, width: 6, height: 4 },
      data: generateSampleData(newWidgetType, selectedColumns),
      config: getChartOptions(newWidgetType),
      filters: []
    };

    setDashboard(prev => ({
      ...prev,
      widgets: [...prev.widgets, newWidget]
    }));

    setShowWidgetDialog(false);
    setSelectedWidget(newWidget.id);
    
    toast({
      title: "Widget added",
      description: `${newWidgetType} chart has been added to your dashboard`
    });
  };

  const deleteWidget = (widgetId: string) => {
    setDashboard(prev => ({
      ...prev,
      widgets: prev.widgets.filter(w => w.id !== widgetId)
    }));
    
    if (selectedWidget === widgetId) {
      setSelectedWidget(null);
    }

    toast({
      title: "Widget removed",
      description: "Widget has been removed from your dashboard"
    });
  };

  const updateWidget = (widgetId: string, updates: Partial<ChartWidget>) => {
    setDashboard(prev => ({
      ...prev,
      widgets: prev.widgets.map(w => 
        w.id === widgetId ? { ...w, ...updates } : w
      )
    }));
  };

  const saveDashboard = () => {
    if (onSave) {
      onSave(dashboard);
      toast({
        title: "Dashboard saved",
        description: "Your dashboard has been saved successfully"
      });
    }
  };

  const renderChart = (widget: ChartWidget) => {
    const commonProps = {
      data: widget.data,
      options: widget.config,
      key: widget.id
    };

    switch (widget.type) {
      case 'bar':
        return <Bar {...commonProps} />;
      case 'line':
        return <Line {...commonProps} />;
      case 'pie':
        return <Pie {...commonProps} />;
      case 'doughnut':
        return <Doughnut {...commonProps} />;
      case 'kpi':
        return (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="text-4xl font-bold text-indigo-600 mb-2">
              {widget.data.value || '0'}
            </div>
            <div className="text-sm text-gray-500">{widget.data.label || 'KPI Value'}</div>
            <div className="text-xs text-gray-400 mt-1">{widget.data.subtitle || ''}</div>
          </div>
        );
      case 'table':
        return (
          <div className="h-full overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {(widget.data.headers || ['Column 1', 'Column 2']).map((header: string, index: number) => (
                    <th key={index} className="px-2 py-1 text-left border-b">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(widget.data.rows || [['Row 1', 'Data 1'], ['Row 2', 'Data 2']]).map((row: any[], index: number) => (
                  <tr key={index} className="hover:bg-gray-50">
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex} className="px-2 py-1 border-b">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      default:
        return <div className="h-full flex items-center justify-center text-gray-500">Unsupported chart type</div>;
    }
  };

  const getWidgetIcon = (type: ChartWidget['type']) => {
    switch (type) {
      case 'bar': return <BarChart3 className="h-4 w-4" />;
      case 'line': return <LineChart className="h-4 w-4" />;
      case 'pie': return <PieChart className="h-4 w-4" />;
      case 'doughnut': return <PieChart className="h-4 w-4" />;
      case 'kpi': return <Target className="h-4 w-4" />;
      case 'table': return <Grid3x3 className="h-4 w-4" />;
      default: return <BarChart3 className="h-4 w-4" />;
    }
  };

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Dashboard Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Activity className="h-6 w-6 text-indigo-600" />
              <div>
                <CardTitle className="text-xl">{dashboard.name}</CardTitle>
                {dashboard.description && (
                  <p className="text-sm text-gray-500">{dashboard.description}</p>
                )}
              </div>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                {dashboard.widgets.length} widget{dashboard.widgets.length !== 1 ? 's' : ''}
              </Badge>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
                className={isEditing ? 'bg-indigo-50 text-indigo-700' : ''}
                data-testid="button-toggle-edit"
              >
                {isEditing ? <Eye className="h-4 w-4" /> : <Settings className="h-4 w-4" />}
                <span className="ml-1">{isEditing ? 'View' : 'Edit'}</span>
              </Button>
              
              <Dialog open={showWidgetDialog} onOpenChange={setShowWidgetDialog}>
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    className="bg-indigo-600 hover:bg-indigo-700"
                    disabled={!isEditing}
                    data-testid="button-add-widget"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Widget
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Widget</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Widget Type</label>
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        {(['bar', 'line', 'pie', 'doughnut', 'kpi', 'table'] as const).map(type => (
                          <Button
                            key={type}
                            variant={newWidgetType === type ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setNewWidgetType(type)}
                            className="flex flex-col items-center p-3 h-auto"
                            data-testid={`button-widget-type-${type}`}
                          >
                            {getWidgetIcon(type)}
                            <span className="mt-1 text-xs capitalize">{type}</span>
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button
                        variant="outline"
                        onClick={() => setShowWidgetDialog(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={createNewWidget}
                        data-testid="button-create-widget"
                      >
                        Create Widget
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <Button
                variant="outline"
                size="sm"
                onClick={saveDashboard}
                data-testid="button-save-dashboard"
              >
                <Save className="h-4 w-4 mr-1" />
                Save
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                data-testid="button-download-dashboard"
              >
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Dashboard Content */}
      <div className="flex-1 flex space-x-4">
        {/* Widgets Panel (when editing) */}
        {isEditing && (
          <Card className="w-80">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Dashboard Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Dashboard Name</label>
                <Input
                  value={dashboard.name}
                  onChange={(e) => setDashboard(prev => ({ ...prev, name: e.target.value }))}
                  className="mt-1"
                  data-testid="input-dashboard-name"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={dashboard.description}
                  onChange={(e) => setDashboard(prev => ({ ...prev, description: e.target.value }))}
                  className="mt-1"
                  rows={3}
                  data-testid="textarea-dashboard-description"
                />
              </div>

              <Separator />

              <div>
                <label className="text-sm font-medium mb-2 block">Widgets</label>
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {dashboard.widgets.map(widget => (
                      <div
                        key={widget.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedWidget === widget.id 
                            ? 'border-indigo-500 bg-indigo-50' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => setSelectedWidget(widget.id)}
                        data-testid={`widget-item-${widget.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            {getWidgetIcon(widget.type)}
                            <span className="text-sm font-medium">{widget.title}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteWidget(widget.id);
                            }}
                            data-testid={`button-delete-${widget.id}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="text-xs text-gray-500 mt-1 capitalize">
                          {widget.type} • {widget.position.width}x{widget.position.height}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Dashboard Canvas */}
        <Card className="flex-1">
          <CardContent className="p-6">
            <div 
              ref={canvasRef}
              className="relative w-full h-full min-h-96"
              style={{ 
                backgroundColor: dashboard.layout.backgroundColor,
                backgroundImage: dashboard.layout.showGrid 
                  ? `radial-gradient(circle, #e5e7eb 1px, transparent 1px)`
                  : 'none',
                backgroundSize: dashboard.layout.showGrid 
                  ? `${dashboard.layout.gridSize}px ${dashboard.layout.gridSize}px` 
                  : 'auto'
              }}
              data-testid="dashboard-canvas"
            >
              {dashboard.widgets.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <Layout className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      {isEditing ? 'Start Building Your Dashboard' : 'No Widgets Available'}
                    </h3>
                    <p className="text-gray-500 mb-4">
                      {isEditing 
                        ? 'Add widgets to create powerful data visualizations'
                        : 'Switch to edit mode to add widgets'
                      }
                    </p>
                    {isEditing && (
                      <Button
                        onClick={() => setShowWidgetDialog(true)}
                        className="bg-indigo-600 hover:bg-indigo-700"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Your First Widget
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-12 gap-4 h-full">
                  {dashboard.widgets.map(widget => (
                    <div
                      key={widget.id}
                      className={`bg-white rounded-lg shadow-sm border transition-all ${
                        selectedWidget === widget.id && isEditing
                          ? 'border-indigo-500 shadow-md'
                          : 'border-gray-200'
                      }`}
                      style={{
                        gridColumn: `span ${widget.position.width}`,
                        gridRow: `span ${widget.position.height}`
                      }}
                      data-testid={`dashboard-widget-${widget.id}`}
                    >
                      <div className="h-full flex flex-col">
                        <div className="flex items-center justify-between p-3 border-b">
                          <h4 className="font-medium text-gray-900">{widget.title}</h4>
                          {isEditing && (
                            <div className="flex items-center space-x-1">
                              <Button variant="ghost" size="sm">
                                <Settings className="h-3 w-3" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => deleteWidget(widget.id)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 p-3">
                          {renderChart(widget)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}