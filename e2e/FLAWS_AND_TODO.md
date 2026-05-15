# DMMS E2E Test — Flaws and TODO

Findings from static code analysis of the frontend (`src/`) and backend (`internal/`) during E2E test authoring.

---

## Critical Bugs

### CRIT-001 — Admin registration is silently downgraded without feedback
**File:** `internal/handlers/auth_handler.go:42-44`
**Issue:** The `register` handler silently forces the role to `contributor` if the requested role is not `pm` or `contributor`. This means a user trying to register as `admin` receives a `contributor` account with no error message. The frontend also does not expose the `admin` option on the registration form, which is consistent — but the backend behavior is silent and could confuse integration callers.
**Reproduction:**
```
POST /api/dmms/auth/register  { "role": "admin", ... }
→ 201 Created with role: "contributor"  (no error)
```
**Expected:** 400 Bad Request with message "invalid role", OR explicit documentation that admin must be promoted separately.
**Severity:** High
**Fix:** Return a 400 if an unsupported role is requested, or document the promotion workflow.

---

### CRIT-002 — PM/Admin can reject a proposal without owning the deliverable
**File:** `internal/handlers/proposal_handler.go:155-168`
**Issue:** `Reject` handler does not verify that the calling PM owns the project/deliverable associated with the proposal. Any authenticated PM can reject any proposal across all projects.
**Reproduction:**
```
POST /api/dmms/proposals/<another_pm_proposal_id>/reject
Authorization: Bearer <different_pm_token>
→ 200 OK  {"rejected": true}
```
**Expected:** 403 Forbidden if calling user is not the PM of the associated deliverable.
**Severity:** Critical
**Fix:** Add ownership check: load the proposal → deliverable → project, verify `project.pm_id == caller_id`.

---

### CRIT-003 — No check preventing PM from accepting their own proposal (if they submitted one)
**File:** `internal/service/deliverable_service.go` (AcceptProposal)
**Issue:** The `AcceptProposal` service checks that the proposal exists but does not verify the caller is the PM of the associated deliverable. Since `AcceptProposal` is gated on `pmID` parameter, a contributor with a stolen/forged token for a PM ID could accept proposals. More critically, no check prevents a PM from submitting a proposal on their own deliverable (the submit handler only checks `DelivOpenForBids`, not that the caller is not the PM).
**Severity:** High
**Fix:** In `Submit` proposal handler, verify `contributorID != deliverable.project.pm_id`.

---

## Missing UI Validation

### UI-001 — Project name with whitespace-only is accepted by the "Create Project" form
**File:** `src/pages/projects/ProjectsPage.tsx:91`
**Issue:** The `Create Project` button is disabled only when `!name` (falsy), but `name = "   "` is truthy. A project named "   " can be created and appears in the list.
**Reproduction:** Open New Project modal → type spaces → click Create Project → project with blank name appears.
**Expected:** Trim the name and disable the button if the trimmed value is empty.
**Severity:** Medium
**Fix:** Change condition to `disabled={saving || !name.trim()}` and trim before sending to API.

---

### UI-002 — Edit Project modal has no required validation on name
**File:** `src/pages/projects/ProjectDetailPage.tsx:229`
**Issue:** The edit modal name `Input` lacks a `required` attribute. The user can clear the project name and save it, resulting in a project with an empty name.
**Reproduction:** Open Edit Project → clear name → click Save → project name disappears.
**Expected:** Validate that name is not empty before calling `projectsApi.update`.
**Severity:** Medium
**Fix:** Add `required` to the name input and add a guard in `handleEditSave`.

---

### UI-003 — Proposal bid amount has no client-side max validation against deliverable budget
**File:** `src/pages/marketplace/MarketplacePage.tsx` (bid form)
**Issue:** While the backend validates `bid_amount > d.MaxBudget`, the frontend proposal form does not set the `max` attribute on the number input nor shows a hint about the max budget before submitting.
**Expected:** Show max budget hint and set `max={deliverable.max_budget}` on the input.
**Severity:** Low (backend prevents it but UX is poor)

---

### UI-004 — Delete project uses browser `confirm()` — inaccessible and un-styleable
**File:** `src/pages/projects/ProjectDetailPage.tsx:125`
**Issue:** `window.confirm()` is used for delete confirmation. This is inaccessible (no keyboard trap, no ARIA), cannot be styled to match the design system, and does not work in some test environments.
**Severity:** Medium
**Fix:** Replace with a custom `Modal` confirmation dialog (the project already has a `Modal` component).

---

### UI-005 — Same pattern for delete deliverable (confirm dialog)
**File:** `src/pages/deliverables/DeliverableTreePage.tsx:47`
**Same as UI-004.**

---

### UI-006 — Same pattern for delete user in admin (confirm dialog)
**File:** `src/pages/admin/AdminPage.tsx:24`
**Same as UI-004.**

---

## Missing Error States

