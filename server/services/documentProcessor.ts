import { storage } from "../storage";
import { multiAIService } from "./multiAIService";
import { randomUUID } from "crypto";

export interface ProcessingResult {
  success: boolean;
  error?: string;
  chunksCreated?: number;
}

export class DocumentProcessor {
  async processDocument(documentId: string, fileBuffer?: Buffer): Promise<ProcessingResult> {
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

      // Extract text based on file type using buffer
      if (!fileBuffer) {
        throw new Error("File buffer is required for text extraction");
      }
      const extractedText = await this.extractText(document, fileBuffer);
      
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
        const embedding = await multiAIService.generateEmbeddings(chunk.content);
        
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

  private async extractText(document: any, fileBuffer: Buffer): Promise<string> {
    const mimeType = document.mimeType;
    
    try {
      if (mimeType === "application/pdf") {
        try {
          // Use dynamic import with better error handling
          const pdfParseModule = await import('pdf-parse');
          const pdfParse = pdfParseModule.default || pdfParseModule;
          const pdfData = await pdfParse(fileBuffer, {
            max: 0, // Parse all pages
            version: 'v1.10.88' // Use specific version to avoid issues
          });
          return pdfData.text || '';
        } catch (pdfError) {
          console.error('PDF parsing failed, attempting fallback:', pdfError);
          // Fallback: return a simple text extraction message
          return `[PDF Document: ${document.filename}]\n\nDocument processing temporarily unavailable. Please try re-uploading the document.`;
        }
      } else if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ buffer: fileBuffer });
        return result.value;
      } else if (mimeType === "text/plain") {
        return fileBuffer.toString('utf-8');
      }
      
      throw new Error(`Unsupported file type: ${mimeType}`);
    } catch (error) {
      console.error(`Error extracting text from ${document.filename}:`, error);
      throw new Error(`Failed to extract text: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
    try {
      const document = await storage.getDocument(documentId);
      if (!document) {
        throw new Error("Document not found");
      }

      // Delete existing chunks
      await storage.deleteChunksByDocument(documentId);
      
      // For reprocessing, we can't access the original file buffer
      // In production, files would be stored in S3 or similar and we'd fetch them
      // For now, mark as failed with clear message about missing file content
      
      await storage.updateDocument(documentId, { 
        status: "failed",
        errorMessage: "Cannot reprocess document: Original file content not available. File would need to be re-uploaded.",
        processedAt: new Date()
      });

      return { 
        success: false, 
        error: "Cannot reprocess document: Original file content not available. File would need to be re-uploaded." 
      };
    } catch (error) {
      console.error(`Error reprocessing document ${documentId}:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      };
    }
  }
}

export const documentProcessor = new DocumentProcessor();
