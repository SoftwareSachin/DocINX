import { storage } from "../storage";
import { generateEmbeddings } from "../openai";
import { randomUUID } from "crypto";

export interface ProcessingResult {
  success: boolean;
  error?: string;
  chunksCreated?: number;
}

export class DocumentProcessor {
  async processDocument(documentId: string): Promise<ProcessingResult> {
    try {
      const document = await storage.getDocument(documentId);
      if (!document) {
        throw new Error("Document not found");
      }

      // Update status to processing
      await storage.updateDocument(documentId, { 
        status: "processing",
        processedAt: new Date()
      });

      // Extract text based on file type
      const extractedText = await this.extractText(document);
      
      // Update document with extracted text
      await storage.updateDocument(documentId, { 
        extractedText 
      });

      // Chunk the text
      const chunks = this.chunkText(extractedText);
      
      // Generate embeddings and store chunks
      let chunksCreated = 0;
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = await generateEmbeddings(chunk.content);
        
        await storage.createChunk({
          documentId,
          chunkIndex: i,
          content: chunk.content,
          charStart: chunk.charStart,
          charEnd: chunk.charEnd,
          embedding,
        });
        
        chunksCreated++;
      }

      // Update document status to ready
      await storage.updateDocument(documentId, { 
        status: "ready" 
      });

      return { success: true, chunksCreated };
    } catch (error) {
      // Update document status to failed
      await storage.updateDocument(documentId, { 
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error"
      });

      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      };
    }
  }

  private async extractText(document: any): Promise<string> {
    // In a real implementation, this would handle different file types:
    // - PDF: Use PDF parsing library
    // - DOCX: Use document parsing library
    // - Images: Use OCR (Tesseract or cloud OCR)
    // - TXT: Direct text reading
    
    // For MVP, we'll simulate text extraction
    const mimeType = document.mimeType;
    
    if (mimeType === "application/pdf") {
      // Simulate PDF text extraction
      return `Extracted text from PDF: ${document.filename}\n\nThis is sample extracted content that would come from a PDF parsing library. In production, this would use libraries like pdf-parse or similar to extract actual text content from PDF files.`;
    } else if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      // Simulate DOCX text extraction
      return `Extracted text from DOCX: ${document.filename}\n\nThis is sample extracted content that would come from a DOCX parsing library. In production, this would use libraries like mammoth or similar to extract actual text content from Word documents.`;
    } else if (mimeType === "text/plain") {
      // For text files, we would read the file directly
      return `Content from text file: ${document.filename}\n\nThis is sample text content. In production, this would be the actual content read from the uploaded text file.`;
    }
    
    throw new Error(`Unsupported file type: ${mimeType}`);
  }

  private chunkText(text: string): Array<{
    content: string;
    charStart: number;
    charEnd: number;
  }> {
    const chunks = [];
    const chunkSize = 500; // characters
    const overlap = 50; // characters
    
    for (let i = 0; i < text.length; i += chunkSize - overlap) {
      const end = Math.min(i + chunkSize, text.length);
      const content = text.slice(i, end);
      
      if (content.trim().length > 0) {
        chunks.push({
          content: content.trim(),
          charStart: i,
          charEnd: end,
        });
      }
      
      if (end >= text.length) break;
    }
    
    return chunks;
  }

  async reprocessDocument(documentId: string): Promise<ProcessingResult> {
    // Delete existing chunks
    await storage.deleteChunksByDocument(documentId);
    
    // Process again
    return this.processDocument(documentId);
  }
}

export const documentProcessor = new DocumentProcessor();
