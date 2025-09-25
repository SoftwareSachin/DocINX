import {
  users,
  documents,
  chunks,
  chatSessions,
  chatMessages,
  datasets,
  dashboards,
  visualizations,
  queries,
  type User,
  type UpsertUser,
  type Document,
  type InsertDocument,
  type Chunk,
  type InsertChunk,
  type ChatSession,
  type InsertChatSession,
  type ChatMessage,
  type InsertChatMessage,
  type Dataset,
  type InsertDataset,
  type Dashboard,
  type InsertDashboard,
  type Visualization,
  type InsertVisualization,
  type Query,
  type InsertQuery,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations (IMPORTANT: mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Document operations
  createDocument(document: InsertDocument): Promise<Document>;
  getDocument(id: string): Promise<Document | undefined>;
  getDocumentsByUser(userId: string): Promise<Document[]>;
  getAllDocuments(): Promise<Document[]>;
  updateDocument(id: string, updates: Partial<Document>): Promise<Document>;
  deleteDocument(id: string): Promise<void>;
  getDocumentStats(): Promise<{
    total: number;
    processing: number;
    ready: number;
    failed: number;
  }>;
  
  // Chunk operations
  createChunk(chunk: InsertChunk): Promise<Chunk>;
  getChunksByDocument(documentId: string): Promise<Chunk[]>;
  searchSimilarChunks(embedding: number[], limit: number): Promise<Chunk[]>;
  deleteChunksByDocument(documentId: string): Promise<void>;
  
  // Chat operations
  createChatSession(session: InsertChatSession): Promise<ChatSession>;
  getChatSession(id: string): Promise<ChatSession | undefined>;
  getChatSessionsByUser(userId: string): Promise<ChatSession[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  getChatMessages(sessionId: string): Promise<ChatMessage[]>;
  
  // Admin operations
  getAllUsers(): Promise<User[]>;
  updateUserRole(userId: string, role: string): Promise<User>;
  deleteUser(userId: string): Promise<void>;
  
  // Analytics operations
  createDataset(dataset: InsertDataset): Promise<Dataset>;
  getDataset(id: string): Promise<Dataset | undefined>;
  getDatasetsByUser(userId: string): Promise<Dataset[]>;
  getAllDatasets(): Promise<Dataset[]>;
  updateDataset(id: string, updates: Partial<Dataset>): Promise<Dataset>;
  deleteDataset(id: string): Promise<void>;
  
  createDashboard(dashboard: InsertDashboard): Promise<Dashboard>;
  getDashboard(id: string): Promise<Dashboard | undefined>;
  getDashboardsByUser(userId: string): Promise<Dashboard[]>;
  getDashboardsByDataset(datasetId: string): Promise<Dashboard[]>;
  updateDashboard(id: string, updates: Partial<Dashboard>): Promise<Dashboard>;
  deleteDashboard(id: string): Promise<void>;
  
  createVisualization(visualization: InsertVisualization): Promise<Visualization>;
  getVisualization(id: string): Promise<Visualization | undefined>;
  getVisualizationsByDashboard(dashboardId: string): Promise<Visualization[]>;
  updateVisualization(id: string, updates: Partial<Visualization>): Promise<Visualization>;
  deleteVisualization(id: string): Promise<void>;
  
  createQuery(query: InsertQuery): Promise<Query>;
  getQuery(id: string): Promise<Query | undefined>;
  getQueriesByDataset(datasetId: string): Promise<Query[]>;
  getQueriesByUser(userId: string): Promise<Query[]>;
  deleteQuery(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations (IMPORTANT: mandatory for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Helper method to ensure anonymous user exists
  private async ensureAnonymousUser(userId: string): Promise<void> {
    if (userId === 'anonymous-user') {
      const existingUser = await this.getUser(userId);
      if (!existingUser) {
        await this.upsertUser({
          id: 'anonymous-user',
          email: 'anonymous@example.com',
          firstName: 'Anonymous',
          lastName: 'User',
          role: 'user'
        });
      }
    }
  }

  // Document operations
  async createDocument(document: InsertDocument): Promise<Document> {
    // Ensure anonymous user exists before creating document
    await this.ensureAnonymousUser(document.uploaderId);
    
    const [created] = await db.insert(documents).values(document).returning();
    return created;
  }

  async getDocument(id: string): Promise<Document | undefined> {
    const [document] = await db.select().from(documents).where(eq(documents.id, id));
    return document;
  }

  async getDocumentsByUser(userId: string): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .where(eq(documents.uploaderId, userId))
      .orderBy(desc(documents.uploadedAt));
  }

  async getAllDocuments(): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .orderBy(desc(documents.uploadedAt));
  }

  async updateDocument(id: string, updates: Partial<Document>): Promise<Document> {
    const [updated] = await db
      .update(documents)
      .set(updates)
      .where(eq(documents.id, id))
      .returning();
    return updated;
  }

  async deleteDocument(id: string): Promise<void> {
    await db.delete(documents).where(eq(documents.id, id));
  }

  async getDocumentStats(): Promise<{
    total: number;
    processing: number;
    ready: number;
    failed: number;
  }> {
    const [stats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        processing: sql<number>`count(case when status = 'processing' then 1 end)::int`,
        ready: sql<number>`count(case when status = 'ready' then 1 end)::int`,
        failed: sql<number>`count(case when status = 'failed' then 1 end)::int`,
      })
      .from(documents);
    
    return stats;
  }

  async getChatStatistics() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const [todayQueriesResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(chatMessages)
        .where(
          and(
            eq(chatMessages.role, 'user'),
            sql`${chatMessages.createdAt} >= ${today.toISOString()}`
          )
        );

      return {
        todayQueries: todayQueriesResult?.count || 0,
      };
    } catch (error) {
      console.error("Error getting chat statistics:", error);
      return { todayQueries: 0 };
    }
  }

  async getActiveUserStatistics() {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      // Count unique users who have sent messages in the last 24 hours
      const [activeUsersResult] = await db
        .select({ count: sql<number>`count(distinct ${chatSessions.userId})` })
        .from(chatSessions)
        .leftJoin(chatMessages, eq(chatSessions.id, chatMessages.sessionId))
        .where(
          sql`${chatMessages.createdAt} >= ${twentyFourHoursAgo.toISOString()}`
        );

      return {
        activeUsers: activeUsersResult?.count || 0,
      };
    } catch (error) {
      console.error("Error getting active user statistics:", error);
      return { activeUsers: 0 };
    }
  }

  // Chunk operations
  async createChunk(chunk: InsertChunk): Promise<Chunk> {
    const [created] = await db.insert(chunks).values(chunk).returning();
    return created;
  }

  async getChunksByDocument(documentId: string): Promise<Chunk[]> {
    return await db
      .select()
      .from(chunks)
      .where(eq(chunks.documentId, documentId))
      .orderBy(chunks.chunkIndex);
  }

  async searchSimilarChunks(embedding: number[], limit: number): Promise<Chunk[]> {
    // Implement proper cosine similarity using PostgreSQL operations
    // This is a basic implementation - pgvector would be more efficient for production
    const similarChunks = await db
      .select()
      .from(chunks)
      .leftJoin(documents, eq(chunks.documentId, documents.id))
      .where(
        and(
          sql`embedding IS NOT NULL`,
          eq(documents.status, 'ready')
        )
      );

    // Calculate cosine similarity for each chunk
    const chunksWithSimilarity = similarChunks
      .map(row => {
        const chunk = row.chunks;
        if (!chunk.embedding) return null;
        
        const similarity = this.calculateCosineSimilarity(embedding, chunk.embedding);
        return { chunk, similarity };
      })
      .filter((item): item is { chunk: Chunk; similarity: number } => 
        item !== null && item.similarity > 0.1  // Basic similarity threshold
      )
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map(item => item.chunk);

    return chunksWithSimilarity;
  }

  private calculateCosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);
    
    if (normA === 0 || normB === 0) return 0;
    
    return dotProduct / (normA * normB);
  }

  async deleteChunksByDocument(documentId: string): Promise<void> {
    await db.delete(chunks).where(eq(chunks.documentId, documentId));
  }

  // Chat operations
  async createChatSession(session: InsertChatSession): Promise<ChatSession> {
    // Ensure anonymous user exists before creating chat session
    await this.ensureAnonymousUser(session.userId);
    
    const [created] = await db.insert(chatSessions).values(session).returning();
    return created;
  }

  async getChatSession(id: string): Promise<ChatSession | undefined> {
    const [session] = await db.select().from(chatSessions).where(eq(chatSessions.id, id));
    return session;
  }

  async getChatSessionsByUser(userId: string): Promise<ChatSession[]> {
    return await db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.userId, userId))
      .orderBy(desc(chatSessions.createdAt));
  }

  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const [created] = await db.insert(chatMessages).values(message).returning();
    return created;
  }

  async getChatMessages(sessionId: string): Promise<ChatMessage[]> {
    return await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(chatMessages.createdAt);
  }

  // Admin operations
  async getAllUsers(): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .orderBy(desc(users.createdAt));
  }

  async updateUserRole(userId: string, role: string): Promise<User> {
    const [updated] = await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async deleteUser(userId: string): Promise<void> {
    await db.delete(users).where(eq(users.id, userId));
  }

  // Analytics operations
  async createDataset(dataset: InsertDataset): Promise<Dataset> {
    await this.ensureAnonymousUser(dataset.userId);
    const [created] = await db.insert(datasets).values(dataset).returning();
    return created;
  }

  async getDataset(id: string): Promise<Dataset | undefined> {
    const [dataset] = await db.select().from(datasets).where(eq(datasets.id, id));
    return dataset;
  }

  async getDatasetsByUser(userId: string): Promise<Dataset[]> {
    return await db
      .select()
      .from(datasets)
      .where(eq(datasets.userId, userId))
      .orderBy(desc(datasets.createdAt));
  }

  async getAllDatasets(): Promise<Dataset[]> {
    return await db
      .select()
      .from(datasets)
      .orderBy(desc(datasets.createdAt));
  }

  async updateDataset(id: string, updates: Partial<Dataset>): Promise<Dataset> {
    const [updated] = await db
      .update(datasets)
      .set(updates)
      .where(eq(datasets.id, id))
      .returning();
    return updated;
  }

  async deleteDataset(id: string): Promise<void> {
    await db.delete(datasets).where(eq(datasets.id, id));
  }

  async createDashboard(dashboard: InsertDashboard): Promise<Dashboard> {
    await this.ensureAnonymousUser(dashboard.userId);
    const [created] = await db.insert(dashboards).values(dashboard).returning();
    return created;
  }

  async getDashboard(id: string): Promise<Dashboard | undefined> {
    const [dashboard] = await db.select().from(dashboards).where(eq(dashboards.id, id));
    return dashboard;
  }

  async getDashboardsByUser(userId: string): Promise<Dashboard[]> {
    return await db
      .select()
      .from(dashboards)
      .where(eq(dashboards.userId, userId))
      .orderBy(desc(dashboards.createdAt));
  }

  async getDashboardsByDataset(datasetId: string): Promise<Dashboard[]> {
    return await db
      .select()
      .from(dashboards)
      .where(eq(dashboards.datasetId, datasetId))
      .orderBy(desc(dashboards.createdAt));
  }

  async updateDashboard(id: string, updates: Partial<Dashboard>): Promise<Dashboard> {
    const updateData = { ...updates, updatedAt: new Date() };
    const [updated] = await db
      .update(dashboards)
      .set(updateData)
      .where(eq(dashboards.id, id))
      .returning();
    return updated;
  }

  async deleteDashboard(id: string): Promise<void> {
    await db.delete(dashboards).where(eq(dashboards.id, id));
  }

  async createVisualization(visualization: InsertVisualization): Promise<Visualization> {
    const [created] = await db.insert(visualizations).values(visualization).returning();
    return created;
  }

  async getVisualization(id: string): Promise<Visualization | undefined> {
    const [visualization] = await db.select().from(visualizations).where(eq(visualizations.id, id));
    return visualization;
  }

  async getVisualizationsByDashboard(dashboardId: string): Promise<Visualization[]> {
    return await db
      .select()
      .from(visualizations)
      .where(eq(visualizations.dashboardId, dashboardId))
      .orderBy(visualizations.createdAt);
  }

  async updateVisualization(id: string, updates: Partial<Visualization>): Promise<Visualization> {
    const updateData = { ...updates, updatedAt: new Date() };
    const [updated] = await db
      .update(visualizations)
      .set(updateData)
      .where(eq(visualizations.id, id))
      .returning();
    return updated;
  }

  async deleteVisualization(id: string): Promise<void> {
    await db.delete(visualizations).where(eq(visualizations.id, id));
  }

  async createQuery(query: InsertQuery): Promise<Query> {
    await this.ensureAnonymousUser(query.userId);
    const [created] = await db.insert(queries).values(query).returning();
    return created;
  }

  async getQuery(id: string): Promise<Query | undefined> {
    const [query] = await db.select().from(queries).where(eq(queries.id, id));
    return query;
  }

  async getQueriesByDataset(datasetId: string): Promise<Query[]> {
    return await db
      .select()
      .from(queries)
      .where(eq(queries.datasetId, datasetId))
      .orderBy(desc(queries.executedAt));
  }

  async getQueriesByUser(userId: string): Promise<Query[]> {
    return await db
      .select()
      .from(queries)
      .where(eq(queries.userId, userId))
      .orderBy(desc(queries.executedAt));
  }

  async deleteQuery(id: string): Promise<void> {
    await db.delete(queries).where(eq(queries.id, id));
  }
}

export const storage = new DatabaseStorage();
