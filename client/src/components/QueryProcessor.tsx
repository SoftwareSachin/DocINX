import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  MessageSquare, Send, Bot, User, Lightbulb, 
  BarChart3, TrendingUp, Filter, Database,
  Clock, CheckCircle, AlertCircle, Copy, Download,
  Sparkles, Zap, Target, Search, RefreshCw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface QueryResult {
  id: string;
  query: string;
  sql: string;
  result: any;
  visualizationType: string;
  timestamp: Date;
  status: 'success' | 'error' | 'processing';
  error?: string;
  executionTime?: number;
}

interface QuerySuggestion {
  text: string;
  description: string;
  icon: React.ReactNode;
  category: 'analytics' | 'trends' | 'comparison' | 'filters';
}

interface QueryProcessorProps {
  datasets: any[];
  selectedColumns: string[];
  onCreateVisualization?: (queryResult: QueryResult) => void;
}

export default function QueryProcessor({
  datasets,
  selectedColumns,
  onCreateVisualization
}: QueryProcessorProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<QueryResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [selectedResult, setSelectedResult] = useState<QueryResult | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  // Predefined query suggestions based on available data
  const querySuggestions: QuerySuggestion[] = [
    {
      text: "Show me the top 5 categories by total sales",
      description: "Find highest performing categories",
      icon: <TrendingUp className="h-4 w-4" />,
      category: 'analytics'
    },
    {
      text: "What's the monthly trend for revenue this year?",
      description: "Analyze revenue patterns over time",
      icon: <BarChart3 className="h-4 w-4" />,
      category: 'trends'
    },
    {
      text: "Compare performance between different regions",
      description: "Regional performance analysis",
      icon: <Target className="h-4 w-4" />,
      category: 'comparison'
    },
    {
      text: "Show me outliers in the data",
      description: "Identify unusual data points",
      icon: <Sparkles className="h-4 w-4" />,
      category: 'analytics'
    },
    {
      text: "Filter data where sales > 1000",
      description: "Apply custom filters to dataset",
      icon: <Filter className="h-4 w-4" />,
      category: 'filters'
    },
    {
      text: "Calculate correlation between variables",
      description: "Find relationships in your data",
      icon: <Zap className="h-4 w-4" />,
      category: 'analytics'
    }
  ];

  // Process natural language query
  const processQueryMutation = useMutation({
    mutationFn: async (queryText: string) => {
      const startTime = Date.now();
      
      // Simulate API call to process natural language query
      const response = await apiRequest('POST', '/api/query/process', {
        query: queryText,
        datasets: datasets.map(d => d.id),
        selectedColumns,
        userId: 'anonymous-user'
      });
      
      const executionTime = Date.now() - startTime;
      
      return {
        ...response,
        executionTime
      };
    },
    onSuccess: (data) => {
      const newResult: QueryResult = {
        id: `result_${Date.now()}`,
        query,
        sql: data.sql || 'SELECT * FROM dataset LIMIT 10',
        result: data.result || { data: [], rowCount: 0 },
        visualizationType: data.visualizationType || 'table',
        timestamp: new Date(),
        status: 'success',
        executionTime: data.executionTime
      };

      setResults(prev => [newResult, ...prev]);
      setQuery('');
      setIsProcessing(false);
      
      toast({
        title: "Query processed successfully",
        description: `Generated ${data.visualizationType} visualization in ${data.executionTime}ms`
      });
    },
    onError: (error: any) => {
      const errorResult: QueryResult = {
        id: `result_${Date.now()}`,
        query,
        sql: '',
        result: null,
        visualizationType: 'error',
        timestamp: new Date(),
        status: 'error',
        error: error.message || 'Failed to process query'
      };

      setResults(prev => [errorResult, ...prev]);
      setIsProcessing(false);
      
      toast({
        title: "Query processing failed",
        description: error.message || "Failed to process your query",
        variant: "destructive"
      });
    }
  });

  const handleSubmitQuery = () => {
    if (!query.trim()) {
      toast({
        title: "Empty query",
        description: "Please enter a query to process",
        variant: "destructive"
      });
      return;
    }

    if (datasets.length === 0) {
      toast({
        title: "No datasets available",
        description: "Please upload datasets first",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    setShowSuggestions(false);
    processQueryMutation.mutate(query);
  };

  const handleSuggestionClick = (suggestion: QuerySuggestion) => {
    setQuery(suggestion.text);
    setShowSuggestions(false);
    textareaRef.current?.focus();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: "Text has been copied to your clipboard"
    });
  };

  const retryQuery = (queryText: string) => {
    setQuery(queryText);
    handleSubmitQuery();
  };

  const getCategoryColor = (category: QuerySuggestion['category']) => {
    switch (category) {
      case 'analytics': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'trends': return 'bg-green-100 text-green-800 border-green-200';
      case 'comparison': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'filters': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: QueryResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'processing':
        return <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="space-y-4">
      {/* Query Input */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center space-x-2">
            <MessageSquare className="h-5 w-5" />
            <span>Natural Language Query</span>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              AI-Powered
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Ask anything about your data</label>
            <div className="relative">
              <Textarea
                ref={textareaRef}
                placeholder="e.g., 'Show me the top 5 products by sales', 'What's the monthly trend?', 'Compare regions by revenue'"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    handleSubmitQuery();
                  }
                }}
                className="min-h-20 resize-none pr-12"
                data-testid="textarea-query-input"
              />
              <Button
                size="sm"
                onClick={handleSubmitQuery}
                disabled={isProcessing || !query.trim()}
                className="absolute bottom-2 right-2 bg-indigo-600 hover:bg-indigo-700"
                data-testid="button-submit-query"
              >
                {isProcessing ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Press Ctrl+Enter to submit</span>
              <span>{datasets.length} dataset{datasets.length !== 1 ? 's' : ''} available</span>
            </div>
          </div>

          {/* Query Suggestions */}
          {showSuggestions && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-700">Query Suggestions</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSuggestions(false)}
                  data-testid="button-hide-suggestions"
                >
                  Hide
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {querySuggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    className="p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => handleSuggestionClick(suggestion)}
                    data-testid={`suggestion-${index}`}
                  >
                    <div className="flex items-start space-x-2">
                      <div className="flex-shrink-0 mt-0.5">
                        {suggestion.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 mb-1">
                          {suggestion.text}
                        </div>
                        <div className="text-xs text-gray-500 mb-2">
                          {suggestion.description}
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-xs ${getCategoryColor(suggestion.category)}`}
                        >
                          {suggestion.category}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Query Results */}
      {results.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Bot className="h-5 w-5" />
                <span>Query Results</span>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  {results.length} result{results.length !== 1 ? 's' : ''}
                </Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setResults([])}
                data-testid="button-clear-results"
              >
                Clear All
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-96">
              <div className="space-y-4 p-4">
                {results.map((result, index) => (
                  <div key={result.id}>
                    <div
                      className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                        selectedResult?.id === result.id
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedResult(result)}
                      data-testid={`result-${result.id}`}
                    >
                      {/* Result Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-start space-x-2">
                          <User className="h-4 w-4 text-gray-500 mt-1" />
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-900 mb-1">
                              {result.query}
                            </div>
                            <div className="text-xs text-gray-500">
                              {formatTimestamp(result.timestamp)}
                              {result.executionTime && ` • ${result.executionTime}ms`}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(result.status)}
                          <Badge
                            variant="outline"
                            className={
                              result.status === 'success'
                                ? 'bg-green-100 text-green-800 border-green-200'
                                : result.status === 'error'
                                ? 'bg-red-100 text-red-800 border-red-200'
                                : 'bg-blue-100 text-blue-800 border-blue-200'
                            }
                          >
                            {result.status}
                          </Badge>
                        </div>
                      </div>

                      {/* AI Response */}
                      <div className="flex items-start space-x-2 mb-3">
                        <Bot className="h-4 w-4 text-indigo-600 mt-1" />
                        <div className="flex-1">
                          {result.status === 'success' ? (
                            <div className="space-y-2">
                              <div className="text-sm text-gray-700">
                                I've generated a <strong>{result.visualizationType}</strong> visualization
                                {result.result?.rowCount && ` with ${result.result.rowCount} data points`}.
                              </div>
                              {result.sql && (
                                <div className="bg-gray-50 rounded p-2 text-xs font-mono text-gray-600">
                                  {result.sql}
                                </div>
                              )}
                            </div>
                          ) : result.status === 'error' ? (
                            <div className="text-sm text-red-600">
                              {result.error || 'An error occurred while processing your query'}
                            </div>
                          ) : (
                            <div className="text-sm text-gray-500">
                              Processing your query...
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center space-x-2">
                        {result.status === 'success' && (
                          <>
                            {onCreateVisualization && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onCreateVisualization(result);
                                }}
                                data-testid={`button-visualize-${result.id}`}
                              >
                                <BarChart3 className="h-3 w-3 mr-1" />
                                Create Chart
                              </Button>
                            )}
                            {result.sql && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyToClipboard(result.sql);
                                }}
                                data-testid={`button-copy-sql-${result.id}`}
                              >
                                <Copy className="h-3 w-3 mr-1" />
                                Copy SQL
                              </Button>
                            )}
                          </>
                        )}
                        
                        {result.status === 'error' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              retryQuery(result.query);
                            }}
                            data-testid={`button-retry-${result.id}`}
                          >
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Retry
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(result.query);
                          }}
                          data-testid={`button-copy-query-${result.id}`}
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Copy Query
                        </Button>
                      </div>
                    </div>
                    {index < results.length - 1 && <Separator className="my-4" />}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Detailed Result Dialog */}
      {selectedResult && (
        <Dialog 
          open={!!selectedResult} 
          onOpenChange={() => setSelectedResult(null)}
        >
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Query Result Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Original Query</label>
                <div className="mt-1 p-3 bg-gray-50 rounded text-sm">
                  {selectedResult.query}
                </div>
              </div>
              
              {selectedResult.sql && (
                <div>
                  <label className="text-sm font-medium">Generated SQL</label>
                  <div className="mt-1 p-3 bg-gray-50 rounded text-sm font-mono">
                    {selectedResult.sql}
                  </div>
                </div>
              )}
              
              {selectedResult.result && (
                <div>
                  <label className="text-sm font-medium">Result Preview</label>
                  <div className="mt-1 p-3 bg-gray-50 rounded text-sm">
                    <pre className="whitespace-pre-wrap">
                      {JSON.stringify(selectedResult.result, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}