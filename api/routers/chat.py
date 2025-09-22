from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
import logging
import uuid

from db.session import get_db
from schemas.chat import (
    ChatQueryRequest, 
    ChatQueryResponse, 
    ChatSessionResponse, 
    ChatMessageResponse
)
from services.enhanced_chat_service import EnhancedChatService

logger = logging.getLogger(__name__)

router = APIRouter()
chat_service = EnhancedChatService()

def get_user_id() -> str:
    """Simple user ID for demo mode - no authentication required"""
    return "demo-user"


@router.post("/chat/query", response_model=ChatQueryResponse)
async def process_chat_query(
    request: ChatQueryRequest,
    db: AsyncSession = Depends(get_db)
):
    """Process a chat query using enhanced RAG with multi-provider fallbacks"""
    try:
        user_id = get_user_id()
        
        # Create new session if not provided
        session_id = request.session_id
        if not session_id:
            session_id = str(uuid.uuid4())
        
        # Process the query with enhanced chat service
        response = await chat_service.process_chat_message(
            user_id=user_id,
            session_id=session_id,
            message=request.query,
            max_tokens=getattr(request, 'max_tokens', 1000)
        )
        
        if response["success"]:
            return ChatQueryResponse(
                answer=response["response"],
                sources=response.get("sources", []),
                session_id=session_id,
                metadata=response.get("metadata", {})
            )
        else:
            # Enhanced error handling with graceful degradation
            error_response = response.get("response", "I apologize, but I'm having trouble processing your request right now.")
            return ChatQueryResponse(
                answer=error_response,
                sources=[],
                session_id=session_id,
                metadata={"error": True, "provider_used": "error_handler"}
            )
        
    except Exception as e:
        logger.error(f"Chat query processing failed: {str(e)}")
        # Graceful error response instead of HTTP error
        return ChatQueryResponse(
            answer="I'm experiencing technical difficulties. Please try again in a moment, or try rephrasing your question.",
            sources=[],
            session_id=session_id or str(uuid.uuid4()),
            metadata={"error": True, "exception": str(e)}
        )


@router.get("/chat/sessions", response_model=List[ChatSessionResponse])
async def get_chat_sessions(db: AsyncSession = Depends(get_db)):
    """Get all chat sessions for user with enhanced session management"""
    try:
        user_id = get_user_id()
        sessions = await chat_service.get_chat_sessions(user_id)
        
        # Convert to proper response format
        session_responses = []
        for session in sessions:
            session_responses.append(ChatSessionResponse(
                session_id=session["session_id"],
                created_at=session["created_at"],
                latest_message=session.get("latest_message", ""),
                message_count=session.get("message_count", 0)
            ))
        
        return session_responses
    except Exception as e:
        logger.error(f"Failed to fetch chat sessions: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch chat sessions")


@router.get("/chat/sessions/{session_id}/messages", response_model=List[ChatMessageResponse])
async def get_chat_messages(session_id: str, db: AsyncSession = Depends(get_db)):
    """Get messages for a chat session with enhanced message handling"""
    try:
        user_id = get_user_id()
        
        # Get messages using enhanced chat service
        messages = await chat_service.get_chat_history(session_id, user_id)
        
        if not messages:
            return []
        
        # Convert to proper response format
        message_responses = []
        for msg in messages:
            message_responses.append(ChatMessageResponse(
                message_id=msg["message_id"],
                role=msg["role"],
                content=msg["content"],
                sources=msg.get("sources", []),
                created_at=msg["created_at"]
            ))
        
        return message_responses
    except Exception as e:
        logger.error(f"Failed to fetch chat messages for session {session_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch chat messages")