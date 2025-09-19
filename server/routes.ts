import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import { documentProcessor } from "./services/documentProcessor";
import { chatService } from "./services/chatService";
import { z } from "zod";
import { randomUUID } from "crypto";
import { db } from "./db";
import { chunks, documents } from "@shared/schema";
import { eq, and, sql, isNotNull } from "drizzle-orm";

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain"
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type"));
    }
  },
});

const querySchema = z.object({
  query: z.string().min(1),
  sessionId: z.string().optional(),
});

export async function registerRoutes(app: Express): Promise<Server> {
  // No authentication needed

  // Document routes
  app.post('/api/documents/upload', upload.array('files'), async (req: any, res) => {
    try {
      const userId = 'anonymous-user'; // Default user for non-authenticated mode
      const files = req.files as Express.Multer.File[];
      
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const uploadedDocuments = [];

      for (const file of files) {
        // In production, you would upload to S3 or similar storage
        const fileKey = `uploads/${userId}/${randomUUID()}-${file.originalname}`;
        
        const document = await storage.createDocument({
          title: file.originalname,
          filename: file.originalname,
          uploaderId: userId,
          fileKey,
          mimeType: file.mimetype,
          fileSize: file.size,
          status: "processing",
          errorMessage: null,
          extractedText: null,
        });

        uploadedDocuments.push(document);

        // Process document asynchronously with file buffer
        documentProcessor.processDocument(document.id, file.buffer).catch(error => {
          console.error(`Error processing document ${document.id}:`, error);
        });
      }

      res.json({ 
        message: "Files uploaded successfully", 
        documents: uploadedDocuments 
      });
    } catch (error) {
      console.error("Error uploading files:", error);
      res.status(500).json({ message: "Failed to upload files" });
    }
  });

  app.get('/api/documents', async (req: any, res) => {
    try {
      // Show all documents in non-authenticated mode
      const documents = await storage.getAllDocuments();
      
      res.json(documents);
    } catch (error) {
      console.error("Error fetching documents:", error);
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

      // Reprocess document asynchronously
      documentProcessor.reprocessDocument(id).catch(error => {
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
      const userId = 'anonymous-user';
      const { query, sessionId } = querySchema.parse(req.body);
      
      let currentSessionId = sessionId;
      
      // Create new session if not provided
      if (!currentSessionId) {
        const session = await storage.createChatSession({ userId });
        currentSessionId = session.id;
      }

      const response = await chatService.processQuery(currentSessionId, query, userId);
      
      res.json({
        ...response,
        sessionId: currentSessionId,
      });
    } catch (error) {
      console.error("Error processing chat query:", error);
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
      const documentStats = await storage.getDocumentStats();
      
      // Calculate real statistics
      const chatStats = await storage.getChatStatistics();
      const activeUserStats = await storage.getActiveUserStatistics();
      
      const stats = {
        totalDocuments: documentStats.total,
        processing: documentStats.processing,
        queriesToday: chatStats.todayQueries,
        activeUsers: activeUserStats.activeUsers,
        ...(await getAdminStats(documentStats)), // Always show admin stats in non-auth mode
      };

      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
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
          avgMinutes: sql<number>`COALESCE(AVG(CAST((julianday(${documents.processedAt}) - julianday(${documents.uploadedAt})) * 24 * 60 AS REAL)), 0)` 
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

  const httpServer = createServer(app);
  return httpServer;
}
