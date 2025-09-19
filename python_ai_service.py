#!/usr/bin/env python3
"""
Python AI Service - Dedicated service for AI operations
Runs on port 8000 and handles:
- OpenAI API integration
- Document processing
- Vector operations  
- RAG functionality
"""

import uvicorn
import os
import asyncio
from contextlib import asynccontextmanager

# Set up environment
os.chdir("/home/runner/workspace")

# Import after setting working directory
from app.main import app

@asynccontextmanager
async def lifespan_wrapper(app_instance):
    # Initialize database and services
    from db.session import init_db
    await init_db()
    print("Python AI Service initialized successfully")
    yield

# Update the app lifespan
app.router.lifespan_context = lifespan_wrapper

if __name__ == "__main__":
    print("Starting Python AI Service on port 8000...")
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info",
        access_log=True
    )