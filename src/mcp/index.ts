#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE_URL = process.env.DMMS_BASE_URL ?? "http://localhost:8080";
const TOKEN = process.env.DMMS_TOKEN ?? "";

async function api(
  method: string,
  path: string,
  body?: unknown
): Promise<unknown> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${text}`);
  return text ? JSON.parse(text) : null;
}

// Strip null/undefined/""/"{}"/"[]" values and shorten ISO timestamps to YYYY-MM-DD.
// Keeps false/0/[] as-is. Removes verbose internal GORM-only fields.
const SKIP_KEYS = new Set(["deleted_at", "updated_at"]);

function compact(val: unknown): unknown {
  if (val === null || val === undefined) return undefined;
  if (typeof val === "string") {
    if (val === "" || val === "[]" || val === "{}") return undefined;
    // Shorten ISO timestamps to YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}T/.test(val)) return val.substring(0, 10);
    return val;
  }
  if (Array.isArray(val)) {
    return val.map(compact).filter((v) => v !== undefined);
  }
  if (typeof val === "object") {
    // Handle GORM NullTime {"Time":"...","Valid":bool}
    const obj = val as Record<string, unknown>;
    if ("Valid" in obj && "Time" in obj) {
      return obj.Valid === true ? compact(obj.Time) : undefined;
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (SKIP_KEYS.has(k)) continue;
      const cv = compact(v);
      if (cv !== undefined) out[k] = cv;
    }
    return Object.keys(out).length === 0 ? undefined : out;
  }
  return val;
}

// For kanban tasks: add effective_due_date = task.due_date ?? deliverable_due_date
// This gives AI agents a single reliable field for scheduling/overdue checks.
function withEffectiveDue(data: unknown): unknown {
  if (!data || typeof data !== "object") return data;
  if (Array.isArray(data)) return data.map(withEffectiveDue);

  const obj = data as Record<string, unknown>;

  const applyToItem = (item: unknown): unknown => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return item;
    const t = item as Record<string, unknown>;
    const effective = t.due_date ?? t.deliverable_due_date;
    if (effective !== undefined && effective !== null && t.effective_due_date === undefined) {
      return { ...t, effective_due_date: effective };
    }
    return t;
  };

  if (Array.isArray(obj.items)) {
    return { ...obj, items: (obj.items as unknown[]).map(applyToItem) };
  }
  if (Array.isArray(obj.data)) {
    return { ...obj, data: (obj.data as unknown[]).map(applyToItem) };
  }
  return applyToItem(obj);
}

function fmt(data: unknown): { content: Array<{ type: "text"; text: string }> } {
  const cleaned = compact(data);
  return { content: [{ type: "text", text: JSON.stringify(cleaned) }] };
}

function fmtKanban(data: unknown): { content: Array<{ type: "text"; text: string }> } {
  return fmt(withEffectiveDue(data));
}

const server = new McpServer({
  name: "dmms",
  version: "1.0.0",
});

// ─── AUTH ────────────────────────────────────────────────────────────────────

server.tool(
  "dmms_login",
  "Login and get a JWT token for subsequent requests",
  {
    email: z.string().email(),
    password: z.string(),
  },
  async ({ email, password }) => {
    const data = await api("POST", "/api/dmms/auth/login", { email, password });
    return fmt(data);
  }
);

server.tool(
  "dmms_me",
  "Get the currently authenticated user profile",
  {},
  async () => {
    const data = await api("GET", "/api/dmms/auth/me");
    return fmt(data);
  }
);

// ─── PROJECTS ─────────────────────────────────────────────────────────────────

server.tool(
  "dmms_list_projects",
  "List projects. Filterable by status. Returns {items, total, limit, offset}.",
  {
    status: z
      .enum(["draft", "active", "completed", "cancelled"])
      .optional()
      .describe("Filter by project status"),
    limit: z.number().int().min(1).max(100).optional().describe("Page size (default 20)"),
    offset: z.number().int().min(0).optional().describe("Page offset"),
  },
  async (params) => {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.limit != null) qs.set("limit", String(params.limit));
    if (params.offset != null) qs.set("offset", String(params.offset));
    const data = await api("GET", `/api/dmms/projects${qs.toString() ? `?${qs}` : ""}`);
    return fmt(data);
  }
);

server.tool(
  "dmms_get_project",
  "Get a single project by ID",
  { id: z.string().uuid() },
  async ({ id }) => {
    const data = await api("GET", `/api/dmms/projects/${id}`);
    return fmt(data);
  }
);

server.tool(
  "dmms_create_project",
  "Create a new project (PM/Admin only)",
  {
    name: z.string(),
    description: z.string().optional(),
    budget: z.number().optional(),
    start_date: z.string().optional().describe("YYYY-MM-DD"),
    end_date: z.string().optional().describe("YYYY-MM-DD"),
  },
  async (body) => {
    const data = await api("POST", "/api/dmms/projects", body);
    return fmt(data);
  }
);

server.tool(
  "dmms_update_project",
  "Update an existing project (PM/Admin only)",
  {
    id: z.string().uuid(),
    name: z.string().optional(),
    description: z.string().optional(),
    budget: z.number().optional(),
    start_date: z.string().optional().describe("YYYY-MM-DD"),
    end_date: z.string().optional().describe("YYYY-MM-DD"),
  },
  async ({ id, ...body }) => {
    const data = await api("PATCH", `/api/dmms/projects/${id}`, body);
    return fmt(data);
  }
);

server.tool(
  "dmms_delete_project",
  "Delete a project (PM/Admin only)",
  { id: z.string().uuid() },
  async ({ id }) => {
    const data = await api("DELETE", `/api/dmms/projects/${id}`);
    return fmt(data);
  }
);

// ─── DELIVERABLES ─────────────────────────────────────────────────────────────

server.tool(
  "dmms_deliverable_tree",
  "Get the full deliverable tree for a project (recursive parent/child structure)",
  { project_id: z.string().uuid() },
  async ({ project_id }) => {
    const data = await api(
      "GET",
      `/api/dmms/projects/${project_id}/deliverables/tree`
    );
    return fmt(data);
  }
);

server.tool(
  "dmms_get_deliverable",
  "Get a single deliverable by ID",
  { id: z.string().uuid() },
  async ({ id }) => {
    const data = await api("GET", `/api/dmms/deliverables/${id}`);
    return fmt(data);
  }
);

server.tool(
  "dmms_create_deliverable",
  "Create a new deliverable (PM/Admin only)",
  {
    project_id: z.string().uuid(),
    parent_id: z.string().uuid().optional(),
    title: z.string(),
    brief: z.string().optional(),
    scope: z.string().optional(),
    acceptance_criteria: z.array(z.string()).optional(),
    max_budget: z.number().optional(),
    start_date: z.string().optional().describe("YYYY-MM-DD"),
    due_date: z.string().optional().describe("YYYY-MM-DD"),
    visibility: z.enum(["public", "private"]).optional(),
  },
  async (body) => {
    const data = await api("POST", "/api/dmms/deliverables", body);
    return fmt(data);
  }
);

server.tool(
  "dmms_update_deliverable",
  "Update an existing deliverable (PM/Admin only)",
  {
    id: z.string().uuid(),
    title: z.string().optional(),
    brief: z.string().optional(),
    scope: z.string().optional(),
    acceptance_criteria: z.array(z.string()).optional(),
    max_budget: z.number().optional(),
    start_date: z.string().optional().describe("YYYY-MM-DD or empty to clear"),
    due_date: z.string().optional().describe("YYYY-MM-DD or empty to clear"),
    visibility: z.enum(["public", "private"]).optional(),
  },
  async ({ id, ...body }) => {
    const data = await api("PATCH", `/api/dmms/deliverables/${id}`, body);
    return fmt(data);
  }
);

server.tool(
  "dmms_delete_deliverable",
  "Delete a deliverable (PM/Admin only)",
  { id: z.string().uuid() },
  async ({ id }) => {
    const data = await api("DELETE", `/api/dmms/deliverables/${id}`);
    return fmt(data);
  }
);

server.tool(
  "dmms_my_deliverables",
  "List deliverables assigned to the current user (contributor), ordered by due_date ascending",
  {},
  async () => {
    const data = await api("GET", "/api/dmms/deliverables/assigned");
    return fmt(data);
  }
);

server.tool(
  "dmms_open_deliverable_for_bids",
  "Open a deliverable for bidding (PM/Admin only)",
  { id: z.string().uuid() },
  async ({ id }) => {
    const data = await api("POST", `/api/dmms/deliverables/${id}/open-bids`);
    return fmt(data);
  }
);

server.tool(
  "dmms_cancel_deliverable",
  "Cancel a deliverable (PM/Admin only)",
  { id: z.string().uuid() },
  async ({ id }) => {
    const data = await api("POST", `/api/dmms/deliverables/${id}/cancel`);
    return fmt(data);
  }
);

server.tool(
  "dmms_reassign_deliverable",
  "Reassign a deliverable back to open (PM/Admin only)",
  { id: z.string().uuid() },
  async ({ id }) => {
    const data = await api("POST", `/api/dmms/deliverables/${id}/reassign`);
    return fmt(data);
  }
);

// ─── TASKS (checklist) ────────────────────────────────────────────────────────

server.tool(
  "dmms_list_tasks",
  "List checklist tasks for a deliverable",
  { deliverable_id: z.string().uuid() },
  async ({ deliverable_id }) => {
    const data = await api(
      "GET",
      `/api/dmms/deliverables/${deliverable_id}/tasks`
    );
    return fmt(data);
  }
);

server.tool(
  "dmms_create_task",
  "Create a checklist task for a deliverable (PM/Admin only)",
  {
    deliverable_id: z.string().uuid(),
    title: z.string(),
    is_required: z.boolean().optional(),
    position: z.number().int().optional(),
  },
  async ({ deliverable_id, ...body }) => {
    const data = await api(
      "POST",
      `/api/dmms/deliverables/${deliverable_id}/tasks`,
      body
    );
    return fmt(data);
  }
);

server.tool(
  "dmms_update_task",
  "Update a checklist task (PM/Admin only)",
  {
    deliverable_id: z.string().uuid(),
    task_id: z.string().uuid(),
    title: z.string().optional(),
    is_required: z.boolean().optional(),
    position: z.number().int().optional(),
  },
  async ({ deliverable_id, task_id, ...body }) => {
    const data = await api(
      "PATCH",
      `/api/dmms/deliverables/${deliverable_id}/tasks/${task_id}`,
      body
    );
    return fmt(data);
  }
);

server.tool(
  "dmms_delete_task",
  "Delete a checklist task (PM/Admin only)",
  {
    deliverable_id: z.string().uuid(),
    task_id: z.string().uuid(),
  },
  async ({ deliverable_id, task_id }) => {
    const data = await api(
      "DELETE",
      `/api/dmms/deliverables/${deliverable_id}/tasks/${task_id}`
    );
    return fmt(data);
  }
);

// ─── KANBAN TASKS ─────────────────────────────────────────────────────────────
// Each kanban task includes three date fields:
//   due_date             — task-level due date (null if not set)
//   deliverable_due_date — parent deliverable's due date (use as fallback reference)
//   effective_due_date   — computed by this MCP: due_date ?? deliverable_due_date
// Tasks are sorted: earliest effective_due_date first, then by position.

server.tool(
  "dmms_list_kanban",
  "List all kanban tasks with optional filters. Returns {items, total}. Each task includes effective_due_date (task due_date or deliverable_due_date fallback).",
  {
    project_id: z.string().uuid().optional(),
    deliverable_id: z.string().uuid().optional(),
    status: z.enum(["backlog", "todo", "in_progress", "review", "done"]).optional(),
    assignee_id: z.string().uuid().optional().describe("Filter by assigned user ID"),
    hide_archived: z.boolean().optional().describe("Exclude archived tasks"),
    from_date: z.string().optional().describe("YYYY-MM-DD lower bound on effective_due_date"),
    to_date: z.string().optional().describe("YYYY-MM-DD upper bound on effective_due_date"),
    limit: z.number().int().min(1).max(200).optional(),
    offset: z.number().int().min(0).optional(),
  },
  async (params) => {
    const qs = new URLSearchParams();
    if (params.project_id) qs.set("project_id", params.project_id);
    if (params.deliverable_id) qs.set("deliverable_id", params.deliverable_id);
    if (params.status) qs.set("status", params.status);
    if (params.assignee_id) qs.set("assigned_to", params.assignee_id);
    if (params.hide_archived) qs.set("hide_archived", "true");
    if (params.from_date) qs.set("from_date", params.from_date);
    if (params.to_date) qs.set("to_date", params.to_date);
    if (params.limit != null) qs.set("limit", String(params.limit));
    if (params.offset != null) qs.set("offset", String(params.offset));
    const data = await api(
      "GET",
      `/api/dmms/kanban${qs.toString() ? `?${qs}` : ""}`
    );
    return fmtKanban(data);
  }
);

server.tool(
  "dmms_my_kanban",
  "List kanban tasks for the current user (assigned, member, or deliverable owner). Returns {items, total}. Each task includes effective_due_date.",
  {
    project_id: z.string().uuid().optional(),
    deliverable_id: z.string().uuid().optional(),
    status: z.enum(["backlog", "todo", "in_progress", "review", "done"]).optional(),
    hide_archived: z.boolean().optional().describe("Exclude archived tasks"),
    from_date: z.string().optional().describe("YYYY-MM-DD lower bound on effective_due_date"),
    to_date: z.string().optional().describe("YYYY-MM-DD upper bound on effective_due_date"),
    limit: z.number().int().min(1).max(200).optional(),
    offset: z.number().int().min(0).optional(),
  },
  async (params) => {
    const qs = new URLSearchParams();
    if (params.project_id) qs.set("project_id", params.project_id);
    if (params.deliverable_id) qs.set("deliverable_id", params.deliverable_id);
    if (params.status) qs.set("status", params.status);
    if (params.hide_archived) qs.set("hide_archived", "true");
    if (params.from_date) qs.set("from_date", params.from_date);
    if (params.to_date) qs.set("to_date", params.to_date);
    if (params.limit != null) qs.set("limit", String(params.limit));
    if (params.offset != null) qs.set("offset", String(params.offset));
    const data = await api(
      "GET",
      `/api/dmms/kanban/mine${qs.toString() ? `?${qs}` : ""}`
    );
    return fmtKanban(data);
  }
);

server.tool(
  "dmms_create_kanban_task",
  "Create a new kanban task. project_id and deliverable_id are required.",
  {
    title: z.string(),
    description: z.string().optional(),
    project_id: z.string().uuid(),
    deliverable_id: z.string().uuid(),
    assignee_id: z.string().uuid().optional().describe("User ID to assign"),
    status: z.enum(["backlog", "todo", "in_progress", "review", "done"]).optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    due_date: z.string().optional().describe("YYYY-MM-DD"),
    labels: z.array(z.string()).optional(),
  },
  async ({ assignee_id, ...rest }) => {
    const data = await api("POST", "/api/dmms/kanban", {
      ...rest,
      ...(assignee_id != null ? { assigned_to: assignee_id } : {}),
    });
    return fmtKanban(data);
  }
);

server.tool(
  "dmms_update_kanban_task",
  "Update a kanban task (move status, reassign, set due date, etc.)",
  {
    id: z.string().uuid(),
    title: z.string().optional(),
    description: z.string().optional(),
    assignee_id: z.string().uuid().nullable().optional().describe("User ID or null to unassign"),
    status: z.enum(["backlog", "todo", "in_progress", "review", "done"]).optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    due_date: z.string().optional().describe("YYYY-MM-DD or empty string to clear"),
    labels: z.array(z.string()).optional(),
  },
  async ({ id, assignee_id, ...rest }) => {
    const data = await api("PATCH", `/api/dmms/kanban/${id}`, {
      ...rest,
      ...(assignee_id !== undefined ? { assigned_to: assignee_id } : {}),
    });
    return fmtKanban(data);
  }
);

server.tool(
  "dmms_delete_kanban_task",
  "Delete a kanban task",
  { id: z.string().uuid() },
  async ({ id }) => {
    const data = await api("DELETE", `/api/dmms/kanban/${id}`);
    return fmt(data);
  }
);

server.tool(
  "dmms_kanban_comments",
  "List comments on a kanban task",
  { id: z.string().uuid() },
  async ({ id }) => {
    const data = await api("GET", `/api/dmms/kanban/${id}/comments`);
    return fmt(data);
  }
);

server.tool(
  "dmms_add_kanban_comment",
  "Add a comment to a kanban task",
  {
    id: z.string().uuid(),
    body: z.string(),
  },
  async ({ id, body: comment }) => {
    const data = await api("POST", `/api/dmms/kanban/${id}/comments`, {
      body: comment,
    });
    return fmt(data);
  }
);

// ─── PROPOSALS ────────────────────────────────────────────────────────────────

server.tool(
  "dmms_list_proposals",
  "List proposals for a deliverable (PM/Admin only)",
  { deliverable_id: z.string().uuid() },
  async ({ deliverable_id }) => {
    const data = await api(
      "GET",
      `/api/dmms/deliverables/${deliverable_id}/proposals`
    );
    return fmt(data);
  }
);

server.tool(
  "dmms_my_proposals",
  "List proposals submitted by the current user",
  {},
  async () => {
    const data = await api("GET", "/api/dmms/proposals/mine");
    return fmt(data);
  }
);

server.tool(
  "dmms_submit_proposal",
  "Submit a proposal for a deliverable",
  {
    deliverable_id: z.string().uuid(),
    bid_amount: z.number(),
    pitch: z.string(),
    estimated_days: z.number().int().optional(),
  },
  async ({ deliverable_id, ...body }) => {
    const data = await api(
      "POST",
      `/api/dmms/deliverables/${deliverable_id}/proposals`,
      body
    );
    return fmt(data);
  }
);

server.tool(
  "dmms_accept_proposal",
  "Accept a proposal and assign the deliverable (PM/Admin only)",
  { proposal_id: z.string().uuid() },
  async ({ proposal_id }) => {
    const data = await api(
      "POST",
      `/api/dmms/proposals/${proposal_id}/accept`
    );
    return fmt(data);
  }
);

server.tool(
  "dmms_reject_proposal",
  "Reject a proposal (PM/Admin only)",
  {
    proposal_id: z.string().uuid(),
    reason: z.string().optional(),
  },
  async ({ proposal_id, reason }) => {
    const data = await api(
      "POST",
      `/api/dmms/proposals/${proposal_id}/reject`,
      { reason }
    );
    return fmt(data);
  }
);

// ─── SUBMISSIONS / APPROVALS ──────────────────────────────────────────────────

server.tool(
  "dmms_pending_submissions",
  "List all submissions pending PM review (PM/Admin only)",
  {},
  async () => {
    const data = await api("GET", "/api/dmms/submissions/pending");
    return fmt(data);
  }
);

server.tool(
  "dmms_get_submission",
  "Get the latest submission for a deliverable",
  { deliverable_id: z.string().uuid() },
  async ({ deliverable_id }) => {
    const data = await api(
      "GET",
      `/api/dmms/deliverables/${deliverable_id}/submission`
    );
    return fmt(data);
  }
);

server.tool(
  "dmms_submission_history",
  "Get all submission history for a deliverable",
  { deliverable_id: z.string().uuid() },
  async ({ deliverable_id }) => {
    const data = await api(
      "GET",
      `/api/dmms/deliverables/${deliverable_id}/submissions`
    );
    return fmt(data);
  }
);

server.tool(
  "dmms_submit_work",
  "Submit work for a deliverable",
  {
    deliverable_id: z.string().uuid(),
    notes: z.string().optional(),
    links: z.array(z.string().url()).optional(),
  },
  async ({ deliverable_id, ...body }) => {
    const data = await api(
      "POST",
      `/api/dmms/deliverables/${deliverable_id}/submissions`,
      body
    );
    return fmt(data);
  }
);

server.tool(
  "dmms_approve_submission",
  "Approve a submission (PM/Admin only)",
  {
    submission_id: z.string().uuid(),
    feedback: z.string().optional(),
  },
  async ({ submission_id, feedback }) => {
    const data = await api(
      "POST",
      `/api/dmms/submissions/${submission_id}/approve`,
      { feedback }
    );
    return fmt(data);
  }
);

server.tool(
  "dmms_request_revision",
  "Request revision on a submission (PM/Admin only)",
  {
    submission_id: z.string().uuid(),
    feedback: z.string(),
  },
  async ({ submission_id, feedback }) => {
    const data = await api(
      "POST",
      `/api/dmms/submissions/${submission_id}/request-revision`,
      { feedback }
    );
    return fmt(data);
  }
);

server.tool(
  "dmms_reject_submission",
  "Reject a submission (PM/Admin only)",
  {
    submission_id: z.string().uuid(),
    reason: z.string(),
  },
  async ({ submission_id, reason }) => {
    const data = await api(
      "POST",
      `/api/dmms/submissions/${submission_id}/reject`,
      { reason }
    );
    return fmt(data);
  }
);

// ─── MARKETPLACE ──────────────────────────────────────────────────────────────

server.tool(
  "dmms_marketplace",
  "Browse open deliverables available for bidding. visibility=all includes private ones (PM/Admin only).",
  {
    visibility: z
      .enum(["public", "all"])
      .optional()
      .describe("'public' (default) shows public-only; 'all' also shows private"),
  },
  async ({ visibility }) => {
    const qs = visibility === "all" ? "?visibility=all" : "";
    const data = await api("GET", `/api/dmms/marketplace/bids${qs}`);
    return fmt(data);
  }
);

// ─── REWARDS ──────────────────────────────────────────────────────────────────

server.tool(
  "dmms_rewards_ledger",
  "View the rewards/payment ledger for the current user",
  {},
  async () => {
    const data = await api("GET", "/api/dmms/rewards/ledger");
    return fmt(data);
  }
);

// ─── ADMIN ────────────────────────────────────────────────────────────────────

server.tool(
  "dmms_list_users",
  "List all users (Admin only)",
  {
    limit: z.number().int().min(1).max(200).optional(),
    offset: z.number().int().min(0).optional(),
  },
  async (params) => {
    const qs = new URLSearchParams();
    if (params.limit != null) qs.set("limit", String(params.limit));
    if (params.offset != null) qs.set("offset", String(params.offset));
    const data = await api(
      "GET",
      `/api/dmms/admin/users${qs.toString() ? `?${qs}` : ""}`
    );
    return fmt(data);
  }
);

server.tool(
  "dmms_update_user_role",
  "Update a user's role (Admin only)",
  {
    user_id: z.string().uuid(),
    role: z.enum(["admin", "pm", "contractor"]),
  },
  async ({ user_id, role }) => {
    const data = await api("PATCH", `/api/dmms/admin/users/${user_id}`, {
      role,
    });
    return fmt(data);
  }
);

// ─── START ────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
