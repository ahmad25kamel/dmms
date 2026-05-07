.PHONY: build clean run-dev run-prod

# Build the production application
build:
	@echo "Building frontend..."
	npm run build
	@echo "Building MCP server..."
	npm run build:mcp
	@echo "Tidying Go modules..."
	go mod tidy
	@echo "Building Go binary..."
	go build -ldflags="-s -w" -o finance-game main.go
	@echo "Build complete! Run ./finance-game to start."

# Clean up build artifacts
clean:
	rm -rf out
	rm -f finance-game

# Run in development mode
run-dev:
	go run main.go

# Run the production binary
run-prod: build
	./finance-game

# Reset all game data points
reset:
	go run main.go --reset
