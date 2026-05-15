.PHONY: build clean dev-backend dev-frontend tidy run

# Full production build: frontend + MCP server + Go binary
build:
	@echo "Building frontend..."
	npm run build
	@echo "Building MCP server..."
	npm run build:mcp
	@echo "Tidying Go modules..."
	go mod tidy
	@echo "Building Go binary..."
	go build -ldflags="-s -w" -o dmms-server ./cmd/dmms
	@echo "Build complete. Run: source .env && ./dmms-server"

# Remove build artifacts
clean:
	rm -f dmms-server
	rm -rf dist dist-mcp

# Run Go backend in development mode (requires .env to be sourced)
dev-backend:
	go run ./cmd/dmms

# Run Vite frontend dev server
dev-frontend:
	npm run dev

# Tidy Go modules
tidy:
	go mod tidy
