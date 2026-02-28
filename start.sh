#!/bin/bash

# start.sh — Production-Ready Single Command Hosting
# This script builds the frontend and backend, then runs them in production mode.
# It does NOT use 'npm run dev' and is intended for hosting environments like Render.

# Exit on any error
set -e

# Cleanup function to stop background processes when you press Ctrl+C
cleanup() {
    echo ""
    echo "Stopping production servers..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit
}

# Trap SIGINT (Ctrl+C) and SIGTERM
trap cleanup SIGINT SIGTERM

echo "--- Build Phase ---"

# Step 1: Build the Frontend (Static Files)
echo "Building Frontend..."
(cd client && npm install && npm run build)

# Step 2: Prepare the Backend (Prisma)
echo "Building Backend..."
(cd server && npm install && npx prisma generate)

echo "Build Complete! ✅"
echo ""

echo "--- Execution Phase ---"

# Step 3: Run the Backend (Production Node Process)
# Render provides the $PORT environment variable.
# We set a default of 5080 primarily for local production testing.
BACKEND_PORT=${PORT:-5080}
echo "Starting Backend on Port $BACKEND_PORT..."
(cd server && node index.js) &
BACKEND_PID=$!

# Step 4: Run the Frontend (Static File Server)
# In production, we use 'serve' to run the static 'dist' build.
# We run it on port 5173 to avoid conflict with the backend.
echo "Starting Frontend on Port 5173..."
(cd client && npx serve -s dist -l 5173) &
FRONTEND_PID=$!

echo "--------------------------------------------------"
echo "Production servers are live!"
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo "--------------------------------------------------"
echo "Press Ctrl+C to terminate both."

# Keep the script running
wait
