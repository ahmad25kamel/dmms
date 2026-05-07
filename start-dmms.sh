#!/bin/bash
set -e

if [ ! -f ".env.dmms" ]; then
  echo "Create .env.dmms first (copy from .env.dmms example)"
  exit 1
fi

source .env.dmms

echo "Building Go backend..."
go build -o dmms-server ./cmd/dmms/...

echo "Building frontend..."
npm run build

echo "Building MCP server..."
npm run build:mcp

PORT="${DMMS_PORT:-3005}"
echo "Checking port $PORT..."
PIDS=$(lsof -ti tcp:"$PORT" 2>/dev/null || true)
if [ -n "$PIDS" ]; then
  echo "Killing processes on port $PORT: $PIDS"
  kill -9 $PIDS
  sleep 0.5
fi

echo "Starting DMMS server..."
exec ./dmms-server