### ERR-001 — API error on project create is silently swallowed
**File:** `src/pages/projects/ProjectsPage.tsx:17-20`
**Issue:** `handleCreate` calls `projectsApi.create` with no try/catch. If the API call fails (e.g., network error, 500), the modal closes and the user gets no feedback.
**Reproduction:** Disconnect the backend → try to create a project → modal closes with no error shown.
**Expected:** Catch the error and display it as an `Alert`.
**Severity:** High

---

### ERR-002 — Kanban `loadMore` errors are silently discarded
**File:** `src/pages/kanban/KanbanPage.tsx` (PMKanban `loadMore`)
**Issue:** The `loadMore` callback has no error handling. A failed API call leaves the column empty without any error message.
**Expected:** Show an error notice in the column or a global alert.
**Severity:** Medium

---

### ERR-003 — Submission handler ignores error from `UpdateStatus` after creating submission
**File:** `internal/handlers/submission_handler.go:82`
**Issue:** `h.deliverables.UpdateStatus(...)` is called with `//nolint:errcheck`. If the status update fails, the submission is created but the deliverable status is not moved to `submitted`. This creates an inconsistent state.
**Expected:** Check the error and rollback or surface it.
**Severity:** High

---

### ERR-004 — RequestRevision and RejectSubmission handlers silently ignore Decode errors
**File:** `internal/handlers/submission_handler.go:126, 144`
**Issue:** `Decode(r, &body)` is called without checking the returned error. If the body is malformed, the handler proceeds with empty `Notes`.
**Expected:** `if err := Decode(r, &body); err != nil { Err(w, 400, "invalid body"); return }`.
**Severity:** Low (notes field is optional but the pattern is inconsistent)

---

## UX Gaps

### UX-001 — No success toast/notification after creating a project
**File:** `src/pages/projects/ProjectsPage.tsx`
**Issue:** After a project is created, the modal closes and the project appears in the list — but there is no visible success feedback. Users may click "Create Project" multiple times if the network is slow.
**Expected:** A toast notification "Project created successfully" or at minimum a loading spinner on the button (which is implemented but only for `saving` state during submit).
**Severity:** Low

---

### UX-002 — After accepting a proposal, no toast or clear state change in UI
**File:** `src/pages/proposals/ProposalReviewPage.tsx`
**Issue:** After calling `accept()`, the proposal's status is updated locally but the UI does not scroll to or highlight the accepted proposal, and there is no feedback notification.
**Severity:** Low

---

### UX-003 — Marketplace has no search or filter by keyword
**File:** `src/pages/marketplace/MarketplacePage.tsx`
**Issue:** The marketplace only groups deliverables by project. There is no text search, budget filter, or due date filter. With many deliverables, this becomes unusable.
**Severity:** Medium

---

### UX-004 — Kanban columns do not show empty state text when no tasks exist
**File:** `src/pages/kanban/KanbanPage.tsx`
**Issue:** Empty kanban columns show nothing — no "No tasks" message. Users may think the data is still loading.
**Severity:** Low

---

### UX-005 — DeliverableTreePage: no visual indication of dependency relationship
**File:** `src/pages/deliverables/DeliverableTreePage.tsx`
**Issue:** The `dependency_id` field is supported in the data model but the tree UI does not render dependency arrows or indicators. PMs cannot see which deliverables block others.
**Severity:** Medium

---

### UX-006 — Dashboard shows "Portfolio overview" even for contributors who have no projects
**File:** `src/pages/dashboard/DashboardPage.tsx`
**Issue:** The `ContributorDashboard` component (not fully read) should show context-relevant content. The subtitle "Portfolio overview" is PM-centric language shown to contributors.
**Severity:** Low

---

### UX-007 — Proposal revision (edit) not exposed in UI
**File:** `src/api/index.ts:68` — `proposalsApi.revise` exists
**Issue:** The API supports revising a pending proposal (`PATCH /proposals/:id`) but the `ProposalsPage` only shows a "Withdraw" button. Contributors cannot edit their bid amount or message.
**Severity:** Medium
**Fix:** Add an "Edit" button next to pending proposals that opens a form to revise bid_amount and message.

---

## Security Concerns

### SEC-001 — Admin promotion is only enforceable via direct DB/admin API; no seeding script
**Issue:** There is no way to create an admin account through the normal registration flow. Testers and operators must manually promote users in the database. No seed script or documentation is provided.
**Severity:** High (operational risk)
**Fix:** Provide a `seed.sh` or `go run ./cmd/seed` that creates a default admin account for development/test environments.

---

### SEC-002 — JWT tokens stored in localStorage (XSS risk)
**File:** `src/store/authStore.tsx` (not read, inferred from pattern)
**Issue:** The standard SPA pattern of storing JWT in `localStorage` exposes the token to XSS attacks. If any injected script runs (e.g., via UI-006 above), the token can be exfiltrated.
**Expected:** Store tokens in `httpOnly` cookies, or at minimum in `sessionStorage` with strict CSP.
**Severity:** High

---

### SEC-003 — No rate limiting mentioned on auth endpoints
**File:** `cmd/dmms/main.go` (not read), `internal/handlers/auth_handler.go`
**Issue:** The login and register endpoints have no visible rate limiting. Brute-force attacks against `/auth/login` are possible.
**Expected:** Add rate limiting middleware (e.g., `golang.org/x/time/rate`) to auth endpoints.
**Severity:** High

