#!/bin/bash
# scripts/deploy-service.sh
# Deploys DMMS as a systemd service using settings from .env.dmms

set -e

APP_NAME="dmms"
ENV_FILE=".env.dmms"
SERVICE_FILE="/etc/systemd/system/${APP_NAME}.service"
WORKING_DIR=$(pwd)
USER=$(whoami)

# 1. Check for .env file
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Error: $ENV_FILE not found in $WORKING_DIR"
    echo "Please create it first (e.g., cp .env.dmms.example .env.dmms)"
    exit 1
fi

# 2. Extract Port for display
PORT=$(grep -E "^DMMS_PORT=" "$ENV_FILE" | cut -d '=' -f2 | tr -d '"' | tr -d "'")
PORT=${PORT:-3005}

echo "🚀 Preparing to deploy $APP_NAME as a systemd service..."
echo "📍 Working Directory: $WORKING_DIR"
echo "👤 User: $USER"
echo "🌐 Port: $PORT"

# 3. Build the application (Optional but recommended)
echo "📦 Building application artifacts..."
npm run build
npm run build:mcp
echo "🐹 Building Go backend..."
go build -o dmms-server ./cmd/dmms

# 4. Create the systemd service file
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

# 5. Reload and start
echo "🔄 Reloading systemd and starting service..."
sudo systemctl daemon-reload
sudo systemctl enable $APP_NAME
sudo systemctl restart $APP_NAME

echo "✅ Deployment successful!"
echo "📡 Service is now running on port $PORT"
echo "📊 Check status: sudo systemctl status $APP_NAME"
echo "📜 View logs: sudo journalctl -u $APP_NAME -f"
