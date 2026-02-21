#!/bin/bash
# ═══════════════════════════════════════════════
# LogisPro — One-Command Launch Script
# Starts both backend (port 3001) and frontend (port 5173)
# ═══════════════════════════════════════════════

DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🚀 LogisPro — Starting..."
echo ""

# Kill any zombie processes
echo "🧹 Cleaning up old processes..."
kill -9 $(lsof -ti:3001) 2>/dev/null
kill -9 $(lsof -ti:5173) 2>/dev/null
sleep 1

# Start backend
echo "📦 Starting backend server (port 3001)..."
cd "$DIR/server"
node src/index.js &
BACKEND_PID=$!

# Wait for backend to be ready
sleep 3

# Start frontend
echo "🎨 Starting frontend (port 5173)..."
cd "$DIR"
npx vite --port 5173 &
FRONTEND_PID=$!

# Wait for frontend to be ready
sleep 3

echo ""
echo "═══════════════════════════════════════════════"
echo "  ✅ LogisPro is running!"
echo "  🌐 App:     http://localhost:5173"
echo "  📡 API:     http://localhost:3001"
echo "  ⏹  Press Ctrl+C to stop both servers"
echo "═══════════════════════════════════════════════"
echo ""

# Open browser (macOS)
open http://localhost:5173 2>/dev/null || true

# Handle Ctrl+C — kill both processes
trap "echo ''; echo '⏹ Stopping servers...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM

# Wait for either to exit
wait
