import { api } from './client';
import type {
  User, Project, Deliverable, Task, Subtask,
  Proposal, Submission, RewardLedgerEntry, KanbanTask, KanbanComment,
} from '../types';

// Auth
export const authApi = {
  register: (body: { email: string; name: string; password: string; role: string }) =>
    api.post<User>('/auth/register', body),
  login: (body: { email: string; password: string }) =>
    api.post<{ user: User; token: string }>('/auth/login', body),
  me: () => api.get<User>('/auth/me'),
};

// Projects
export const projectsApi = {
  list: () => api.get<Project[]>('/projects'),
  get: (id: string) => api.get<Project>(`/projects/${id}`),
  create: (body: Partial<Project>) => api.post<Project>('/projects', body),
  update: (id: string, body: Partial<Project>) => api.patch<Project>(`/projects/${id}`, body),
  delete: (id: string) => api.delete<{ deleted: boolean }>(`/projects/${id}`),
};

// Deliverables
export const deliverablesApi = {
  tree: (projectId: string) => api.get<Deliverable[]>(`/projects/${projectId}/deliverables/tree`),
  get: (id: string) => api.get<Deliverable>(`/deliverables/${id}`),
  create: (body: Partial<Deliverable>) => api.post<Deliverable>('/deliverables', body),
  update: (id: string, body: Partial<Deliverable>) => api.patch<Deliverable>(`/deliverables/${id}`, body),
  delete: (id: string) => api.delete<{ deleted: boolean }>(`/deliverables/${id}`),
  openForBids: (id: string) => api.post<Deliverable>(`/deliverables/${id}/open-bids`),
  cancel: (id: string) => api.post<{ cancelled: boolean }>(`/deliverables/${id}/cancel`),
  reopen: (id: string) => api.post<{ reopened: boolean }>(`/deliverables/${id}/reopen`),
  reassign: (id: string) => api.post<{ reassigned: boolean }>(`/deliverables/${id}/reassign`),
  myAssigned: () => api.get<Deliverable[]>('/deliverables/assigned'),
  listTasks: (id: string) => api.get<Task[]>(`/deliverables/${id}/tasks`),
  createTask: (id: string, body: Partial<Task>) => api.post<Task>(`/deliverables/${id}/tasks`, body),
  updateTask: (id: string, taskId: string, body: Partial<Task>) => api.patch<Task>(`/deliverables/${id}/tasks/${taskId}`, body),
  deleteTask: (id: string, taskId: string) => api.delete<{ deleted: boolean }>(`/deliverables/${id}/tasks/${taskId}`),
  listSubtasks: (id: string) => api.get<Task[]>(`/deliverables/${id}/subtasks`),
  createSubtask: (id: string, body: Partial<Task>) => api.post<Task>(`/deliverables/${id}/subtasks`, body),
  updateSubtask: (id: string, subtaskId: string, body: Partial<Task>) =>
    api.patch<Task>(`/deliverables/${id}/subtasks/${subtaskId}`, body),
  getSubmission: (id: string) => api.get<Submission>(`/deliverables/${id}/submission`),
  listHistory: (id: string) => api.get<Submission[]>(`/deliverables/${id}/submissions`),
  submit: (id: string, body: Partial<Submission>) =>
    api.post<Submission>(`/deliverables/${id}/submissions`, body),
};

// Marketplace
export const marketplaceApi = {
  listBids: () => api.get<Deliverable[]>('/marketplace/bids'),
};

// Proposals
export const proposalsApi = {
  list: (deliverableId: string) => api.get<Proposal[]>(`/deliverables/${deliverableId}/proposals`),
  submit: (deliverableId: string, body: Partial<Proposal>) =>
    api.post<Proposal>(`/deliverables/${deliverableId}/proposals`, body),
  mine: () => api.get<Proposal[]>('/proposals/mine'),
  revise: (id: string, body: Partial<Proposal>) => api.patch<{ updated: boolean }>(`/proposals/${id}`, body),
  withdraw: (id: string) => api.post<{ withdrawn: boolean }>(`/proposals/${id}/withdraw`),
  accept: (id: string) => api.post<{ accepted: boolean }>(`/proposals/${id}/accept`),
  reject: (id: string) => api.post<{ rejected: boolean }>(`/proposals/${id}/reject`),
};

// Submissions (review)
export const submissionsApi = {
  pending: () => api.get<Submission[]>('/submissions/pending'),
  approve: (id: string) => api.post<{ approved: boolean }>(`/submissions/${id}/approve`),
  requestRevision: (id: string, notes: string) =>
    api.post<{ revision_requested: boolean }>(`/submissions/${id}/request-revision`, { notes }),
  reject: (id: string, notes: string) =>
    api.post<{ rejected: boolean }>(`/submissions/${id}/reject`, { notes }),
};

// Rewards
export const rewardsApi = {
  ledger: (userId?: string) =>
    api.get<{ entries: RewardLedgerEntry[]; total: number }>(
      `/rewards/ledger${userId ? `?user_id=${userId}` : ''}`
    ),
};

// Kanban
export const kanbanApi = {
  list: (params?: { project_id?: string; deliverable_id?: string; assigned_to?: string }) => {
    const q = new URLSearchParams();
    if (params?.project_id) q.set('project_id', params.project_id);
    if (params?.deliverable_id) q.set('deliverable_id', params.deliverable_id);
    if (params?.assigned_to) q.set('assigned_to', params.assigned_to);
    const qs = q.toString();
    return api.get<KanbanTask[]>(`/kanban${qs ? '?' + qs : ''}`);
  },
  mine: () => api.get<KanbanTask[]>('/kanban/mine'),
  create: (body: Partial<KanbanTask> & { due_date?: string }) => api.post<KanbanTask>('/kanban', body),
  update: (id: string, body: Partial<KanbanTask> & { due_date?: string }) => api.patch<KanbanTask>(`/kanban/${id}`, body),
  delete: (id: string) => api.delete<{ deleted: boolean }>(`/kanban/${id}`),
  listComments: (id: string) => api.get<KanbanComment[]>(`/kanban/${id}/comments`),
  addComment: (id: string, body: string) => api.post<KanbanComment>(`/kanban/${id}/comments`, { body }),
};

// Admin
export const adminApi = {
  listUsers: () => api.get<User[]>('/admin/users'),
  updateRole: (id: string, role: string) => api.patch<{ updated: boolean }>(`/admin/users/${id}`, { role }),
  deleteUser: (id: string) => api.delete<{ deleted: boolean }>(`/admin/users/${id}`),
};