---

### SEC-004 — Proposal Reject handler does not verify PM ownership of deliverable
**(Duplicate of CRIT-002 — listed here for security tracking)**

---

## Performance Issues

### PERF-001 — `projectsApi.list()` loads all projects with no pagination
**File:** `src/pages/projects/ProjectsPage.tsx:13`, `internal/handlers/project_handler.go`
**Issue:** All projects are fetched at once. For PMs with hundreds of projects this will be slow and memory-intensive on both client and server.
**Fix:** Add `limit/offset` query params to `GET /projects` and implement virtual scroll or pagination in the UI.
**Severity:** Medium

---

### PERF-002 — `usersApi.list()` in Kanban loads ALL users for contributor filter
**File:** `src/pages/kanban/KanbanPage.tsx:68`
**Issue:** `usersApi.list()` fetches all users to populate the contributor filter dropdown. For large organizations this is expensive. The endpoint has no pagination.
**Fix:** Implement a search-as-you-type autocomplete or paginated user list.
**Severity:** Medium

---

### PERF-003 — DeliverableTreePage re-sorts the entire tree on every reload
**File:** `src/pages/deliverables/DeliverableTreePage.tsx:23-37`
**Issue:** The recursive `sortTree` function is called on every `reload()` including after every action (openBids, cancel, reopen, etc.). For large trees this is inefficient; should use `useMemo`.
**Severity:** Low

---

### PERF-004 — N+1 query risk in Kanban task enrichment
**File:** `internal/repository/kanban_repo.go` (not read)
**Issue:** Based on the enriched fields (`project_name`, `deliverable_title`, `assigned_to_name`), the repository likely performs JOINs. If these are implemented as separate queries per task, it's an N+1 pattern.
**Fix:** Verify that the SQL uses JOINs, not sequential selects per task.
**Severity:** Medium

---

## Accessibility

### A11Y-001 — Kanban drag-and-drop is not keyboard accessible
**File:** `src/pages/kanban/KanbanPage.tsx`
**Issue:** The drag-and-drop implementation relies on mouse events. Keyboard users cannot move tasks between columns.
**Expected:** Implement keyboard DnD with arrow keys and Space/Enter to pick up and drop tasks.
**WCAG:** 2.1.1 Keyboard (Level A)
**Severity:** High

---

### A11Y-002 — Modal does not trap focus
**File:** `src/components/ui/Modal.tsx` (not read, inferred)
**Issue:** Standard modal accessibility requires focus to be trapped inside the modal while it's open. Verify that tabbing out of the modal is prevented.
**WCAG:** 2.1.2 No Keyboard Trap (Level A) — trapping focus intentionally inside modal is required
**Severity:** High

---

### A11Y-003 — Deliverable tree collapse buttons have no accessible label
**File:** `src/pages/projects/ProjectDetailPage.tsx:485-499`
**Issue:** The expand/collapse toggle is a `<button>` containing only an SVG with no `aria-label` or `title`. Screen readers will announce it as "button" with no context.
**Expected:** Add `aria-label="Collapse {deliverable title}"` or `aria-expanded` attribute.
**Severity:** High

---

### A11Y-004 — Badge and KpiCard components likely lack ARIA roles
**File:** `src/components/ui/` (not read)
**Issue:** Status badges (e.g., "draft", "open_for_bids") should have appropriate roles or aria-labels for screen readers.
**Severity:** Medium

---

### A11Y-005 — Color-only status differentiation
**File:** `src/lib/statusColors.ts`
**Issue:** Deliverable and project statuses are communicated through color-coded badges only (inferred from `deliverableStatusColor`, `projectStatusColor` helpers). Users with color blindness cannot distinguish statuses.
**Expected:** Add icons or text labels alongside color coding.
**WCAG:** 1.4.1 Use of Color (Level A)
**Severity:** High

---

## TODO — Test Infrastructure

- [ ] **Seed script**: Create `scripts/seed-test-users.sh` that registers `test.pm`, `test.contributor`, and promotes `test.admin` to admin role. Run before E2E suite.
- [ ] **CI integration**: Add `playwright.yml` GitHub Actions workflow that starts the server, runs `npm run build`, and executes `npx playwright test`.
- [ ] **Database isolation**: E2E tests share a single DB. Consider using a separate `DMMS_TEST_DB` or transaction rollback between tests.
- [ ] **Test data cleanup**: Some tests create projects/deliverables but cleanup may fail silently. Add a global `afterAll` teardown that deletes all projects created during the test run by scanning for the `E2E Project` prefix.
- [ ] **Flaky: Drag-and-drop tests**: Quarantined with `test.fixme`. Implement once a stable DnD solution (keyboard-accessible) is in place.
- [ ] **Coverage gaps**: Budget page (`/budget`), workspace list page (`/workspace`), and Gantt chart interactions are not yet covered. Add specs after the above flaws are fixed.
