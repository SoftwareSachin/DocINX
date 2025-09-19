import numpy as np
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import List, Tuple

from db.models import Chunk, Document
from core.config import settings


class VectorService:
    
    def cosine_similarity(self, a: List[float], b: List[float]) -> float:
        """Calculate cosine similarity between two vectors"""
        a_np = np.array(a)
        b_np = np.array(b)
        
        dot_product = np.dot(a_np, b_np)
        norm_a = np.linalg.norm(a_np)
        norm_b = np.linalg.norm(b_np)
        
        if norm_a == 0 or norm_b == 0:
            return 0.0
        
        return dot_product / (norm_a * norm_b)
    
    async def search_similar_chunks(
        self,
        db: AsyncSession,
        query_embedding: List[float],
        user_id: str,
        limit: int = None
    ) -> List[Tuple[Chunk, Document, float]]:
        """Search for similar chunks using cosine similarity"""
        if limit is None:
            limit = settings.max_chunks_context
        
        # Get all chunks from ready documents for the user
        result = await db.execute(
            select(Chunk, Document)
            .join(Document, Chunk.document_id == Document.id)
            .where(
                and_(
                    Document.status == "ready",
                    Document.uploader_id == user_id,
                    Chunk.embedding.isnot(None)
                )
            )
        )
        
        chunks_with_docs = result.all()
        
        # Calculate similarities
        similarities = []
        for chunk, document in chunks_with_docs:
            if chunk.embedding:
                similarity = self.cosine_similarity(query_embedding, chunk.embedding)
                similarities.append((chunk, document, similarity))
        
        # Sort by similarity and return top results
        similarities.sort(key=lambda x: x[2], reverse=True)
        
        # Filter by threshold and limit
        filtered_results = [
            result for result in similarities
            if result[2] >= settings.similarity_threshold
        ]
        
        return filtered_results[:limit]