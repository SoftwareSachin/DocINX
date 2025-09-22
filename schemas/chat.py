from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime


class ChatQueryRequest(BaseModel):
    query: str
    session_id: Optional[str] = None


class ChatSource(BaseModel):
    document_id: str
    document_title: str
    chunk_content: str


class ChatQueryResponse(BaseModel):
    answer: str
    sources: List[ChatSource]
    session_id: str


class ChatMessageCreate(BaseModel):
    session_id: str
    role: str
    content: str
    sources: Optional[List[Any]] = None


class ChatMessageResponse(BaseModel):
    id: str
    session_id: str
    role: str
    content: str
    sources: Optional[List[Any]] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class ChatSessionCreate(BaseModel):
    user_id: str


class ChatSessionResponse(BaseModel):
    id: str
    user_id: str
    created_at: datetime
    
    class Config:
        from_attributes = True