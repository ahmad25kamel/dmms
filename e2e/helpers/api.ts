/**
 * Direct API helpers for test setup/teardown
 * Used to create test data without going through the UI
 */

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3005';

export interface TestUser {
  id: string;
  username: string;
  name: string;
  role: string;
  token: string;
}

export async function apiLogin(username: string, password: string): Promise<TestUser> {
  const res = await fetch(`${BASE_URL}/api/dmms/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  const body = await res.json();
  return { ...body.data.user, token: body.data.token };
}

export async function apiRegister(
  username: string,
  name: string,
  password: string,
  role: string
): Promise<TestUser> {
  const res = await fetch(`${BASE_URL}/api/dmms/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, name, password, role }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Register failed: ${res.status} ${body.error || ''}`);
  }
  return apiLogin(username, password);
}

export async function apiCreateProject(
  token: string,
  data: { name: string; description?: string; budget_total?: number }
) {
  const res = await fetch(`${BASE_URL}/api/dmms/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ budget_total: 0, ...data }),
  });
  if (!res.ok) throw new Error(`Create project failed: ${res.status}`);
  const body = await res.json();
  return body.data;
}

export async function apiCreateDeliverable(
  token: string,
  data: {
    project_id: string;
    title: string;
    brief?: string;
    max_budget?: number;
    parent_id?: string;
    visibility?: string;
  }
) {
  const res = await fetch(`${BASE_URL}/api/dmms/deliverables`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ max_budget: 1000, visibility: 'public', ...data }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Create deliverable failed: ${res.status} ${body.error || ''}`);
  }
  const body = await res.json();
  return body.data;
}

export async function apiOpenForBids(token: string, deliverableId: string) {
  const res = await fetch(`${BASE_URL}/api/dmms/deliverables/${deliverableId}/open-bids`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Open bids failed: ${res.status}`);
  return (await res.json()).data;
}

export async function apiSubmitProposal(
  token: string,
  deliverableId: string,
  data: { bid_amount: number; message?: string }
) {
  const res = await fetch(`${BASE_URL}/api/dmms/deliverables/${deliverableId}/proposals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Submit proposal failed: ${res.status} ${body.error || ''}`);
  }
  return (await res.json()).data;
}

export async function apiAcceptProposal(token: string, proposalId: string) {
  const res = await fetch(`${BASE_URL}/api/dmms/proposals/${proposalId}/accept`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Accept proposal failed: ${res.status}`);
  return (await res.json()).data;
}

export async function apiSubmitWork(
  token: string,
  deliverableId: string,
  data: { notes?: string; pr_links?: string }
) {
  const res = await fetch(`${BASE_URL}/api/dmms/deliverables/${deliverableId}/submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ notes: 'Test submission', ...data }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Submit work failed: ${res.status} ${body.error || ''}`);
  }
  return (await res.json()).data;
}

export async function apiDeleteProject(token: string, projectId: string) {
  const res = await fetch(`${BASE_URL}/api/dmms/projects/${projectId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Delete project failed: ${res.status}`);
}
