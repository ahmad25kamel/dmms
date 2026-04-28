# DMMS — Deliverable Marketplace Management System

A SaaS platform for managing project deliverables through an internal marketplace. Project Managers break work into a recursive deliverable tree, open items for bidding, and Contributors propose budgets and timelines. Approved work triggers automatic reward ledger entries and budget savings tracking.

## Roles

| Role | Capabilities |
|------|-------------|
| **PM** | Create projects, build deliverable trees, review bids, approve/reject submissions |
| **Contributor** | Browse marketplace, submit proposals, complete work, track earnings |
| **Admin** | Manage users and roles |

## Tech Stack

- **Backend**: Go (standard library `net/http`), SQLite (`modernc.org/sqlite`), JWT auth, bcrypt passwords
- **Frontend**: React 19 + TypeScript + Vite, KMG design system (Inter + JetBrains Mono)
- **Auth**: JWT Bearer tokens, 24h expiry

---

## Prerequisites

- Go 1.22+
- Node.js 20+ / npm 10+

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
export DMMS_DB_PATH=dmms.db
```

> `DMMS_JWT_SECRET` is required — the server will not start without it.

### 4. Run database migrations

Migrations run automatically on server startup from `migrations/001_dmms_init.sql`.

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
| `DMMS_DB_PATH` | No | `dmms.db` | SQLite database file path |

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
├── src/                # React frontend
│   ├── api/            # API client + typed functions
│   ├── components/     # UI component library (KMG design system)
│   ├── pages/          # Page components by route
│   ├── store/          # Auth context/store
│   └── types/          # TypeScript types
└── .env.dmms           # Local environment (not committed)
```
