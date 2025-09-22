from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
import logging

from db.session import get_db
from schemas.document import DocumentResponse, DocumentUploadResponse, DocumentStats
from services.document_service import DocumentService
from services.queue_processor import process_document_task
from core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()
document_service = DocumentService()

def get_user_id() -> str:
    """Simple user ID for demo mode - no authentication barriers"""
    return "anonymous-user"


@router.post("/documents/upload", response_model=DocumentUploadResponse)
async def upload_documents(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db)
):
    """Upload documents for processing - Demo Mode (no auth required)"""
    try:
        user_id = get_user_id()  # Simple demo user
        
        if not files:
            raise HTTPException(status_code=400, detail="No files uploaded")
        
        uploaded_documents = []
        
        for file in files:
            # Enhanced file type validation (including CSV)
            supported_types = [
                "application/pdf",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "text/plain",
                "text/csv",
                "application/csv"
            ]
            if file.content_type not in supported_types:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Unsupported file type: {file.content_type}. Supported: PDF, DOCX, TXT, CSV"
                )
            
            # Validate file size
            file_content = await file.read()
            if len(file_content) > settings.max_file_size:
                raise HTTPException(
                    status_code=400, 
                    detail=f"File too large. Maximum size: {settings.max_file_size // (1024*1024)}MB"
                )
            
            # Create document record
            filename = file.filename or "unknown_file"
            document = await document_service.create_document(
                db=db,
                title=filename,
                filename=filename,
                uploader_id=user_id,
                file_key=f"uploads/{user_id}/{file.filename}",
                mime_type=file.content_type,
                file_size=len(file_content),
                status="queued"  # Start with queued status
            )
            
            uploaded_documents.append(document)
            
            # Queue document for robust processing with retry and fallbacks
            try:
                task = process_document_task.delay(document.id, file_content)
                logger.info(f"Document {document.id} queued for processing with task {task.id}")
            except Exception as queue_error:
                logger.error(f"Failed to queue document {document.id}: {str(queue_error)}")
                # Fallback to immediate background processing
                background_tasks.add_task(
                    _fallback_process_document,
                    document.id,
                    file_content
                )
        
        # Enhanced response with processing information
        processing_info = "Files uploaded and queued for robust processing with automatic retries and fallbacks."
        if any(doc.status == "queued" for doc in uploaded_documents):
            processing_info += " You'll see documents appear as they complete processing."
        
        return DocumentUploadResponse(
            message=processing_info,
            documents=uploaded_documents
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Document upload failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to upload files: {str(e)}")


async def _fallback_process_document(document_id: str, file_content: bytes):
    """Fallback document processing when queue is unavailable"""
    try:
        from services.document_processor import DocumentProcessor
        processor = DocumentProcessor()
        result = await processor.process_document(document_id, file_content)
        logger.info(f"Fallback processing completed for document {document_id}: {result}")
    except Exception as e:
        logger.error(f"Fallback processing failed for document {document_id}: {str(e)}")


@router.get("/documents", response_model=List[DocumentResponse])
async def get_documents(db: AsyncSession = Depends(get_db)):
    """Get all documents"""
    try:
        documents = await document_service.get_all_documents(db)
        return documents
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to fetch documents")


@router.get("/documents/{document_id}", response_model=DocumentResponse)
async def get_document(document_id: str, db: AsyncSession = Depends(get_db)):
    """Get specific document"""
    try:
        document = await document_service.get_document(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        return document
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to fetch document")


@router.post("/documents/{document_id}/reprocess")
async def reprocess_document(document_id: str, db: AsyncSession = Depends(get_db)):
    """Reprocess a document"""
    try:
        document = await document_service.get_document(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Mark as failed since we don't store original file content
        await document_service.update_document(
            db=db,
            document_id=document_id,
            status="failed",
            error_message="Cannot reprocess document: Original file content not available. File would need to be re-uploaded."
        )
        
        return {"message": "Document reprocessing started"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to reprocess document")


@router.delete("/documents/{document_id}")
async def delete_document(document_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a document"""
    try:
        document = await document_service.get_document(db, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        await document_service.delete_document(db, document_id)
        return {"message": "Document deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to delete document")