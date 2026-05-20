# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Available Skills

- **dmms** (`.claude/skills/dmms/SKILL.md`) - manage DMMS projects, deliverables, tasks, kanban, proposals and approvals via MCP tools. Trigger: `/dmms`
When the user types `/dmms`, invoke the Skill tool with `skill: "dmms"` before doing anything else.

## Project Overview

DMMS (Deliverable Modular Management System) — a SaaS platform where PMs break work into recursive deliverable trees, Contributors bid on items, and approvals trigger automatic reward ledger entries.

Three roles: **PM** (create projects, review bids, approve submissions), **Contributor** (browse marketplace, submit proposals, complete work), **Admin** (manage users/roles).

## Development Commands

### Backend (Go)

```bash
# Dev — SQLite is used automatically when DB_HOST is not set
DMMS_JWT_SECRET=any-secret go run ./cmd/dmms   # starts on :3005, creates dmms.db

# With a .env file
source .env && go run ./cmd/dmms

# Production build
go build -o dmms-server ./cmd/dmms
```

### Frontend (React/Vite)

```bash
npm run dev             # dev server on :3000 (proxies /api/dmms → :3005)
npm run build           # production build → dist/
npm run build:mcp       # compile MCP server → dist-mcp/index.js
npm run type-check      # TypeScript type check (linter)
```

### Full Production Build & Deploy

**Always use the deploy script for builds** — it handles npm install, frontend build, MCP build, Go binary, and systemd service restart in one step:

```bash
./scripts/deploy-service.sh
```

What it does:
1. Validates `.env` (requires `DMMS_JWT_SECRET`, `DB_HOST`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`)
2. `npm ci && npm run build && npm run build:mcp`
3. `go build -o dmms-server ./cmd/dmms`
4. Installs/restarts a user-level systemd service (`~/.config/systemd/user/dmms.service`)

Post-deploy:
```bash
systemctl --user status dmms      # check status
journalctl --user -u dmms -f      # tail logs
systemctl --user restart dmms     # restart only (no rebuild)
```

### End-to-End Tests

```bash
npx playwright test             # run all e2e tests (requires running server on :3000)
npx playwright test e2e/auth.spec.ts   # run a single spec
npx playwright test --list      # list all tests without running
```

## Environment Setup

```bash
cp .env.example .env   # then edit with your values
```

**Required:**
- `DMMS_JWT_SECRET` — any long random string (e.g. `openssl rand -hex 32`)

**Optional:**
- `DMMS_PORT` — server port (default: `3005`)
- `DMMS_DB_PATH` — SQLite file path (default: `dmms.db`)

**MySQL (production only) — omit these for SQLite dev:**
- `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`

### Database Driver Selection

The driver is chosen automatically at startup — no config flag needed:

| `DB_HOST` set? | Driver | Database file/server |
|---|---|---|
| No (default) | **SQLite** | `dmms.db` in project root |
| Yes | **MySQL** | connect to `DB_HOST:DB_PORT` |

Database schema migrations run automatically via GORM AutoMigrate on every startup.

## Architecture

### Backend: `internal/`

Layered Go architecture using standard `net/http` with GORM:

```
internal/
  config/       config.go         — loads env vars; exposes DBDriver ("sqlite"|"mysql")
  database/     db.go             — opens GORM connection, runs AutoMigrate
                migrations.sql    — reference MySQL DDL (not executed at runtime)
  models/       models.go         — GORM structs + status constants for all 11 tables
  repository/   *.go              — data access layer; all DB queries live here
  service/      *.go              — business logic (proposal acceptance, rewards, budgets)
  handlers/     *_handler.go      — HTTP handlers, one file per domain:
                  auth, project, deliverable, proposal, submission,
                  reward, kanban, marketplace, admin
                response.go       — shared JSON response helpers
  middleware/   *.go              — JWT auth; injects user into request context
```

All API endpoints are prefixed `/api/dmms/`. The built frontend (`dist/`) is embedded in the Go binary and served at `/`.

Entry point: `cmd/dmms/main.go`

### Frontend: `src/`

React 19 + TypeScript + Vite:

```
src/
  api/          — typed fetch wrappers, one file per domain
  components/   — shared UI (KMG design system: Inter + JetBrains Mono)
  pages/        — route-level components; routes defined in App.tsx
  store/        — React context: JWT token + current user
  types/        — TypeScript interfaces mirroring Go models
  mcp/          — MCP server source (index.ts), compiled separately
```

Path alias `@` resolves to the project root.

### MCP Server: `src/mcp/index.ts` → `dist-mcp/index.js`

Node.js stdio MCP server exposing 30 tools for AI-assisted management. Build with `npm run build:mcp`. Configure in `.claude/settings.json`:

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

Get a token:
```bash
curl -s -X POST http://localhost:3005/api/dmms/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"...","password":"..."}' | jq -r '.data.token'
```

### Session Start Hook (Claude Code on the web)

`.claude/hooks/session-start.sh` runs automatically on remote sessions and installs:
- npm packages (`npm install`)
- Go module cache (`go mod download`)
- Playwright Chromium browser (for e2e tests)

## Key Domain Concepts

- **Deliverable tree**: recursive parent/child structure; PMs build hierarchies of work items
- **Deliverable lifecycle**: `draft → open → assigned → submitted → approved / revision / rejected`
- **Proposal flow**: Contributor submits proposal on an open deliverable → PM accepts one → deliverable becomes `assigned`
- **Submission flow**: Contributor submits work → PM approves / requests revision / rejects
- **Rewards ledger**: approved submissions auto-create ledger entries tracking contributor earnings and PM budget savings
- **Kanban board**: cross-project task board; tasks have statuses `backlog → todo → in_progress → done`

## Data Models (11 tables)

| Table | Key fields |
|---|---|
| `dmms_users` | id, username, email, role (pm/contributor/admin), approved |
| `dmms_projects` | id, name, pm_id, budget_ceiling/total/allocated/saved, status |
| `dmms_deliverables` | id, project_id, parent_id (recursive), status, visibility, max_budget |
| `dmms_tasks` | id, deliverable_id, project_id, assigned_to, status, position |
| `dmms_task_comments` | id, task_id, author_id, body, file_uploads |
| `dmms_task_members` | id, task_id, user_id |
| `dmms_proposals` | id, deliverable_id, contributor_id, bid_amount, status |
| `dmms_submissions` | id, deliverable_id, contributor_id, status, reviewer_id |
| `dmms_reward_ledger` | id, user_id, deliverable_id, project_id, amount |
| `dmms_comment_mentions` | id, comment_id, user_id, username |
| `dmms_notifications` | id, user_id, kind, payload, read |
