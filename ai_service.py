#!/usr/bin/env python3
"""
Standalone Python AI Service for DocINX
Handles all AI operations including:
- Document processing and text extraction
- OpenAI embedding generation
- Vector similarity search
- RAG chat functionality
"""

import uvicorn
import os
import asyncio
from fastapi import FastAPI, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional
import logging

# Set working directory
os.chdir("/home/runner/workspace")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="DocINX AI Service",
    description="Python AI backend for document processing and RAG",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5000", "http://0.0.0.0:5000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models for requests
class ChatRequest(BaseModel):
    session_id: str
    query: str
    user_id: str

class DocumentProcessRequest(BaseModel):
    document_id: str

# Initialize services on startup
@app.on_event("startup")
async def startup_event():
    try:
        # Initialize database
        from db.session import init_db
        await init_db()
        logger.info("AI Service: Database initialized")
        
        # Test OpenAI connection
        from services.openai_service import OpenAIService
        openai_service = OpenAIService()
        logger.info("AI Service: OpenAI service initialized")
        
        logger.info("AI Service: Startup complete on port 8000")
    except Exception as e:
        logger.error(f"AI Service startup failed: {e}")
        raise

@app.get("/")
async def root():
    return {"message": "DocINX AI Service - Python Backend", "status": "running"}

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "ai"}

@app.post("/api/documents/process")
async def process_document(
    background_tasks: BackgroundTasks,
    document_id: str,
    file: UploadFile = File(...)
):
    """Process uploaded document"""
    try:
        logger.info(f"Processing document: {document_id}")
        
        # Read file content
        file_content = await file.read()
        
        # Import and use document processor
        from services.document_processor import DocumentProcessor
        processor = DocumentProcessor()
        
        # Process in background
        background_tasks.add_task(processor.process_document, document_id, file_content)
        
        return {"message": "Document processing started", "document_id": document_id}
    except Exception as e:
        logger.error(f"Document processing failed: {e}")
        raise HTTPException(status_code=500, detail="Document processing failed")

@app.post("/api/documents/{document_id}/reprocess")
async def reprocess_document(
    document_id: str,
    background_tasks: BackgroundTasks
):
    """Reprocess existing document"""
    try:
        logger.info(f"Reprocessing document: {document_id}")
        
        from services.document_processor import DocumentProcessor
        processor = DocumentProcessor()
        
        # Get document and reprocess
        background_tasks.add_task(processor.reprocess_document, document_id)
        
        return {"message": "Document reprocessing started", "document_id": document_id}
    except Exception as e:
        logger.error(f"Document reprocessing failed: {e}")
        raise HTTPException(status_code=500, detail="Document reprocessing failed")

@app.post("/api/chat/query")
async def process_chat_query(request: ChatRequest):
    """Process chat query using RAG"""
    try:
        logger.info(f"Processing chat query for session: {request.session_id}")
        
        # Import chat service
        from services.chat_service import ChatService
        from db.session import AsyncSessionLocal
        
        chat_service = ChatService()
        
        # Process query with database session
        async with AsyncSessionLocal() as db:
            response = await chat_service.process_query(
                db=db,
                session_id=request.session_id,
                query=request.query,
                user_id=request.user_id
            )
            
        return response
    except Exception as e:
        logger.error(f"Chat query processing failed: {e}")
        raise HTTPException(status_code=500, detail="Chat query processing failed")

@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    logger.error(f"Unhandled error: {exc}")
    return JSONResponse(
        status_code=500,
        content={"message": "Internal server error"}
    )

if __name__ == "__main__":
    print("Starting DocINX AI Service on port 8000...")
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info",
        access_log=True
    )