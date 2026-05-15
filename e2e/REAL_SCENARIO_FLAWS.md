# Real-Scenario QA Flaws & TODO

Deep business logic analysis of DMMS — beyond functional testing.
Each flaw includes the scenario it was found in, root cause in code, severity, and a concrete fix.

---

## CRITICAL BUSINESS LOGIC FLAWS

---

### REAL-FLAW-001 — Parent budget rollup happens server-side but is not re-fetched in UI after child creation
**Scenario:** Scenario 2 — Parent budget auto-sums children  
**Found in:** `internal/service/deliverable_service.go:recomputeProjectBudget`  
**Issue:** When a child deliverable is created, the backend correctly sums child budgets into the parent's `max_budget` via `recomputeProjectBudget`. However, the React frontend receives the `Create` response containing the *child's* data only — it does NOT re-fetch the deliverable tree. The parent node shown in the UI will display the old budget until the user manually refreshes.

**Reproduction:**
1. PM creates parent deliverable with max_budget=0
2. PM creates child A (max_budget=3000) under parent
3. PM creates child B (max_budget=2000) under parent
4. Without refresh: parent shows 0 budget in UI
5. After F5 refresh: parent shows 5000 ✓

**Expected:** Parent budget updates reactively after any child add/edit/delete.  
**Severity:** High — PMs see stale budget data during planning  
**Fix:** After creating/editing/deleting a child deliverable, re-fetch the full deliverable tree for the project. Or: return the updated parent in the create-child API response.

---

### REAL-FLAW-002 — `dependency_id` is stored but never enforced anywhere
**Scenario:** Scenario 5 — Dependency blocking  
**Found in:** `internal/models/models.go:Deliverable.DependencyID`, `internal/service/deliverable_service.go:OpenForBids`  
**Issue:** The `Deliverable` model has a `dependency_id` field which lets a PM specify that deliverable B depends on deliverable A. This is rendered in the UI. However, `OpenForBids()` does NOT check whether the dependency deliverable has been approved before allowing bids on the dependent deliverable. Contractors can be assigned work that logically cannot start yet.

**Reproduction:**
1. PM creates Deliverable A (Design Phase) — draft
2. PM creates Deliverable B (Dev Phase), sets `dependency_id = A`
3. PM opens B for bids — **succeeds even though A is still draft**
4. Contributor is assigned to B, starts work before A is even scoped

**Expected:** `OpenForBids` should check: if `dependency_id != nil`, the dependency's status must be `approved`.  
**Severity:** Critical — violates the entire premise of dependency-ordered work  
**Fix in:** `internal/service/deliverable_service.go:OpenForBids`:
```go
if d.DependencyID != nil {
    dep, err := s.deliverables.FindByID(*d.DependencyID)
    if err != nil || dep.Status != models.DelivApproved {
        return fmt.Errorf("dependency deliverable must be approved first")
    }
}
```

---

### REAL-FLAW-003 — Required kanban tasks do NOT block deliverable submission
**Scenario:** Scenario 4 — Required task does not gate submission  
**Found in:** `internal/handlers/submission_handler.go:Submit`, `internal/models/models.go:Task.IsRequired`  
**Issue:** A PM can mark a kanban task as `is_required = true` (meaning the contractor MUST complete it before submitting). However, `Submit` in `submission_handler.go` never checks whether all required tasks are in `done` status. A contractor can submit incomplete work.

**Reproduction:**
1. PM creates task "Write unit tests" with `is_required=true` under deliverable D
2. Contributor leaves the task in "todo" state
3. Contributor calls POST `/deliverables/{D}/submissions` → **201 Created** — no validation

**Expected:** `Submit` should fail with 400 if any `is_required=true` task for this deliverable has `status != done`.  
**Severity:** Critical — defeats the purpose of required subtasks as acceptance gates  
**Fix in:** `internal/handlers/submission_handler.go:Submit`:
```go
// Check required tasks
requiredPending, _ := h.subtasks.CountRequiredPending(deliverableID)
if requiredPending > 0 {
    Err(w, http.StatusBadRequest, fmt.Sprintf("%d required task(s) not completed", requiredPending))
    return
}
```

