# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DMMS (Deliverable Marketplace Management System) — a SaaS platform where PMs break work into recursive deliverable trees, Contributors bid on items, and approvals trigger automatic reward ledger entries.

Three roles: **PM** (create projects, review bids, approve submissions), **Contributor** (browse marketplace, submit proposals, complete work), **Admin** (manage users/roles).

## Development Commands

### Backend (Go)

```bash
source .env.dmms        # load env vars first
go run ./cmd/dmms       # dev server on :3005
go build -o dmms-server ./cmd/dmms   # production build
```

### Frontend (React/Vite)

```bash
npm run dev             # dev server on :3000 (proxies /api/dmms → :3005)
npm run build           # production build → dist/
npm run build:mcp       # compile MCP server → dist-mcp/index.js
```

### Full Production Build

```bash
./start-dmms.sh         # builds Go + frontend + MCP, then starts server
# OR manually:
npm run build && npm run build:mcp && go build -o dmms-server ./cmd/dmms
source .env.dmms && ./dmms-server

# To deploy as a systemd service (Linux):
./scripts/deploy-service.sh
```

### Environment Setup

```bash
cp .env.dmms.example .env.dmms   # then edit
# Required: DMMS_JWT_SECRET
# DB_*: MySQL connection settings (DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME, DB_PASSWORD)
# DMMS_PORT defaults to 3005
```

Database migrations run automatically via GORM AutoMigrate on startup.

## Architecture

### Backend: `internal/dmms/`

Layered Go architecture using standard `net/http` with GORM + MySQL:

- **`config/`** — loads env vars into a Config struct
- **`database/`** — GORM setup + AutoMigrate
- **`models/`** — Go structs and status constants (deliverable/proposal/submission states)
- **`repository/`** — data access layer; all DB queries live here
- **`service/`** — business logic (proposal acceptance, reward ledger writes, budget calculations)
- **`handlers/`** — HTTP handlers, one file per domain (projects, deliverables, proposals, submissions, rewards, admin)
- **`middleware/`** — JWT auth middleware; injects user into request context

All API endpoints are prefixed `/api/dmms/`. The built frontend (`dist/`) is embedded in the binary and served at `/`.

### Frontend: `src/`

React 19 + TypeScript + Vite with the KMG design system (Inter + JetBrains Mono fonts):

- **`api/`** — typed API client functions (one file per domain)
- **`components/`** — shared UI components (KMG design system)
- **`pages/`** — route-level page components; routes defined in `App.tsx`
- **`store/`** — React context for auth state (JWT token, current user)
- **`types/`** — TypeScript interfaces mirroring Go models
- **`mcp/`** — MCP server source (`index.ts`), compiled separately via `tsconfig.mcp.json`

Path alias `@` resolves to the project root.

### MCP Server: `src/mcp/index.ts` → `dist-mcp/index.js`

Node.js stdio MCP server exposing 30 tools for AI-assisted management. Built with `npm run build:mcp` using a separate tsconfig. Configure in `.claude/settings.json`:

```json
{
  "mcpServers": {
    "dmms": {
      "command": "node",
      "args": ["dist-mcp/index.js"],
      "env": {
        "DMMS_BASE_URL": "http://localhost:3005",
        "DMMS_TOKEN": "<jwt-token>"
      }
    }
  }
}
```

Get a token: `curl -s -X POST http://localhost:3005/api/dmms/auth/login -H "Content-Type: application/json" -d '{"email":"...","password":"..."}' | jq -r '.data.token'`

## Key Domain Concepts

- **Deliverable tree**: recursive parent/child structure; PMs build hierarchies of work items
- **Deliverable lifecycle**: `draft → open (for bids) → assigned → submitted → approved/revision/rejected`
- **Proposal flow**: Contributor submits proposal on an open deliverable → PM accepts one → deliverable becomes assigned
- **Submission flow**: Contributor submits work → PM approves/requests revision/rejects
- **Rewards ledger**: approved submissions auto-create ledger entries tracking contributor earnings and PM budget savings

## Notes

- The `go.mod` module name is `finance-game` (legacy name; DMMS was built on top of this repo)
- The repo also contains unrelated files (`game.db`, `scoring/`, `bookmarks-api/`) from prior experiments — ignore these
- `dmms.db` is a local SQLite artifact; production uses MySQL
