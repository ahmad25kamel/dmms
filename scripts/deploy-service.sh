#!/bin/bash
# scripts/deploy-service.sh
# Deploys DMMS as a user-level systemd service (no root required).
# The service runs under the current user account via systemctl --user.

set -e

APP_NAME="dmms"
ENV_FILE=".env"
SERVICE_DIR="$HOME/.config/systemd/user"
SERVICE_FILE="$SERVICE_DIR/${APP_NAME}.service"
WORKING_DIR=$(pwd)
CURRENT_USER=$(whoami)

# 1. Check for .env file
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Error: $ENV_FILE not found in $WORKING_DIR"
    echo "Please create it first (e.g., cp .env.example .env)"
    exit 1
fi

# 2. Validate required variables
source "$ENV_FILE"

MISSING=()
[ -z "$DMMS_JWT_SECRET" ] && MISSING+=("DMMS_JWT_SECRET")
[ -z "$DB_HOST" ]         && MISSING+=("DB_HOST")
[ -z "$DB_DATABASE" ]     && MISSING+=("DB_DATABASE")
[ -z "$DB_USERNAME" ]     && MISSING+=("DB_USERNAME")
[ -z "$DB_PASSWORD" ]     && MISSING+=("DB_PASSWORD")

if [ ${#MISSING[@]} -gt 0 ]; then
    echo "❌ Deployment aborted — the following required variables are not set in $ENV_FILE:"
    for var in "${MISSING[@]}"; do
        echo "   • $var"
    done
    exit 1
fi

# 3. Extract port for display
PORT=${DMMS_PORT:-3005}

echo "🚀 Preparing to deploy $APP_NAME as a user systemd service..."
echo "📍 Working Directory: $WORKING_DIR"
echo "👤 User: $CURRENT_USER"
echo "🌐 Port: $PORT"

# 4. Build the application
echo "📦 Installing dependencies and building artifacts..."
npm ci
npm run build
npm run build:mcp
echo "🐹 Building Go backend..."
go build -o dmms-server ./cmd/dmms

# 5. Create user systemd service directory and service file
echo "📝 Creating user service file at $SERVICE_FILE..."
mkdir -p "$SERVICE_DIR"
cat > "$SERVICE_FILE" << EOF
[Unit]
Description=DMMS - Deliverable Marketplace Management System
After=network.target

[Service]
Type=simple
WorkingDirectory=$WORKING_DIR
EnvironmentFile=$WORKING_DIR/$ENV_FILE
ExecStart=$WORKING_DIR/dmms-server
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
EOF

# 6. Enable lingering so the service survives logout
echo "🔒 Enabling linger for $CURRENT_USER (service persists after logout)..."
loginctl enable-linger "$CURRENT_USER"

# 7. Reload and start
echo "🔄 Reloading user systemd and starting service..."
systemctl --user daemon-reload
systemctl --user enable "$APP_NAME"
systemctl --user restart "$APP_NAME"

echo "✅ Deployment successful!"
echo "📡 Service is now running on port $PORT"
echo "📊 Check status : systemctl --user status $APP_NAME"
echo "📜 View logs    : journalctl --user -u $APP_NAME -f"
echo "⏹  Stop service : systemctl --user stop $APP_NAME"
