#!/usr/bin/env python3
"""
Start both Python FastAPI service and Node.js Express service
"""
import subprocess
import sys
import time
import signal
import os

def cleanup_handler(signum, frame):
    """Handle cleanup on exit"""
    print("\nShutting down services...")
    sys.exit(0)

def main():
    # Set up signal handler
    signal.signal(signal.SIGINT, cleanup_handler)
    signal.signal(signal.SIGTERM, cleanup_handler)
    
    # Change to project directory
    os.chdir("/home/runner/workspace")
    
    # Start Python FastAPI service
    print("Starting Python FastAPI service on port 8000...")
    python_process = subprocess.Popen([
        sys.executable, "-m", "uvicorn", "app.main:app",
        "--host", "0.0.0.0", "--port", "8000", "--reload"
    ])
    
    # Wait a moment for Python service to start
    time.sleep(3)
    
    # Start Node.js Express service
    print("Starting Node.js Express service on port 5000...")
    node_process = subprocess.Popen([
        "tsx", "server/index.ts"
    ], env={**os.environ, "NODE_ENV": "development"})
    
    print("Both services started successfully!")
    print("Python FastAPI: http://localhost:8000")
    print("Node.js Express: http://localhost:5000")
    
    try:
        # Keep both processes running
        while True:
            if python_process.poll() is not None:
                print("Python service stopped, restarting...")
                python_process = subprocess.Popen([
                    sys.executable, "-m", "uvicorn", "app.main:app",
                    "--host", "0.0.0.0", "--port", "8000", "--reload"
                ])
            
            if node_process.poll() is not None:
                print("Node service stopped, restarting...")
                node_process = subprocess.Popen([
                    "tsx", "server/index.ts"
                ], env={**os.environ, "NODE_ENV": "development"})
            
            time.sleep(1)
            
    except KeyboardInterrupt:
        print("\nShutting down services...")
        python_process.terminate()
        node_process.terminate()
        python_process.wait()
        node_process.wait()

if __name__ == "__main__":
    main()