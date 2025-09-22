"""
Multi-provider LLM service with fallbacks and circuit breakers
Supports OpenAI, Anthropic, and deterministic fallbacks
"""
import time
import logging
from typing import List, Dict, Any, Optional, Tuple
import asyncio
from tenacity import retry, stop_after_attempt, wait_exponential

from services.openai_service import OpenAIService
from core.config import settings

logger = logging.getLogger(__name__)

class AnthropicService:
    """Anthropic Claude API service"""
    
    def __init__(self):
        try:
            import anthropic
            api_key = getattr(settings, 'anthropic_api_key', None)
            if api_key:
                self.client = anthropic.AsyncAnthropic(api_key=api_key)
                self.available = True
                logger.info("Anthropic service initialized")
            else:
                self.available = False
                logger.warning("Anthropic API key not configured")
        except ImportError:
            self.available = False
            logger.warning("Anthropic library not available")
    
    async def generate_completion(self, messages: List[Dict[str, str]], max_tokens: int = 1000) -> str:
        """Generate completion using Anthropic Claude"""
        if not self.available:
            raise Exception("Anthropic service not available")
        
        try:
            # Convert messages to Anthropic format
            system_message = ""
            user_messages = []
            
            for msg in messages:
                if msg["role"] == "system":
                    system_message = msg["content"]
                else:
                    user_messages.append(msg)
            
            # Create the message for Claude
            response = await self.client.messages.create(
                model="claude-3-sonnet-20240229",
                max_tokens=max_tokens,
                system=system_message if system_message else "You are a helpful assistant.",
                messages=user_messages
            )
            
            return response.content[0].text
            
        except Exception as e:
            logger.error(f"Anthropic completion failed: {str(e)}")
            raise e

class LLMCircuitBreaker:
    """Circuit breaker specifically for LLM services"""
    
    def __init__(self, failure_threshold=3, recovery_timeout=180):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.providers = {}  # Track each provider separately
    
    def _get_provider_state(self, provider: str):
        """Get or create provider state"""
        if provider not in self.providers:
            self.providers[provider] = {
                'failure_count': 0,
                'state': 'CLOSED',
                'last_failure_time': None
            }
        return self.providers[provider]
    
    def can_execute(self, provider: str) -> bool:
        """Check if provider can be used"""
        state = self._get_provider_state(provider)
        
        if state['state'] == 'CLOSED':
            return True
        elif state['state'] == 'OPEN':
            if time.time() - state['last_failure_time'] > self.recovery_timeout:
                state['state'] = 'HALF_OPEN'
                logger.info(f"LLM circuit breaker for {provider} moving to HALF_OPEN")
                return True
            return False
        elif state['state'] == 'HALF_OPEN':
            return True
    
    def on_success(self, provider: str):
        """Record successful execution"""
        state = self._get_provider_state(provider)
        state['failure_count'] = 0
        state['state'] = 'CLOSED'
    
    def on_failure(self, provider: str):
        """Record failed execution"""
        state = self._get_provider_state(provider)
        state['failure_count'] += 1
        state['last_failure_time'] = time.time()
        
        if state['failure_count'] >= self.failure_threshold:
            state['state'] = 'OPEN'
            logger.warning(f"LLM circuit breaker for {provider} is now OPEN")

