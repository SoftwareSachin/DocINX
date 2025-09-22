"""
Robust document processing queue with Celery and Redis
Implements exponential backoff, circuit breaker, and fallback mechanisms
"""
import time
import random
import logging
from typing import List, Dict, Any, Optional
from celery import Celery
from celery.signals import worker_ready
import redis
from sqlalchemy.ext.asyncio import AsyncSession
import asyncio
from contextlib import asynccontextmanager

from db.session import AsyncSessionLocal
from services.document_service import DocumentService
from services.resilient_embedding_service import ResilientEmbeddingService
from core.config import settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Celery
celery_app = Celery(
    'docinx_queue',
    broker=settings.redis_url or 'redis://localhost:6379/0',
    backend=settings.redis_url or 'redis://localhost:6379/0',
    include=['services.queue_processor']
)

# Celery configuration for robustness
celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    task_routes={
        'services.queue_processor.process_document_task': {'queue': 'document_processing'},
        'services.queue_processor.retry_failed_embeddings': {'queue': 'retry_processing'}
    },
    task_default_retry_delay=60,  # 1 minute default retry delay
    task_max_retries=5,
    worker_prefetch_multiplier=1,  # Prevent worker from grabbing too many tasks
    task_acks_late=True,  # Acknowledge task only after completion
    worker_disable_rate_limits=False,
    task_time_limit=300,  # 5 minutes per task
    task_soft_time_limit=240,  # 4 minutes soft limit
)

# Circuit breaker state
class CircuitBreaker:
    def __init__(self, failure_threshold=5, recovery_timeout=300):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.failure_count = 0
        self.last_failure_time = None
        self.state = 'CLOSED'  # CLOSED, OPEN, HALF_OPEN

    def can_execute(self):
        if self.state == 'CLOSED':
            return True
        elif self.state == 'OPEN':
            if time.time() - self.last_failure_time > self.recovery_timeout:
                self.state = 'HALF_OPEN'
                return True
            return False
        elif self.state == 'HALF_OPEN':
            return True

    def on_success(self):
        self.failure_count = 0
        self.state = 'CLOSED'

    def on_failure(self):
        self.failure_count += 1
        self.last_failure_time = time.time()
        if self.failure_count >= self.failure_threshold:
            self.state = 'OPEN'

# Global circuit breakers
embedding_circuit_breaker = CircuitBreaker()
llm_circuit_breaker = CircuitBreaker()

def exponential_backoff_sleep(base=0.5, attempt=1, max_sleep=10.0):
    """Sleep with exponential backoff and jitter"""
    jitter = random.uniform(0, base)
    sleep = min(max_sleep, (2 ** (attempt-1)) * base + jitter)
    time.sleep(sleep)

