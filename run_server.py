#!/usr/bin/env python3
import uvicorn
import os

if __name__ == "__main__":
    # Ensure we're in the correct directory
    os.chdir("/home/runner/workspace")
    
    # Run the Python AI Backend on port 8000
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )