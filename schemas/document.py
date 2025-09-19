from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class DocumentBase(BaseModel):
    title: str
    filename: str
    mime_type: str
    file_size: int


class DocumentCreate(DocumentBase):
    uploader_id: str
    file_key: str
    status: str = "processing"


class DocumentUpdate(BaseModel):
    title: Optional[str] = None
    status: Optional[str] = None
    error_message: Optional[str] = None
    extracted_text: Optional[str] = None
    processed_at: Optional[datetime] = None


class DocumentResponse(DocumentBase):
    id: str
    uploader_id: str
    file_key: str
    status: str
    error_message: Optional[str] = None
    extracted_text: Optional[str] = None
    uploaded_at: datetime
    processed_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class DocumentUploadResponse(BaseModel):
    message: str
    documents: List[DocumentResponse]


class DocumentStats(BaseModel):
    total: int
    processing: int
    ready: int
    failed: int