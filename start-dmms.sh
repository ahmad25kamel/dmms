#!/bin/bash
set -e

if [ ! -f ".env.dmms" ]; then
  echo "Create .env.dmms first (copy from .env.dmms example)"
  exit 1
fi

source .env.dmms

# Build backend
go build -o dmms-server ./cmd/dmms/...

# Build frontend
npm run build

# Start server
exec ./dmms-server