class MultiLLMService:
    """
    Multi-provider LLM service with intelligent fallbacks
    Provider priority: OpenAI -> Anthropic -> Deterministic
    """
    
    def __init__(self):
        self.openai_service = OpenAIService()
        self.anthropic_service = AnthropicService()
        self.circuit_breaker = LLMCircuitBreaker()
        self.response_cache = {}  # Simple response cache
    
    async def generate_completion_with_fallback(
        self, 
        messages: List[Dict[str, str]], 
        max_tokens: int = 1000,
        temperature: float = 0.7,
        retrieved_docs: Optional[List[str]] = None
    ) -> Tuple[str, str]:
        """
        Generate completion with comprehensive fallback strategy
        Returns: (response, provider_used)
        """
        
        # Create cache key
        cache_key = self._create_cache_key(messages, max_tokens, temperature)
        if cache_key in self.response_cache:
            logger.debug("Response served from cache")
            return self.response_cache[cache_key], "cache"
        
        # Try OpenAI first
        if self.circuit_breaker.can_execute("openai"):
            try:
                response = await self._try_openai_completion(messages, max_tokens, temperature)
                if response:
                    self.circuit_breaker.on_success("openai")
                    self.response_cache[cache_key] = response
                    return response, "openai"
                else:
                    self.circuit_breaker.on_failure("openai")
            except Exception as e:
                logger.warning(f"OpenAI completion failed: {str(e)}")
                self.circuit_breaker.on_failure("openai")
        else:
            logger.warning("OpenAI circuit breaker OPEN - skipping")
        
        # Try Anthropic as fallback
        if self.anthropic_service.available and self.circuit_breaker.can_execute("anthropic"):
            try:
                response = await self._try_anthropic_completion(messages, max_tokens)
                if response:
                    self.circuit_breaker.on_success("anthropic")
                    self.response_cache[cache_key] = response
                    return response, "anthropic"
                else:
                    self.circuit_breaker.on_failure("anthropic")
            except Exception as e:
                logger.warning(f"Anthropic completion failed: {str(e)}")
                self.circuit_breaker.on_failure("anthropic")
        else:
            logger.warning("Anthropic circuit breaker OPEN or service unavailable - skipping")
        
        # Ultimate fallback: deterministic response using retrieved docs
        try:
            response = self._generate_deterministic_response(messages, retrieved_docs)
            self.response_cache[cache_key] = response
            return response, "deterministic"
        except Exception as e:
            logger.error(f"Deterministic fallback failed: {str(e)}")
            return "I apologize, but I'm currently unable to process your request due to technical difficulties. Please try again later.", "error_fallback"
    
    @retry(
        stop=stop_after_attempt(2),
        wait=wait_exponential(multiplier=1, min=2, max=8)
    )
    async def _try_openai_completion(self, messages: List[Dict[str, str]], max_tokens: int, temperature: float) -> Optional[str]:
        """Try OpenAI completion with retries"""
        try:
            if not settings.openai_api_key:
                return None
            
            response = await self.openai_service.generate_chat_completion(
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature
            )
            return response
            
        except Exception as e:
            error_str = str(e).lower()
            if any(keyword in error_str for keyword in ['quota', 'rate_limit', '429', 'insufficient']):
                logger.warning(f"OpenAI quota/rate limit hit: {str(e)}")
                return None
            raise e
    
    @retry(
        stop=stop_after_attempt(2),
        wait=wait_exponential(multiplier=1, min=2, max=8)
    )
    async def _try_anthropic_completion(self, messages: List[Dict[str, str]], max_tokens: int) -> Optional[str]:
        """Try Anthropic completion with retries"""
        try:
            response = await self.anthropic_service.generate_completion(messages, max_tokens)
            return response
        except Exception as e:
            error_str = str(e).lower()
            if any(keyword in error_str for keyword in ['quota', 'rate_limit', '429', 'insufficient']):
                logger.warning(f"Anthropic quota/rate limit hit: {str(e)}")
                return None
            raise e
    
    def _generate_deterministic_response(self, messages: List[Dict[str, str]], retrieved_docs: Optional[List[str]] = None) -> str:
        """Generate deterministic response using templates and retrieved docs"""
        
        # Get the user's last message
        user_message = ""
        for msg in reversed(messages):
            if msg["role"] == "user":
                user_message = msg["content"]
                break
        
        if not user_message:
            return "I didn't receive a clear question. Could you please rephrase your request?"
        
        # If we have retrieved documents, create a response based on them
        if retrieved_docs and len(retrieved_docs) > 0:
            # Take top 3 most relevant docs
            top_docs = retrieved_docs[:3]
            
            response_parts = [
                f"Based on your question about '{user_message}', I found the following relevant information:",
                "",
                "**Relevant Content:**"
            ]
            
            for i, doc in enumerate(top_docs, 1):
                # Truncate very long documents
                doc_content = doc[:500] + "..." if len(doc) > 500 else doc
                response_parts.append(f"{i}. {doc_content}")
                response_parts.append("")
            
            response_parts.extend([
                "**Summary:**",
                f"The above information relates to your question about {user_message}. "
                "Please review the relevant content sections for detailed information.",
                "",
                "*(This response was generated using document retrieval due to AI service limitations. "
                "For more detailed analysis, please try again later when full AI services are available.)*"
            ])
            
            return "\n".join(response_parts)
        
        else:
            # No retrieved docs - provide a helpful template response
            return (
                f"I understand you're asking about: '{user_message}'\n\n"
                "I'm currently operating in limited mode due to AI service constraints. "
                "To get the most helpful response:\n\n"
                "1. Try uploading relevant documents that might contain information about your question\n"
                "2. Be as specific as possible in your queries\n"
                "3. Try again in a few moments when full AI services may be restored\n\n"
                "I apologize for the inconvenience and appreciate your patience."
            )
    
    def _create_cache_key(self, messages: List[Dict[str, str]], max_tokens: int, temperature: float) -> str:
        """Create cache key for response caching"""
        import hashlib
        content = str(messages) + str(max_tokens) + str(temperature)
        return hashlib.md5(content.encode()).hexdigest()
    
    def get_service_status(self) -> Dict[str, Any]:
        """Get status of all LLM services"""
        return {
            "openai": {
                "available": bool(settings.openai_api_key),
                "circuit_breaker": self.circuit_breaker._get_provider_state("openai")
            },
            "anthropic": {
                "available": self.anthropic_service.available,
                "circuit_breaker": self.circuit_breaker._get_provider_state("anthropic")
            },
            "cache_size": len(self.response_cache)
        }
    
    def clear_cache(self):
        """Clear response cache"""
        self.response_cache.clear()
        logger.info("LLM response cache cleared")