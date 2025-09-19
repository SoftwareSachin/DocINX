import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from datetime import datetime
import uuid

from db.models import Document, Chunk
from db.session import AsyncSessionLocal
from services.document_service import DocumentService
from services.openai_service import OpenAIService
from core.config import settings


class DocumentProcessor:
    
    def __init__(self):
        self.document_service = DocumentService()
        self.openai_service = OpenAIService()
    
    async def process_document(
        self,
        document_id: str,
        file_content: bytes
    ) -> dict:
        """Process document: extract text, chunk, generate embeddings"""
        # Create a new database session for background processing
        async with AsyncSessionLocal() as db:
            try:
                # Get document
                document = await self.document_service.get_document(db, document_id)
                if not document:
                    raise Exception("Document not found")
                
                # Update status to processing
                await self.document_service.update_document(
                    db=db,
                    document_id=document_id,
                    status="processing",
                    processed_at=datetime.now()
                )
            
                # Extract text based on file type
                extracted_text = await self._extract_text(document.mime_type, file_content)
                
                # Update document with extracted text
                await self.document_service.update_document(
                    db=db,
                    document_id=document_id,
                    extracted_text=extracted_text
                )
                
                # Chunk the text
                chunks = self._chunk_text(extracted_text)
                
                # Generate embeddings and store chunks
                chunks_created = 0
                for i, chunk in enumerate(chunks):
                    try:
                        # Generate embedding
                        embedding = await self.openai_service.generate_embedding(chunk["content"])
                        
                        # Create chunk record
                        chunk_obj = Chunk(
                            document_id=document_id,
                            chunk_index=i,
                            content=chunk["content"],
                            char_start=chunk["char_start"],
                            char_end=chunk["char_end"],
                            embedding=embedding
                        )
                        
                        db.add(chunk_obj)
                        chunks_created += 1
                        
                    except Exception as e:
                        print(f"Error creating chunk {i} for document {document_id}: {str(e)}")
                        continue
                
                await db.commit()
                
                # Update document status to ready
                await self.document_service.update_document(
                    db=db,
                    document_id=document_id,
                    status="ready"
                )
                
                return {"success": True, "chunks_created": chunks_created}
                
            except Exception as e:
                # Update document status to failed
                await self.document_service.update_document(
                    db=db,
                    document_id=document_id,
                    status="failed",
                    error_message=str(e)
                )
                
                print(f"Error processing document {document_id}: {str(e)}")
                return {"success": False, "error": str(e)}
    
    async def _extract_text(self, mime_type: str, file_content: bytes) -> str:
        """Extract text from file based on MIME type"""
        try:
            if mime_type == "application/pdf":
                # Use pdfminer.six for PDF extraction
                from pdfminer.high_level import extract_text
                from io import BytesIO
                
                pdf_file = BytesIO(file_content)
                text = extract_text(pdf_file)
                return text
                
            elif mime_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
                # Use python-docx for DOCX files
                from docx import Document as DocxDocument
                from io import BytesIO
                
                docx_file = BytesIO(file_content)
                doc = DocxDocument(docx_file)
                text = "\n".join([paragraph.text for paragraph in doc.paragraphs])
                return text
                
            elif mime_type == "text/plain":
                # Plain text file
                return file_content.decode('utf-8')
            
            else:
                raise Exception(f"Unsupported file type: {mime_type}")
                
        except Exception as e:
            raise Exception(f"Failed to extract text: {str(e)}")
    
    def _chunk_text(self, text: str) -> List[dict]:
        """Split text into chunks with overlap"""
        chunks = []
        chunk_size = settings.chunk_size
        overlap = settings.chunk_overlap
        
        for i in range(0, len(text), chunk_size - overlap):
            end = min(i + chunk_size, len(text))
            content = text[i:end].strip()
            
            if content:
                chunks.append({
                    "content": content,
                    "char_start": i,
                    "char_end": end
                })
            
            if end >= len(text):
                break
        
        return chunks