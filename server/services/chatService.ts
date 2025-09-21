import { storage } from "../storage";
import { searchSimilarChunks } from "./vectorService";
import { multiAIService, AIResponse } from "./multiAIService";

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

      // Generate response using multi-AI RAG with document titles
      const chunksWithTitles = relevantChunks.map(chunk => ({
        ...chunk,
        documentTitle: allChunks.find(c => c.id === chunk.id)?.documentTitle || "Unknown Document"
      }));
      const response = await this.generateMultiAIRAGResponse(query, chunksWithTitles);

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

  private async generateMultiAIRAGResponse(
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

    try {
      // Determine query complexity for optimal AI routing
      const complexity = this.determineQueryComplexity(query);
      
      // Use multi-AI service for maximum power
      const aiResponse = await multiAIService.generateChatResponse(query, context, complexity);

      const sources = chunks.map(chunk => ({
        documentId: chunk.documentId,
        documentTitle: chunk.documentTitle,
        chunkId: chunk.id,
        content: chunk.content.substring(0, 200) + "...", // Truncate for preview
        confidence: Math.round(chunk.similarity * 100),
      }));

      return { 
        answer: `${aiResponse.content}\n\n*Powered by ${aiResponse.platform.toUpperCase()} ${aiResponse.model}*`, 
        sources 
      };
    } catch (error) {
      console.error("Error generating multi-AI RAG response:", error);
      
      // Fallback to basic response
      const fallbackAnswer = "I encountered an error while processing your question with our AI systems. Please try again.";
      return { answer: fallbackAnswer, sources: [] };
    }
  }

  // Determine optimal AI platform based on query characteristics
  private determineQueryComplexity(query: string): 'simple' | 'complex' | 'factual' {
    const complexKeywords = ['analyze', 'explain', 'compare', 'evaluate', 'assess', 'interpret', 'reasoning', 'why', 'how does'];
    const factualKeywords = ['what is', 'who is', 'when did', 'where is', 'define', 'definition'];
    
    const queryLower = query.toLowerCase();
    
    if (complexKeywords.some(keyword => queryLower.includes(keyword))) {
      return 'complex';
    } else if (factualKeywords.some(keyword => queryLower.includes(keyword))) {
      return 'factual';
    }
    
    return 'simple';
  }
}

export const chatService = new ChatService();
