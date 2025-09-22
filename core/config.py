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
        import os
        if os.getenv("DATABASE_URL"):
            self.database_url = os.getenv("DATABASE_URL")
    
    # OpenAI
    openai_api_key: Optional[str] = None
    openai_model: str = "gpt-4"
    
    # Embedding settings
    embedding_model: str = "text-embedding-3-small"
    embedding_dimensions: int = 1536
    
    # RAG settings
    chunk_size: int = 500
    chunk_overlap: int = 100
    max_chunks_context: int = 10
    similarity_threshold: float = 0.1
    
    # File processing
    max_file_size: int = 10 * 1024 * 1024  # 10MB
    supported_file_types: list = ["pdf", "docx", "txt", "csv"]
    
    # S3/MinIO settings (DocINX requirement)
    s3_endpoint: Optional[str] = None
    s3_access_key: Optional[str] = None
    s3_secret_key: Optional[str] = None
    s3_bucket: str = "docinx-documents"
    s3_region: str = "us-east-1"
    
settings = Settings()