---

### REAL-FLAW-004 — Proposal revision endpoint exists in backend but is completely absent from the contributor UI
**Scenario:** Scenario 7 — Bob revises his proposal  
**Found in:** `internal/handlers/proposal_handler.go:Revise`, `src/api/`, `src/pages/`  
**Issue:** `PUT /proposals/{id}/revise` is a fully implemented backend endpoint that allows a contributor to update their bid amount and message before it's accepted. However, searching the entire `src/` directory finds no UI component, page, or API client call that uses this endpoint. Contributors have no way to revise a submitted proposal without withdrawing and resubmitting — and they cannot resubmit (409 conflict).

**Consequence:** If a contributor submitted a bid with a typo or wants to sharpen their price, their only option is `withdraw` then the slot is open to others. The revision flow is dead code from the UI perspective.

**Severity:** High — the feature exists but is inaccessible  
**Fix:** Add an "Edit Proposal" button in the contributor's "My Proposals" page. On click, show a modal with bid_amount and message pre-filled, call `PUT /proposals/{id}/revise`.

---

### REAL-FLAW-005 — No "Complete Project" action exists in the PM UI
**Scenario:** Scenario 8 — PM completion workflow  
**Found in:** `internal/handlers/project_handler.go`, `src/pages/projects/`  
**Issue:** The `Project` model has statuses `draft | active | completed | cancelled`, and the backend has `PATCH /projects/{id}` which accepts a status field. However, the PM UI has no "Mark as Completed" button anywhere. Projects can only be moved from draft→active or be cancelled. The `completed` status is unreachable from the UI.

**Additionally:** There is no "project health" dashboard view showing % deliverables approved vs total, blocking the natural completion workflow.

**Severity:** High — PMs cannot formally close out projects  
**Fix:** Add a "Complete Project" button on the project detail page (visible when all deliverables are `approved`). Also add a completion confirmation dialog warning about any non-approved deliverables.

---

### REAL-FLAW-006 — Submission history shows only the latest submission, not all revisions
**Scenario:** Scenario 3 — PM requests revision, Bob resubmits  
**Found in:** `internal/handlers/submission_handler.go:GetByDeliverable` vs `ListHistory`  
**Issue:** Two endpoints exist:
- `GET /deliverables/{id}/submissions` → returns the LATEST submission only (used by the UI)
- `GET /deliverables/{id}/submissions/history` → returns all submissions

The UI calls the first endpoint. After a revision cycle (submit → revision_requested → resubmit), the PM only sees the **latest** submission and loses context about the previous attempt and the revision notes that were given. This breaks the audit trail.

**Severity:** High — PM has no audit trail of revision cycles  
**Fix:** The submission detail panel should call `/submissions/history` and show all submissions in chronological order with reviewer notes for each.

---

### REAL-FLAW-007 — @mention in comments is stored as plain text, no notification generated
**Scenario:** Scenario 4 — Bob mentions @PM in comment  
**Found in:** `internal/handlers/kanban_handler.go:CreateComment`, `internal/models/models.go:TaskComment`  
**Issue:** The `MentionsTextarea` component in the frontend captures `@username` mentions. However:
1. The comment body is stored as plain text with `@Name` embedded — no mention metadata
2. No notification system exists — the mentioned user receives zero signal that they were tagged
3. The mentioned user's ID is never extracted or stored

**Consequence:** The @mention UX is purely cosmetic. Tagging someone in a comment has no functional effect.

**Severity:** High — core collaboration feature is non-functional  
**Fix (phased):**
1. Parse `@Name` in comment body server-side, resolve to user IDs
2. Store mentions in a `dmms_comment_mentions` junction table
3. Create a notifications system (at minimum: in-app notification badge)

---

### REAL-FLAW-008 — Task assignment does NOT notify the assignee
**Scenario:** Scenario 4 — PM assigns task to Bob  
**Found in:** `internal/handlers/kanban_handler.go:Update` (assigns `body.AssignedTo`)  
**Issue:** When a PM assigns (or reassigns) a task to a contributor, the assignee receives no notification. The contributor must manually check the kanban board to discover new assignments. With many tasks across projects, assignments are routinely missed.

