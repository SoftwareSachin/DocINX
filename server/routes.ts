import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage";
// Import HTTP client for communicating with Python AI service
import axios from 'axios';
import { z } from "zod";

// Configuration for Python AI service
const PYTHON_AI_SERVICE_URL = process.env.PYTHON_AI_SERVICE_URL || 'http://localhost:8000';

// Document processing with proper text extraction
// Note: Using dynamic imports to avoid initialization issues

// Helper functions for document processing
async function processDocumentAsync(documentId: string, buffer: Buffer): Promise<void> {
  try {
    // Get document to check file type
    const document = await storage.getDocument(documentId);
    let extractedText = '';
    
    if (!document) {
      throw new Error('Document not found');
    }
    
    console.log(`Processing document: ${document.filename} (${document.mimeType})`);
    console.log(`Buffer size: ${buffer.length} bytes`);
    
    // Update status to processing
    await storage.updateDocument(documentId, { 
      status: 'processing',
      errorMessage: null 
    });
    
    switch (document.mimeType) {
      case 'application/pdf':
        console.log('Extracting text from PDF...');
        try {
          // Use pdf-parse for reliable Node.js PDF text extraction
          const pdfParse = await import("pdf-parse");
          
          const pdfData = await pdfParse.default(buffer, {
            max: 0, // Parse all pages
          });
          
          extractedText = pdfData.text || '';
          console.log(`PDF loaded successfully, ${pdfData.numpages} pages`);
          console.log(`Extracted ${extractedText.length} characters from PDF`);
          
          if (extractedText.length === 0) {
            console.warn('PDF text extraction returned empty result');
            extractedText = 'PDF processed but no text content was extracted. This may be a scanned PDF or contain only images.';
          }
        } catch (pdfError) {
          console.error('PDF parsing error:', pdfError);
          throw new Error(`Failed to parse PDF: ${pdfError instanceof Error ? pdfError.message : 'Unknown error'}`);
        }
        break;
        
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        console.log('Extracting text from DOCX...');
        try {
          const mammoth = await import("mammoth");
          const docxResult = await mammoth.extractRawText({ buffer });
          extractedText = docxResult.value;
          console.log(`Extracted ${extractedText.length} characters from DOCX`);
        } catch (docxError) {
          console.error('DOCX parsing error:', docxError);
          throw new Error(`Failed to parse DOCX: ${docxError instanceof Error ? docxError.message : 'Unknown error'}`);
        }
        break;
        
      case 'text/plain':
        console.log('Processing plain text file...');
        extractedText = buffer.toString('utf8');
        break;
        
      case 'text/csv':
      case 'application/csv':
      case 'application/vnd.ms-excel':
        console.log('Processing CSV file...');
        try {
          // Use robust CSV parser
          const { parse } = await import('csv-parse');
          const csvContent = buffer.toString('utf8');
          
          // Remove BOM if present
          const cleanCsvContent = csvContent.replace(/^\uFEFF/, '');
          
          const records = await new Promise<string[][]>((resolve, reject) => {
            parse(cleanCsvContent, {
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
            extractedText = 'Empty CSV file';
            break;
          }
          
          // First row as headers
          const headers = records[0];
          const dataRows = records.slice(1);
          
          // Convert each row to readable text blocks
          const textBlocks = dataRows.map((row, index) => {
            const rowText = headers.map((header, i) => 
              `${header}: ${row[i] || 'N/A'}`
            ).join(', ');
            return `Row ${index + 1}: ${rowText}`;
          });
          
          extractedText = `CSV Data Summary:\nHeaders: ${headers.join(', ')}\nTotal Rows: ${dataRows.length}\n\nData:\n${textBlocks.join('\n')}`;
          console.log(`Extracted ${extractedText.length} characters from CSV with ${dataRows.length} rows`);
        } catch (csvError) {
          console.error('CSV parsing error:', csvError);
          throw new Error(`Failed to parse CSV: ${csvError instanceof Error ? csvError.message : 'Unknown error'}`);
        }
        break;
        
      default:
        throw new Error(`Unsupported file type: ${document.mimeType}`);
    }
    
    // Remove global truncation - let chunking handle large content properly
    // Large documents should be chunked, not globally truncated to preserve full content for embeddings
    
    // Generate embeddings using our multi-AI service
    console.log('Generating embeddings for document chunks...');
    try {
      const { multiAIService } = await import('./services/multiAIService');
      
      // Simple chunking for embedding generation
      const chunkSize = 500;
      const chunks = [];
      for (let i = 0; i < extractedText.length; i += chunkSize) {
        const chunk = extractedText.slice(i, i + chunkSize);
        if (chunk.trim()) {
          chunks.push({
            content: chunk.trim(),
            charStart: i,
            charEnd: Math.min(i + chunkSize, extractedText.length)
          });
        }
      }
      
      console.log(`Creating ${chunks.length} chunks for embedding`);
      
      // Generate embeddings for chunks
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        try {
          const embedding = await multiAIService.generateEmbeddings(chunk.content);
          
          await storage.createChunk({
            documentId,
            chunkIndex: i,
            content: chunk.content,
            charStart: chunk.charStart,
            charEnd: chunk.charEnd,
            embedding,
          });
          
          console.log(`Created chunk ${i + 1}/${chunks.length}`);
        } catch (embeddingError) {
          console.warn(`Failed to generate embedding for chunk ${i}:`, embeddingError);
          // Continue with other chunks even if one fails
        }
      }
    } catch (embeddingError) {
      console.warn('Embedding generation failed, but continuing with text extraction:', embeddingError);
    }
    
    await storage.updateDocument(documentId, { 
      status: 'ready', 
      extractedText: extractedText.trim(),
      errorMessage: null 
    });
    
    console.log(`Document ${documentId} processed successfully. Text length: ${extractedText.length}`);
    
  } catch (error) {
    console.error('Failed to process document:', error);
    await storage.updateDocument(documentId, { 
      status: 'failed', 
      errorMessage: error instanceof Error ? error.message : 'Document processing failed' 
    });
  }
}

async function reprocessDocumentAsync(documentId: string): Promise<void> {
  try {
    await storage.updateDocument(documentId, { status: 'processing' });
    
    // Note: For reprocessing, we don't have the original buffer, so this is a placeholder
    // In a real implementation, you'd either:
    // 1. Store the original file in cloud storage (S3, etc.) and re-download it
    // 2. Call the Python AI service to reprocess from stored file
    // 3. Keep the original buffer in memory/cache temporarily
    
    console.log('Reprocessing document - marking as ready (file content not available for re-extraction)');
    
    setTimeout(async () => {
      await storage.updateDocument(documentId, { 
        status: 'ready',
        errorMessage: 'Reprocessing completed - original file content not available for re-extraction. Please re-upload for full text extraction.' 
      });
    }, 1000);
  } catch (error) {
    console.error('Failed to reprocess document:', error);
    await storage.updateDocument(documentId, { 
      status: 'failed', 
      errorMessage: 'Reprocessing failed' 
    });
  }
}

// Import Gemini AI service
import { generateChatResponse } from "./services/geminiService";

async function processChatQuery(sessionId: string, query: string, userId: string): Promise<any> {
  try {
    // Get all documents for context (simple RAG implementation)
    const documents = await storage.getAllDocuments();
    let documentContext = '';
    
    // Combine extracted text from all ready documents
    if (documents && documents.length > 0) {
      const readyDocs = documents.filter(doc => doc.status === 'ready' && doc.extractedText);
      if (readyDocs.length === 0) {
        console.log('No documents with extracted text found. User needs to re-upload documents for proper processing.');
      }
      documentContext = readyDocs.map(doc => `[${doc.title}]\n${doc.extractedText}`).join('\n\n');
    }
    
    // Generate AI response using Gemini
    const aiAnswer = await generateChatResponse(query, documentContext);
    
    const response = {
      answer: aiAnswer,
      sources: documents.filter(doc => doc.status === 'ready').map(doc => ({
        title: doc.title,
        id: doc.id
      }))
    };
    
    // Save the message to database
    await storage.createChatMessage({
      sessionId,
      role: 'user',
      content: query
    });
    
    await storage.createChatMessage({
      sessionId,
      role: 'assistant', 
      content: response.answer
    });
    
    return response;
  } catch (error) {
    console.error('Failed to process chat query:', error);
    return {
      answer: "Sorry, I'm experiencing technical difficulties. Please try again later.",
      sources: []
    };
  }
}
import { randomUUID } from "crypto";
import { db } from "./db";
import { chunks, documents } from "@shared/schema";
import { eq, and, sql, isNotNull } from "drizzle-orm";

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 10, // Max 10 files per upload
  },
  fileFilter: (req, file, cb) => {
    console.log(`File upload - Original name: ${file.originalname}, MIME type: ${file.mimetype}`);
    
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "text/csv",
      "application/csv",
      "application/vnd.ms-excel"
    ];
    
    // Check by MIME type and file extension for better CSV support
    const fileExtension = file.originalname.toLowerCase().split('.').pop();
    const isValidMimeType = allowedTypes.includes(file.mimetype);
    const isValidExtension = ['pdf', 'docx', 'txt', 'csv'].includes(fileExtension || '');
    const isCsvFile = fileExtension === 'csv' || file.mimetype.includes('csv') || file.mimetype === 'application/vnd.ms-excel';
    
    if (isValidMimeType || (isValidExtension && isCsvFile)) {
      cb(null, true);
    } else {
      console.log(`Rejected file - MIME: ${file.mimetype}, Extension: ${fileExtension} for file: ${file.originalname}`);
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

const querySchema = z.object({
  query: z.string().min(1),
  sessionId: z.string().nullable().optional(),
});

export async function registerRoutes(app: Express): Promise<Server> {
  // No authentication needed

  // Proxy routes to Python FastAPI service (DocINX requirement: FastAPI as primary backend)
  const PYTHON_API_URL = process.env.PYTHON_AI_SERVICE_URL || 'http://localhost:8000';

  // Document routes - proxy to Python
  app.post('/api/documents/upload', upload.array('files'), async (req: any, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      // Create FormData to send to Python FastAPI
      const formData = new FormData();
      files.forEach(file => {
        const blob = new Blob([file.buffer], { type: file.mimetype });
        formData.append('files', blob, file.originalname);
      });
      formData.append('user_id', 'anonymous-user');

      // Proxy to Python FastAPI service
      const response = await fetch(`${PYTHON_API_URL}/api/documents/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Python API error: ${response.status} - ${error}`);
      }

      const result = await response.json();
      res.json(result);
    } catch (error) {
      console.error("Error proxying upload to Python API:", error);
      res.status(500).json({ message: "Failed to upload files" });
    }
  });

  app.get('/api/documents', async (req: any, res) => {
    try {
      // Proxy to Python FastAPI service
      const response = await fetch(`${PYTHON_API_URL}/api/documents?user_id=anonymous-user`);
      
      if (!response.ok) {
        throw new Error(`Python API error: ${response.status}`);
      }

      const documents = await response.json();
      res.json(documents);
    } catch (error) {
      console.error("Error proxying documents request:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  app.get('/api/documents/:id', async (req: any, res) => {
    try {
      const { id } = req.params;
      
      const document = await storage.getDocument(id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      res.json(document);
    } catch (error) {
      console.error("Error fetching document:", error);
      res.status(500).json({ message: "Failed to fetch document" });
    }
  });

  app.post('/api/documents/:id/reprocess', async (req: any, res) => {
    try {
      const { id } = req.params;
      
      const document = await storage.getDocument(id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Reprocess document asynchronously via Python AI service
      reprocessDocumentAsync(id).catch(error => {
        console.error(`Error reprocessing document ${id}:`, error);
      });

      res.json({ message: "Document reprocessing started" });
    } catch (error) {
      console.error("Error reprocessing document:", error);
      res.status(500).json({ message: "Failed to reprocess document" });
    }
  });

  app.delete('/api/documents/:id', async (req: any, res) => {
    try {
      const { id } = req.params;
      
      const document = await storage.getDocument(id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      await storage.deleteDocument(id);
      res.json({ message: "Document deleted successfully" });
    } catch (error) {
      console.error("Error deleting document:", error);
      res.status(500).json({ message: "Failed to delete document" });
    }
  });

  // Chat routes
  app.post('/api/chat/query', async (req: any, res) => {
    try {
      const { query, sessionId } = querySchema.parse(req.body);
      
      // Proxy to Python FastAPI service
      const response = await fetch(`${PYTHON_API_URL}/api/chat/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          session_id: sessionId,
          user_id: 'anonymous-user'
        }),
      });

      if (!response.ok) {
        throw new Error(`Python API error: ${response.status}`);
      }

      const result = await response.json();
      res.json(result);
    } catch (error) {
      console.error("Error proxying chat query:", error);
      res.status(500).json({ message: "Failed to process query" });
    }
  });

  app.get('/api/chat/sessions', async (req: any, res) => {
    try {
      const userId = 'anonymous-user';
      const sessions = await storage.getChatSessionsByUser(userId);
      res.json(sessions);
    } catch (error) {
      console.error("Error fetching chat sessions:", error);
      res.status(500).json({ message: "Failed to fetch chat sessions" });
    }
  });

  app.get('/api/chat/sessions/:id/messages', async (req: any, res) => {
    try {
      const { id } = req.params;
      
      const session = await storage.getChatSession(id);
      if (!session) {
        return res.status(404).json({ message: "Chat session not found" });
      }

      const messages = await storage.getChatMessages(id);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching chat messages:", error);
      res.status(500).json({ message: "Failed to fetch chat messages" });
    }
  });

  // Stats and dashboard routes
  app.get('/api/stats/dashboard', async (req: any, res) => {
    try {
      // Proxy to Python FastAPI service
      const response = await fetch(`${PYTHON_API_URL}/api/stats/dashboard?user_id=anonymous-user`);
      
      if (!response.ok) {
        throw new Error(`Python API error: ${response.status}`);
      }

      const stats = await response.json();
      res.json(stats);
    } catch (error) {
      console.error("Error proxying stats request:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Helper function for admin statistics
  async function getAdminStats(documentStats: any) {
    try {
      // Calculate real statistics from database
      const embeddingsResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(chunks)
        .then(results => results[0]);

      const storageResult = await db
        .select({ total: sql<number>`COALESCE(SUM(${documents.fileSize}), 0)` })
        .from(documents)
        .then(results => results[0]);

      const avgTimeResult = await db
        .select({ 
          avgMinutes: sql<number>`COALESCE(AVG(EXTRACT(EPOCH FROM (${documents.processedAt} - ${documents.uploadedAt})) / 60), 0)` 
        })
        .from(documents)
        .where(and(
          eq(documents.status, 'ready'),
          isNotNull(documents.processedAt)
        ))
        .then(results => results[0]);

      // Simple health check - try to query chunks table
      let vectorDbHealth = 'unknown';
      try {
        await db.select({ count: sql<number>`count(*)` }).from(chunks).limit(1);
        vectorDbHealth = 'healthy';
      } catch (error) {
        console.error('Vector DB health check failed:', error);
        vectorDbHealth = 'unhealthy';
      }

      const storageUsedGB = Math.round((storageResult?.total || 0) / (1024 * 1024 * 1024) * 100) / 100;
      const avgTime = Math.round(avgTimeResult?.avgMinutes || 0);

      return {
        documentsProcessedToday: documentStats.ready,
        failedProcessing: documentStats.failed,
        totalEmbeddings: embeddingsResult?.count || 0,
        avgProcessingTime: `${avgTime} min`,
        vectorDbHealth,
        storageUsed: `${storageUsedGB} GB`,
        storageLimit: '100 GB', // This would be configurable in production
      };
    } catch (error) {
      console.error("Error getting admin stats:", error);
      return {};
    }
  }

  // Admin routes (no auth required)
  app.get('/api/admin/users', async (req: any, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.patch('/api/admin/users/:id/role', async (req: any, res) => {
    try {
      const { id } = req.params;
      const { role } = req.body;

      if (!['admin', 'user'].includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }

      const updatedUser = await storage.updateUserRole(id, role);
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ message: "Failed to update user role" });
    }
  });

  // Analytics routes
  const analyticsService = (await import("./services/analyticsService")).analyticsService;

  // Dataset routes
  app.post('/api/datasets/upload', upload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file provided' });
      }

      const userId = req.query.user_id || 'anonymous-user';
      const { name, description } = req.body;

      // Validate file type
      if (!['text/csv', 'application/csv', 'application/vnd.ms-excel'].includes(req.file.mimetype)) {
        return res.status(400).json({ message: 'Only CSV files are supported' });
      }

      // Create initial dataset record
      const dataset = await storage.createDataset({
        name: name || req.file.originalname,
        description: description || '',
        userId,
        originalFilename: req.file.originalname,
        fileKey: `datasets/${Date.now()}-${req.file.originalname}`,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        status: 'processing'
      });

      // Process CSV in background
      setImmediate(async () => {
        try {
          const processed = await analyticsService.processCSV(req.file.buffer);
          
          await storage.updateDataset(dataset.id, {
            status: 'ready',
            rowCount: processed.statistics.totalRows,
            columnCount: processed.statistics.totalColumns,
            columns: processed.columns,
            relationships: processed.relationships,
            statistics: processed.statistics,
            processedAt: new Date()
          });
        } catch (error) {
          console.error('Dataset processing error:', error);
          await storage.updateDataset(dataset.id, {
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      });

      res.json(dataset);
    } catch (error) {
      console.error('Dataset upload error:', error);
      res.status(500).json({ message: 'Failed to upload dataset' });
    }
  });

  app.get('/api/datasets', async (req: any, res) => {
    try {
      const userId = req.query.user_id || 'anonymous-user';
      const datasets = await storage.getDatasetsByUser(userId);
      res.json(datasets);
    } catch (error) {
      console.error('Error fetching datasets:', error);
      res.status(500).json({ message: 'Failed to fetch datasets' });
    }
  });

  app.get('/api/datasets/:id', async (req: any, res) => {
    try {
      const { id } = req.params;
      const dataset = await storage.getDataset(id);
      
      if (!dataset) {
        return res.status(404).json({ message: 'Dataset not found' });
      }
      
      res.json(dataset);
    } catch (error) {
      console.error('Error fetching dataset:', error);
      res.status(500).json({ message: 'Failed to fetch dataset' });
    }
  });

  app.delete('/api/datasets/:id', async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteDataset(id);
      res.json({ message: 'Dataset deleted successfully' });
    } catch (error) {
      console.error('Error deleting dataset:', error);
      res.status(500).json({ message: 'Failed to delete dataset' });
    }
  });

  // Dashboard routes
  app.post('/api/dashboards', async (req: any, res) => {
    try {
      const userId = req.query.user_id || 'anonymous-user';
      const dashboard = await storage.createDashboard({
        ...req.body,
        userId
      });
      res.json(dashboard);
    } catch (error) {
      console.error('Error creating dashboard:', error);
      res.status(500).json({ message: 'Failed to create dashboard' });
    }
  });

  app.get('/api/dashboards', async (req: any, res) => {
    try {
      const userId = req.query.user_id || 'anonymous-user';
      const datasetId = req.query.dataset_id;
      
      const dashboards = datasetId 
        ? await storage.getDashboardsByDataset(datasetId)
        : await storage.getDashboardsByUser(userId);
        
      res.json(dashboards);
    } catch (error) {
      console.error('Error fetching dashboards:', error);
      res.status(500).json({ message: 'Failed to fetch dashboards' });
    }
  });

  app.get('/api/dashboards/:id', async (req: any, res) => {
    try {
      const { id } = req.params;
      const dashboard = await storage.getDashboard(id);
      
      if (!dashboard) {
        return res.status(404).json({ message: 'Dashboard not found' });
      }
      
      // Also fetch visualizations for this dashboard
      const visualizations = await storage.getVisualizationsByDashboard(id);
      
      res.json({
        ...dashboard,
        visualizations
      });
    } catch (error) {
      console.error('Error fetching dashboard:', error);
      res.status(500).json({ message: 'Failed to fetch dashboard' });
    }
  });

  app.put('/api/dashboards/:id', async (req: any, res) => {
    try {
      const { id } = req.params;
      const dashboard = await storage.updateDashboard(id, req.body);
      res.json(dashboard);
    } catch (error) {
      console.error('Error updating dashboard:', error);
      res.status(500).json({ message: 'Failed to update dashboard' });
    }
  });

  app.delete('/api/dashboards/:id', async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteDashboard(id);
      res.json({ message: 'Dashboard deleted successfully' });
    } catch (error) {
      console.error('Error deleting dashboard:', error);
      res.status(500).json({ message: 'Failed to delete dashboard' });
    }
  });

  // Visualization routes
  app.post('/api/visualizations', async (req: any, res) => {
    try {
      const visualization = await storage.createVisualization(req.body);
      res.json(visualization);
    } catch (error) {
      console.error('Error creating visualization:', error);
      res.status(500).json({ message: 'Failed to create visualization' });
    }
  });

  app.get('/api/visualizations', async (req: any, res) => {
    try {
      const { dashboard_id } = req.query;
      
      if (!dashboard_id) {
        return res.status(400).json({ message: 'dashboard_id is required' });
      }
      
      const visualizations = await storage.getVisualizationsByDashboard(dashboard_id);
      res.json(visualizations);
    } catch (error) {
      console.error('Error fetching visualizations:', error);
      res.status(500).json({ message: 'Failed to fetch visualizations' });
    }
  });

  app.put('/api/visualizations/:id', async (req: any, res) => {
    try {
      const { id } = req.params;
      const visualization = await storage.updateVisualization(id, req.body);
      res.json(visualization);
    } catch (error) {
      console.error('Error updating visualization:', error);
      res.status(500).json({ message: 'Failed to update visualization' });
    }
  });

  app.delete('/api/visualizations/:id', async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteVisualization(id);
      res.json({ message: 'Visualization deleted successfully' });
    } catch (error) {
      console.error('Error deleting visualization:', error);
      res.status(500).json({ message: 'Failed to delete visualization' });
    }
  });

  // Natural language query routes
  app.post('/api/datasets/:datasetId/query', async (req: any, res) => {
    try {
      const { datasetId } = req.params;
      const { queryText } = req.body;
      const userId = req.query.user_id || 'anonymous-user';

      // Get dataset
      const dataset = await storage.getDataset(datasetId);
      if (!dataset || !dataset.columns) {
        return res.status(404).json({ message: 'Dataset not found or not processed' });
      }

      // Cast columns to proper type
      const columns = dataset.columns as any[];
      
      // Generate SQL and suggested visualization
      const { sql, visualization } = await analyticsService.generateSQL(
        columns.map((col: any) => col.name),
        queryText,
        columns
      );

      // Save query
      const query = await storage.createQuery({
        datasetId,
        userId,
        queryText,
        sqlQuery: sql,
        visualizationType: visualization,
        results: null // Would be populated when actually executed
      });

      res.json({
        query,
        suggestedVisualization: visualization,
        sql
      });
    } catch (error) {
      console.error('Error processing query:', error);
      res.status(500).json({ message: 'Failed to process query' });
    }
  });

  app.get('/api/datasets/:datasetId/queries', async (req: any, res) => {
    try {
      const { datasetId } = req.params;
      const queries = await storage.getQueriesByDataset(datasetId);
      res.json(queries);
    } catch (error) {
      console.error('Error fetching queries:', error);
      res.status(500).json({ message: 'Failed to fetch queries' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
