from pydantic import BaseModel
from typing import Optional


class DashboardStats(BaseModel):
    total_documents: int
    processing: int
    queries_today: int
    active_users: int
    
    # Admin stats
    documents_processed_today: Optional[int] = None
    failed_processing: Optional[int] = None
    total_embeddings: Optional[int] = None
    avg_processing_time: Optional[str] = None
    vector_db_health: Optional[str] = None
    storage_used: Optional[str] = None
    storage_limit: Optional[str] = None