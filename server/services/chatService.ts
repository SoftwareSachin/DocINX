import OpenAI from "openai";
import { storage } from "../storage";
import { generateEmbeddings } from "../openai";
import { searchSimilarChunks } from "./vectorService";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key"
});

export interface ChatResponse {
  answer: string;
  sources: Array<{
    documentId: string;
    documentTitle: string;
    chunkId: string;
    content: string;
    confidence: number;
  }>;
}

export class ChatService {
  async processQuery(
    sessionId: string,
    query: string,
    userId: string
  ): Promise<ChatResponse> {
    // Store user message
    await storage.createChatMessage({
      sessionId,
      role: "user",
      content: query,
      sources: null,
    });

    try {
      // Get user's documents for context
      const userDocuments = await storage.getDocumentsByUser(userId);
      const readyDocuments = userDocuments.filter(doc => doc.status === "ready");

      if (readyDocuments.length === 0) {
        const answer = "I don't have any processed documents to search through. Please upload and process some documents first.";
        
        await storage.createChatMessage({
          sessionId,
          role: "assistant",
          content: answer,
          sources: [],
        });

        return { answer, sources: [] };
      }

      // Get all chunks from ready documents
      const allChunks: Array<{
        id: string;
        embedding: number[];
        content: string;
        documentId: string;
        documentTitle: string;
      }> = [];
      for (const doc of readyDocuments) {
        const chunks = await storage.getChunksByDocument(doc.id);
        for (const chunk of chunks) {
          if (chunk.embedding) {
            allChunks.push({
              id: chunk.id,
              embedding: chunk.embedding,
              content: chunk.content,
              documentId: doc.id,
              documentTitle: doc.title,
            });
          }
        }
      }

      if (allChunks.length === 0) {
        const answer = "No searchable content found in your documents. The documents may still be processing.";
        
        await storage.createChatMessage({
          sessionId,
          role: "assistant",
          content: answer,
          sources: [],
        });

        return { answer, sources: [] };
      }

      // Search for relevant chunks
      const relevantChunks = await searchSimilarChunks(query, allChunks, 5);

      // Generate response using RAG with document titles
      const chunksWithTitles = relevantChunks.map(chunk => ({
        ...chunk,
        documentTitle: allChunks.find(c => c.id === chunk.id)?.documentTitle || "Unknown Document"
      }));
      const response = await this.generateRAGResponse(query, chunksWithTitles);

      // Store assistant message
      await storage.createChatMessage({
        sessionId,
        role: "assistant",
        content: response.answer,
        sources: response.sources,
      });

      return response;
    } catch (error) {
      console.error("Error processing query:", error);
      
      const errorAnswer = "I encountered an error while processing your question. Please try again.";
      
      await storage.createChatMessage({
        sessionId,
        role: "assistant",
        content: errorAnswer,
        sources: [],
      });

      return { answer: errorAnswer, sources: [] };
    }
  }

  private async generateRAGResponse(
    query: string,
    chunks: Array<{
      id: string;
      content: string;
      documentId: string;
      documentTitle: string;
      similarity: number;
    }>
  ): Promise<ChatResponse> {
    const context = chunks
      .map((chunk, index) => `[${index + 1}] ${chunk.content}`)
      .join("\n\n");

    const prompt = `You are a helpful assistant that answers questions based on the provided document context. Use only the information from the context to answer the question. If the context doesn't contain enough information to answer the question, say so clearly.

Context from documents:
${context}

Question: ${query}

Instructions:
1. Answer the question based only on the provided context
2. Be concise and accurate
3. If you reference specific information, indicate which source number [1], [2], etc.
4. If the context doesn't contain relevant information, clearly state that

Answer:`;

    try {
      // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
      const completion = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that provides accurate answers based on document context with proper source attribution."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_completion_tokens: 1000,
      });

      const answer = completion.choices[0].message.content || "I couldn't generate a response.";

      const sources = chunks.map(chunk => ({
        documentId: chunk.documentId,
        documentTitle: chunk.documentTitle,
        chunkId: chunk.id,
        content: chunk.content.substring(0, 200) + "...", // Truncate for preview
        confidence: Math.round(chunk.similarity * 100),
      }));

      return { answer, sources };
    } catch (error) {
      console.error("Error generating RAG response:", error);
      throw new Error("Failed to generate response");
    }
  }
}

export const chatService = new ChatService();
