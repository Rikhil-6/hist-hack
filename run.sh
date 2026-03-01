
echo "---------------------------------------"
echo "STARTING HIST-HACK LOCAL SERVICES"
echo "---------------------------------------"

echo "Launching Backend (uv + uvicorn)..."
uv run uvicorn app-backend.main:app --reload --port 8000 &

BACKEND_PID=$!

echo "Launching Frontend (npm + vite)..."
cd app && npm run dev -- --port 3000 &
FRONTEND_PID=$!
cd ..

echo ""
echo "Done!"
echo "Frontend: http://localhost:3000"
echo "Backend:  http://localhost:8000"
echo ""
echo "Press Ctrl+C to stop everything."

wait