# DMMS Roadmap

**Vision**: A single platform for every team — freelancers, agencies, product squads, and enterprises. Covering the full lifecycle from work definition → marketplace bidding → execution → delivery → payment, available as both a self-hosted binary and a multi-tenant SaaS.

---

## Current State

The core engine is complete and production-ready:

| Capability | Status |
|------------|--------|
| Recursive deliverable tree | ✅ Done |
| Marketplace bidding (proposals) | ✅ Done |
| Submission & approval workflow | ✅ Done |
| Automatic reward ledger | ✅ Done |
| Cross-project kanban board | ✅ Done |
| File attachments & PR links | ✅ Done |
| Budget tracking (ceiling vs. computed) | ✅ Done |
| @mentions in comments | ✅ Done |
| In-app notifications (stored) | ✅ Done |
| User approval workflow | ✅ Done |
| MCP server (43 AI tools) | ✅ Done |
| Rate limiting & JWT security | ✅ Done |
| Single-binary deployment | ✅ Done |

---

## Milestone 1 — Analytics & Visibility

> **Priority**: Highest — PMs and stakeholders are flying blind today.

### Goals
Give every role a live, data-rich view of project health, budget burn, and contributor performance.

### Deliverables

| Feature | Description |
|---------|-------------|
| **Budget Analytics Dashboard** | Burn rate by project, allocation vs. actuals, savings trend, per-contributor spend breakdown |
| **Gantt / Timeline View** | Deliverable tree rendered as a horizontal timeline; drag to reschedule; critical path highlighted via `dependency_id` |
| **Project Health Score** | Composite metric: on-time %, budget variance, open revision rate — shown as a badge on each project |
| **Burn-down / Burn-up Charts** | Deliverables completed vs. planned over time; supports sprint-mode and continuous flow |
| **Contributor Performance Report** | Earnings history, on-time delivery rate, revision rate, average bid-to-accepted ratio |
| **Export** | CSV and PDF export of reports, ledger entries, and deliverable trees |

### Technical Notes
- New read-only `/api/dmms/analytics/*` handler group
- Queries aggregate from existing tables — no schema changes required
- Charts: lightweight library (e.g. Recharts, already in React ecosystem)
- Gantt: custom SVG renderer over the deliverable tree data

---

## Milestone 2 — Real-Time & Communication

> **Priority**: High — no live updates means constant page reloads.

### Deliverables

| Feature | Description |
|---------|-------------|
| **Email Notifications** | Proposal accepted/rejected, submission reviewed, task assigned, @mention — configurable via SMTP in `.env` |
| **WebSocket Live Updates** | Kanban board, notification badge, submission status update without reload |
| **In-App Notification Center** | Unread count badge, full notification feed with deep links to the relevant page |
| **@Mention Email Delivery** | Mention in a comment → in-app notification + email (model stores mentions; delivery layer missing) |
| **Comment Reactions** | Emoji reactions on kanban task comments |

### Technical Notes
- Email: Go `net/smtp` or pluggable transport (Resend / SendGrid via env var)
- WebSocket: single `/ws` endpoint broadcasting per-user events; goroutine hub pattern
- Notification center: extend existing `dmms_notifications` table with `link` field

---

## Milestone 3 — Integrations & Automation

> **Priority**: High — makes DMMS the hub, not a silo.

### Deliverables

| Feature | Description |
|---------|-------------|
| **Outbound Webhooks** | Per-project configurable endpoints; events: proposal accepted, submission approved/rejected, deliverable status change; Zapier/Make-compatible JSON payloads |
| **GitHub / GitLab Sync** | Link a deliverable to a repository; merged PR → auto-advance deliverable status; PR URL auto-populated in submission form |
| **Slack / Teams Alerts** | Webhook-based channel notifications (e.g. "Submission approved on Project X by @alice") |
| **Docker Compose** | One-command local and production deployment; separate services for Go binary, MySQL, and optional reverse proxy |
| **CI Pipeline** | GitHub Actions: Playwright E2E on push, Go build check, TypeScript type-check, automated test reports |

### Technical Notes
- Webhooks: new `dmms_webhooks` config table; async delivery via goroutine queue with retry
- GitHub sync: OAuth app or PAT; poll or webhook receiver endpoint
- Docker Compose: `docker-compose.yml` + `Dockerfile` for Go binary; MySQL official image

---

## Milestone 4 — Methodology Flexibility

> **Priority**: Medium — broadens the addressable audience to agile/scrum teams.

### Deliverables

| Feature | Description |
|---------|-------------|
| **Sprint Planning Mode** | Group deliverables into named sprints; sprint board view; velocity tracking across sprints |
| **Time Tracking** | Log hours per task or deliverable; hourly rate support alongside fixed-price bids; timesheet export |
| **Custom Fields** | PMs add custom metadata to deliverables and kanban tasks (text, number, date, dropdown) |
| **Workflow Templates** | Pre-built project templates: Software Release, Agency Client Project, Freelance Contract, Research Sprint |
| **Recurring Tasks** | Kanban tasks that auto-recreate on a daily / weekly / monthly schedule |
| **Kanban Sub-tasks** | Checklist items inside kanban cards, distinct from deliverable acceptance criteria |

### Technical Notes
- Sprints: new `dmms_sprints` table with `start_date`, `end_date`, `deliverable_ids` join
- Custom fields: EAV pattern (`dmms_custom_fields` schema + `dmms_custom_field_values`) or JSONB column
- Templates: stored as JSON seed data; applied on project create

---

## Milestone 5 — Client-Facing & Marketplace Expansion

> **Priority**: Medium — opens revenue-generating use cases for agencies and freelancers.

### Deliverables

| Feature | Description |
|---------|-------------|
| **Public Marketplace** | Unauthenticated browse of open deliverables; register-to-bid CTA; SEO-friendly pages |
| **Client Portal** | Read-only shareable project view for clients and stakeholders via signed token link — no account required |
| **Proposal Sharing** | PM shares a single open deliverable publicly with a link |
| **Invoice Generation** | Generate PDF invoices from ledger entries; mark as paid; send via email |
| **Time-to-Payment Tracking** | Days from submission approval to ledger entry; dashboard metric and alert if overdue |

### Technical Notes
- Public marketplace: new unauthenticated route group; rate-limited by IP
- Client portal: short-lived signed JWT with `project_id` claim; read-only handler group
- Invoice PDF: Go `gofpdf` or similar; template-based with DMMS branding

---

## Milestone 6 — Multi-Tenancy & SaaS Foundation

> **Priority**: Critical for cloud deployment — architecturally invasive; run as a parallel track.

### Deliverables

| Feature | Description |
|---------|-------------|
| **Organizations / Workspaces** | All data scoped to an `org_id`; users belong to one or more orgs |
| **Org Roles** | Owner, Admin, Member, Guest — replaces flat global roles within an org context |
| **Email Invitation System** | Invite by email address; pending invite tokens; resend and revoke |
| **OAuth Login** | Google and GitHub sign-in alongside existing username/password |
| **SaaS Billing** | Stripe integration; Free / Pro / Enterprise plans; seat limits; upgrade/downgrade flow |
| **Super-Admin Dashboard** | SaaS operator panel: org list, usage metrics, plan management, impersonation |
| **Self-Hosted Bypass** | `DMMS_SELF_HOSTED=true` disables billing, org limits, and multi-tenancy — preserves single-binary mode |

### Technical Notes
- All existing tables gain an `org_id` foreign key; middleware injects org context from JWT
- OAuth: standard PKCE flow; store `provider` + `provider_id` on user
- Stripe: webhook receiver for subscription events; entitlement checks in middleware
- Migration path: existing single-user deployments treated as a default org

---

## Milestone 7 — Enterprise & Compliance

> **Priority**: Medium-High — required for enterprise sales and regulated industries.

### Deliverables

| Feature | Description |
|---------|-------------|
| **Audit Log** | Immutable append-only record of every create / update / delete: who, when, what changed |
| **Advanced RBAC** | Custom roles with granular permission sets (e.g. "Reviewer": approve submissions but not create projects) |
| **SAML / OIDC SSO** | Enterprise identity provider support (Okta, Azure AD, Google Workspace) |
| **2FA / TOTP** | Authenticator app (RFC 6238) support on login; enforce per-org or per-user |
| **GDPR Tools** | Per-user data export (JSON archive), right-to-deletion, configurable data retention policy |
| **SLA Tracking** | Per-deliverable SLA targets; escalation alerts when at risk; SLA breach report |

### Technical Notes
- Audit log: write-only `dmms_audit_log` table; middleware hooks on all mutating handlers
- RBAC: `dmms_roles` + `dmms_role_permissions` tables; replace hardcoded role checks
- SAML: `crewjam/saml` Go library; SP-initiated flow

---

## Milestone 8 — Mobile & Accessibility

> **Priority**: Medium — polish and reach.

### Deliverables

| Feature | Description |
|---------|-------------|
| **Progressive Web App (PWA)** | Installable on iOS and Android; offline kanban board via service worker cache |
| **Full WCAG 2.1 AA** | Keyboard-accessible drag-and-drop, modal focus trap, all remaining A11Y backlog items |
| **Mobile-Optimized Layouts** | Kanban board and deliverable tree fully responsive for small screens |

---

## Milestone 9 — AI & Automation

> **Priority**: High — DMMS's strongest differentiator. Claude Code integration already ships.

### Deliverables

| Feature | Description |
|---------|-------------|
| **AI Deliverable Breakdown** | PM describes a project in natural language → Claude generates a full deliverable tree with suggested budgets and due dates |
| **Proposal Scoring** | AI ranks incoming proposals by quality, timeline realism, and contributor history; PM sees a recommendation |
| **Budget Estimation** | AI suggests a max budget for a new deliverable based on scope description and historical accepted bids |
| **Auto-Assign Suggestions** | AI recommends contributors for open deliverables based on past performance and skill signals |
| **MCP Tool Expansion** | All new features from M1–M8 exposed as MCP tools so Claude Code can manage the full platform |

### Technical Notes
- AI features: call Anthropic API from backend; stream responses to frontend via SSE
- Prompt caching on deliverable tree context (large structured inputs benefit most)
- MCP: extend `src/mcp/index.ts` alongside each milestone's feature work

---

## Recommended Sequencing

```
Now          Q3 2026       Q4 2026       Q1 2027       Q2 2027+
 │              │             │             │              │
 ├── M1 ────────┤             │             │              │
 │   Analytics  │             │             │              │
 │              ├── M2 ───────┤             │              │
 │              │   Real-Time │             │              │
 │              ├── M3 ───────┤             │              │
 │              │   Integrat. │             │              │
 ├──────────────┼── M6* ──────┼─────────────┤              │
 │              │   SaaS      │  (parallel) │              │
 │              │             ├── M4 ───────┤              │
 │              │             │   Methods   │              │
 │              │             ├── M5 ───────┤              │
 │              │             │   Client    │              │
 │              │             ├── M9 ───────┼──────────────┤
 │              │             │   AI        │              │
 │              │             │             ├── M7 ────────┤
 │              │             │             │   Enterprise │
 │              │             │             ├── M8 ────────┤
 │              │             │             │   Mobile     │
```

*M6 (multi-tenancy) runs as a parallel track — it is architecturally invasive and should not block feature milestones.*

---

## Milestone Summary

| # | Milestone | Theme | Effort | Audience Impact |
|---|-----------|-------|--------|-----------------|
| M1 | Analytics & Visibility | Reporting | Medium | All roles |
| M2 | Real-Time & Communication | Collaboration | Medium | All roles |
| M3 | Integrations & Automation | Connectivity | Medium | PMs, DevOps |
| M4 | Methodology Flexibility | Agile / Scrum | High | Product teams |
| M5 | Client-Facing & Marketplace | Growth | Medium | Agencies, freelancers |
| M6 | Multi-Tenancy & SaaS | Platform | Very High | SaaS customers |
| M7 | Enterprise & Compliance | Governance | High | Enterprise |
| M8 | Mobile & Accessibility | Reach | Medium | All roles |
| M9 | AI & Automation | Differentiation | Medium | All roles |

---

Have an idea or want to sponsor a milestone? [Open a discussion](../../discussions) or submit a feature request issue.
