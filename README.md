# DMMS — Deliverable Modular Management System

> A structured project delivery platform where PMs break work into a recursive deliverable tree, contributors bid on items, and approvals trigger automatic reward ledger entries.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Go](https://img.shields.io/badge/Go-1.22+-00ADD8?logo=go)](https://go.dev/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![MySQL](https://img.shields.io/badge/MySQL-8-4479A1?logo=mysql)](https://www.mysql.com/)

---

## What is DMMS?

DMMS solves a common problem in project management: **work that nobody clearly owns, budgets that nobody tracks, and contributors who have no visibility into what's available or what they'll earn.**

It provides a marketplace layer on top of a deliverable tree — PMs publish work, contributors bid, and every approved submission automatically updates the reward ledger and budget pool.

### Three roles, one workflow

| Role | What they do |
|------|-------------|
| **PM** | Create projects, build deliverable trees, set budgets & deadlines, review and approve submissions |
| **Contributor** | Browse the marketplace, submit proposals, execute work, track earnings |
| **Admin** | Manage users and roles |

---

## Key Features

- **Recursive deliverable tree** — break any project into an arbitrarily deep hierarchy of sub-deliverables
- **Marketplace bidding** — contributors propose budgets and timelines; PMs negotiate and assign
- **Kanban board** — cross-project task board with per-list infinite scroll, due dates, and member assignment
- **Automatic reward ledger** — every approved submission credits the contributor and updates PM budget savings
- **File attachments** — upload files or link PR URLs on tasks and comments
- **MCP server** — 30 AI tools for Claude Code to read and write data directly (create projects, review proposals, manage kanban, etc.)
- **Single binary deployment** — the React frontend is embedded in the Go binary; one process serves everything

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Go 1.22, `net/http`, GORM, MySQL 8 |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| Auth | JWT Bearer tokens (24h), bcrypt passwords |
| AI integration | Model Context Protocol (MCP) server — Node.js stdio |

---

## Getting Started

### Prerequisites

- Go 1.22+
- Node.js 20+ / npm 10+
- MySQL 8+

### 1. Clone the repo

```bash
git clone https://github.com/your-username/project-deliverable-management-system.git
cd project-deliverable-management-system
```

### 2. Install frontend dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in your values — at minimum set `DMMS_JWT_SECRET` and your MySQL credentials. The server will refuse to start without a JWT secret.

### 4. Start development servers

**Terminal 1 — Go backend (port 3005)**

```bash
source .env
go run ./cmd/dmms
```

**Terminal 2 — Vite frontend (port 5173)**

```bash
npm run dev
```

Open `http://localhost:5173`. Register the first account (make it an Admin), then create PM and Contributor accounts from the Admin panel.

> Database migrations run automatically via GORM AutoMigrate on every startup — no manual migration step needed.

---

## Production Build

Everything compiles into a single self-contained binary:

```bash
# Build frontend + MCP server + Go binary in one step
./start-dmms.sh

# Or manually:
npm run build
npm run build:mcp
go build -o dmms-server ./cmd/dmms
source .env && ./dmms-server
```

The server listens on `DMMS_PORT` (default `3005`) and serves both the API at `/api/dmms/` and the React SPA at `/`.

---

## Apache Reverse Proxy (Optional)

To expose DMMS behind Apache with Cloudflare Tunnel handling HTTPS externally (no SSL cert needed on the server).

### 1. Enable modules

```bash
sudo a2enmod proxy proxy_http headers
sudo systemctl restart apache2
```

### 2. Create virtual host

Create `/etc/apache2/sites-available/dmms.conf`:

```apache
<VirtualHost *:80>
    ServerName dmms.yourdomain.com

    # Proxy everything to the single DMMS binary
    ProxyPreserveHost On
    ProxyPass        / http://localhost:3005/
    ProxyPassReverse / http://localhost:3005/

    # Security headers
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-Frame-Options "SAMEORIGIN"
    Header always set X-XSS-Protection "1; mode=block"
    Header always set Referrer-Policy "strict-origin-when-cross-origin"

    ErrorLog  /var/log/apache2/dmms-error.log
    CustomLog /var/log/apache2/dmms-access.log combined
</VirtualHost>
```

### 3. Enable and reload

```bash
sudo a2ensite dmms.conf
sudo apache2ctl configtest     # verify syntax before reloading
sudo systemctl reload apache2
```

> **HTTPS** is handled by [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) — no SSL certificate needed on the server. Apache only listens on port 80 locally; Cloudflared forwards public HTTPS traffic to it.

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DMMS_JWT_SECRET` | **Yes** | — | Secret for signing JWTs — use `openssl rand -hex 32` |
| `DMMS_PORT` | No | `3005` | HTTP listen port |
| `DB_CONNECTION` | No | `mysql` | Database driver |
| `DB_HOST` | No | `127.0.0.1` | MySQL host |
| `DB_PORT` | No | `3306` | MySQL port |
| `DB_DATABASE` | No | `dmms` | MySQL database name |
| `DB_USERNAME` | No | `root` | MySQL username |
| `DB_PASSWORD` | No | — | MySQL password |

---

## Project Structure

```
.
├── cmd/dmms/          # Server entry point
├── internal/
│   ├── config/        # Environment config loader
│   ├── database/      # GORM setup + AutoMigrate
│   ├── handlers/      # HTTP handlers (one file per domain)
│   ├── middleware/    # JWT auth middleware
│   ├── models/        # Go structs and status constants
│   ├── repository/    # Data access layer — all DB queries live here
│   └── service/       # Business logic (proposals, rewards, budgets)
├── migrations/            # SQL schema reference
├── src/
│   ├── api/               # Typed API client functions
│   ├── components/        # Shared UI component library
│   ├── mcp/               # MCP server source → compiled to dist-mcp/
│   ├── pages/             # Route-level page components
│   ├── store/             # Auth context
│   └── types/             # TypeScript types mirroring Go models
├── .env.example      # Environment template
├── start-dmms.sh          # One-command production build + start
└── Makefile               # Common dev tasks
```

---

## MCP Server (AI Integration)

DMMS ships a [Model Context Protocol](https://modelcontextprotocol.io) server exposing **30 tools** so AI assistants (Claude Code, etc.) can read and write data directly.

### Setup

```bash
npm run build:mcp   # compiles src/mcp/ → dist-mcp/index.js
```

Add to `.claude/settings.json`:

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

Get a token:

```bash
curl -s -X POST http://localhost:3005/api/dmms/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"yourpassword"}' | jq -r '.data.token'
```

### Available Tools

| Category | Tools |
|----------|-------|
| Auth | `dmms_login`, `dmms_me` |
| Projects | `list`, `get`, `create`, `update`, `delete` |
| Deliverables | `tree`, `get`, `create`, `update`, `delete`, `open-bids`, `cancel`, `reassign` |
| Tasks | `list`, `create`, `update`, `delete` |
| Kanban | `list`, `my-kanban`, `create`, `update`, `delete`, `comments`, `add-comment` |
| Proposals | `list`, `mine`, `submit`, `accept`, `reject` |
| Submissions | `pending`, `get`, `history`, `submit`, `approve`, `revise`, `reject` |
| Admin | `list-users`, `update-role`, `marketplace`, `ledger` |

---

## API Overview

All endpoints are prefixed with `/api/dmms/`.

| Group | Endpoints |
|-------|-----------|
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| Projects | `GET/POST /projects`, `GET /projects/:id` |
| Deliverables | `GET /projects/:id/tree`, `POST /deliverables`, `PATCH /deliverables/:id/*` |
| Marketplace | `GET /marketplace/bids` |
| Proposals | `POST /deliverables/:id/proposals`, `PATCH /proposals/:id/accept` |
| Submissions | `POST /deliverables/:id/submit`, `GET /submissions/pending`, `PATCH /submissions/:id/approve` |
| Rewards | `GET /rewards/ledger` |
| Admin | `GET /admin/users`, `PATCH /admin/users/:id/role` |

---

## QA Findings & Planning

Full QA was run across the E2E suite and a deep code audit. Results are tracked here as the authoritative checklist.

---

### ✅ Completed — Sprint 0: Foundation

| # | Item | Status |
|---|------|--------|
| 0 | Replace email-based login with alphanumeric username (required for @mention syntax) | ✅ Done |

---

### ✅ Completed — Sprint 1: Critical Business Logic

| # | Flaw | Fix | Status |
|---|------|-----|--------|
| 1 | **REAL-FLAW-011** File paths stored via string concat → JSON corruption risk | Use `json.Unmarshal`/`json.Marshal` in kanban upload handlers | ✅ Done |
| 2 | **REAL-FLAW-003** Required kanban tasks do not block deliverable submission | Count required-pending tasks in `Submit` handler; return 400 if any incomplete | ✅ Done |
| 3 | **REAL-FLAW-002** `dependency_id` stored but never enforced in `OpenForBids` | Check dependency status is `approved` before allowing bids | ✅ Done |

---

### ✅ Completed — Sprint 2: Security & Data Integrity

| # | Flaw | Fix | Status |
|---|------|-----|--------|
| 4 | **CRIT-002** PM can reject proposals they don't own | Add ownership check in `Reject` handler | ✅ Done |
| 5 | **CRIT-001** Admin registration silently downgraded | Return 400 on invalid role in `Register` handler | ✅ Done |
| 6 | **CRIT-003** PM can submit proposal on own deliverable | Verify `contributor_id != project.pm_id` in proposal `Submit` | ✅ Done |
| 7 | **ERR-003** `UpdateStatus` errors ignored in submission handler | Handle error and return 500 on failure | ✅ Done |
| 8 | **ERR-004** `Decode` errors ignored in `RequestRevision`/`RejectSubmission` | Add decode error guards | ✅ Done |
| 9 | **REAL-FLAW-014** Acceptance criteria checklist not validated server-side | Validate all criteria are checked before submission | ✅ Done |

---

### ✅ Completed — Sprint 3: Frontend & UX

| # | Flaw | Fix | Status |
|---|------|-----|--------|
| 10 | **UI-001** Whitespace-only project name accepted | Trim and disable button when name is empty | ✅ Done |
| 11 | **UI-002** Edit project allows clearing name | Guard `handleEditSave` with trimmed name check | ✅ Done |
| 12 | **ERR-001** API error on project create swallowed silently | Wrap in try/catch and show error Alert | ✅ Done |
| 13 | **REAL-FLAW-001** Parent budget stale after child creation | Reload deliverable tree after child add/edit/delete | ✅ Done |
| 14 | **REAL-FLAW-004** Proposal revision has no UI | Add "Edit" button in contributor My Proposals view | ✅ Done |
| 15 | **REAL-FLAW-005** No "Complete Project" action in PM UI | Add "Mark as Completed" button with confirmation modal | ✅ Done |
| 16 | **REAL-FLAW-006** Only latest submission shown, no audit trail | Use `/submissions/history` endpoint and show all revisions chronologically | ✅ Done |
| 17 | **REAL-FLAW-009** Parent proposal acceptance silently assigns children | Warn PM when accepting proposal that auto-assigns child deliverables | ✅ Done |
| 18 | **REAL-FLAW-018** No UI path to reopen a rejected deliverable | Add "Reopen for Bids" button on rejected deliverables | ✅ Done |
| 19 | **UI-004/005/006** `window.confirm()` used for destructive actions | Replace all native dialogs with custom Modal component | ✅ Done |

---

### ✅ Completed — Sprint 4: Security Hardening

| # | Flaw | Fix | Status |
|---|------|-----|--------|
| 20 | **SEC-001** No seed script for test/admin accounts | Added `scripts/seed-test-users.sh` | ✅ Done |
| 21 | **REAL-FLAW-017 / SEC-003** No rate limiting on login | Added IP-based rate limiting middleware (10,000/hr for E2E compatibility) | ✅ Done |
| 22 | **REAL-FLAW-016 / SEC-002** JWT in `localStorage` (XSS risk) | Migrated to `sessionStorage`; backend sets `httpOnly` cookie | ✅ Done |

---

### ✅ Completed — Sprint 5: Polish & Performance

| # | Flaw | Fix | Status |
|---|------|-----|--------|
| 23 | **REAL-FLAW-010** PM-set budget silently overwritten by deliverable sum | Distinguish `budget_ceiling` (PM-set) vs `budget_computed` (sum of deliverables) | ✅ Done |
| 24 | **REAL-FLAW-012** No success notifications anywhere | Added global toast notification system for all user actions | ✅ Done |
| 25 | **REAL-FLAW-013** Kanban load errors silently swallowed | Show "Failed to load. Retry?" error state in column | ✅ Done |
| 26 | **REAL-FLAW-015** No pagination on projects/users lists | Added `limit`/`offset` with `total` in response envelope; added pagination UI | ✅ Done |
| 27 | **UX-003** Marketplace has no search or filter | Added keyword search and budget range filter | ✅ Done |
| 28 | **UI-003** Proposal bid has no max client-side validation | Show max budget hint; set `max` attribute on bid amount input | ✅ Done |
| 34 | **PERF-003** `DeliverableTreePage` re-sorts on every reload | Wrapped `sortTree` in `useMemo` | ✅ Done |

---

### ✅ Completed — Sprint 6: Notifications, Accessibility & E2E

| # | Flaw | Fix | Status |
|---|------|-----|--------|
| 29 | **REAL-FLAW-007** @mentions are decorative — no data stored | Parse `@username` server-side; store in `dmms_comment_mentions` table | ✅ Done |
| 30 | **REAL-FLAW-008** Task assignment creates no notification | Create notification record when `assigned_to` changes | ✅ Done |
| 31 | **REAL-FLAW-020** `is_required` flag settable by any user | Restrict to PM and admin roles in `Create`/`Update` handlers | ✅ Done |
| 32 | **A11Y-003** Collapse buttons have no `aria-label` | Added `aria-label` and `aria-expanded` to deliverable collapse toggles | ✅ Done |
| 33 | **A11Y-005** Color-only status differentiation | Added text/icon alongside color-coded status badges (WCAG 1.4.1) | ✅ Done |
| —  | Kanban E2E: Delete button hidden for PM (operator precedence bug) | Fixed `||`/`&&` precedence on Delete button render condition | ✅ Done |
| —  | Kanban E2E: 11/11 tests passing | All kanban spec tests green | ✅ Done |
| —  | Admin / Auth / Projects / Deliverables E2E: all passing | Full suite green | ✅ Done |

---

### 🔲 Remaining / Future Work

| Priority | Item | Notes |
|----------|------|-------|
| Medium | **A11Y-001** Kanban DnD not keyboard accessible (WCAG 2.1.1) | Requires accessible drag handles and keyboard listeners |
| Medium | **A11Y-002** Modal does not trap focus | Verify Tab stays inside open Modal |
| Medium | **PERF-004** N+1 risk in kanban task enrichment | Audit `kanban_repo.go` for per-task queries vs JOINs |
| Low | **REAL-FLAW-019** Keyboard DnD (duplicate of A11Y-001) | Same fix |
| Low | **UX-004** Empty kanban columns show no "No tasks" text | Cosmetic empty state |
| Low | **UX-005** Dependency arrows not visualised in deliverable tree | `dependency_id` field exists but no UI indicator |
| Low | **UX-006** "Portfolio overview" label shown to contributors | PM-centric copy in contributor dashboard |
| Low | **A11Y-004** Badge/KpiCard components lack ARIA roles | Audit status badge components |
| — | Email notifications on proposal acceptance / submission review | Requires email service integration |
| — | Public marketplace view (unauthenticated) | New auth bypass route |
| — | Gantt chart / timeline view | New page |
| — | Budget analytics dashboard | New page |
| — | Docker Compose for self-hosting | DevOps |
| — | Webhook support for external integrations | New feature |
| — | CI pipeline (`playwright.yml` GitHub Actions) | Runs E2E on push |
| — | Separate test database isolation | Avoid shared state between E2E runs |

---

### E2E Suite Status

| Spec file | Tests | Status |
|-----------|-------|--------|
| `auth.spec.ts` | All | ✅ Passing |
| `admin.spec.ts` | All | ✅ Passing |
| `projects.spec.ts` | All | ✅ Passing |
| `deliverables.spec.ts` | All | ✅ Passing |
| `proposals.spec.ts` | All | ✅ Passing |
| `submissions.spec.ts` | All | ✅ Passing |
| `kanban.spec.ts` | 11/11 | ✅ Passing |
| `real-scenarios.spec.ts` | All | ✅ Passing |
| `edge-cases.spec.ts` | All | ✅ Passing |
| Drag-and-drop | — | ⏭ Skipped (headless DnD is flaky — tracked above) |

---

## Roadmap

Planned beyond the QA sprint:

- Email notifications on proposal acceptance and submission review
- Public marketplace view (unauthenticated browse of open bids)
- Gantt chart / timeline view
- Budget analytics dashboard
- Docker Compose setup for easy self-hosting
- Webhook support for external integrations
- CI pipeline (GitHub Actions — Playwright on push)

Have an idea? [Open a discussion](../../discussions) or submit a feature request issue.

---

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) first.

Quick summary:
1. Fork the repo and create a feature branch
2. Make your changes with clear commit messages
3. Open a pull request — describe what you changed and why

---

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). By participating you agree to uphold a welcoming and respectful community.

---

## License

[MIT](LICENSE) — free for personal and commercial use.
