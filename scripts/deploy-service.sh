#!/bin/bash
# scripts/deploy-service.sh
# Deploys DMMS as a systemd service using settings from .env

set -e

APP_NAME="dmms"
ENV_FILE=".env"
SERVICE_FILE="/etc/systemd/system/${APP_NAME}.service"
WORKING_DIR=$(pwd)
USER=$(whoami)

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

# 3. Extract Port for display
PORT=${DMMS_PORT:-3005}

echo "🚀 Preparing to deploy $APP_NAME as a systemd service..."
echo "📍 Working Directory: $WORKING_DIR"
echo "👤 User: $USER"
echo "🌐 Port: $PORT"

# 4. Build the application
echo "📦 Building application artifacts..."
npm run build
npm run build:mcp
echo "🐹 Building Go backend..."
go build -o dmms-server ./cmd/dmms

# 5. Create the systemd service file
echo "📝 Creating systemd service file at $SERVICE_FILE..."
sudo bash -c "cat <<EOF > $SERVICE_FILE
[Unit]
Description=DMMS - Deliverable Marketplace Management System
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$WORKING_DIR
EnvironmentFile=$WORKING_DIR/$ENV_FILE
ExecStart=$WORKING_DIR/dmms-server
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF"

# 6. Reload and start
echo "🔄 Reloading systemd and starting service..."
sudo systemctl daemon-reload
sudo systemctl enable $APP_NAME
sudo systemctl restart $APP_NAME

echo "✅ Deployment successful!"
echo "📡 Service is now running on port $PORT"
echo "📊 Check status: sudo systemctl status $APP_NAME"
echo "📜 View logs: sudo journalctl -u $APP_NAME -f"
