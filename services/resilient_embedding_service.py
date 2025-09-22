"""
Resilient embedding service with OpenAI primary + local fallbacks
Implements circuit breakers, retry logic, and graceful degradation
"""
import time
import random
import logging
import hashlib
import asyncio
from typing import List, Optional, Tuple, Dict, Any
import numpy as np
from tenacity import retry, stop_after_attempt, wait_exponential

from services.openai_service import OpenAIService
from core.config import settings

logger = logging.getLogger(__name__)

class LocalEmbeddingService:
    """Local embedding fallback using TF-IDF and simple similarity"""
    
    def __init__(self):
        self.tfidf_vectorizer = None
        self.model_loaded = False
        
    def _load_simple_vectorizer(self):
        """Load simple TF-IDF vectorizer as fallback"""
        try:
            from sklearn.feature_extraction.text import TfidfVectorizer
            self.tfidf_vectorizer = TfidfVectorizer(
                max_features=1536,  # Match OpenAI embedding dimensions
                stop_words='english',
                ngram_range=(1, 2)
            )
            self.model_loaded = True
            logger.info("Local TF-IDF vectorizer loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load TF-IDF vectorizer: {str(e)}")
            self.model_loaded = False
    
    def generate_embedding(self, text: str) -> Optional[List[float]]:
        """Generate embedding using local methods"""
        try:
            if not self.model_loaded:
                self._load_simple_vectorizer()
            
            if self.model_loaded and self.tfidf_vectorizer:
                # For single text, we need to fit on a small corpus first
                # This is a simplified approach for fallback
                corpus = [text, "sample text for fitting", "another sample"]
                tfidf_matrix = self.tfidf_vectorizer.fit_transform(corpus)
                embedding = tfidf_matrix[0].toarray()[0].tolist()
                
                # Pad or truncate to match OpenAI dimensions
                target_dim = 1536
                if len(embedding) < target_dim:
                    embedding.extend([0.0] * (target_dim - len(embedding)))
                elif len(embedding) > target_dim:
                    embedding = embedding[:target_dim]
                
                return embedding
            else:
                # Ultimate fallback: deterministic hash-based embedding
                return self._generate_hash_embedding(text)
                
        except Exception as e:
            logger.error(f"Local embedding generation failed: {str(e)}")
            return self._generate_hash_embedding(text)
    
    def _generate_hash_embedding(self, text: str) -> List[float]:
        """Generate deterministic embedding from text hash"""
        # Create multiple hashes for better distribution
        embeddings = []
        for i in range(12):  # Create 12 chunks of 128 dimensions each = 1536
            hash_input = f"{text}_{i}".encode()
            hash_obj = hashlib.md5(hash_input)
            seed = int(hash_obj.hexdigest()[:8], 16)
            np.random.seed(seed)
            chunk = np.random.normal(0, 0.1, 128).tolist()
            embeddings.extend(chunk)
        
        return embeddings[:1536]  # Ensure exactly 1536 dimensions

class CircuitBreaker:
    """Circuit breaker for embedding service calls"""
    
    def __init__(self, failure_threshold=5, recovery_timeout=300, success_threshold=3):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.success_threshold = success_threshold
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time = None
        self.state = 'CLOSED'  # CLOSED, OPEN, HALF_OPEN
        
    def can_execute(self) -> bool:
        """Check if circuit breaker allows execution"""
        if self.state == 'CLOSED':
            return True
        elif self.state == 'OPEN':
            if time.time() - self.last_failure_time > self.recovery_timeout:
                self.state = 'HALF_OPEN'
                self.success_count = 0
                logger.info("Circuit breaker moving to HALF_OPEN state")
                return True
            return False
        elif self.state == 'HALF_OPEN':
            return True
    
    def on_success(self):
        """Record successful execution"""
        if self.state == 'HALF_OPEN':
            self.success_count += 1
            if self.success_count >= self.success_threshold:
                self.state = 'CLOSED'
                self.failure_count = 0
                logger.info("Circuit breaker moving to CLOSED state")
        elif self.state == 'CLOSED':
            self.failure_count = max(0, self.failure_count - 1)
    
    def on_failure(self):
        """Record failed execution"""
        self.failure_count += 1
        self.last_failure_time = time.time()
        
        if self.state == 'HALF_OPEN':
            self.state = 'OPEN'
            logger.warning("Circuit breaker moving back to OPEN state")
        elif self.failure_count >= self.failure_threshold:
            self.state = 'OPEN'
            logger.warning(f"Circuit breaker OPEN after {self.failure_count} failures")

