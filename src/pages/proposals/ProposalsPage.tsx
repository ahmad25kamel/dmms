import { useEffect, useState, useMemo } from 'react';
import { proposalsApi } from '../../api';
import type { Proposal, ProposalStatus } from '../../types';
import { Badge, Button, Spinner, EmptyState, Modal, FormField, Input, Textarea } from '../../components/ui';
import { formatCurrency, formatDate, proposalStatusColor } from '../../lib/statusColors';

const STATUS_FILTERS: { label: string; value: ProposalStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Accepted', value: 'accepted' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Withdrawn', value: 'withdrawn' },
];

const STATUS_LABEL: Record<ProposalStatus, string> = {
  pending: 'Awaiting Review',
  accepted: 'Accepted',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

export function ProposalsPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ProposalStatus | 'all'>('all');
  const [editProposal, setEditProposal] = useState<Proposal | null>(null);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  useEffect(() => {
    proposalsApi.mine().then(setProposals).finally(() => setLoading(false));
  }, []);

  async function withdraw(id: string) {
    setWithdrawingId(id);
    try {
      await proposalsApi.withdraw(id);
      setProposals(ps => ps.map(p => p.id === id ? { ...p, status: 'withdrawn' } : p));
    } finally {
      setWithdrawingId(null);
    }
  }

  async function saveRevision(id: string, bid_amount: number, message: string) {
    await proposalsApi.revise(id, { bid_amount, message });
    setProposals(ps => ps.map(p => p.id === id ? { ...p, bid_amount, message } : p));
    setEditProposal(null);
  }

  const filtered = useMemo(
    () => filter === 'all' ? proposals : proposals.filter(p => p.status === filter),
    [proposals, filter]
  );

  const pendingCount = proposals.filter(p => p.status === 'pending').length;
  const acceptedCount = proposals.filter(p => p.status === 'accepted').length;

  if (loading) return <Spinner />;

  return (
    <div className="dmms-page">
      <div className="dmms-page-head">
        <div>
          <h1>My Proposals</h1>
          <p className="dmms-page-sub">
            {proposals.length} total · {pendingCount} pending · {acceptedCount} accepted
          </p>
        </div>
      </div>

      {proposals.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          {([
            { label: 'Total', value: proposals.length, color: 'var(--fg-1)' },
            { label: 'Pending', value: pendingCount, color: 'var(--amber)' },
            { label: 'Accepted', value: acceptedCount, color: 'var(--emerald)' },
            { label: 'Rejected', value: proposals.filter(p => p.status === 'rejected').length, color: 'var(--rose)' },
          ] as const).map(stat => (
            <div key={stat.label} style={{ background: 'var(--bg-1)', border: '1px solid var(--border-1)', borderRadius: 'var(--radius-md)', padding: '14px 16px' }}>
              <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', marginBottom: 4 }}>{stat.label}</p>
              <p style={{ fontSize: 22, fontWeight: 700, color: stat.color }}>{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {STATUS_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            style={{
              padding: '5px 14px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-1)',
              background: filter === f.value ? 'var(--kamel-blue)' : 'transparent',
              color: filter === f.value ? '#fff' : 'var(--fg-2)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: filter === f.value ? 600 : 400,
              transition: 'all 0.15s',
            }}
          >
            {f.label}
            {f.value === 'pending' && pendingCount > 0 && (
              <span style={{ marginLeft: 6, background: 'var(--amber)', color: '#000', borderRadius: 99, padding: '1px 6px', fontSize: 11, fontWeight: 700 }}>
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No proposals" description={filter === 'all' ? 'Browse the marketplace and submit bids to get started.' : `No ${filter} proposals.`} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(p => (
            <ProposalCard
              key={p.id}
              proposal={p}
              withdrawingId={withdrawingId}
              onEdit={() => setEditProposal(p)}
              onWithdraw={() => withdraw(p.id)}
            />
          ))}
        </div>
      )}

      {editProposal && (
        <ReviseModal
          proposal={editProposal}
          onClose={() => setEditProposal(null)}
          onSave={saveRevision}
        />
      )}
    </div>
  );
}

function ProposalCard({ proposal: p, withdrawingId, onEdit, onWithdraw }: {
  proposal: Proposal;
  withdrawingId: string | null;
  onEdit: () => void;
  onWithdraw: () => void;
}) {
  const isPending = p.status === 'pending';
  const isAccepted = p.status === 'accepted';

  return (
    <div style={{
      background: 'var(--bg-1)',
      border: `1px solid ${isAccepted ? 'var(--emerald)' : 'var(--border-1)'}`,
      borderRadius: 'var(--radius-md)',
      padding: '16px 20px',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 16,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {(p.deliverable_title || p.project_name) && (
          <div style={{ marginBottom: 6 }}>
            {p.project_name && (
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-4)' }}>
                {p.project_name}
              </span>
            )}
            {p.deliverable_title && (
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)', marginTop: 1 }}>{p.deliverable_title}</p>
            )}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--fg-0)' }}>{formatCurrency(p.bid_amount)}</span>
          <Badge color={proposalStatusColor[p.status]}>{STATUS_LABEL[p.status]}</Badge>
          {p.eta_date && (
            <span style={{ fontSize: 12, color: 'var(--fg-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              ETA {formatDate(p.eta_date)}
            </span>
          )}
        </div>
        {p.message && (
          <p style={{ fontSize: 13, color: 'var(--fg-2)', lineHeight: 1.5, marginBottom: 8, padding: '8px 12px', background: 'var(--bg-2)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--border-2)' }}>
            "{p.message}"
          </p>
        )}
        <p style={{ fontSize: 12, color: 'var(--fg-4)' }}>Submitted {formatDate(p.created_at)}</p>
      </div>

      {isPending && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
          <Button size="sm" onClick={onEdit}>Edit Bid</Button>
          <Button size="sm" variant="danger" onClick={onWithdraw} disabled={withdrawingId === p.id}>
            {withdrawingId === p.id ? 'Withdrawing…' : 'Withdraw'}
          </Button>
        </div>
      )}
    </div>
  );
}

function ReviseModal({ proposal, onClose, onSave }: {
  proposal: Proposal;
  onClose: () => void;
  onSave: (id: string, bid_amount: number, message: string) => Promise<void>;
}) {
  const [bidAmount, setBidAmount] = useState(String(proposal.bid_amount));
  const [message, setMessage] = useState(proposal.message || '');
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(proposal.id, parseFloat(bidAmount) || 0, message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Revise Proposal" onClose={onClose} footer={
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
        <Button type="submit" form="revise-proposal-form" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</Button>
      </div>
    }>
      <form id="revise-proposal-form" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ background: 'var(--bg-2)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', fontSize: 13, color: 'var(--fg-3)' }}>
          Revising bid for: <strong style={{ color: 'var(--fg-1)' }}>{proposal.deliverable_title || 'Deliverable'}</strong>
        </div>
        <FormField label="Bid Amount (Rp)">
          <Input type="number" value={bidAmount} onChange={e => setBidAmount(e.target.value)} min="0.01" step="0.01" required />
        </FormField>
        <FormField label="Message to PM">
          <Textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} placeholder="Why are you the right fit for this deliverable?" />
        </FormField>
      </form>
    </Modal>
  );
}
