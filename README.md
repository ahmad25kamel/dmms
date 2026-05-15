# DMMS — Deliverable Marketplace Management System

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

To expose DMMS behind Apache with HTTPS, enable the required modules and create a virtual host config.

### 1. Enable modules

```bash
sudo a2enmod proxy proxy_http headers ssl
sudo systemctl restart apache2
```

### 2. Create virtual host

Create `/etc/apache2/sites-available/dmms.conf`:

```apache
<VirtualHost *:80>
    ServerName dmms.yourdomain.com
    Redirect permanent / https://dmms.yourdomain.com/
</VirtualHost>

<VirtualHost *:443>
    ServerName dmms.yourdomain.com

    SSLEngine on
    SSLCertificateFile     /etc/letsencrypt/live/dmms.yourdomain.com/fullchain.pem
    SSLCertificateKeyFile  /etc/letsencrypt/live/dmms.yourdomain.com/privkey.pem

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

> **SSL certificates:** if you don't have one yet, use [Certbot](https://certbot.eff.org/):
> ```bash
> sudo certbot --apache -d dmms.yourdomain.com
> ```

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

## Roadmap

This is an actively developed personal project. Planned improvements include:

- [ ] Email notifications on proposal acceptance and submission review
- [ ] Dependency-aware scheduling (block deliverable until dependency is approved)
- [ ] Public marketplace view (unauthenticated browse of open bids)
- [ ] Gantt chart / timeline view
- [ ] Budget analytics dashboard
- [ ] Docker Compose setup for easy self-hosting
- [ ] API rate limiting
- [ ] Webhook support for external integrations

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