**Severity:** High — assignments are silently dropped in contributor's inbox  
**Fix:** Add a notification record when `assigned_to` changes. At minimum, the kanban board should have a "Recently Assigned to Me" badge or filter.

---

### REAL-FLAW-009 — Proposal acceptance assigns ALL descendant deliverables but does NOT create subtasks for them
**Scenario:** Scenario 2 — AcceptProposal locks descendants  
**Found in:** `internal/service/deliverable_service.go:AcceptProposal`  
**Code:**
```go
// Lock all descendant deliverables (set owner to same contributor)
for _, childID := range descendantIDs {
    if err := txDeliv.UpdateStatus(childID, models.DelivAssigned); err != nil {
        return err
    }
}
// Assign all tasks of deliverable and its descendants to the contributor
if err := tx.Table("dmms_tasks").Where("deliverable_id IN ?", allDeliverableIDs).Update("assigned_to", proposal.ContributorID).Error; err != nil {
    return err
}
```
**Issue:** Child deliverables are automatically assigned to the winning contributor, but:
1. The children never went through their own bidding process — a contributor is silently responsible for them
2. There is no way to set different budgets or contributors for children after the parent is accepted
3. The contractor may not have bid with children in mind (their bid was only for the parent)

**Severity:** High — creates hidden workload for contractors without their explicit consent  
**Fix:** Either (a) prevent parent-level bidding when children exist (force bid at leaf level only), or (b) when accepting parent proposal, display a warning "This will also assign N child deliverables" and require confirmation. OR (c) treat child assignment as optional/separate flow.

---

### REAL-FLAW-010 — `budget_total` on Project is computed from deliverables, not from PM's input — but PM sets it at creation
**Scenario:** Scenario 8 — Budget reconciliation  
**Found in:** `internal/service/deliverable_service.go:recomputeProjectBudget`  
**Issue:** When creating a project, PM enters a `budget_total`. But `recomputeProjectBudget` overwrites `budget_total` with the sum of root deliverable budgets every time a deliverable is modified. This means:
1. If PM sets project budget = $100,000 but deliverables only sum to $50,000, the project budget becomes $50,000
2. The PM's original intended budget (for contingency, unscoped work, etc.) is silently discarded
3. There is no way to have "unallocated budget headroom"

**Severity:** Medium — the PM-set budget is overridden silently, which is counterintuitive  
**Fix:** Introduce a separate `budget_ceiling` (PM-set) vs `budget_computed` (sum of deliverables). Show both. Alert if `budget_computed > budget_ceiling`.

---

