import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str = os.getenv("DATABASE_URL", "")
    
    # OpenAI
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    openai_model: str = "gpt-4"
    openai_embedding_model: str = "text-embedding-3-small"
    
    # Document processing
    max_file_size: int = 10 * 1024 * 1024  # 10MB
    chunk_size: int = 500
    chunk_overlap: int = 50
    
    # Vector search
    similarity_threshold: float = 0.7
    max_chunks_context: int = 5
    
    # Environment
    environment: str = os.getenv("NODE_ENV", "development")
    debug: bool = environment == "development"
    
    class Config:
        env_file = ".env"


settings = Settings()