@asynccontextmanager
async def get_async_session():
    """Async context manager for database sessions"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

@celery_app.task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_jitter=True)
def process_document_task(self, document_id: str, file_content_bytes: bytes):
    """
    Celery task for robust document processing with retries and fallbacks
    """
    logger.info(f"Starting document processing for document_id: {document_id}")
    
    try:
        # Run async processing in event loop
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        result = loop.run_until_complete(
            _process_document_async(document_id, file_content_bytes, self.request.retries)
        )
        
        loop.close()
        logger.info(f"Document processing completed for {document_id}: {result}")
        return result
        
    except Exception as exc:
        logger.error(f"Document processing failed for {document_id}: {str(exc)}")
        
        # Exponential backoff for retries
        countdown = 60 * (2 ** self.request.retries)
        
        # Update document status to show retry attempt
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(_update_document_status(
                document_id, 
                f"indexing_pending_retry_attempt_{self.request.retries + 1}",
                f"Retry {self.request.retries + 1}/5: {str(exc)}"
            ))
            loop.close()
        except:
            pass
        
        raise self.retry(exc=exc, countdown=countdown, max_retries=5)

async def _process_document_async(document_id: str, file_content_bytes: bytes, retry_count: int = 0):
    """Async document processing with robust error handling and fallbacks"""
    
    async with get_async_session() as db:
        document_service = DocumentService()
        embedding_service = ResilientEmbeddingService()
        
        try:
            # Get document
            document = await document_service.get_document(db, document_id)
            if not document:
                raise Exception("Document not found")
            
            # Update status to processing
            await document_service.update_document(
                db=db,
                document_id=document_id,
                status="processing" if retry_count == 0 else f"processing_retry_{retry_count}",
                processed_at=None
            )
            
            # Extract text based on file type
            extracted_text = await _extract_text_robust(document.mime_type, file_content_bytes)
            
            # Update document with extracted text
            await document_service.update_document(
                db=db,
                document_id=document_id,
                extracted_text=extracted_text
            )
            
            # Chunk the text
            chunks = _chunk_text_robust(extracted_text)
            
            # Process chunks with robust embedding generation
            chunks_created = 0
            chunks_failed = 0
            
            for i, chunk in enumerate(chunks):
                try:
                    # Check circuit breaker before attempting embedding
                    if not embedding_circuit_breaker.can_execute():
                        logger.warning(f"Embedding circuit breaker OPEN - skipping chunk {i}")
                        # Store chunk without embedding for later retry
                        await _store_chunk_without_embedding(db, document_id, i, chunk)
                        chunks_failed += 1
                        continue
                    
                    # Generate embedding with fallbacks
                    embedding, provider = await embedding_service.generate_embedding_with_fallback(
                        chunk["content"]
                    )
                    
                    if embedding:
                        # Create chunk record with embedding
                        from db.models import Chunk
                        chunk_obj = Chunk(
                            document_id=document_id,
                            chunk_index=i,
                            content=chunk["content"],
                            char_start=chunk["char_start"],
                            char_end=chunk["char_end"],
                            embedding=embedding
                        )
                        
                        db.add(chunk_obj)
                        chunks_created += 1
                        embedding_circuit_breaker.on_success()
                        
                        logger.info(f"Chunk {i} embedded successfully using {provider}")
                    else:
                        # Store chunk without embedding for later retry
                        await _store_chunk_without_embedding(db, document_id, i, chunk)
                        chunks_failed += 1
                        embedding_circuit_breaker.on_failure()
                        
                except Exception as e:
                    logger.error(f"Error processing chunk {i}: {str(e)}")
                    embedding_circuit_breaker.on_failure()
                    
                    # Store chunk without embedding for later retry
                    await _store_chunk_without_embedding(db, document_id, i, chunk)
                    chunks_failed += 1
                    continue
            
            await db.commit()
            
            # Determine final status based on processing results
            if chunks_created > 0 and chunks_failed == 0:
                final_status = "ready"
                message = f"Document processed successfully with {chunks_created} chunks"
            elif chunks_created > 0 and chunks_failed > 0:
                final_status = "partial"
                message = f"Document partially processed: {chunks_created} chunks ready, {chunks_failed} pending retry"
                # Schedule retry for failed chunks
                retry_failed_embeddings.delay(document_id)
            else:
                final_status = "indexing_pending_quota"
                message = f"Document uploaded but indexing failed. {chunks_failed} chunks pending retry"
                # Schedule retry for failed chunks
                retry_failed_embeddings.delay(document_id, countdown=300)  # 5 minute delay
            
            # Update document final status
            await document_service.update_document(
                db=db,
                document_id=document_id,
                status=final_status,
                error_message=message if final_status != "ready" else None
            )
            
            return {
                "success": True,
                "status": final_status,
                "chunks_created": chunks_created,
                "chunks_failed": chunks_failed,
                "message": message
            }
            
        except Exception as e:
            # Update document status to failed
            await document_service.update_document(
                db=db,
                document_id=document_id,
                status="failed",
                error_message=str(e)
            )
            
            logger.error(f"Document processing failed for {document_id}: {str(e)}")
            raise e

@celery_app.task(bind=True)
def retry_failed_embeddings(self, document_id: str, countdown: int = 60):
    """Retry failed embedding generation for document chunks"""
    
    logger.info(f"Retrying failed embeddings for document {document_id}")
    
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        result = loop.run_until_complete(_retry_embeddings_async(document_id))
        
        loop.close()
        return result
        
    except Exception as exc:
        logger.error(f"Retry embeddings failed for {document_id}: {str(exc)}")
        
        # Exponential backoff for retries
        retry_countdown = countdown * 2
        max_countdown = 3600  # 1 hour max
        
        if retry_countdown <= max_countdown and self.request.retries < 3:
            raise self.retry(exc=exc, countdown=min(retry_countdown, max_countdown))
        
        # Mark as failed after max retries
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(_update_document_status(
                document_id, 
                "embedding_failed",
                "Maximum retry attempts exceeded for embedding generation"
            ))
            loop.close()
        except:
            pass
        
        raise exc

async def _retry_embeddings_async(document_id: str):
    """Async retry logic for failed embeddings"""
    
    async with get_async_session() as db:
        embedding_service = ResilientEmbeddingService()
        
        # Find chunks without embeddings
        from db.models import Chunk
        from sqlalchemy import select
        
        result = await db.execute(
            select(Chunk).where(
                Chunk.document_id == document_id,
                Chunk.embedding.is_(None)
            )
        )
        
        chunks_without_embeddings = result.scalars().all()
        
        if not chunks_without_embeddings:
            logger.info(f"No chunks need embedding retry for document {document_id}")
            return {"success": True, "message": "No chunks need retry"}
        
        retry_success = 0
        retry_failed = 0
        
        for chunk in chunks_without_embeddings:
            try:
                if not embedding_circuit_breaker.can_execute():
                    logger.warning("Embedding circuit breaker OPEN - stopping retry")
                    break
                
                embedding, provider = await embedding_service.generate_embedding_with_fallback(
                    chunk.content
                )
                
                if embedding:
                    chunk.embedding = embedding
                    retry_success += 1
                    embedding_circuit_breaker.on_success()
                    logger.info(f"Retry successful for chunk {chunk.id} using {provider}")
                else:
                    retry_failed += 1
                    embedding_circuit_breaker.on_failure()
                    
            except Exception as e:
                logger.error(f"Retry failed for chunk {chunk.id}: {str(e)}")
                embedding_circuit_breaker.on_failure()
                retry_failed += 1
                continue
        
        await db.commit()
        
        # Update document status
        if retry_success > 0 and retry_failed == 0:
            await _update_document_status(document_id, "ready", "All chunks processed successfully")
        elif retry_success > 0:
            await _update_document_status(
                document_id, 
                "partial", 
                f"Retry completed: {retry_success} successful, {retry_failed} still pending"
            )
        
        return {
            "success": True,
            "retry_success": retry_success,
            "retry_failed": retry_failed
        }

async def _extract_text_robust(mime_type: str, file_content: bytes) -> str:
    """Robust text extraction with enhanced format support"""
    try:
        if mime_type == "application/pdf":
            from pdfminer.high_level import extract_text
            from io import BytesIO
            pdf_file = BytesIO(file_content)
            text = extract_text(pdf_file)
            return text
            
        elif mime_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
            from docx import Document as DocxDocument
            from io import BytesIO
            docx_file = BytesIO(file_content)
            doc = DocxDocument(docx_file)
            text = "\n".join([paragraph.text for paragraph in doc.paragraphs])
            return text
            
        elif mime_type == "text/plain":
            return file_content.decode('utf-8')
            
        elif mime_type == "text/csv":
            # Enhanced CSV support
            import csv
            from io import StringIO
            csv_content = file_content.decode('utf-8')
            csv_reader = csv.reader(StringIO(csv_content))
            rows = []
            headers = next(csv_reader, [])
            for row in csv_reader:
                if len(row) == len(headers):
                    row_dict = dict(zip(headers, row))
                    rows.append(str(row_dict))
            return "CSV Data:\nHeaders: " + ", ".join(headers) + "\n\nRows:\n" + "\n".join(rows)
        
        else:
            raise Exception(f"Unsupported file type: {mime_type}")
            
    except Exception as e:
        raise Exception(f"Failed to extract text: {str(e)}")

def _chunk_text_robust(text: str) -> List[Dict[str, Any]]:
    """Enhanced text chunking with overlap and smart splitting"""
    chunks = []
    chunk_size = getattr(settings, 'chunk_size', 1000)
    overlap = getattr(settings, 'chunk_overlap', 200)
    
    # Smart chunking - prefer to split on sentence boundaries
    sentences = text.split('. ')
    current_chunk = ""
    current_start = 0
    
    for sentence in sentences:
        sentence_with_period = sentence + '. '
        
        if len(current_chunk + sentence_with_period) <= chunk_size:
            current_chunk += sentence_with_period
        else:
            if current_chunk:
                chunks.append({
                    "content": current_chunk.strip(),
                    "char_start": current_start,
                    "char_end": current_start + len(current_chunk)
                })
                
                # Calculate overlap for next chunk
                overlap_text = current_chunk[-overlap:] if len(current_chunk) > overlap else current_chunk
                current_start += len(current_chunk) - len(overlap_text)
                current_chunk = overlap_text + sentence_with_period
            else:
                # Single sentence is too long, force split
                current_chunk = sentence_with_period
    
    # Add final chunk
    if current_chunk:
        chunks.append({
            "content": current_chunk.strip(),
            "char_start": current_start,
            "char_end": current_start + len(current_chunk)
        })
    
    return chunks

async def _store_chunk_without_embedding(db: AsyncSession, document_id: str, chunk_index: int, chunk: Dict[str, Any]):
    """Store chunk without embedding for later retry"""
    from db.models import Chunk
    
    chunk_obj = Chunk(
        document_id=document_id,
        chunk_index=chunk_index,
        content=chunk["content"],
        char_start=chunk["char_start"],
        char_end=chunk["char_end"],
        embedding=None  # Will be filled in later
    )
    
    db.add(chunk_obj)

async def _update_document_status(document_id: str, status: str, message: str = None):
    """Update document status helper"""
    async with get_async_session() as db:
        document_service = DocumentService()
        await document_service.update_document(
            db=db,
            document_id=document_id,
            status=status,
            error_message=message
        )

# Health check and monitoring endpoints
def get_queue_health():
    """Get queue health statistics"""
    try:
        # Connect to Redis and get queue stats
        r = redis.Redis.from_url(settings.redis_url or 'redis://localhost:6379/0')
        
        # Get queue lengths
        doc_queue_length = r.llen('celery')
        retry_queue_length = r.llen('retry_processing')
        
        # Get circuit breaker states
        health_status = {
            "queue_lengths": {
                "document_processing": doc_queue_length,
                "retry_processing": retry_queue_length
            },
            "circuit_breakers": {
                "embedding": {
                    "state": embedding_circuit_breaker.state,
                    "failure_count": embedding_circuit_breaker.failure_count
                },
                "llm": {
                    "state": llm_circuit_breaker.state,
                    "failure_count": llm_circuit_breaker.failure_count
                }
            },
            "workers_active": True  # This would need worker inspection in production
        }
        
        return health_status
        
    except Exception as e:
        return {"error": str(e), "status": "unhealthy"}

# Worker startup
@worker_ready.connect
def worker_ready_handler(sender=None, **kwargs):
    """Initialize worker when ready"""
    logger.info("DocINX queue worker is ready and initialized")