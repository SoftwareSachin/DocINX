from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from db.session import get_db
from schemas.chat import (
    ChatQueryRequest, 
    ChatQueryResponse, 
    ChatSessionResponse, 
    ChatMessageResponse
)
from services.chat_service import ChatService

router = APIRouter()
chat_service = ChatService()


@router.post("/chat/query", response_model=ChatQueryResponse)
async def process_chat_query(
    request: ChatQueryRequest,
    db: AsyncSession = Depends(get_db)
):
    """Process a chat query using RAG"""
    try:
        user_id = "anonymous-user"  # Default user for non-authenticated mode
        
        # Create new session if not provided
        session_id = request.session_id
        if not session_id:
            session = await chat_service.create_chat_session(db, user_id)
            session_id = session.id
        
        # Process the query
        response = await chat_service.process_query(
            db=db,
            session_id=session_id,
            query=request.query,
            user_id=user_id
        )
        
        return ChatQueryResponse(
            answer=response["answer"],
            sources=response["sources"],
            session_id=session_id
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to process query")


@router.get("/chat/sessions", response_model=List[ChatSessionResponse])
async def get_chat_sessions(db: AsyncSession = Depends(get_db)):
    """Get all chat sessions for user"""
    try:
        user_id = "anonymous-user"
        sessions = await chat_service.get_chat_sessions_by_user(db, user_id)
        return sessions
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to fetch chat sessions")


@router.get("/chat/sessions/{session_id}/messages", response_model=List[ChatMessageResponse])
async def get_chat_messages(session_id: str, db: AsyncSession = Depends(get_db)):
    """Get messages for a chat session"""
    try:
        # Verify session exists
        session = await chat_service.get_chat_session(db, session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Chat session not found")
        
        messages = await chat_service.get_chat_messages(db, session_id)
        return messages
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to fetch chat messages")