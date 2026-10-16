#!/usr/bin/env bash
# Fluent Tindahan — run-local (Novastack standard entrypoint)
# Usage:
#   ./run-local.sh              # native backend + Vite (default)
#   ./run-local.sh --docker     # docker compose stack
#   ./run-local.sh --docker --build

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODE="native"
BUILD=0

for arg in "$@"; do
  case "$arg" in
    --docker|-d) MODE="docker" ;;
    --build|-b) BUILD=1 ;;
    --help|-h)
      sed -n '2,7p' "$0"
      exit 0
      ;;
    *)
      echo "[ERROR] Unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

echo "=========================================================="
echo "  Fluent Tindahan — run-local"
echo "=========================================================="

url_ok() {
  curl -fsS --max-time 2 "$1" >/dev/null 2>&1
}

if [[ "$MODE" == "docker" ]]; then
  if ! command -v docker >/dev/null 2>&1; then
    echo "[ERROR] Docker is not installed or not on PATH." >&2
    echo "        Install Docker, or run without --docker." >&2
    exit 1
  fi

  if [[ ! -f "$ROOT/.env" && -f "$ROOT/.env.example" ]]; then
    cp "$ROOT/.env.example" "$ROOT/.env"
    echo "[INFO] Created .env from .env.example — review secrets before production use."
  fi

  cd "$ROOT"
  echo "[INFO] Starting Docker Compose stack (db + api + web)..."
  if [[ "$BUILD" -eq 1 ]]; then
    docker compose up -d --build
  else
    docker compose up -d
  fi

  echo ""
  echo "=========================================================="
  echo "  Docker stack is up"
  echo "  - PWA (nginx):     http://localhost:8080"
  echo "  - API (direct):    http://localhost:5000"
  echo "  - Health:          http://localhost:5000/api/health"
  echo "  - Postgres:        localhost:5432"
  echo "=========================================================="
  exit 0
fi

# --- Native mode ---
BACKEND_DIR="$ROOT/backend/src/FluentTindahan.WebApi"
FRONTEND_DIR="$ROOT/frontend"

mkdir -p "$ROOT/.run"

if url_ok "http://localhost:5000/api/health"; then
  echo "[OK] Backend already running at http://localhost:5000"
else
  echo "[INFO] Starting Backend Web API on http://localhost:5000..."
  (
    cd "$BACKEND_DIR"
    export ASPNETCORE_ENVIRONMENT=Development
    nohup dotnet run --urls "http://localhost:5000" >"$ROOT/.run/backend.log" 2>&1 &
    echo $! >"$ROOT/.run/backend.pid"
  )
fi

if url_ok "http://127.0.0.1:5173"; then
  echo "[OK] Frontend already running at http://localhost:5173"
else
  if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
    echo "[INFO] Installing frontend dependencies (npm ci)..."
    (cd "$FRONTEND_DIR" && npm ci --ignore-scripts)
  fi
  echo "[INFO] Starting Frontend Dev Server on http://localhost:5173..."
  (
    cd "$FRONTEND_DIR"
    nohup npm run dev -- --host 127.0.0.1 --port 5173 >"$ROOT/.run/frontend.log" 2>&1 &
    echo $! >"$ROOT/.run/frontend.pid"
  )
fi

sleep 3

echo ""
echo "=========================================================="
echo "  Services are live!"
echo "  - Frontend PWA:    http://localhost:5173"
echo "  - Backend API:     http://localhost:5000"
echo "  - Swagger UI:      http://localhost:5000/swagger"
echo "  - Health Check:    http://localhost:5000/api/health"
echo "  Tip: ./run-local.sh --docker  for full compose stack"
echo "  Logs: $ROOT/.run/*.log"
echo "=========================================================="
