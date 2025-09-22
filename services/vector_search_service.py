"""
Robust vector search service with pgvector primary and BM25 fallback
Implements semantic search with graceful degradation to keyword search
"""
import logging
from typing import List, Dict, Any, Optional, Tuple
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text, func
from sqlalchemy.sql import Select

from db.session import AsyncSessionLocal
from db.models import Chunk, Document
from services.resilient_embedding_service import ResilientEmbeddingService
from core.config import settings

logger = logging.getLogger(__name__)

class VectorSearchService:
    """
    Comprehensive vector search with multiple fallback strategies:
    1. Primary: pgvector cosine similarity search
    2. Secondary: PostgreSQL full-text search (tsvector)
    3. Tertiary: Simple keyword matching with TF-IDF scoring
    """
    
    def __init__(self):
        self.embedding_service = ResilientEmbeddingService()
        self.search_cache = {}  # Cache search results
    
    async def search_documents(
        self,
        query: str,
        user_id: str,
        limit: int = 10,
        similarity_threshold: float = 0.7
    ) -> Tuple[List[Dict[str, Any]], str]:
        """
        Search documents with comprehensive fallback strategy
        Returns: (results, search_method_used)
        """
        
        # Check cache first
        cache_key = f"{query}_{user_id}_{limit}_{similarity_threshold}"
        if cache_key in self.search_cache:
            logger.debug("Search results served from cache")
            return self.search_cache[cache_key], "cache"
        
        # Try vector search first
        try:
            results = await self._vector_search(query, user_id, limit, similarity_threshold)
            if results:
                self.search_cache[cache_key] = results
                return results, "vector_search"
        except Exception as e:
            logger.warning(f"Vector search failed: {str(e)}")
        
        # Fallback to full-text search
        try:
            results = await self._fulltext_search(query, user_id, limit)
            if results:
                self.search_cache[cache_key] = results
                return results, "fulltext_search"
        except Exception as e:
            logger.warning(f"Full-text search failed: {str(e)}")
        
        # Ultimate fallback: keyword search
        try:
            results = await self._keyword_search(query, user_id, limit)
            self.search_cache[cache_key] = results
            return results, "keyword_search"
        except Exception as e:
            logger.error(f"All search methods failed: {str(e)}")
            return [], "search_failed"
    
    async def _vector_search(
        self,
        query: str,
        user_id: str,
        limit: int,
        similarity_threshold: float
    ) -> Optional[List[Dict[str, Any]]]:
        """Perform vector similarity search using pgvector"""
        
        # Generate query embedding
        query_embedding, embedding_provider = await self.embedding_service.generate_embedding_with_fallback(query)
        
        if not query_embedding:
            logger.warning("Could not generate query embedding")
            return None
        
        async with AsyncSessionLocal() as db:
            try:
                # Use pgvector cosine similarity search
                query_sql = text("""
                    SELECT 
                        c.id,
                        c.content,
                        c.char_start,
                        c.char_end,
                        c.chunk_index,
                        d.id as document_id,
                        d.title,
                        d.filename,
                        d.uploader_id,
                        1 - (c.embedding <=> :query_embedding) as similarity
                    FROM chunks c
                    JOIN documents d ON c.document_id = d.id
                    WHERE d.uploader_id = :user_id
                    AND d.status = 'ready'
                    AND c.embedding IS NOT NULL
                    AND 1 - (c.embedding <=> :query_embedding) > :threshold
                    ORDER BY c.embedding <=> :query_embedding
                    LIMIT :limit
                """)
                
                result = await db.execute(query_sql, {
                    "query_embedding": query_embedding,
                    "user_id": user_id,
                    "threshold": similarity_threshold,
                    "limit": limit
                })
                
                rows = result.fetchall()
                
                results = []
                for row in rows:
                    results.append({
                        "chunk_id": row.id,
                        "content": row.content,
                        "char_start": row.char_start,
                        "char_end": row.char_end,
                        "chunk_index": row.chunk_index,
                        "document_id": row.document_id,
                        "document_title": row.title,
                        "document_filename": row.filename,
                        "similarity": float(row.similarity),
                        "search_method": "vector",
                        "embedding_provider": embedding_provider
                    })
                
                logger.info(f"Vector search returned {len(results)} results using {embedding_provider}")
                return results
                
            except Exception as e:
                logger.error(f"Vector search database error: {str(e)}")
                return None
    
    async def _fulltext_search(
        self,
        query: str,
        user_id: str,
        limit: int
    ) -> Optional[List[Dict[str, Any]]]:
        """Perform PostgreSQL full-text search using tsvector"""
        
        async with AsyncSessionLocal() as db:
            try:
                # First, ensure we have tsvector columns (create if needed)
                await self._ensure_fulltext_indices(db)
                
                # Perform full-text search
                query_sql = text("""
                    SELECT 
                        c.id,
                        c.content,
                        c.char_start,
                        c.char_end,
                        c.chunk_index,
                        d.id as document_id,
                        d.title,
                        d.filename,
                        d.uploader_id,
                        ts_rank(to_tsvector('english', c.content), plainto_tsquery('english', :query)) as rank
                    FROM chunks c
                    JOIN documents d ON c.document_id = d.id
                    WHERE d.uploader_id = :user_id
                    AND d.status = 'ready'
                    AND to_tsvector('english', c.content) @@ plainto_tsquery('english', :query)
                    ORDER BY ts_rank(to_tsvector('english', c.content), plainto_tsquery('english', :query)) DESC
                    LIMIT :limit
                """)
                
                result = await db.execute(query_sql, {
                    "query": query,
                    "user_id": user_id,
                    "limit": limit
                })
                
                rows = result.fetchall()
                
                results = []
                for row in rows:
                    results.append({
                        "chunk_id": row.id,
                        "content": row.content,
                        "char_start": row.char_start,
                        "char_end": row.char_end,
                        "chunk_index": row.chunk_index,
                        "document_id": row.document_id,
                        "document_title": row.title,
                        "document_filename": row.filename,
                        "similarity": float(row.rank),
                        "search_method": "fulltext",
                        "embedding_provider": "postgresql"
                    })
                
                logger.info(f"Full-text search returned {len(results)} results")
                return results
                
            except Exception as e:
                logger.error(f"Full-text search error: {str(e)}")
                return None
    
    async def _keyword_search(
        self,
        query: str,
        user_id: str,
        limit: int
    ) -> List[Dict[str, Any]]:
        """Simple keyword search as ultimate fallback"""
        
        async with AsyncSessionLocal() as db:
            try:
                # Split query into keywords
                keywords = query.lower().split()
                
                # Simple ILIKE search for keywords
                conditions = []
                for keyword in keywords:
                    conditions.append(f"LOWER(c.content) LIKE '%{keyword}%'")
                
                where_clause = " OR ".join(conditions) if conditions else "1=1"
                
                query_sql = text(f"""
                    SELECT 
                        c.id,
                        c.content,
                        c.char_start,
                        c.char_end,
                        c.chunk_index,
                        d.id as document_id,
                        d.title,
                        d.filename,
                        d.uploader_id
                    FROM chunks c
                    JOIN documents d ON c.document_id = d.id
                    WHERE d.uploader_id = :user_id
                    AND d.status = 'ready'
                    AND ({where_clause})
                    ORDER BY char_length(c.content) ASC
                    LIMIT :limit
                """)
                
                result = await db.execute(query_sql, {
                    "user_id": user_id,
                    "limit": limit
                })
                
                rows = result.fetchall()
                
                results = []
                for i, row in enumerate(rows):
                    # Simple scoring based on keyword matches
                    content_lower = row.content.lower()
                    score = sum(1 for keyword in keywords if keyword in content_lower)
                    score = score / len(keywords) if keywords else 0
                    
                    results.append({
                        "chunk_id": row.id,
                        "content": row.content,
                        "char_start": row.char_start,
                        "char_end": row.char_end,
                        "chunk_index": row.chunk_index,
                        "document_id": row.document_id,
                        "document_title": row.title,
                        "document_filename": row.filename,
                        "similarity": score,
                        "search_method": "keyword",
                        "embedding_provider": "none"
                    })
                
                # Sort by score
                results.sort(key=lambda x: x["similarity"], reverse=True)
                
                logger.info(f"Keyword search returned {len(results)} results")
                return results
                
            except Exception as e:
                logger.error(f"Keyword search error: {str(e)}")
                return []
    
    async def _ensure_fulltext_indices(self, db: AsyncSession):
        """Ensure full-text search indices exist"""
        try:
            # Check if we need to create indices
            # This is a simplified version - in production you'd use proper migrations
            index_sql = text("""
                CREATE INDEX IF NOT EXISTS chunks_content_fts_idx 
                ON chunks USING gin(to_tsvector('english', content))
            """)
            await db.execute(index_sql)
            await db.commit()
            
        except Exception as e:
            logger.warning(f"Could not create full-text indices: {str(e)}")
            # Not critical - full-text search will still work, just slower
            pass
    
    async def get_document_chunks(
        self,
        document_id: str,
        user_id: str
    ) -> List[Dict[str, Any]]:
        """Get all chunks for a specific document"""
        
        async with AsyncSessionLocal() as db:
            try:
                query = select(Chunk, Document).join(Document).where(
                    Document.id == document_id,
                    Document.uploader_id == user_id,
                    Document.status == 'ready'
                ).order_by(Chunk.chunk_index)
                
                result = await db.execute(query)
                rows = result.fetchall()
                
                chunks = []
                for row in rows:
                    chunk, document = row
                    chunks.append({
                        "chunk_id": chunk.id,
                        "content": chunk.content,
                        "char_start": chunk.char_start,
                        "char_end": chunk.char_end,
                        "chunk_index": chunk.chunk_index,
                        "document_id": document.id,
                        "document_title": document.title,
                        "document_filename": document.filename,
                        "has_embedding": chunk.embedding is not None
                    })
                
                return chunks
                
            except Exception as e:
                logger.error(f"Error getting document chunks: {str(e)}")
                return []
    
    async def reindex_document_embeddings(self, document_id: str, user_id: str) -> Dict[str, Any]:
        """Reindex embeddings for a specific document"""
        
        async with AsyncSessionLocal() as db:
            try:
                # Get all chunks for this document
                query = select(Chunk, Document).join(Document).where(
                    Document.id == document_id,
                    Document.uploader_id == user_id
                ).order_by(Chunk.chunk_index)
                
                result = await db.execute(query)
                rows = result.fetchall()
                
                if not rows:
                    return {"success": False, "message": "Document not found or no chunks"}
                
                reindex_success = 0
                reindex_failed = 0
                
                for row in rows:
                    chunk, document = row
                    try:
                        # Generate new embedding
                        embedding, provider = await self.embedding_service.generate_embedding_with_fallback(
                            chunk.content
                        )
                        
                        if embedding:
                            chunk.embedding = embedding
                            reindex_success += 1
                        else:
                            reindex_failed += 1
                            
                    except Exception as e:
                        logger.error(f"Failed to reindex chunk {chunk.id}: {str(e)}")
                        reindex_failed += 1
                
                await db.commit()
                
                return {
                    "success": True,
                    "reindex_success": reindex_success,
                    "reindex_failed": reindex_failed,
                    "total_chunks": len(rows)
                }
                
            except Exception as e:
                logger.error(f"Reindex failed: {str(e)}")
                return {"success": False, "message": str(e)}
    
    def clear_search_cache(self):
        """Clear search result cache"""
        self.search_cache.clear()
        logger.info("Search cache cleared")
    
    def get_search_stats(self) -> Dict[str, Any]:
        """Get search service statistics"""
        return {
            "cache_size": len(self.search_cache),
            "embedding_service_status": self.embedding_service.get_circuit_breaker_status()
        }