class ResilientEmbeddingService:
    """
    Resilient embedding service with multiple fallback strategies
    Primary: OpenAI API
    Secondary: Local TF-IDF
    Tertiary: Hash-based deterministic embeddings
    """
    
    def __init__(self):
        self.openai_service = OpenAIService()
        self.local_service = LocalEmbeddingService()
        self.circuit_breaker = CircuitBreaker()
        self.embedding_cache = {}  # Simple in-memory cache
        
    async def generate_embedding_with_fallback(self, text: str) -> Tuple[Optional[List[float]], str]:
        """
        Generate embedding with comprehensive fallback strategy
        Returns: (embedding, provider_used)
        """
        # Check cache first
        text_hash = hashlib.md5(text.encode()).hexdigest()
        if text_hash in self.embedding_cache:
            logger.debug("Embedding served from cache")
            return self.embedding_cache[text_hash], "cache"
        
        # Attempt primary provider (OpenAI) with circuit breaker
        if self.circuit_breaker.can_execute():
            try:
                embedding = await self._try_openai_embedding(text)
                if embedding:
                    self.circuit_breaker.on_success()
                    self.embedding_cache[text_hash] = embedding
                    return embedding, "openai"
                else:
                    self.circuit_breaker.on_failure()
            except Exception as e:
                logger.warning(f"OpenAI embedding failed: {str(e)}")
                self.circuit_breaker.on_failure()
        else:
            logger.warning("OpenAI circuit breaker OPEN - skipping primary provider")
        
        # Fallback to local embedding service
        try:
            logger.info("Attempting local embedding fallback")
            embedding = await asyncio.to_thread(self.local_service.generate_embedding, text)
            if embedding:
                self.embedding_cache[text_hash] = embedding
                return embedding, "local_tfidf"
        except Exception as e:
            logger.error(f"Local embedding failed: {str(e)}")
        
        # Ultimate fallback: hash-based embedding
        try:
            logger.warning("Using hash-based embedding fallback")
            embedding = await asyncio.to_thread(self.local_service._generate_hash_embedding, text)
            self.embedding_cache[text_hash] = embedding
            return embedding, "hash_fallback"
        except Exception as e:
            logger.error(f"Hash embedding fallback failed: {str(e)}")
            return None, "failed"
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=8)
    )
    async def _try_openai_embedding(self, text: str) -> Optional[List[float]]:
        """Try OpenAI embedding with retries"""
        try:
            if not settings.openai_api_key:
                # No API key - skip OpenAI
                return None
            
            embedding = await self.openai_service.generate_embedding(text)
            return embedding
            
        except Exception as e:
            # Check if it's a quota/rate limit error
            error_str = str(e).lower()
            if any(keyword in error_str for keyword in ['quota', 'rate_limit', '429', 'insufficient']):
                logger.warning(f"OpenAI quota/rate limit hit: {str(e)}")
                return None  # Don't retry quota errors
            
            # For other errors, let tenacity handle retries
            raise e
    
    def get_circuit_breaker_status(self) -> Dict[str, Any]:
        """Get current circuit breaker status for monitoring"""
        return {
            "state": self.circuit_breaker.state,
            "failure_count": self.circuit_breaker.failure_count,
            "success_count": self.circuit_breaker.success_count,
            "can_execute": self.circuit_breaker.can_execute(),
            "cache_size": len(self.embedding_cache)
        }
    
    def clear_cache(self):
        """Clear embedding cache"""
        self.embedding_cache.clear()
        logger.info("Embedding cache cleared")
    
    async def batch_generate_embeddings(self, texts: List[str]) -> List[Tuple[Optional[List[float]], str]]:
        """Generate embeddings for multiple texts efficiently"""
        results = []
        
        # Process in batches to avoid overwhelming the API
        batch_size = 10
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            batch_results = []
            
            for text in batch:
                embedding, provider = await self.generate_embedding_with_fallback(text)
                batch_results.append((embedding, provider))
                
                # Small delay between requests to avoid rate limiting
                await asyncio.sleep(0.1)
            
            results.extend(batch_results)
            
            # Longer delay between batches
            if i + batch_size < len(texts):
                await asyncio.sleep(1)
        
        return results