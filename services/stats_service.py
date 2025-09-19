from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from datetime import datetime, timedelta
from typing import Dict, Any

from db.models import Document, Chunk, ChatMessage, ChatSession
from services.document_service import DocumentService


class StatsService:
    
    def __init__(self):
        self.document_service = DocumentService()
    
    async def get_document_stats(self, db: AsyncSession) -> Dict[str, int]:
        """Get document statistics"""
        return await self.document_service.get_document_stats(db)
    
    async def get_chat_stats(self, db: AsyncSession) -> Dict[str, int]:
        """Get chat statistics"""
        try:
            today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
            
            result = await db.execute(
                select(func.count(ChatMessage.id))
                .where(
                    and_(
                        ChatMessage.role == "user",
                        ChatMessage.created_at >= today
                    )
                )
            )
            
            today_queries = result.scalar() or 0
            
            return {
                "today_queries": int(today_queries)
            }
            
        except Exception as e:
            print(f"Error getting chat statistics: {str(e)}")
            return {"today_queries": 0}
    
    async def get_active_user_stats(self, db: AsyncSession) -> Dict[str, int]:
        """Get active user statistics"""
        try:
            twenty_four_hours_ago = datetime.now() - timedelta(hours=24)
            
            # Count unique users who have sent messages in the last 24 hours
            result = await db.execute(
                select(func.count(func.distinct(ChatSession.user_id)))
                .select_from(ChatSession)
                .join(ChatMessage, ChatSession.id == ChatMessage.session_id)
                .where(ChatMessage.created_at >= twenty_four_hours_ago)
            )
            
            active_users = result.scalar() or 0
            
            return {
                "active_users": int(active_users)
            }
            
        except Exception as e:
            print(f"Error getting active user statistics: {str(e)}")
            return {"active_users": 0}
    
    async def get_admin_stats(self, db: AsyncSession) -> Dict[str, Any]:
        """Get admin statistics"""
        try:
            # Total embeddings count
            embeddings_result = await db.execute(
                select(func.count(Chunk.id)).where(Chunk.embedding.isnot(None))
            )
            total_embeddings = embeddings_result.scalar() or 0
            
            # Storage used calculation
            storage_result = await db.execute(
                select(func.coalesce(func.sum(Document.file_size), 0))
            )
            total_bytes = storage_result.scalar() or 0
            storage_used_gb = round(total_bytes / (1024 * 1024 * 1024), 2)
            
            # Average processing time
            avg_time_result = await db.execute(
                select(
                    func.coalesce(
                        func.avg(
                            func.extract('epoch', Document.processed_at - Document.uploaded_at) / 60
                        ), 
                        0
                    )
                ).where(
                    and_(
                        Document.status == "ready",
                        Document.processed_at.isnot(None)
                    )
                )
            )
            avg_minutes = avg_time_result.scalar() or 0
            
            # Vector DB health check
            vector_db_health = "healthy"
            try:
                await db.execute(select(func.count(Chunk.id)).limit(1))
            except Exception:
                vector_db_health = "unhealthy"
            
            return {
                "total_embeddings": int(total_embeddings),
                "avg_processing_time": f"{int(avg_minutes)} min",
                "vector_db_health": vector_db_health,
                "storage_used": f"{storage_used_gb} GB",
                "storage_limit": "100 GB"
            }
            
        except Exception as e:
            print(f"Error getting admin stats: {str(e)}")
            return {
                "total_embeddings": 0,
                "avg_processing_time": "0 min",
                "vector_db_health": "unknown",
                "storage_used": "0 GB",
                "storage_limit": "100 GB"
            }