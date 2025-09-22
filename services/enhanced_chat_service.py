"""
Enhanced chat service with RAG, multi-provider LLM support, and robust error handling
"""
import logging
import json
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
import asyncio

from db.session import AsyncSessionLocal
from db.models import ChatSession, ChatMessage, Document
from services.vector_search_service import VectorSearchService
from services.multi_llm_service import MultiLLMService
from core.config import settings

logger = logging.getLogger(__name__)

class EnhancedChatService:
    """
    Enhanced chat service with comprehensive RAG implementation
    Features:
    - Multi-provider LLM support with fallbacks
    - Robust vector search with multiple fallback strategies
    - Source citation and context management
    - Conversation memory and context preservation
    """
    
    def __init__(self):
        self.vector_search = VectorSearchService()
        self.llm_service = MultiLLMService()
        self.max_context_length = getattr(settings, 'max_context_length', 4000)
        self.max_sources = getattr(settings, 'max_sources', 5)
    
    async def process_chat_message(
        self,
        user_id: str,
        session_id: str,
        message: str,
        max_tokens: int = 1000
    ) -> Dict[str, Any]:
        """
        Process chat message with comprehensive RAG and error handling
        """
        
        async with AsyncSessionLocal() as db:
            try:
                # Get or create chat session
                session = await self._get_or_create_session(db, session_id, user_id)
                
                # Store user message
                user_msg = ChatMessage(
                    session_id=session_id,
                    role="user",
                    content=message
                )
                db.add(user_msg)
                await db.flush()  # Get the ID
                
                # Perform document search for context
                search_results, search_method = await self.vector_search.search_documents(
                    query=message,
                    user_id=user_id,
                    limit=self.max_sources
                )
                
                # Build conversation context
                conversation_history = await self._get_conversation_history(db, session_id)
                
                # Generate response with context
                response, provider_used, sources = await self._generate_contextual_response(
                    message=message,
                    search_results=search_results,
                    conversation_history=conversation_history,
                    max_tokens=max_tokens,
                    search_method=search_method
                )
                
                # Store assistant response
                assistant_msg = ChatMessage(
                    session_id=session_id,
                    role="assistant",
                    content=response,
                    sources=json.dumps(sources) if sources else None
                )
                db.add(assistant_msg)
                
                await db.commit()
                
                return {
                    "success": True,
                    "response": response,
                    "sources": sources,
                    "metadata": {
                        "provider_used": provider_used,
                        "search_method": search_method,
                        "sources_found": len(search_results),
                        "conversation_length": len(conversation_history) + 2
                    }
                }
                
            except Exception as e:
                await db.rollback()
                logger.error(f"Chat processing failed: {str(e)}")
                
                # Store error message for user
                try:
                    error_response = (
                        "I apologize, but I encountered an issue processing your message. "
                        "Please try again, and if the problem persists, check that your documents "
                        "are properly uploaded and indexed."
                    )
                    
                    assistant_msg = ChatMessage(
                        session_id=session_id,
                        role="assistant",
                        content=error_response,
                        sources=json.dumps([{"error": str(e)}])
                    )
                    db.add(assistant_msg)
                    await db.commit()
                    
                    return {
                        "success": False,
                        "response": error_response,
                        "error": str(e),
                        "metadata": {
                            "provider_used": "error_handler",
                            "search_method": "failed"
                        }
                    }
                except Exception as nested_e:
                    logger.error(f"Failed to store error message: {str(nested_e)}")
                    return {
                        "success": False,
                        "response": "I'm experiencing technical difficulties. Please try again later.",
                        "error": str(e)
                    }
    
    async def _generate_contextual_response(
        self,
        message: str,
        search_results: List[Dict[str, Any]],
        conversation_history: List[Dict[str, str]],
        max_tokens: int,
        search_method: str
    ) -> Tuple[str, str, List[Dict[str, Any]]]:
        """Generate response with context from search results and conversation"""
        
        # Prepare context from search results
        context_parts = []
        sources = []
        
        if search_results:
            context_parts.append("**Relevant Information from Documents:**")
            
            for i, result in enumerate(search_results, 1):
                # Truncate long content for context
                content = result["content"]
                if len(content) > 300:
                    content = content[:300] + "..."
                
                context_parts.append(f"{i}. From '{result['document_title']}':")
                context_parts.append(f"   {content}")
                context_parts.append("")
                
                # Build source reference
                sources.append({
                    "document_id": result["document_id"],
                    "document_title": result["document_title"],
                    "document_filename": result["document_filename"],
                    "chunk_id": result["chunk_id"],
                    "similarity": result["similarity"],
                    "search_method": result["search_method"],
                    "content_preview": content
                })
        
        # Build conversation context
        context_text = "\n".join(context_parts)
        
        # Prepare messages for LLM
        messages = []
        
        # System message with instructions
        system_prompt = self._build_system_prompt(search_method, len(search_results))
        messages.append({"role": "system", "content": system_prompt})
        
        # Add relevant conversation history (limited)
        recent_history = conversation_history[-6:]  # Last 3 exchanges
        for hist_msg in recent_history:
            messages.append(hist_msg)
        
        # Add current context and question
        if context_text:
            user_message_with_context = f"""Context from documents:
{context_text}

User question: {message}

Please answer based on the provided context and our conversation history."""
        else:
            user_message_with_context = f"""No relevant documents found in the knowledge base.

User question: {message}

Please provide a helpful response and suggest how the user might find the information they need."""
        
        messages.append({
            "role": "user", 
            "content": user_message_with_context
        })
        
        # Truncate context if too long
        messages = self._truncate_context(messages, self.max_context_length)
        
        # Generate response with fallbacks
        retrieved_docs = [result["content"] for result in search_results]
        response, provider = await self.llm_service.generate_completion_with_fallback(
            messages=messages,
            max_tokens=max_tokens,
            retrieved_docs=retrieved_docs
        )
        
        return response, provider, sources
    
    def _build_system_prompt(self, search_method: str, sources_count: int) -> str:
        """Build system prompt based on search results and capabilities"""
        
        base_prompt = """You are DocINX, an AI assistant that helps users understand and query their documents. """
        
        if sources_count > 0:
            base_prompt += f"""I found {sources_count} relevant sources using {search_method} search. 

Your task:
1. Answer the user's question based on the provided document context
2. Be specific and cite information from the documents when relevant
3. If the context doesn't fully answer the question, acknowledge what you can and cannot determine
4. Maintain conversation continuity with previous messages
5. Be helpful, accurate, and concise

Format your response clearly and include relevant quotes or references when appropriate."""
        
        else:
            base_prompt += """No relevant documents were found for this query.

Your task:
1. Acknowledge that no specific documents were found
2. Provide general guidance if possible
3. Suggest ways the user might find the information (uploading relevant documents, rephrasing query, etc.)
4. Maintain conversation continuity
5. Be helpful and encouraging

Keep responses constructive and guide the user toward success."""
        
        return base_prompt
    
    def _truncate_context(self, messages: List[Dict[str, str]], max_length: int) -> List[Dict[str, str]]:
        """Truncate conversation context to fit within limits"""
        
        # Calculate total length
        total_length = sum(len(msg["content"]) for msg in messages)
        
        if total_length <= max_length:
            return messages
        
        # Keep system message and current user message, truncate middle
        if len(messages) <= 2:
            return messages
        
        system_msg = messages[0]
        user_msg = messages[-1]
        middle_msgs = messages[1:-1]
        
        # Keep as much recent history as possible
        truncated_middle = []
        remaining_length = max_length - len(system_msg["content"]) - len(user_msg["content"])
        
        for msg in reversed(middle_msgs):
            if len(msg["content"]) < remaining_length:
                truncated_middle.insert(0, msg)
                remaining_length -= len(msg["content"])
            else:
                break
        
        return [system_msg] + truncated_middle + [user_msg]
    
    async def _get_or_create_session(self, db, session_id: str, user_id: str) -> ChatSession:
        """Get existing session or create new one"""
        from sqlalchemy import select
        
        result = await db.execute(
            select(ChatSession).where(ChatSession.id == session_id)
        )
        session = result.scalar_one_or_none()
        
        if not session:
            session = ChatSession(
                id=session_id,
                user_id=user_id
            )
            db.add(session)
            await db.flush()
        
        return session
    
    async def _get_conversation_history(self, db, session_id: str, limit: int = 10) -> List[Dict[str, str]]:
        """Get recent conversation history"""
        from sqlalchemy import select
        
        result = await db.execute(
            select(ChatMessage)
            .where(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at.desc())
            .limit(limit)
        )
        
        messages = result.scalars().all()
        
        # Return in chronological order
        history = []
        for msg in reversed(messages):
            history.append({
                "role": msg.role,
                "content": msg.content
            })
        
        return history
    
    async def get_chat_sessions(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all chat sessions for a user"""
        
        async with AsyncSessionLocal() as db:
            try:
                from sqlalchemy import select
                
                result = await db.execute(
                    select(ChatSession)
                    .where(ChatSession.user_id == user_id)
                    .order_by(ChatSession.created_at.desc())
                )
                
                sessions = result.scalars().all()
                
                session_list = []
                for session in sessions:
                    # Get latest message for preview
                    msg_result = await db.execute(
                        select(ChatMessage)
                        .where(ChatMessage.session_id == session.id)
                        .order_by(ChatMessage.created_at.desc())
                        .limit(1)
                    )
                    latest_msg = msg_result.scalar_one_or_none()
                    
                    session_list.append({
                        "session_id": session.id,
                        "created_at": session.created_at.isoformat(),
                        "latest_message": latest_msg.content[:100] + "..." if latest_msg and len(latest_msg.content) > 100 else latest_msg.content if latest_msg else "",
                        "message_count": len(session.messages) if hasattr(session, 'messages') else 0
                    })
                
                return session_list
                
            except Exception as e:
                logger.error(f"Error getting chat sessions: {str(e)}")
                return []
    
    async def get_chat_history(self, session_id: str, user_id: str) -> List[Dict[str, Any]]:
        """Get full chat history for a session"""
        
        async with AsyncSessionLocal() as db:
            try:
                from sqlalchemy import select
                
                # Verify session belongs to user
                session_result = await db.execute(
                    select(ChatSession).where(
                        ChatSession.id == session_id,
                        ChatSession.user_id == user_id
                    )
                )
                session = session_result.scalar_one_or_none()
                
                if not session:
                    return []
                
                # Get all messages
                result = await db.execute(
                    select(ChatMessage)
                    .where(ChatMessage.session_id == session_id)
                    .order_by(ChatMessage.created_at.asc())
                )
                
                messages = result.scalars().all()
                
                history = []
                for msg in messages:
                    sources = None
                    if msg.sources:
                        try:
                            sources = json.loads(msg.sources)
                        except:
                            sources = None
                    
                    history.append({
                        "message_id": msg.id,
                        "role": msg.role,
                        "content": msg.content,
                        "sources": sources,
                        "created_at": msg.created_at.isoformat()
                    })
                
                return history
                
            except Exception as e:
                logger.error(f"Error getting chat history: {str(e)}")
                return []
    
    def get_service_status(self) -> Dict[str, Any]:
        """Get status of chat service components"""
        return {
            "vector_search": self.vector_search.get_search_stats(),
            "llm_service": self.llm_service.get_service_status(),
            "max_context_length": self.max_context_length,
            "max_sources": self.max_sources
        }