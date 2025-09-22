#!/bin/bash

# Start Python FastAPI service in background
echo "Starting Python FastAPI service..."
cd /home/runner/workspace && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
PYTHON_PID=$!

# Wait a moment for Python service to start
sleep 3

# Start Node.js Express service
echo "Starting Node.js Express service..."
cd /home/runner/workspace && NODE_ENV=development tsx server/index.ts &
NODE_PID=$!

# Function to cleanup processes on exit
cleanup() {
    echo "Stopping services..."
    kill $PYTHON_PID $NODE_PID 2>/dev/null
    exit
}

# Set trap to cleanup on script exit
trap cleanup EXIT

# Wait for both processes
wait $PYTHON_PID $NODE_PID