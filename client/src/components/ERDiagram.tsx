import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Download, Maximize2, RotateCcw, GitBranch } from 'lucide-react';
import mermaid from 'mermaid';

interface Column {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey?: boolean;
  foreignKey?: boolean;
  unique?: boolean;
}

interface Entity {
  name: string;
  columns: Column[];
}

interface ERDiagramProps {
  datasets: any[];
  selectedColumns?: string[];
  onColumnSelect?: (columns: string[]) => void;
}

export default function ERDiagram({ datasets, selectedColumns = [], onColumnSelect }: ERDiagramProps) {
  const diagramRef = useRef<HTMLDivElement>(null);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [diagramCode, setDiagramCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      fontSize: 14,
      themeVariables: {
        primaryColor: '#4f46e5',
        primaryTextColor: '#1f2937',
        primaryBorderColor: '#6366f1',
        lineColor: '#6b7280',
        sectionBkgColor: '#f9fafb',
        altSectionBkgColor: '#f3f4f6',
        gridColor: '#e5e7eb',
        tertiaryColor: '#fafafa'
      }
    });
  }, []);

  useEffect(() => {
    if (datasets.length > 0) {
      generateEntitiesFromDatasets();
    }
  }, [datasets]);

  useEffect(() => {
    if (entities.length > 0) {
      renderDiagram();
    }
  }, [entities]);

  const generateEntitiesFromDatasets = () => {
    setIsLoading(true);
    
    const generatedEntities: Entity[] = datasets.map(dataset => {
      if (!dataset.columns || !Array.isArray(dataset.columns)) {
        return {
          name: dataset.name.replace(/[^a-zA-Z0-9]/g, '_'),
          columns: [
            { name: 'id', type: 'INTEGER', nullable: false, primaryKey: true },
            { name: 'data', type: 'TEXT', nullable: true }
          ]
        };
      }

      const columns: Column[] = dataset.columns.map((col: any, index: number) => ({
        name: col.name || `column_${index}`,
        type: inferDataType(col.type || col.dataType || 'TEXT'),
        nullable: col.nullable !== false,
        primaryKey: index === 0 || col.name?.toLowerCase().includes('id'),
        unique: col.unique || false
      }));

      return {
        name: dataset.name.replace(/[^a-zA-Z0-9]/g, '_'),
        columns
      };
    });

    setEntities(generatedEntities);
    setIsLoading(false);
  };

  const inferDataType = (type: string): string => {
    const lowerType = type.toLowerCase();
    if (lowerType.includes('int') || lowerType.includes('number')) return 'INTEGER';
    if (lowerType.includes('decimal') || lowerType.includes('float')) return 'DECIMAL';
    if (lowerType.includes('date')) return 'DATE';
    if (lowerType.includes('bool')) return 'BOOLEAN';
    if (lowerType.includes('json')) return 'JSON';
    return 'VARCHAR(255)';
  };

  const generateMermaidCode = (): string => {
    let code = 'erDiagram\n';
    
    entities.forEach(entity => {
      code += `    ${entity.name} {\n`;
      entity.columns.forEach(column => {
        let typeDeclaration = `${column.type} ${column.name}`;
        if (column.primaryKey) typeDeclaration += ' PK';
        if (column.foreignKey) typeDeclaration += ' FK';
        if (column.unique) typeDeclaration += ' UK';
        if (!column.nullable) typeDeclaration += ' "NOT NULL"';
        code += `        ${typeDeclaration}\n`;
      });
      code += '    }\n\n';
    });

    // Generate relationships based on naming conventions
    entities.forEach(entity => {
      entity.columns.forEach(column => {
        if (column.name.toLowerCase().endsWith('_id') && !column.primaryKey) {
          const referencedEntity = column.name.replace(/_id$/, '');
          const targetEntity = entities.find(e => 
            e.name.toLowerCase().includes(referencedEntity.toLowerCase())
          );
          if (targetEntity && targetEntity.name !== entity.name) {
            code += `    ${targetEntity.name} ||--o{ ${entity.name} : has\n`;
          }
        }
      });
    });

    return code;
  };

  const renderDiagram = async () => {
    if (!diagramRef.current || entities.length === 0) return;

    try {
      const code = generateMermaidCode();
      setDiagramCode(code);
      
      const diagramId = `er-diagram-${Date.now()}`;
      
      diagramRef.current.innerHTML = '';
      
      const { svg } = await mermaid.render(diagramId, code);
      diagramRef.current.innerHTML = svg;
      
      // Add click handlers for interactive column selection
      const elements = diagramRef.current.querySelectorAll('.er-attributeBoxEven, .er-attributeBoxOdd');
      elements.forEach((element, index) => {
        element.addEventListener('click', () => {
          const columnName = element.textContent?.trim() || '';
          if (columnName && onColumnSelect) {
            const newSelection = selectedColumns.includes(columnName)
              ? selectedColumns.filter(col => col !== columnName)
              : [...selectedColumns, columnName];
            onColumnSelect(newSelection);
          }
        });
        
        // Highlight selected columns
        if (selectedColumns.some(col => element.textContent?.includes(col))) {
          element.setAttribute('style', 'fill: #dbeafe; stroke: #3b82f6; stroke-width: 2px;');
        }
      });
    } catch (error) {
      console.error('Error rendering ER diagram:', error);
      if (diagramRef.current) {
        diagramRef.current.innerHTML = `
          <div class="text-center py-8">
            <p class="text-red-600">Error rendering diagram: ${error}</p>
          </div>
        `;
      }
    }
  };

  const downloadDiagram = () => {
    const svg = diagramRef.current?.querySelector('svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      
      const link = document.createElement('a');
      link.download = 'entity-relationship-diagram.png';
      link.href = canvas.toDataURL();
      link.click();
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  const regenerateDiagram = () => {
    generateEntitiesFromDatasets();
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <GitBranch className="h-5 w-5 text-gray-500" />
          <h3 className="text-lg font-semibold text-gray-900">Entity Relationship Diagram</h3>
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            {entities.length} entit{entities.length !== 1 ? 'ies' : 'y'}
          </Badge>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={regenerateDiagram}
            disabled={isLoading}
            data-testid="button-regenerate-erd"
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            {isLoading ? 'Generating...' : 'Regenerate'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={downloadDiagram}
            data-testid="button-download-erd"
          >
            <Download className="h-4 w-4 mr-1" />
            Download
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Entity List */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Entities & Columns</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-80">
              <div className="space-y-2 p-4">
                {entities.map((entity, entityIndex) => (
                  <div key={entityIndex} className="space-y-1">
                    <div className="font-medium text-sm text-gray-900">{entity.name}</div>
                    <div className="space-y-1 pl-2">
                      {entity.columns.map((column, columnIndex) => (
                        <div
                          key={columnIndex}
                          className={`text-xs p-1 rounded cursor-pointer transition-colors ${
                            selectedColumns.includes(column.name)
                              ? 'bg-blue-100 text-blue-800'
                              : 'text-gray-600 hover:bg-gray-100'
                          }`}
                          onClick={() => {
                            if (onColumnSelect) {
                              const newSelection = selectedColumns.includes(column.name)
                                ? selectedColumns.filter(col => col !== column.name)
                                : [...selectedColumns, column.name];
                              onColumnSelect(newSelection);
                            }
                          }}
                          data-testid={`column-${column.name}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono">{column.name}</span>
                            <div className="flex items-center space-x-1">
                              {column.primaryKey && <Badge variant="outline" className="text-xs px-1 py-0">PK</Badge>}
                              {column.foreignKey && <Badge variant="outline" className="text-xs px-1 py-0">FK</Badge>}
                              {column.unique && <Badge variant="outline" className="text-xs px-1 py-0">UK</Badge>}
                            </div>
                          </div>
                          <div className="text-xs text-gray-500 font-mono">{column.type}</div>
                        </div>
                      ))}
                    </div>
                    {entityIndex < entities.length - 1 && <Separator className="my-2" />}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Diagram Display */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center">
              Relationship Diagram
              <Button variant="ghost" size="sm" className="ml-auto">
                <Maximize2 className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg bg-white p-4 min-h-96">
              {isLoading ? (
                <div className="flex items-center justify-center h-96">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div>
                    <p className="text-sm text-gray-500">Generating entity relationship diagram...</p>
                  </div>
                </div>
              ) : entities.length === 0 ? (
                <div className="flex items-center justify-center h-96">
                  <div className="text-center">
                    <GitBranch className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">No data available to generate diagram</p>
                    <p className="text-sm text-gray-400">Upload datasets with column information</p>
                  </div>
                </div>
              ) : (
                <div 
                  ref={diagramRef} 
                  className="w-full h-full min-h-96 overflow-auto"
                  data-testid="er-diagram-container"
                />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Diagram Code (for debugging) */}
      {diagramCode && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Mermaid Code</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-gray-50 p-3 rounded overflow-auto">
              <code>{diagramCode}</code>
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}