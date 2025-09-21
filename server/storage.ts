import {
  users,
  documents,
  chunks,
  chatSessions,
  chatMessages,
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
    // Using PostgreSQL's array operations for similarity search
    // In production, you'd want to use pgvector or similar for better performance
    return await db
      .select()
      .from(chunks)
      .where(sql`embedding IS NOT NULL`)
      .limit(limit);
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
}

export const storage = new DatabaseStorage();
