import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, Filter, Database, Type, Hash, Calendar, 
  ToggleLeft, CheckSquare, Square, Eye, EyeOff,
  TrendingUp, BarChart3, PieChart, Target
} from 'lucide-react';

interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  unique: boolean;
  primaryKey?: boolean;
  foreignKey?: boolean;
  samples?: string[];
  statistics?: {
    count: number;
    uniqueCount: number;
    nullCount: number;
    min?: any;
    max?: any;
    avg?: number;
    distribution?: { [key: string]: number };
  };
}

interface ColumnGroup {
  name: string;
  columns: ColumnInfo[];
  datasetId: string;
}

interface ColumnSelectorProps {
  columnGroups: ColumnGroup[];
  selectedColumns: string[];
  onSelectionChange: (columns: string[]) => void;
  onCreateDashboard?: (selectedColumns: string[]) => void;
  showAnalytics?: boolean;
}

export default function ColumnSelector({
  columnGroups,
  selectedColumns,
  onSelectionChange,
  onCreateDashboard,
  showAnalytics = true
}: ColumnSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterByType, setFilterByType] = useState<string>('all');
  const [showOnlySelected, setShowOnlySelected] = useState(false);

  const allColumns = useMemo(() => {
    return columnGroups.flatMap(group => 
      group.columns.map(col => ({ ...col, groupName: group.name, datasetId: group.datasetId }))
    );
  }, [columnGroups]);

  const filteredColumns = useMemo(() => {
    return allColumns.filter(column => {
      const matchesSearch = column.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterByType === 'all' || column.type.toLowerCase().includes(filterByType.toLowerCase());
      const matchesSelected = !showOnlySelected || selectedColumns.includes(column.name);
      
      return matchesSearch && matchesType && matchesSelected;
    });
  }, [allColumns, searchTerm, filterByType, showOnlySelected, selectedColumns]);

  const columnTypes = useMemo(() => {
    const types = new Set(allColumns.map(col => col.type));
    return Array.from(types).sort();
  }, [allColumns]);

  const getTypeIcon = (type: string) => {
    const lowerType = type.toLowerCase();
    if (lowerType.includes('int') || lowerType.includes('number')) return <Hash className="h-4 w-4" />;
    if (lowerType.includes('date') || lowerType.includes('time')) return <Calendar className="h-4 w-4" />;
    if (lowerType.includes('bool')) return <ToggleLeft className="h-4 w-4" />;
    return <Type className="h-4 w-4" />;
  };

  const getTypeColor = (type: string) => {
    const lowerType = type.toLowerCase();
    if (lowerType.includes('int') || lowerType.includes('number')) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (lowerType.includes('date') || lowerType.includes('time')) return 'bg-green-100 text-green-800 border-green-200';
    if (lowerType.includes('bool')) return 'bg-purple-100 text-purple-800 border-purple-200';
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const isColumnSelected = (columnName: string) => selectedColumns.includes(columnName);

  const toggleColumn = (columnName: string) => {
    const newSelection = isColumnSelected(columnName)
      ? selectedColumns.filter(col => col !== columnName)
      : [...selectedColumns, columnName];
    onSelectionChange(newSelection);
  };

  const selectAllVisible = () => {
    const visibleColumnNames = filteredColumns.map(col => col.name);
    const newSelection = [...new Set([...selectedColumns, ...visibleColumnNames])];
    onSelectionChange(newSelection);
  };

  const deselectAllVisible = () => {
    const visibleColumnNames = new Set(filteredColumns.map(col => col.name));
    const newSelection = selectedColumns.filter(col => !visibleColumnNames.has(col));
    onSelectionChange(newSelection);
  };

  const clearSelection = () => {
    onSelectionChange([]);
  };

  const getVisualizationSuggestion = (column: ColumnInfo) => {
    const type = column.type.toLowerCase();
    if (type.includes('date') || type.includes('time')) return { icon: <TrendingUp className="h-3 w-3" />, text: 'Time Series' };
    if (type.includes('int') || type.includes('number')) return { icon: <BarChart3 className="h-3 w-3" />, text: 'Bar Chart' };
    if (column.statistics && column.statistics.uniqueCount < 10) return { icon: <PieChart className="h-3 w-3" />, text: 'Pie Chart' };
    return { icon: <Target className="h-3 w-3" />, text: 'KPI' };
  };

  const renderColumnCard = (column: ColumnInfo & { groupName: string; datasetId: string }) => {
    const isSelected = isColumnSelected(column.name);
    const suggestion = getVisualizationSuggestion(column);

    return (
      <Card 
        key={`${column.datasetId}-${column.name}`}
        className={`cursor-pointer transition-all hover:shadow-md ${
          isSelected ? 'ring-2 ring-indigo-500 bg-indigo-50' : ''
        }`}
        onClick={() => toggleColumn(column.name)}
        data-testid={`column-card-${column.name}`}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center space-x-2">
              <Checkbox 
                checked={isSelected}
                onChange={() => {}} // Handled by card click
                className="pointer-events-none"
              />
              <div className="flex items-center space-x-1">
                {getTypeIcon(column.type)}
                <span className="font-medium text-gray-900">{column.name}</span>
              </div>
            </div>
            <div className="flex items-center space-x-1">
              {column.primaryKey && <Badge variant="outline" className="text-xs px-1 py-0">PK</Badge>}
              {column.foreignKey && <Badge variant="outline" className="text-xs px-1 py-0">FK</Badge>}
              {column.unique && <Badge variant="outline" className="text-xs px-1 py-0">UK</Badge>}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className={getTypeColor(column.type)}>
                {column.type}
              </Badge>
              <span className="text-xs text-gray-500">{column.groupName}</span>
            </div>

            {showAnalytics && column.statistics && (
              <div className="space-y-1">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500">Count:</span>
                    <span className="ml-1 font-medium">{column.statistics.count.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Unique:</span>
                    <span className="ml-1 font-medium">{column.statistics.uniqueCount.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Nulls:</span>
                    <span className="ml-1 font-medium">{column.statistics.nullCount.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Complete:</span>
                    <span className="ml-1 font-medium">
                      {((1 - column.statistics.nullCount / column.statistics.count) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t">
                  <div className="flex items-center space-x-1 text-xs text-gray-600">
                    {suggestion.icon}
                    <span>Suggested: {suggestion.text}</span>
                  </div>
                </div>
              </div>
            )}

            {column.samples && column.samples.length > 0 && (
              <div className="pt-1 border-t">
                <div className="text-xs text-gray-500 mb-1">Sample values:</div>
                <div className="text-xs font-mono text-gray-600 space-y-0.5">
                  {column.samples.slice(0, 3).map((sample, index) => (
                    <div key={index} className="truncate">
                      {sample || '<null>'}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header & Controls */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Database className="h-5 w-5 text-gray-500" />
            <h3 className="text-lg font-semibold text-gray-900">Column Selection</h3>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              {selectedColumns.length} selected
            </Badge>
          </div>
          
          <div className="flex items-center space-x-2">
            {selectedColumns.length > 0 && onCreateDashboard && (
              <Button
                onClick={() => onCreateDashboard(selectedColumns)}
                className="bg-indigo-600 hover:bg-indigo-700"
                data-testid="button-create-dashboard"
              >
                <BarChart3 className="h-4 w-4 mr-1" />
                Create Dashboard
              </Button>
            )}
            <Button
              variant="outline"
              onClick={clearSelection}
              disabled={selectedColumns.length === 0}
              data-testid="button-clear-selection"
            >
              Clear Selection
            </Button>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search columns..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid="input-search-columns"
            />
          </div>
          
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
            value={filterByType}
            onChange={(e) => setFilterByType(e.target.value)}
            data-testid="select-filter-type"
          >
            <option value="all">All Types</option>
            {columnTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowOnlySelected(!showOnlySelected)}
              className={showOnlySelected ? 'bg-blue-50 text-blue-700' : ''}
              data-testid="button-toggle-selected"
            >
              {showOnlySelected ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              <span className="ml-1">Selected Only</span>
            </Button>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={selectAllVisible}
              data-testid="button-select-all"
            >
              <CheckSquare className="h-4 w-4 mr-1" />
              Select All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={deselectAllVisible}
              data-testid="button-deselect-all"
            >
              <Square className="h-4 w-4 mr-1" />
              Deselect All
            </Button>
          </div>
        </div>
      </div>

      {/* Results Summary */}
      <div className="flex items-center justify-between text-sm text-gray-600 py-2 border-t border-b">
        <span>
          Showing {filteredColumns.length} of {allColumns.length} columns
          {searchTerm && ` matching "${searchTerm}"`}
          {filterByType !== 'all' && ` with type "${filterByType}"`}
        </span>
        <span>
          {selectedColumns.length} column{selectedColumns.length !== 1 ? 's' : ''} selected
        </span>
      </div>

      {/* Columns Grid */}
      <ScrollArea className="h-96">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-1">
          {filteredColumns.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <Filter className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No columns found</h3>
              <p className="text-gray-500">Try adjusting your search or filter criteria</p>
            </div>
          ) : (
            filteredColumns.map(renderColumnCard)
          )}
        </div>
      </ScrollArea>

      {/* Selected Columns Summary */}
      {selectedColumns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Selected Columns Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {selectedColumns.map(columnName => {
                  const column = allColumns.find(col => col.name === columnName);
                  return (
                    <Badge
                      key={columnName}
                      variant="outline"
                      className="bg-indigo-50 text-indigo-700 border-indigo-200 cursor-pointer hover:bg-indigo-100"
                      onClick={() => toggleColumn(columnName)}
                      data-testid={`selected-column-${columnName}`}
                    >
                      {getTypeIcon(column?.type || 'TEXT')}
                      <span className="ml-1">{columnName}</span>
                    </Badge>
                  );
                })}
              </div>
              
              <Separator />
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Total Columns:</span>
                  <span className="ml-2 font-medium">{selectedColumns.length}</span>
                </div>
                <div>
                  <span className="text-gray-500">Data Sources:</span>
                  <span className="ml-2 font-medium">
                    {new Set(selectedColumns.map(col => {
                      const column = allColumns.find(c => c.name === col);
                      return column?.groupName;
                    }).filter(Boolean)).size}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Numeric Columns:</span>
                  <span className="ml-2 font-medium">
                    {selectedColumns.filter(col => {
                      const column = allColumns.find(c => c.name === col);
                      return column?.type.toLowerCase().includes('int') || column?.type.toLowerCase().includes('number');
                    }).length}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Date Columns:</span>
                  <span className="ml-2 font-medium">
                    {selectedColumns.filter(col => {
                      const column = allColumns.find(c => c.name === col);
                      return column?.type.toLowerCase().includes('date') || column?.type.toLowerCase().includes('time');
                    }).length}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}