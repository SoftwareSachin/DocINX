#!/home/runner/workspace/.pythonlibs/bin/python
"""
Python AI Service Runner
This script starts the Python AI backend service on port 8000.
Currently used alongside the Node.js service for AI-powered document processing.
"""
import sys
import os

# Add the project root to Python path
project_root = "/home/runner/workspace"
if project_root not in sys.path:
    sys.path.insert(0, project_root)

try:
    import uvicorn
except ImportError:
    print("Error: uvicorn not found. Make sure Python dependencies are installed.")
    sys.exit(1)

if __name__ == "__main__":
    # Ensure we're in the correct directory
    os.chdir(project_root)
    
    # Run the Python AI Backend on port 8000
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )