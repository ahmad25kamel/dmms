# Changelog

All notable changes to DMMS are documented here, derived from the git commit history.

---

## [Unreleased] — 2026-05-18

### Features
- Implement user account approval workflow; redesign reward ledger page for improved visibility
- Add archive support to tasks with repository methods, API parameters, and UI toggle
- Enhance contributor dashboard with financial KPIs, earnings history, and project status breakdown
- Implement hierarchical deliverable grouping and nested sub-deliverable management in workspace UI and API
- Automate task membership upon proposal acceptance; improve UI/UX of proposals management dashboard
- Add bid filtering and automatic UI refresh after submission in marketplace
- Add proposal count to marketplace deliverables; fix project manager ID filter in proposal repository

### Refactor
- Replace GORM query builder with raw SQL for `ListOpenBids` to improve join logic and soft-delete handling

---

## 2026-05-16

### Features
- Add PM all-proposals view and proposal count on deliverable tree
- Integrate Husky for pre-push validation and add automated CI pipeline checks
- Distinguish PM budget ceiling (`budget_ceiling`) from computed budget total (`budget_computed`)
- Add pagination to projects and admin users list
- Create notification record on task assignment change
- Parse and store `@mention` data when creating comments
- Add seed script for test users including admin promotion
- Add keyword search filter to marketplace
- Add global toast notification system for user actions
- Add "Reopen for Bids" button on rejected and cancelled deliverables
- Add proposal revision UI for contributors
- Add "Complete Project" action to PM project detail page

### Fixes
- Make all kanban E2E tests pass
- Fix auth spec selector issues; raise rate limit to 10,000/hr for dev environment
- Update E2E tests for custom modals; raise rate limit for test suite
- Validate acceptance criteria checklist on submission
- Restrict `is_required` task flag to PM and admin roles only
- Show error state with retry in kanban column on load failure
- Add IP-based rate limiting to login and register endpoints
- Store JWT in `sessionStorage` instead of `localStorage` to reduce XSS attack surface
- Warn PM when accepting proposal that auto-assigns child deliverables
- Show full submission history including revision notes
- Replace native `confirm()` dialogs with custom Modal component
- Add `aria-label` and `aria-expanded` to deliverable collapse buttons (WCAG A11Y)
- Use human-readable status labels in marketplace badges (WCAG 1.4.1)

### Performance
- Memoize deliverable tree sort to avoid redundant re-computation

### Tests
- Update E2E suite for username-based auth and all accumulated fixes

### Docs
- Move QA checklist and planning into README; remove from e2e folder

---

## 2026-05-15

### Features
- Replace email-based login with alphanumeric username for `@mention` support
- Add proxy configuration for `/uploads` route to the backend server
- Update kanban file attachments to display images inline and show filenames instead of indices

### Fixes
- Reject whitespace-only project names; show error alert on create/edit failure
- Verify PM ownership before allowing proposal rejection; prevent PM self-bidding
- Enforce dependency approval before opening deliverable for bids
- Block submission when required kanban tasks are incomplete
- Use `json.Marshal`/`json.Unmarshal` for file path array in kanban upload (prevents JSON corruption)
- Serve `/uploads/` as static files so uploaded attachments are accessible
- Add `chmod +x` for deploy script

### Docs
- Simplify Apache config to HTTP-only (HTTPS handled via Cloudflare Tunnel)

### Chore
- Rename project to "Deliverable Modular Management System"
- Track `.claude/skills` in git and add DMMS skill
- Register DMMS skill in project `CLAUDE.md`
