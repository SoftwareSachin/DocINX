import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
import uvicorn

from api.routers import documents, chat, stats, admin
from core.config import settings
from db.session import init_db
from services.queue_processor import get_queue_health
from services.enhanced_chat_service import EnhancedChatService
from services.vector_search_service import VectorSearchService
from services.multi_llm_service import MultiLLMService

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("DocINX Enhanced API starting up...")
    await init_db()
    
    # Initialize enhanced services
    app.state.chat_service = EnhancedChatService()
    app.state.search_service = VectorSearchService()
    app.state.llm_service = MultiLLMService()
    
    logger.info("Multi-provider LLM system initialized")
    logger.info("Resilient embedding service initialized")
    logger.info("Queue-based processing ready")
    logger.info("DocINX Enhanced API startup complete")
    
    yield
    
    # Shutdown
    logger.info("DocINX Enhanced API shutting down...")
    try:
        app.state.search_service.clear_search_cache()
        app.state.llm_service.clear_cache()
        logger.info("Service caches cleared")
    except Exception as e:
        logger.error(f"Error during shutdown: {str(e)}")


app = FastAPI(
    title="DocINX API - Enhanced",
    description="Comprehensive document intelligence platform with robust AI capabilities, multi-provider fallbacks, and resilient processing",
    version="2.0.0",
    lifespan=lifespan
)

# CORS middleware (Open for demo)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Open access as requested
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global exception handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={"message": exc.detail}
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    return JSONResponse(
        status_code=422,
        content={"message": f"Validation error: {str(exc)}"}
    )


@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={"message": "Internal server error"}
    )


# Include routers
app.include_router(documents.router, prefix="/api", tags=["documents"])
app.include_router(chat.router, prefix="/api", tags=["chat"])
app.include_router(stats.router, prefix="/api", tags=["stats"])
app.include_router(admin.router, prefix="/api", tags=["admin"])


@app.get("/")
async def root():
    return {
        "message": "DocINX API v2.0 - Document Intelligence Platform (No Auth Mode)",
        "features": [
            "Multi-provider LLM fallbacks (OpenAI, Anthropic, Deterministic)",
            "Resilient embedding generation with local fallbacks",
            "Queue-based document processing with retry logic",
            "Vector search with BM25 and keyword fallbacks",
            "Circuit breaker protection for all services",
            "Comprehensive monitoring and health checks",
            "Support for PDF, DOCX, TXT, CSV formats",
            "Enhanced RAG with source citation"
        ],
        "status": "running",
        "security": "disabled - no authentication required"
    }

@app.get("/health")
async def health():
    """Comprehensive health check including all service components"""
    try:
        # Check queue health
        queue_health = get_queue_health()
        
        # Check services if available
        health_data = {
            "status": "healthy",
            "service": "DocINX API (No Auth)",
            "version": "2.0.0",
            "security": "disabled",
            "queue_processor": queue_health
        }
        
        # Add service health if initialized
        if hasattr(app.state, 'chat_service'):
            health_data["chat_service"] = app.state.chat_service.get_service_status()
        if hasattr(app.state, 'search_service'):
            health_data["search_service"] = app.state.search_service.get_search_stats()
        if hasattr(app.state, 'llm_service'):
            health_data["llm_service"] = app.state.llm_service.get_service_status()
        
        health_data["capabilities"] = {
            "document_formats": ["PDF", "DOCX", "TXT", "CSV"],
            "embedding_providers": ["OpenAI", "Local TF-IDF", "Hash fallback"],
            "llm_providers": ["OpenAI", "Anthropic", "Deterministic fallback"],
            "search_methods": ["Vector similarity", "Full-text", "Keyword"]
        }
        
        return health_data
        
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return {
            "status": "degraded",
            "service": "DocINX Enhanced API",
            "error": str(e)
        }

@app.get("/api/system/status")
async def system_status():
    """Detailed system status for monitoring and debugging"""
    try:
        status_data = {
            "queue_health": get_queue_health(),
            "timestamp": "now"
        }
        
        if hasattr(app.state, 'chat_service'):
            status_data["chat_service"] = app.state.chat_service.get_service_status()
        if hasattr(app.state, 'search_service'):
            status_data["search_service"] = app.state.search_service.get_search_stats()
        if hasattr(app.state, 'llm_service'):
            status_data["llm_service"] = app.state.llm_service.get_service_status()
        
        return status_data
    except Exception as e:
        return {"error": str(e), "status": "error"}


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )