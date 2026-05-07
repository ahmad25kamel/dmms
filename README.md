# DMMS — Deliverable Marketplace Management System

A SaaS platform for managing project deliverables through an internal marketplace. Project Managers break work into a recursive deliverable tree, open items for bidding, and Contributors propose budgets and timelines. Approved work triggers automatic reward ledger entries and budget savings tracking.

## Roles

| Role | Capabilities |
|------|-------------|
| **PM** | Create projects, build deliverable trees, review bids, approve/reject submissions |
| **Contributor** | Browse marketplace, submit proposals, complete work, track earnings |
| **Admin** | Manage users and roles |

## Tech Stack

- **Backend**: Go (standard library `net/http`), MySQL (GORM), JWT auth, bcrypt passwords
- **Frontend**: React 19 + TypeScript + Vite, KMG design system (Inter + JetBrains Mono)
- **Auth**: JWT Bearer tokens, 24h expiry
- **MCP Server**: Node.js stdio MCP server (`src/mcp/`) — exposes 30 tools for AI-assisted project management

---

## Prerequisites

- Go 1.22+
- Node.js 20+ / npm 10+
- MySQL 8+

---

## Initial Setup

### 1. Clone / enter the project

```bash
cd project-deliverable-management-system
```

### 2. Install frontend dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.dmms.example .env.dmms   # or create manually
```

Edit `.env.dmms`:

```bash
export DMMS_JWT_SECRET=change-me-to-a-long-random-string
export DMMS_PORT=3005

export DB_CONNECTION=mysql
export DB_HOST=127.0.0.1
export DB_PORT=3306
export DB_DATABASE=dmms
export DB_USERNAME=root
export DB_PASSWORD=yourpassword
```

> `DMMS_JWT_SECRET` is required — the server will not start without it.

### 4. Run database migrations

Migrations run automatically on server startup via GORM AutoMigrate.

---

## Development Mode

Run backend and frontend in two terminals:

**Terminal 1 — Go backend**

```bash
source .env.dmms
go run ./cmd/dmms
```

Server starts at `http://localhost:3005`

**Terminal 2 — Vite dev server**

```bash
npm run dev
```

Frontend starts at `http://localhost:5173` with API proxied to `:3005`.

Open `http://localhost:5173` in your browser. Register an admin account first, then create PM and Contributor accounts.

---

## Production Mode

Build the frontend, embed it in the Go binary, and serve everything from a single process.

### 1. Build frontend

```bash
npm run build
```

This outputs to `./dist/`.

### 2. Build Go binary

```bash
go build -o dmms-server ./cmd/dmms
```

### 3. Run

```bash
source .env.dmms && ./dmms-server
```

The server serves both the API at `/api/dmms/` and the React SPA at `/` from the same port (`3005` by default).

Open `http://localhost:3005`.

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DMMS_JWT_SECRET` | **Yes** | — | Secret key for signing JWTs |
| `DMMS_PORT` | No | `3005` | HTTP listen port |
| `DB_CONNECTION` | No | `mysql` | Database driver |
| `DB_HOST` | No | `127.0.0.1` | MySQL host |
| `DB_PORT` | No | `3306` | MySQL port |
| `DB_DATABASE` | No | `dmms` | MySQL database name |
| `DB_USERNAME` | No | `root` | MySQL username |
| `DB_PASSWORD` | No | — | MySQL password |

---

## MCP Server (AI Integration)

DMMS ships a [Model Context Protocol](https://modelcontextprotocol.io) server that lets AI assistants (Claude Code, etc.) read and write data directly through the backend API.

### Build

The MCP server is built as part of the standard build:

```bash
npm run build:mcp   # builds src/mcp/ → dist-mcp/index.js
```

Or via the full build:

```bash
./start-dmms.sh     # builds Go + frontend + MCP, then starts server
```

### Connect Claude Code

Add to `.claude/settings.json` in the project root:

```json
{
  "mcpServers": {
    "dmms": {
      "command": "node",
      "args": ["dist-mcp/index.js"],
      "env": {
        "DMMS_BASE_URL": "http://localhost:3005",
        "DMMS_TOKEN": "<your-jwt-token>"
      }
    }
  }
}
```

Get a token by logging in:

```bash
curl -s -X POST http://localhost:3005/api/dmms/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"yourpassword"}' | jq -r '.data.token'
```

Then paste the token into `DMMS_TOKEN` and restart Claude Code.

### Available MCP Tools (30)

| Category | Tools |
|----------|-------|
| Auth | `dmms_login`, `dmms_me` |
| Projects | `dmms_list_projects`, `dmms_get_project`, `dmms_create_project`, `dmms_update_project`, `dmms_delete_project` |
| Deliverables | `dmms_deliverable_tree`, `dmms_get_deliverable`, `dmms_create_deliverable`, `dmms_update_deliverable`, `dmms_delete_deliverable`, `dmms_my_deliverables`, `dmms_open_deliverable_for_bids`, `dmms_cancel_deliverable`, `dmms_reassign_deliverable` |
| Tasks | `dmms_list_tasks`, `dmms_create_task`, `dmms_update_task`, `dmms_delete_task` |
| Kanban | `dmms_list_kanban`, `dmms_my_kanban`, `dmms_create_kanban_task`, `dmms_update_kanban_task`, `dmms_delete_kanban_task`, `dmms_kanban_comments`, `dmms_add_kanban_comment` |
| Proposals | `dmms_list_proposals`, `dmms_my_proposals`, `dmms_submit_proposal`, `dmms_accept_proposal`, `dmms_reject_proposal` |
| Approvals | `dmms_pending_submissions`, `dmms_get_submission`, `dmms_submission_history`, `dmms_submit_work`, `dmms_approve_submission`, `dmms_request_revision`, `dmms_reject_submission` |
| Admin | `dmms_list_users`, `dmms_update_user_role`, `dmms_marketplace`, `dmms_rewards_ledger` |

### Claude Skill

Type `/dmms` in Claude Code to activate the DMMS skill, which guides Claude through common workflows (create project, add deliverables, review submissions, manage kanban, etc.).

---

## API Overview

All endpoints are prefixed with `/api/dmms/`.

| Group | Endpoints |
|-------|-----------|
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| Projects | `GET/POST /projects`, `GET /projects/:id` |
| Deliverables | `GET /projects/:id/tree`, `POST /deliverables`, `PATCH /deliverables/:id/open-bids`, etc. |
| Marketplace | `GET /marketplace/bids` |
| Proposals | `POST /deliverables/:id/proposals`, `GET /proposals/mine`, `PATCH /proposals/:id/accept` |
| Submissions | `POST /deliverables/:id/submit`, `GET /submissions/pending`, `PATCH /submissions/:id/approve` |
| Rewards | `GET /rewards/ledger` |
| Admin | `GET /admin/users`, `PATCH /admin/users/:id/role`, `DELETE /admin/users/:id` |

---

## Project Structure

```
.
├── cmd/dmms/           # Server entry point
├── internal/dmms/
│   ├── config/         # Environment config
│   ├── database/       # SQLite setup + migrations
│   ├── handlers/       # HTTP handlers (one file per domain)
│   ├── middleware/     # JWT auth middleware
│   ├── models/         # Go structs and status constants
│   ├── repository/     # Data access layer
│   └── service/        # Business logic
├── migrations/         # SQL schema
├── src/                # React frontend + MCP server source
│   ├── api/            # API client + typed functions
│   ├── components/     # UI component library (KMG design system)
│   ├── mcp/            # MCP server (src/mcp/index.ts → dist-mcp/)
│   ├── pages/          # Page components by route
│   ├── store/          # Auth context/store
│   └── types/          # TypeScript types
├── dist-mcp/           # Compiled MCP server (gitignored)
├── tsconfig.mcp.json   # TypeScript config for MCP build
└── .env.dmms           # Local environment (not committed)
```
