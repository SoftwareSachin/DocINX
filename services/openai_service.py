import openai
from typing import List, Optional, Dict, Any
from tenacity import retry, stop_after_attempt, wait_exponential

from core.config import settings


class OpenAIService:
    
    def __init__(self):
        # Handle missing API key gracefully for development/demo mode
        api_key = settings.openai_api_key or "demo-key"
        if not settings.openai_api_key:
            print("Warning: OpenAI API key not configured. Running in demo mode.")
        self.client = openai.AsyncOpenAI(api_key=api_key)
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10)
    )
    async def generate_embedding(self, text: str) -> List[float]:
        """Generate embedding for text using OpenAI"""
        try:
            if not settings.openai_api_key:
                # Return fake embedding for demo mode
                import hashlib
                import numpy as np
                hash_obj = hashlib.md5(text.encode())
                seed = int(hash_obj.hexdigest()[:8], 16)
                np.random.seed(seed)
                return np.random.normal(0, 1, settings.embedding_dimensions).tolist()
            
            response = await self.client.embeddings.create(
                model=settings.embedding_model,
                input=text
            )
            return response.data[0].embedding
        except Exception as e:
            print(f"Error generating embedding: {str(e)}")
            # Fallback to fake embedding
            import hashlib
            import numpy as np
            hash_obj = hashlib.md5(text.encode())
            seed = int(hash_obj.hexdigest()[:8], 16)
            np.random.seed(seed)
            return np.random.normal(0, 1, settings.embedding_dimensions).tolist()
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10)
    )
    async def generate_chat_completion(
        self,
        messages: List[Dict[str, Any]],
        max_tokens: Optional[int] = 1000,
        temperature: float = 0.7
    ) -> str:
        """Generate chat completion using OpenAI"""
        try:
            if not settings.openai_api_key:
                # Return demo response for demo mode
                last_message = messages[-1]["content"] if messages else "Hello"
                return f"Demo response: I received your message '{last_message}'. This is a demo mode response since OpenAI API key is not configured."
            
            response = await self.client.chat.completions.create(
                model=settings.openai_model,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature
            )
            return response.choices[0].message.content or ""
        except Exception as e:
            print(f"Error generating chat completion: {str(e)}")
            # Fallback to demo response
            last_message = messages[-1]["content"] if messages else "Hello"
            return f"Error response: I encountered an issue processing your message '{last_message}'. Please try again later."