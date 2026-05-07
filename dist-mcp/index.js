#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
const BASE_URL = process.env.DMMS_BASE_URL ?? "http://localhost:8080";
const TOKEN = process.env.DMMS_TOKEN ?? "";
async function api(method, path, body) {
    const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers: {
            "Content-Type": "application/json",
            ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    if (!res.ok)
        throw new Error(`${res.status} ${res.statusText}: ${text}`);
    return text ? JSON.parse(text) : null;
}
const server = new McpServer({
    name: "dmms",
    version: "1.0.0",
});
// ─── AUTH ────────────────────────────────────────────────────────────────────
server.tool("dmms_login", "Login and get a JWT token for subsequent requests", {
    email: z.string().email(),
    password: z.string(),
}, async ({ email, password }) => {
    const data = await api("POST", "/api/dmms/auth/login", { email, password });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});
server.tool("dmms_me", "Get the currently authenticated user profile", {}, async () => {
    const data = await api("GET", "/api/dmms/auth/me");
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});
// ─── PROJECTS ─────────────────────────────────────────────────────────────────
server.tool("dmms_list_projects", "List all projects", {}, async () => {
    const data = await api("GET", "/api/dmms/projects");
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});
server.tool("dmms_get_project", "Get a single project by ID", { id: z.string().uuid() }, async ({ id }) => {
    const data = await api("GET", `/api/dmms/projects/${id}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});
server.tool("dmms_create_project", "Create a new project (PM/Admin only)", {
    name: z.string(),
    description: z.string().optional(),
    budget: z.number().optional(),
    start_date: z.string().optional().describe("YYYY-MM-DD"),
    end_date: z.string().optional().describe("YYYY-MM-DD"),
}, async (body) => {
    const data = await api("POST", "/api/dmms/projects", body);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});
server.tool("dmms_update_project", "Update an existing project (PM/Admin only)", {
    id: z.string().uuid(),
    name: z.string().optional(),
    description: z.string().optional(),
    budget: z.number().optional(),
    start_date: z.string().optional().describe("YYYY-MM-DD"),
    end_date: z.string().optional().describe("YYYY-MM-DD"),
}, async ({ id, ...body }) => {
    const data = await api("PATCH", `/api/dmms/projects/${id}`, body);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});
server.tool("dmms_delete_project", "Delete a project (PM/Admin only)", { id: z.string().uuid() }, async ({ id }) => {
    const data = await api("DELETE", `/api/dmms/projects/${id}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});
// ─── DELIVERABLES ─────────────────────────────────────────────────────────────
server.tool("dmms_deliverable_tree", "Get the full deliverable tree for a project", { project_id: z.string().uuid() }, async ({ project_id }) => {
    const data = await api("GET", `/api/dmms/projects/${project_id}/deliverables/tree`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});
server.tool("dmms_get_deliverable", "Get a single deliverable by ID", { id: z.string().uuid() }, async ({ id }) => {
    const data = await api("GET", `/api/dmms/deliverables/${id}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});
server.tool("dmms_create_deliverable", "Create a new deliverable (PM/Admin only)", {
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
}, async (body) => {
    const data = await api("POST", "/api/dmms/deliverables", body);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});
server.tool("dmms_update_deliverable", "Update an existing deliverable (PM/Admin only)", {
    id: z.string().uuid(),
    title: z.string().optional(),
    brief: z.string().optional(),
    scope: z.string().optional(),
    acceptance_criteria: z.array(z.string()).optional(),
    max_budget: z.number().optional(),
    start_date: z.string().optional().describe("YYYY-MM-DD or empty to clear"),
    due_date: z.string().optional().describe("YYYY-MM-DD or empty to clear"),
    visibility: z.enum(["public", "private"]).optional(),
}, async ({ id, ...body }) => {
    const data = await api("PATCH", `/api/dmms/deliverables/${id}`, body);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});
server.tool("dmms_delete_deliverable", "Delete a deliverable (PM/Admin only)", { id: z.string().uuid() }, async ({ id }) => {
    const data = await api("DELETE", `/api/dmms/deliverables/${id}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});
server.tool("dmms_my_deliverables", "List deliverables assigned to the current user", {}, async () => {
    const data = await api("GET", "/api/dmms/deliverables/assigned");
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});
server.tool("dmms_open_deliverable_for_bids", "Open a deliverable for bidding (PM/Admin only)", { id: z.string().uuid() }, async ({ id }) => {
    const data = await api("POST", `/api/dmms/deliverables/${id}/open-bids`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});
server.tool("dmms_cancel_deliverable", "Cancel a deliverable (PM/Admin only)", { id: z.string().uuid() }, async ({ id }) => {
    const data = await api("POST", `/api/dmms/deliverables/${id}/cancel`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});
server.tool("dmms_reassign_deliverable", "Reassign a deliverable back to open (PM/Admin only)", { id: z.string().uuid() }, async ({ id }) => {
    const data = await api("POST", `/api/dmms/deliverables/${id}/reassign`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});
// ─── TASKS ────────────────────────────────────────────────────────────────────
server.tool("dmms_list_tasks", "List tasks for a deliverable", { deliverable_id: z.string().uuid() }, async ({ deliverable_id }) => {
    const data = await api("GET", `/api/dmms/deliverables/${deliverable_id}/tasks`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});
server.tool("dmms_create_task", "Create a task for a deliverable (PM/Admin only)", {
    deliverable_id: z.string().uuid(),
    title: z.string(),
    is_required: z.boolean().optional(),
    position: z.number().int().optional(),
}, async ({ deliverable_id, ...body }) => {
    const data = await api("POST", `/api/dmms/deliverables/${deliverable_id}/tasks`, body);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});
server.tool("dmms_update_task", "Update a task (PM/Admin only)", {
    deliverable_id: z.string().uuid(),
    task_id: z.string().uuid(),
    title: z.string().optional(),
    is_required: z.boolean().optional(),
    position: z.number().int().optional(),
}, async ({ deliverable_id, task_id, ...body }) => {
    const data = await api("PATCH", `/api/dmms/deliverables/${deliverable_id}/tasks/${task_id}`, body);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});
server.tool("dmms_delete_task", "Delete a task (PM/Admin only)", {
    deliverable_id: z.string().uuid(),
    task_id: z.string().uuid(),
}, async ({ deliverable_id, task_id }) => {
    const data = await api("DELETE", `/api/dmms/deliverables/${deliverable_id}/tasks/${task_id}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});
// ─── KANBAN TASKS ─────────────────────────────────────────────────────────────
server.tool("dmms_list_kanban", "List all kanban tasks (optionally filtered)", {
    project_id: z.string().uuid().optional(),
    status: z
        .enum(["backlog", "todo", "in_progress", "review", "done"])
        .optional(),
    assignee_id: z.string().uuid().optional(),
}, async (params) => {
    const qs = new URLSearchParams();
    if (params.project_id)
        qs.set("project_id", params.project_id);
    if (params.status)
        qs.set("status", params.status);
    if (params.assignee_id)
        qs.set("assignee_id", params.assignee_id);
    const data = await api("GET", `/api/dmms/kanban${qs.toString() ? `?${qs}` : ""}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});
server.tool("dmms_my_kanban", "List kanban tasks assigned to the current user", {}, async () => {
    const data = await api("GET", "/api/dmms/kanban/mine");
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});
server.tool("dmms_create_kanban_task", "Create a new kanban task (project_id and deliverable_id are required by the backend)", {
    title: z.string(),
    description: z.string().optional(),
    project_id: z.string().uuid(),
    deliverable_id: z.string().uuid(),
    assignee_id: z.string().uuid().optional(),
    status: z
        .enum(["backlog", "todo", "in_progress", "review", "done"])
        .optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    due_date: z.string().optional().describe("YYYY-MM-DD"),
    labels: z.array(z.string()).optional(),
}, async (body) => {
    const data = await api("POST", "/api/dmms/kanban", body);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});
server.tool("dmms_update_kanban_task", "Update a kanban task (move status, reassign, etc.)", {
    id: z.string().uuid(),
    title: z.string().optional(),
    description: z.string().optional(),
    assignee_id: z.string().uuid().nullable().optional(),
    status: z
        .enum(["backlog", "todo", "in_progress", "review", "done"])
        .optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    due_date: z.string().optional().describe("YYYY-MM-DD or empty"),
    labels: z.array(z.string()).optional(),
}, async ({ id, ...body }) => {
    const data = await api("PATCH", `/api/dmms/kanban/${id}`, body);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});
server.tool("dmms_delete_kanban_task", "Delete a kanban task", { id: z.string().uuid() }, async ({ id }) => {
    const data = await api("DELETE", `/api/dmms/kanban/${id}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});
server.tool("dmms_kanban_comments", "List comments on a kanban task", { id: z.string().uuid() }, async ({ id }) => {
    const data = await api("GET", `/api/dmms/kanban/${id}/comments`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});
server.tool("dmms_add_kanban_comment", "Add a comment to a kanban task", {
    id: z.string().uuid(),
    body: z.string(),
}, async ({ id, body: comment }) => {
    const data = await api("POST", `/api/dmms/kanban/${id}/comments`, {
        body: comment,
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});
// ─── PROPOSALS ────────────────────────────────────────────────────────────────
server.tool("dmms_list_proposals", "List proposals for a deliverable (PM/Admin only)", { deliverable_id: z.string().uuid() }, async ({ deliverable_id }) => {
    const data = await api("GET", `/api/dmms/deliverables/${deliverable_id}/proposals`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});
server.tool("dmms_my_proposals", "List proposals submitted by the current user", {}, async () => {
    const data = await api("GET", "/api/dmms/proposals/mine");
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});
server.tool("dmms_submit_proposal", "Submit a proposal for a deliverable", {
    deliverable_id: z.string().uuid(),
    bid_amount: z.number(),
    pitch: z.string(),
    estimated_days: z.number().int().optional(),
}, async ({ deliverable_id, ...body }) => {
    const data = await api("POST", `/api/dmms/deliverables/${deliverable_id}/proposals`, body);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});
server.tool("dmms_accept_proposal", "Accept a proposal and assign the deliverable (PM/Admin only)", { proposal_id: z.string().uuid() }, async ({ proposal_id }) => {
    const data = await api("POST", `/api/dmms/proposals/${proposal_id}/accept`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});
server.tool("dmms_reject_proposal", "Reject a proposal (PM/Admin only)", {
    proposal_id: z.string().uuid(),
    reason: z.string().optional(),
}, async ({ proposal_id, reason }) => {
    const data = await api("POST", `/api/dmms/proposals/${proposal_id}/reject`, { reason });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});
// ─── SUBMISSIONS / APPROVALS ──────────────────────────────────────────────────
server.tool("dmms_pending_submissions", "List all submissions pending PM review (PM/Admin only)", {}, async () => {
    const data = await api("GET", "/api/dmms/submissions/pending");
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});
server.tool("dmms_get_submission", "Get the latest submission for a deliverable", { deliverable_id: z.string().uuid() }, async ({ deliverable_id }) => {
    const data = await api("GET", `/api/dmms/deliverables/${deliverable_id}/submission`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});
server.tool("dmms_submission_history", "Get all submission history for a deliverable", { deliverable_id: z.string().uuid() }, async ({ deliverable_id }) => {
    const data = await api("GET", `/api/dmms/deliverables/${deliverable_id}/submissions`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});
server.tool("dmms_submit_work", "Submit work for a deliverable", {
    deliverable_id: z.string().uuid(),
    notes: z.string().optional(),
    links: z.array(z.string().url()).optional(),
}, async ({ deliverable_id, ...body }) => {
    const data = await api("POST", `/api/dmms/deliverables/${deliverable_id}/submissions`, body);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});
server.tool("dmms_approve_submission", "Approve a submission (PM/Admin only)", {
    submission_id: z.string().uuid(),
    feedback: z.string().optional(),
}, async ({ submission_id, feedback }) => {
    const data = await api("POST", `/api/dmms/submissions/${submission_id}/approve`, { feedback });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});
server.tool("dmms_request_revision", "Request revision on a submission (PM/Admin only)", {
    submission_id: z.string().uuid(),
    feedback: z.string(),
}, async ({ submission_id, feedback }) => {
    const data = await api("POST", `/api/dmms/submissions/${submission_id}/request-revision`, { feedback });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});
server.tool("dmms_reject_submission", "Reject a submission (PM/Admin only)", {
    submission_id: z.string().uuid(),
    reason: z.string(),
}, async ({ submission_id, reason }) => {
    const data = await api("POST", `/api/dmms/submissions/${submission_id}/reject`, { reason });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});
// ─── MARKETPLACE ──────────────────────────────────────────────────────────────
server.tool("dmms_marketplace", "Browse open deliverables available for bidding", {}, async () => {
    const data = await api("GET", "/api/dmms/marketplace/bids");
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});
// ─── REWARDS ──────────────────────────────────────────────────────────────────
server.tool("dmms_rewards_ledger", "View the rewards/payment ledger for the current user", {}, async () => {
    const data = await api("GET", "/api/dmms/rewards/ledger");
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});
// ─── ADMIN ────────────────────────────────────────────────────────────────────
server.tool("dmms_list_users", "List all users (Admin only)", {}, async () => {
    const data = await api("GET", "/api/dmms/admin/users");
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});
server.tool("dmms_update_user_role", "Update a user's role (Admin only)", {
    user_id: z.string().uuid(),
    role: z.enum(["admin", "pm", "contractor"]),
}, async ({ user_id, role }) => {
    const data = await api("PATCH", `/api/dmms/admin/users/${user_id}`, {
        role,
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});
// ─── START ────────────────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
