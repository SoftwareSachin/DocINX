from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from typing import List, Optional
from datetime import datetime

from db.models import Document, User
from schemas.document import DocumentResponse


class DocumentService:
    
    async def create_document(
        self,
        db: AsyncSession,
        title: str,
        filename: str,
        uploader_id: str,
        file_key: str,
        mime_type: str,
        file_size: int,
        status: str = "processing"
    ) -> DocumentResponse:
        """Create a new document"""
        
        # Ensure anonymous user exists
        await self._ensure_anonymous_user(db, uploader_id)
        
        document = Document(
            title=title,
            filename=filename,
            uploader_id=uploader_id,
            file_key=file_key,
            mime_type=mime_type,
            file_size=file_size,
            status=status
        )
        
        db.add(document)
        await db.commit()
        await db.refresh(document)
        
        return DocumentResponse.model_validate(document)
    
    async def get_document(self, db: AsyncSession, document_id: str) -> Optional[DocumentResponse]:
        """Get document by ID"""
        result = await db.execute(
            select(Document).where(Document.id == document_id)
        )
        document = result.scalar_one_or_none()
        
        if document:
            return DocumentResponse.model_validate(document)
        return None
    
    async def get_all_documents(self, db: AsyncSession) -> List[DocumentResponse]:
        """Get all documents ordered by upload date"""
        result = await db.execute(
            select(Document).order_by(desc(Document.uploaded_at))
        )
        documents = result.scalars().all()
        
        return [DocumentResponse.model_validate(doc) for doc in documents]
    
    async def update_document(
        self,
        db: AsyncSession,
        document_id: str,
        status: Optional[str] = None,
        error_message: Optional[str] = None,
        extracted_text: Optional[str] = None,
        processed_at: Optional[datetime] = None
    ) -> Optional[DocumentResponse]:
        """Update document fields"""
        result = await db.execute(
            select(Document).where(Document.id == document_id)
        )
        document = result.scalar_one_or_none()
        
        if not document:
            return None
        
        if status is not None:
            document.status = status
        if error_message is not None:
            document.error_message = error_message
        if extracted_text is not None:
            document.extracted_text = extracted_text
        if processed_at is not None:
            document.processed_at = processed_at
        
        await db.commit()
        await db.refresh(document)
        
        return DocumentResponse.model_validate(document)
    
    async def delete_document(self, db: AsyncSession, document_id: str) -> bool:
        """Delete document and its chunks"""
        result = await db.execute(
            select(Document).where(Document.id == document_id)
        )
        document = result.scalar_one_or_none()
        
        if not document:
            return False
        
        await db.delete(document)
        await db.commit()
        return True
    
    async def get_document_stats(self, db: AsyncSession) -> dict:
        """Get document statistics"""
        result = await db.execute(
            select(
                func.count().label("total"),
                func.sum(func.case((Document.status == "processing", 1), else_=0)).label("processing"),
                func.sum(func.case((Document.status == "ready", 1), else_=0)).label("ready"),
                func.sum(func.case((Document.status == "failed", 1), else_=0)).label("failed")
            ).select_from(Document)
        )
        
        stats = result.one()
        return {
            "total": int(stats.total or 0),
            "processing": int(stats.processing or 0),
            "ready": int(stats.ready or 0),
            "failed": int(stats.failed or 0)
        }
    
    async def _ensure_anonymous_user(self, db: AsyncSession, user_id: str):
        """Ensure anonymous user exists in database"""
        if user_id == "anonymous-user":
            result = await db.execute(
                select(User).where(User.id == user_id)
            )
            user = result.scalar_one_or_none()
            
            if not user:
                anonymous_user = User(
                    id="anonymous-user",
                    email="anonymous@example.com",
                    first_name="Anonymous",
                    last_name="User",
                    role="user"
                )
                db.add(anonymous_user)
                await db.commit()