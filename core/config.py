import os
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql://localhost:5432/postgres"
    
    class Config:
        env_file = ".env"
        
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Use environment DATABASE_URL if available
        if os.getenv("DATABASE_URL"):
            self.database_url = os.getenv("DATABASE_URL")
    
    # OpenAI
    openai_api_key: Optional[str] = os.getenv("OPENAI_API_KEY")
    openai_model: str = "gpt-4"
    
    # Anthropic (fallback LLM)
    anthropic_api_key: Optional[str] = os.getenv("ANTHROPIC_API_KEY")
    
    # Redis for queue processing
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    
    # Embedding settings
    embedding_model: str = "text-embedding-3-small"
    embedding_dimensions: int = 1536
    
    # RAG settings (enhanced)
    chunk_size: int = 1000
    chunk_overlap: int = 200
    max_chunks_context: int = 10
    similarity_threshold: float = 0.7
    
    # Chat settings
    max_context_length: int = 4000
    max_sources: int = 5
    
    # Circuit breaker settings
    embedding_failure_threshold: int = 5
    embedding_recovery_timeout: int = 300  # 5 minutes
    llm_failure_threshold: int = 3
    llm_recovery_timeout: int = 180  # 3 minutes
    
    # Search settings
    vector_similarity_threshold: float = 0.7
    search_cache_ttl: int = 300  # 5 minutes
    
    # Queue settings
    celery_task_time_limit: int = 300  # 5 minutes
    celery_soft_time_limit: int = 240  # 4 minutes
    max_retries: int = 5
    
    # File processing (enhanced)
    max_file_size: int = 50 * 1024 * 1024  # 50MB (increased)
    supported_file_types: list = ["pdf", "docx", "txt", "csv"]
    
    # S3/MinIO settings (DocINX requirement)
    s3_endpoint: Optional[str] = os.getenv("S3_ENDPOINT")
    s3_access_key: Optional[str] = os.getenv("S3_ACCESS_KEY")
    s3_secret_key: Optional[str] = os.getenv("S3_SECRET_KEY")
    s3_bucket: str = os.getenv("S3_BUCKET", "docinx-documents")
    s3_region: str = os.getenv("S3_REGION", "us-east-1")
    
settings = Settings()