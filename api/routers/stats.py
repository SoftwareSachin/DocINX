from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from db.session import get_db
from schemas.stats import DashboardStats
from services.stats_service import StatsService

router = APIRouter()
stats_service = StatsService()


@router.get("/stats/dashboard", response_model=DashboardStats)
async def get_dashboard_stats(db: AsyncSession = Depends(get_db)):
    """Get dashboard statistics"""
    try:
        # Get document stats
        doc_stats = await stats_service.get_document_stats(db)
        
        # Get chat stats
        chat_stats = await stats_service.get_chat_stats(db)
        
        # Get active user stats
        active_user_stats = await stats_service.get_active_user_stats(db)
        
        # Get admin stats (always show in non-auth mode)
        admin_stats = await stats_service.get_admin_stats(db)
        
        return DashboardStats(
            total_documents=doc_stats["total"],
            processing=doc_stats["processing"],
            queries_today=chat_stats["today_queries"],
            active_users=active_user_stats["active_users"],
            documents_processed_today=doc_stats["ready"],
            failed_processing=doc_stats["failed"],
            total_embeddings=admin_stats["total_embeddings"],
            avg_processing_time=admin_stats["avg_processing_time"],
            vector_db_health=admin_stats["vector_db_health"],
            storage_used=admin_stats["storage_used"],
            storage_limit=admin_stats["storage_limit"]
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to fetch dashboard stats")