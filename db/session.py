import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from core.config import settings

# Create async engine with proper SSL configuration
database_url = settings.database_url.replace("postgresql://", "postgresql+asyncpg://")

# Remove sslmode parameter if it exists, as asyncpg handles SSL differently
if "sslmode" in database_url:
    # Parse URL and remove sslmode
    from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
    parsed = urlparse(database_url)
    query_params = parse_qs(parsed.query)
    query_params.pop('sslmode', None)
    new_query = urlencode(query_params, doseq=True)
    database_url = urlunparse((
        parsed.scheme, parsed.netloc, parsed.path,
        parsed.params, new_query, parsed.fragment
    ))

engine = create_async_engine(
    database_url,
    echo=False,
    pool_pre_ping=True,
    pool_recycle=300,
)

# Create async session maker
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# Base class for ORM models
Base = declarative_base()


async def init_db():
    """Initialize database tables"""
    async with engine.begin() as conn:
        # Import all models here to ensure they are registered
        from db.models import User, Document, Chunk, ChatSession, ChatMessage
        
        # Create all tables
        await conn.run_sync(Base.metadata.create_all)


async def get_db():
    """Dependency to get database session"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()