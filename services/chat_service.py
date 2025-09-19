from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, and_, func
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import json

from db.models import ChatSession, ChatMessage, Document
from schemas.chat import ChatSessionResponse, ChatMessageResponse, ChatSource
from services.openai_service import OpenAIService
from services.vector_service import VectorService
from services.document_service import DocumentService


class ChatService:
    
    def __init__(self):
        self.openai_service = OpenAIService()
        self.vector_service = VectorService()
        self.document_service = DocumentService()
    
    async def create_chat_session(self, db: AsyncSession, user_id: str) -> ChatSessionResponse:
        """Create a new chat session"""
        
        # Ensure anonymous user exists
        await self.document_service._ensure_anonymous_user(db, user_id)
        
        session = ChatSession(user_id=user_id)
        db.add(session)
        await db.commit()
        await db.refresh(session)
        
        return ChatSessionResponse.model_validate(session)
    
    async def get_chat_session(self, db: AsyncSession, session_id: str) -> Optional[ChatSessionResponse]:
        """Get chat session by ID"""
        result = await db.execute(
            select(ChatSession).where(ChatSession.id == session_id)
        )
        session = result.scalar_one_or_none()
        
        if session:
            return ChatSessionResponse.model_validate(session)
        return None
    
    async def get_chat_sessions_by_user(self, db: AsyncSession, user_id: str) -> List[ChatSessionResponse]:
        """Get all chat sessions for a user"""
        result = await db.execute(
            select(ChatSession)
            .where(ChatSession.user_id == user_id)
            .order_by(desc(ChatSession.created_at))
        )
        sessions = result.scalars().all()
        
        return [ChatSessionResponse.model_validate(session) for session in sessions]
    
    async def create_chat_message(
        self,
        db: AsyncSession,
        session_id: str,
        role: str,
        content: str,
        sources: Optional[List[ChatSource]] = None
    ) -> ChatMessageResponse:
        """Create a new chat message"""
        sources_json = None
        if sources:
            sources_json = json.dumps([source.model_dump() for source in sources])
        
        message = ChatMessage(
            session_id=session_id,
            role=role,
            content=content,
            sources=sources_json
        )
        
        db.add(message)
        await db.commit()
        await db.refresh(message)
        
        return ChatMessageResponse.model_validate(message)
    
    async def get_chat_messages(self, db: AsyncSession, session_id: str) -> List[ChatMessageResponse]:
        """Get all messages for a chat session"""
        result = await db.execute(
            select(ChatMessage)
            .where(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at)
        )
        messages = result.scalars().all()
        
        return [ChatMessageResponse.model_validate(message) for message in messages]
    
    async def process_query(
        self,
        db: AsyncSession,
        session_id: str,
        query: str,
        user_id: str
    ) -> Dict[str, Any]:
        """Process a chat query using RAG"""
        try:
            # Store user message
            await self.create_chat_message(db, session_id, "user", query)
            
            # Generate embedding for the query
            query_embedding = await self.openai_service.generate_embedding(query)
            
            # Search for similar chunks
            similar_chunks = await self.vector_service.search_similar_chunks(
                db=db,
                query_embedding=query_embedding,
                user_id=user_id
            )
            
            # Build context from similar chunks
            context_chunks = []
            sources = []
            
            for chunk, document, similarity in similar_chunks:
                context_chunks.append(chunk.content)
                chunk_preview = chunk.content[:200] + "..." if len(chunk.content) > 200 else chunk.content
                sources.append(ChatSource(
                    document_id=document.id,
                    document_title=document.title,
                    chunk_content=chunk_preview
                ))
            
            # Build context string
            context = "\n\n".join(context_chunks) if context_chunks else "No relevant documents found."
            
            # Create prompt for LLM
            messages = [
                {
                    "role": "system",
                    "content": """You are DocINX, an AI assistant that helps users understand and analyze their documents. 
                    Use the provided context from the user's documents to answer their questions accurately and helpfully.
                    If the context doesn't contain relevant information, say so clearly.
                    Always be concise but comprehensive in your responses."""
                },
                {
                    "role": "user",
                    "content": f"""Context from documents:
                    {context}
                    
                    Question: {query}
                    
                    Please answer based on the provided context."""
                }
            ]
            
            # Generate response using LLM
            answer = await self.openai_service.generate_chat_completion(messages)
            
            # Store assistant message
            await self.create_chat_message(db, session_id, "assistant", answer, sources)
            
            return {
                "answer": answer,
                "sources": sources
            }
            
        except Exception as e:
            error_message = f"Sorry, I encountered an error processing your query: {str(e)}"
            
            # Store error message
            await self.create_chat_message(db, session_id, "assistant", error_message)
            
            return {
                "answer": error_message,
                "sources": []
            }