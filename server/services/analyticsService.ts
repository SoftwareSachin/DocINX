import { parse } from 'csv-parse';
import type { Dataset } from "@shared/schema";

export interface ColumnMetadata {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  nullable: boolean;
  unique: boolean;
  samples: any[];
  nullCount: number;
  uniqueCount: number;
  min?: number;
  max?: number;
  mean?: number;
}

export interface Relationship {
  fromColumn: string;
  toColumn: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  confidence: number;
  description: string;
}

export interface DataStatistics {
  totalRows: number;
  totalColumns: number;
  memoryUsage: number;
  completeness: number; // percentage of non-null values
  duplicateRows: number;
  overview: string;
}

export interface ProcessedDataset {
  data: any[][];
  headers: string[];
  columns: ColumnMetadata[];
  relationships: Relationship[];
  statistics: DataStatistics;
}

export class AnalyticsService {
  async processCSV(buffer: Buffer): Promise<ProcessedDataset> {
    try {
      // Parse CSV
      const csvContent = buffer.toString('utf8').replace(/^\uFEFF/, ''); // Remove BOM
      
      const records = await new Promise<string[][]>((resolve, reject) => {
        parse(csvContent, {
          auto_parse: false,
          skip_empty_lines: true,
          trim: true,
          relax_quotes: true,
        }, (err, output) => {
          if (err) reject(err);
          else resolve(output);
        });
      });

      if (records.length === 0) {
        throw new Error('CSV file is empty');
      }

      const headers = records[0];
      const data = records.slice(1);

      if (headers.length === 0) {
        throw new Error('CSV file has no columns');
      }

      // Analyze columns
      const columns = await this.analyzeColumns(headers, data);
      
      // Detect relationships
      const relationships = await this.detectRelationships(columns, data);
      
      // Generate statistics
      const statistics = await this.generateStatistics(data, columns);

      return {
        data,
        headers,
        columns,
        relationships,
        statistics
      };
    } catch (error) {
      console.error('CSV processing error:', error);
      throw new Error(`Failed to process CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async analyzeColumns(headers: string[], data: any[][]): Promise<ColumnMetadata[]> {
    const columns: ColumnMetadata[] = [];

    for (let i = 0; i < headers.length; i++) {
      const columnData = data.map(row => row[i]).filter(val => val !== undefined && val !== null && val !== '');
      const allData = data.map(row => row[i]);
      
      const column: ColumnMetadata = {
        name: headers[i],
        type: this.inferDataType(columnData),
        nullable: allData.some(val => val === undefined || val === null || val === ''),
        unique: new Set(columnData).size === columnData.length,
        samples: columnData.slice(0, 5), // First 5 non-empty values
        nullCount: allData.length - columnData.length,
        uniqueCount: new Set(columnData).size
      };

      // Add numerical statistics if numeric
      if (column.type === 'number') {
        const numericData = columnData.map(val => parseFloat(val)).filter(val => !isNaN(val));
        if (numericData.length > 0) {
          column.min = Math.min(...numericData);
          column.max = Math.max(...numericData);
          column.mean = numericData.reduce((a, b) => a + b, 0) / numericData.length;
        }
      }

      columns.push(column);
    }

    return columns;
  }

  private inferDataType(values: any[]): 'string' | 'number' | 'date' | 'boolean' {
    if (values.length === 0) return 'string';

    let numberCount = 0;
    let dateCount = 0;
    let booleanCount = 0;

    for (const value of values.slice(0, 50)) { // Sample first 50 values
      const strValue = String(value).toLowerCase().trim();
      
      // Check boolean
      if (['true', 'false', 'yes', 'no', '1', '0', 'y', 'n'].includes(strValue)) {
        booleanCount++;
        continue;
      }

      // Check number
      if (!isNaN(Number(value)) && !isNaN(parseFloat(value))) {
        numberCount++;
        continue;
      }

      // Check date
      const dateValue = new Date(value);
      if (!isNaN(dateValue.getTime()) && String(value).length > 4) {
        dateCount++;
        continue;
      }
    }

    const sampleSize = Math.min(values.length, 50);
    const threshold = sampleSize * 0.7; // 70% threshold

    if (numberCount >= threshold) return 'number';
    if (dateCount >= threshold) return 'date';
    if (booleanCount >= threshold) return 'boolean';
    
    return 'string';
  }

  private async detectRelationships(columns: ColumnMetadata[], data: any[][]): Promise<Relationship[]> {
    const relationships: Relationship[] = [];

    // Find potential foreign key relationships
    for (let i = 0; i < columns.length; i++) {
      for (let j = i + 1; j < columns.length; j++) {
        const col1 = columns[i];
        const col2 = columns[j];

        // Skip if different types
        if (col1.type !== col2.type) continue;

        const col1Data = data.map(row => row[i]).filter(val => val !== undefined && val !== null && val !== '');
        const col2Data = data.map(row => row[j]).filter(val => val !== undefined && val !== null && val !== '');

        const intersection = new Set(col1Data.filter(val => col2Data.includes(val)));
        const unionSize = new Set([...col1Data, ...col2Data]).size;
        
        // Calculate overlap percentage
        const overlap = intersection.size / Math.min(col1Data.length, col2Data.length);

        if (overlap > 0.1) { // At least 10% overlap
          let type: 'one-to-one' | 'one-to-many' | 'many-to-many' = 'many-to-many';
          
          if (col1.unique && col2.unique) {
            type = 'one-to-one';
          } else if (col1.unique || col2.unique) {
            type = 'one-to-many';
          }

          relationships.push({
            fromColumn: col1.name,
            toColumn: col2.name,
            type,
            confidence: overlap,
            description: `Potential ${type} relationship between ${col1.name} and ${col2.name} (${(overlap * 100).toFixed(1)}% overlap)`
          });
        }
      }
    }

    // Look for ID patterns
    const idColumns = columns.filter(col => 
      col.name.toLowerCase().includes('id') || 
      col.name.toLowerCase().endsWith('_id') ||
      col.name.toLowerCase().startsWith('id_')
    );

    // Look for name/description patterns that might relate to IDs
    const nameColumns = columns.filter(col => 
      col.name.toLowerCase().includes('name') || 
      col.name.toLowerCase().includes('title') ||
      col.name.toLowerCase().includes('description')
    );

    // Create relationships between ID and name columns
    for (const idCol of idColumns) {
      for (const nameCol of nameColumns) {
        if (idCol.name !== nameCol.name) {
          relationships.push({
            fromColumn: idCol.name,
            toColumn: nameCol.name,
            type: 'one-to-many',
            confidence: 0.8,
            description: `Inferred relationship: ${idCol.name} identifies ${nameCol.name}`
          });
        }
      }
    }

    return relationships;
  }

  private async generateStatistics(data: any[][], columns: ColumnMetadata[]): Promise<DataStatistics> {
    const totalRows = data.length;
    const totalColumns = columns.length;
    
    // Calculate completeness
    let totalCells = totalRows * totalColumns;
    let filledCells = 0;
    
    for (const row of data) {
      for (const cell of row) {
        if (cell !== undefined && cell !== null && cell !== '') {
          filledCells++;
        }
      }
    }
    
    const completeness = totalCells > 0 ? (filledCells / totalCells) * 100 : 0;

    // Find duplicate rows
    const rowStrings = data.map(row => JSON.stringify(row));
    const uniqueRowStrings = new Set(rowStrings);
    const duplicateRows = rowStrings.length - uniqueRowStrings.size;

    // Estimate memory usage (rough)
    const avgRowSize = JSON.stringify(data[0] || []).length;
    const memoryUsage = avgRowSize * totalRows;

    // Generate overview
    const numericColumns = columns.filter(col => col.type === 'number').length;
    const dateColumns = columns.filter(col => col.type === 'date').length;
    const categoricalColumns = columns.filter(col => col.type === 'string').length;

    const overview = `Dataset contains ${totalRows.toLocaleString()} rows and ${totalColumns} columns. ` +
      `${numericColumns} numeric columns, ${categoricalColumns} categorical columns, ${dateColumns} date columns. ` +
      `Data completeness: ${completeness.toFixed(1)}%. ` +
      `${duplicateRows > 0 ? `Found ${duplicateRows} duplicate rows.` : 'No duplicate rows found.'}`;

    return {
      totalRows,
      totalColumns,
      memoryUsage,
      completeness,
      duplicateRows,
      overview
    };
  }

  async generateSQL(
    headers: string[],
    query: string,
    columns: ColumnMetadata[]
  ): Promise<{ sql: string; visualization: string }> {
    // This is a simplified SQL generation - in production you'd use a more sophisticated NL to SQL system
    const lowerQuery = query.toLowerCase();
    
    let sql = '';
    let visualization = 'table';

    // Detect query patterns
    if (lowerQuery.includes('top') || lowerQuery.includes('highest') || lowerQuery.includes('largest')) {
      const numberMatch = query.match(/top\s+(\d+)/i) || query.match(/(\d+)\s+top/i);
      const limit = numberMatch ? numberMatch[1] : '10';
      
      // Find the most likely column to sort by
      const numericColumns = columns.filter(col => col.type === 'number');
      const sortColumn = numericColumns.length > 0 ? numericColumns[0].name : headers[0];
      
      sql = `SELECT * FROM dataset ORDER BY ${sortColumn} DESC LIMIT ${limit}`;
      visualization = 'bar';
      
    } else if (lowerQuery.includes('count') || lowerQuery.includes('how many')) {
      // Group by most likely categorical column
      const categoricalColumns = columns.filter(col => col.type === 'string' && col.uniqueCount < 20);
      const groupColumn = categoricalColumns.length > 0 ? categoricalColumns[0].name : headers[0];
      
      sql = `SELECT ${groupColumn}, COUNT(*) as count FROM dataset GROUP BY ${groupColumn} ORDER BY count DESC`;
      visualization = 'pie';
      
    } else if (lowerQuery.includes('average') || lowerQuery.includes('mean')) {
      const numericColumns = columns.filter(col => col.type === 'number');
      if (numericColumns.length > 0) {
        const avgColumn = numericColumns[0].name;
        sql = `SELECT AVG(${avgColumn}) as average_${avgColumn} FROM dataset`;
        visualization = 'kpi';
      }
      
    } else if (lowerQuery.includes('sum') || lowerQuery.includes('total')) {
      const numericColumns = columns.filter(col => col.type === 'number');
      if (numericColumns.length > 0) {
        const sumColumn = numericColumns[0].name;
        sql = `SELECT SUM(${sumColumn}) as total_${sumColumn} FROM dataset`;
        visualization = 'kpi';
      }
      
    } else if (lowerQuery.includes('over time') || lowerQuery.includes('trend')) {
      const dateColumns = columns.filter(col => col.type === 'date');
      const numericColumns = columns.filter(col => col.type === 'number');
      
      if (dateColumns.length > 0 && numericColumns.length > 0) {
        sql = `SELECT ${dateColumns[0].name}, SUM(${numericColumns[0].name}) as value FROM dataset GROUP BY ${dateColumns[0].name} ORDER BY ${dateColumns[0].name}`;
        visualization = 'line';
      }
    } else {
      // Default: show all data
      sql = `SELECT * FROM dataset LIMIT 100`;
      visualization = 'table';
    }

    return { sql, visualization };
  }
}

export const analyticsService = new AnalyticsService();