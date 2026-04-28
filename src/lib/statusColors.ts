import type { DeliverableStatus, ProjectStatus, ProposalStatus, SubmissionStatus } from '../types';

type BadgeColor = 'gray' | 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'indigo';

export const deliverableStatusColor: Record<DeliverableStatus, BadgeColor> = {
  draft: 'gray',
  open_for_bids: 'blue',
  assigned: 'indigo',
  in_progress: 'purple',
  submitted: 'yellow',
  approved: 'green',
  revision_requested: 'red',
  cancelled: 'red',
  rejected: 'red',
};

export const deliverableStatusLabel: Record<DeliverableStatus, string> = {
  draft: 'Draft',
  open_for_bids: 'Open for Bids',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  submitted: 'Submitted',
  approved: 'Approved',
  revision_requested: 'Revision Requested',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
};

export const projectStatusColor: Record<ProjectStatus, BadgeColor> = {
  draft: 'gray',
  active: 'green',
  completed: 'blue',
  cancelled: 'red',
};

export const proposalStatusColor: Record<ProposalStatus, BadgeColor> = {
  pending: 'yellow',
  accepted: 'green',
  rejected: 'red',
  withdrawn: 'gray',
};

export const submissionStatusColor: Record<SubmissionStatus, BadgeColor> = {
  pending: 'yellow',
  approved: 'green',
  revision_requested: 'red',
  rejected: 'red',
};

export function formatCurrency(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

export function formatDate(date: string | null): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString();
}
