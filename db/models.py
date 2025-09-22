from sqlalchemy import Column, String, Integer, Text, DateTime, Boolean, ForeignKey, ARRAY, Float, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from db.session import Base


class Session(Base):
    """Session storage table for Replit Auth compatibility"""
    __tablename__ = "sessions"
    
    sid = Column(String, primary_key=True)
    sess = Column(Text, nullable=False)  # JSON stored as text
    expire = Column(DateTime, nullable=False)
    
    __table_args__ = (Index("IDX_session_expire", "expire"),)


class User(Base):
    """User storage table for Replit Auth compatibility"""
    __tablename__ = "users"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, unique=True)
    first_name = Column(String, name="first_name")
    last_name = Column(String, name="last_name")
    profile_image_url = Column(String, name="profile_image_url")
    role = Column(String, nullable=False, default="user")  # 'admin' or 'user'
    created_at = Column(DateTime, name="created_at", default=func.now())
    updated_at = Column(DateTime, name="updated_at", default=func.now(), onupdate=func.now())
    
    # Relationships
    documents = relationship("Document", back_populates="uploader", cascade="all, delete-orphan")
    chat_sessions = relationship("ChatSession", back_populates="user", cascade="all, delete-orphan")


class Document(Base):
    """Document storage and metadata"""
    __tablename__ = "documents"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String, nullable=False)
    filename = Column(String, nullable=False)
    uploader_id = Column(String, ForeignKey("users.id"), nullable=False, name="uploader_id")
    file_key = Column(String, nullable=False, name="file_key")  # Storage key
    mime_type = Column(String, nullable=False, name="mime_type")
    file_size = Column(Integer, nullable=False, name="file_size")
    status = Column(String, nullable=False, default="processing")  # 'processing', 'ready', 'failed'
    error_message = Column(Text, name="error_message")
    extracted_text = Column(Text, name="extracted_text")
    uploaded_at = Column(DateTime, name="uploaded_at", default=func.now())
    processed_at = Column(DateTime, name="processed_at")
    
    # Relationships
    uploader = relationship("User", back_populates="documents")
    chunks = relationship("Chunk", back_populates="document", cascade="all, delete-orphan")


class Chunk(Base):
    """Text chunks with embeddings for RAG"""
    __tablename__ = "chunks"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = Column(String, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, name="document_id")
    chunk_index = Column(Integer, nullable=False, name="chunk_index")
    content = Column(Text, nullable=False)
    char_start = Column(Integer, nullable=False, name="char_start")
    char_end = Column(Integer, nullable=False, name="char_end")
    embedding = Column(ARRAY(Float))  # Vector embedding array
    created_at = Column(DateTime, name="created_at", default=func.now())
    
    # Relationships
    document = relationship("Document", back_populates="chunks")


class ChatSession(Base):
    """Chat conversation sessions"""
    __tablename__ = "chat_sessions"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False, name="user_id")
    created_at = Column(DateTime, name="created_at", default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="chat_sessions")
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")


class ChatMessage(Base):
    """Individual chat messages with sources"""
    __tablename__ = "chat_messages"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String, ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False, name="session_id")
    role = Column(String, nullable=False)  # 'user' or 'assistant'
    content = Column(Text, nullable=False)
    sources = Column(JSONB)  # JSON stored as JSONB
    created_at = Column(DateTime, name="created_at", default=func.now())
    
    # Relationships
    session = relationship("ChatSession", back_populates="messages")