### REAL-FLAW-011 — File paths stored using naive string concatenation — JSON corruption risk
**Scenario:** File uploads to tasks and comments  
**Found in:** `internal/handlers/kanban_handler.go:UploadTaskFile` and `UploadCommentFile`  
**Code:**
```go
if t.FilePaths == "[]" || t.FilePaths == "" {
    t.FilePaths = "[\"" + filepath + "\"]"
} else {
    t.FilePaths = t.FilePaths[:len(t.FilePaths)-1] + ",\"" + filepath + "\"]"
}
```
**Issue:** This manual string manipulation is dangerously fragile:
1. If `filepath` contains a `"` or `\`, the JSON is corrupted
2. Any concurrent upload to the same task races on the read-then-write pattern (no transaction)
3. If file path somehow contains `]`, the splice breaks

**Severity:** High — data corruption risk under concurrent usage  
**Fix:** Deserialize to `[]string` using `json.Unmarshal`, append, re-serialize with `json.Marshal`. Use a DB transaction or optimistic lock.

---

### REAL-FLAW-012 — No success notification/toast for any action in the PM or Contributor UI
**Scenario:** All scenarios  
**Found in:** `src/pages/` — all action handlers  
**Issue:** Every create, update, approve, and accept action succeeds silently. The only feedback is that the UI state changes (if the optimistic update works). There is no toast notification, snackbar, or success message. Users frequently click buttons multiple times thinking nothing happened.

**Severity:** Medium — poor UX, leads to duplicate submissions  
**Fix:** Add a global toast/notification system. Fire success toasts on: project create, deliverable status change, proposal accept/reject, submission approve, task create, comment post.

---

### REAL-FLAW-013 — Kanban infinite scroll silently swallows load errors
**Scenario:** Large column load  
**Found in:** `src/pages/kanban/KanbanPage.tsx` — `loadMore` callback  
**Code (conceptual):** The `loadMore` function is called without `.catch()` handling at the column level. If the API fails (network error, 500), the spinner disappears and the column simply shows no more items — no error state, no retry button.

**Severity:** Medium — silent data loss appearance  
**Fix:** Add error state to each column. On `loadMore` failure, show "Failed to load more. Retry?" link.

---

### REAL-FLAW-014 — Contributor can submit without any acceptance criteria checked (checklist is optional)
**Scenario:** Scenario 3 — Work submission  
**Found in:** `internal/handlers/submission_handler.go:Submit`  
**Issue:** Deliverables support `acceptance_criteria` (a JSON array of criterion strings). The submission form shows checkboxes for each criterion. However:
1. The `checklist_completion` field in the submission is stored as whatever the client sends — it is never validated server-side
2. A contributor can call the API with `checklist_completion: {}` (empty) and bypass all criteria
3. The PM reviewing a submission has no way to see which criteria were checked vs unchecked

**Severity:** High — acceptance criteria are cosmetic, not enforceable  
**Fix:** Server-side, validate that `checklist_completion` keys cover all `acceptance_criteria` items and all values are `true` before accepting the submission. Alternatively, make this PM-configurable: "require all criteria checked before submission is allowed."

---

## MEDIUM SEVERITY FLAWS

---

### REAL-FLAW-015 — No pagination on Projects list or Admin Users list
**Files:** `internal/handlers/project_handler.go:List`, `internal/handlers/admin_handler.go:ListUsers`  
**Issue:** Both endpoints return all records. At scale (1000+ projects, 10000+ users), this will cause OOM and timeout.  
**Fix:** Add `limit`/`offset` with reasonable defaults (20/50) and return `total` in response envelope.

---

### REAL-FLAW-016 — JWT stored in localStorage — XSS attack can steal all tokens
**Files:** `src/store/authStore.ts`  
**Issue:** `localStorage.setItem('dmms_token', token)` makes the JWT readable by any injected script.  
**Fix:** Store JWT in `httpOnly` cookie. Fall back to memory-only storage if cookies unavailable.

---

### REAL-FLAW-017 — No rate limiting on login endpoint — brute-force attack possible
**File:** `internal/handlers/auth_handler.go:Login`  
**Issue:** No rate limiting, account lockout, or captcha on the login endpoint.  
**Fix:** Add IP-based rate limiting (e.g., 5 attempts per minute per IP using a middleware or Redis counter).

---

### REAL-FLAW-018 — Deliverable `rejected` status has no re-open path in UI
**Found in:** Status transition code  
**Issue:** A rejected deliverable (PM rejected the submission) has no PM action to re-open it to `draft` or `open_for_bids` so a new contributor can bid. The backend has `Reopen` and `Reassign` service methods, but the UI does not surface them for the `rejected` state.  
**Fix:** Add "Reopen for Bids" button on rejected deliverable that calls the reassign endpoint.

---

### REAL-FLAW-019 — Kanban drag-and-drop is not keyboard accessible (WCAG 2.1.1 Level A)
**Found in:** `src/pages/kanban/KanbanPage.tsx` — DnD implementation  
**Issue:** Moving tasks between columns requires mouse drag. No keyboard alternative exists (no Tab + Enter + arrow key flow).  
**Fix:** Add accessible drag handles with `role="button"` and keyboard listeners (Space to pick up, arrows to move column, Space/Enter to drop).

---

### REAL-FLAW-020 — Task `is_required` flag can be set by any creator — no PM-only gate
**Found in:** `internal/handlers/kanban_handler.go:Create`  
**Issue:** When a contributor creates a subtask on their own deliverable, they can set `is_required=false` even if the PM intended it to be required. Conversely, a contributor could set `is_required=true` on their own task as a self-imposed gate, but this was designed for PMs.  
**Fix:** Only allow `is_required` to be set/changed by PMs and admins. Contributors can create tasks but cannot mark them required.

---

## SUMMARY TABLE

| ID | Severity | Area | One-line description |
|----|----------|------|----------------------|
| REAL-FLAW-001 | High | UI/Budget | Parent budget not reactively updated after child create |
| REAL-FLAW-002 | **Critical** | Business Logic | dependency_id stored but never enforced in OpenForBids |
| REAL-FLAW-003 | **Critical** | Business Logic | Required tasks don't block submission |
| REAL-FLAW-004 | High | UI/UX | Proposal revision endpoint has no UI |
| REAL-FLAW-005 | High | UI/UX | No "Complete Project" action in PM UI |
| REAL-FLAW-006 | High | UX/Audit | Revision history not shown — only latest submission visible |
| REAL-FLAW-007 | High | Collaboration | @mentions are decorative — no notification system |
| REAL-FLAW-008 | High | Collaboration | Task assignment creates no notification for assignee |
| REAL-FLAW-009 | High | Business Logic | Parent proposal acceptance silently assigns all children |
| REAL-FLAW-010 | Medium | Budget | PM-set budget overwritten by deliverable sum silently |
| REAL-FLAW-011 | High | Data Integrity | File paths use string concat — JSON corruption risk |
| REAL-FLAW-012 | Medium | UX | No success notifications/toasts anywhere in the app |
| REAL-FLAW-013 | Medium | UX | Kanban load errors swallowed silently |
| REAL-FLAW-014 | High | Business Logic | Acceptance criteria checklist not validated server-side |
| REAL-FLAW-015 | Medium | Performance | No pagination on projects/users lists |
| REAL-FLAW-016 | High | Security | JWT in localStorage — XSS attack surface |
| REAL-FLAW-017 | High | Security | No rate limiting on login — brute-force possible |
| REAL-FLAW-018 | Medium | UX | No UI path to reopen a rejected deliverable |
| REAL-FLAW-019 | Medium | Accessibility | Kanban DnD not keyboard accessible (WCAG A) |
| REAL-FLAW-020 | Low | Business Logic | Any user can set is_required flag (should be PM-only) |

---

## RECOMMENDED PRIORITY ORDER FOR FIXES

### Sprint 1 (Critical — breaks core business flow)
1. REAL-FLAW-003: Required tasks gate on submission
2. REAL-FLAW-002: Dependency enforcement in OpenForBids  
3. REAL-FLAW-011: Fix file path JSON corruption

### Sprint 2 (High — breaks user trust)
4. REAL-FLAW-014: Validate acceptance checklist server-side
5. REAL-FLAW-009: Warn/confirm when parent acceptance assigns children
6. REAL-FLAW-004: Build proposal revision UI
7. REAL-FLAW-006: Show full submission history with revision notes

### Sprint 3 (High — collaboration and notifications)
8. REAL-FLAW-007: Implement mention notification system
9. REAL-FLAW-008: Task assignment notifications
10. REAL-FLAW-005: Add "Complete Project" action

### Sprint 4 (Medium — polish and security hardening)
11. REAL-FLAW-016: Move JWT to httpOnly cookie
12. REAL-FLAW-017: Rate limit login endpoint
13. REAL-FLAW-001: Reactive parent budget updates
14. REAL-FLAW-010: Distinguish PM budget ceiling vs computed budget
15. REAL-FLAW-012: Add toast notification system
16. REAL-FLAW-015: Paginate projects and users lists
17. REAL-FLAW-018: Reopen rejected deliverable UI
18. REAL-FLAW-013: Kanban error states
19. REAL-FLAW-019: Keyboard-accessible DnD
20. REAL-FLAW-020: PM-only is_required flag
