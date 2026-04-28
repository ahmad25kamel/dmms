export type Role = 'pm' | 'contributor' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  created_at: string;
}

export type ProjectStatus = 'draft' | 'active' | 'completed' | 'cancelled';

export interface Project {
  id: string;
  name: string;
  description: string;
  pm_id: string;
  budget_total: number;
  budget_allocated: number;
  budget_saved: number;
  start_date: string | null;
  end_date: string | null;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}

export type DeliverableStatus =
  | 'draft'
  | 'open_for_bids'
  | 'assigned'
  | 'in_progress'
  | 'submitted'
  | 'approved'
  | 'revision_requested'
  | 'cancelled'
  | 'rejected';

export type Visibility = 'public' | 'private';

export interface Deliverable {
  id: string;
  project_id: string;
  parent_id: string | null;
  title: string;
  brief: string;
  scope: string;
  acceptance_criteria: string;
  max_budget: number;
  accepted_budget: number | null;
  start_date?: string;
  due_date: string | null;
  dependency_id: string | null;
  visibility: Visibility;
  status: DeliverableStatus;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
  children?: Deliverable[];
  project_name?: string;
}

export interface Task {
  id: string;
  deliverable_id: string;
  project_id: string;
  created_by: string;
  assigned_to: string | null;
  title: string;
  description: string;
  status: KanbanStatus;
  is_required: boolean;
  due_date: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  // Enriched fields
  project_name?: string;
  deliverable_title?: string;
  assigned_to_name?: string;
  created_by_name?: string;
  comment_count?: number;
}

// Subtask is now part of Task (is_required: false)
export interface Subtask {
  id: string;
  deliverable_id: string;
  contributor_id: string;
  title: string;
  done: boolean;
  position: number;
}

export type ProposalStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn';

export interface Proposal {
  id: string;
  deliverable_id: string;
  contributor_id: string;
  bid_amount: number;
  eta_date: string | null;
  message: string;
  status: ProposalStatus;
  created_at: string;
  contributor_name?: string;
}

export type SubmissionStatus = 'pending' | 'approved' | 'revision_requested' | 'rejected';

export interface Submission {
  id: string;
  deliverable_id: string;
  contributor_id: string;
  notes: string;
  checklist_completion: string;
  file_uploads: string;
  pr_links: string;
  status: SubmissionStatus;
  reviewer_id: string | null;
  review_notes: string;
  submitted_at: string;
  reviewed_at: string | null;
}

export interface RewardLedgerEntry {
  id: string;
  user_id: string;
  deliverable_id: string;
  project_id: string;
  amount: number;
  approved_by: string;
  created_at: string;
  user_name?: string;
  deliverable_title?: string;
  project_name?: string;
}

export type KanbanStatus = 'backlog' | 'todo' | 'in_progress' | 'done';

export type KanbanTask = Task;

export interface TaskComment {
  id: string;
  task_id: string;
  author_id: string;
  author_name?: string;
  body: string;
  created_at: string;
}

export type KanbanComment = TaskComment;

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
