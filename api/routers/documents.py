from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from db.session import get_db
from schemas.document import DocumentResponse, DocumentUploadResponse, DocumentStats
from services.document_service import DocumentService
from services.document_processor import DocumentProcessor
from core.config import settings

router = APIRouter()
document_service = DocumentService()
document_processor = DocumentProcessor()


@router.post("/documents/upload", response_model=DocumentUploadResponse)
async def upload_documents(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db)
):
    """Upload documents for processing"""
    try:
        user_id = "anonymous-user"  # Default user for non-authenticated mode
        
        if not files:
            raise HTTPException(status_code=400, detail="No files uploaded")
        
        uploaded_documents = []
        
        for file in files:
            # Validate file type
            if file.content_type not in [
                "application/pdf",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "text/plain"
            ]:
                raise HTTPException(status_code=400, detail=f"Unsupported file type: {file.content_type}")
            
            # Validate file size
            file_content = await file.read()
            if len(file_content) > settings.max_file_size:
                raise HTTPException(status_code=400, detail="File too large")
            
            # Create document record
            document = await document_service.create_document(
                db=db,
                title=file.filename,
                filename=file.filename,
                uploader_id=user_id,
                file_key=f"uploads/{user_id}/{file.filename}",
                mime_type=file.content_type,
                file_size=len(file_content),
                status="processing"
            )
            
            uploaded_documents.append(document)
            
            # Process document in background
            background_tasks.add_task(
                document_processor.process_document,
                document.id,
                file_content,
                db
            )
        
        return DocumentUploadResponse(
            message="Files uploaded successfully",
            documents=uploaded_documents
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to upload files")


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