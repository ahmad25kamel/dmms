import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { proposalsApi } from '../../api';
import type { Proposal, ProposalStatus } from '../../types';
import { Badge, Spinner, EmptyState, Button, useToast } from '../../components/ui';
import { formatCurrency, formatDate, proposalStatusColor } from '../../lib/statusColors';

const STATUS_FILTERS: { label: string; value: ProposalStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Accepted', value: 'accepted' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Withdrawn', value: 'withdrawn' },
];

export function AllProposalsPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ProposalStatus | 'all'>('all');
  const { toast } = useToast();

  useEffect(() => {
    proposalsApi.allForPM().then(setProposals).finally(() => setLoading(false));
  }, []);

  async function handleAccept(id: string) {
    try {
      await proposalsApi.accept(id);
      setProposals(ps => ps.map(p => p.id === id ? { ...p, status: 'accepted' } : p));
      toast('Proposal accepted', 'success');
    } catch {
      toast('Failed to accept proposal', 'error');
    }
  }

  async function handleReject(id: string) {
    try {
      await proposalsApi.reject(id);
      setProposals(ps => ps.map(p => p.id === id ? { ...p, status: 'rejected' } : p));
      toast('Proposal rejected', 'success');
    } catch {
      toast('Failed to reject proposal', 'error');
    }
  }

  const filtered = useMemo(
    () => filter === 'all' ? proposals : proposals.filter(p => p.status === filter),
    [proposals, filter]
  );

  const pendingCount = proposals.filter(p => p.status === 'pending').length;

  if (loading) return <Spinner />;

  return (
    <div className="dmms-page">
      <div className="dmms-page-head">
        <div>
          <h1>All Proposals</h1>
          <p className="dmms-page-sub">
            {proposals.length} total · {pendingCount} pending review
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {STATUS_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            style={{
              padding: '4px 12px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: filter === f.value ? 'var(--accent)' : 'transparent',
              color: filter === f.value ? '#fff' : 'var(--fg-1)',
              cursor: 'pointer',
              fontSize: 13,
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
        <EmptyState title="No proposals" description="No proposals match the selected filter." />
      ) : (
        <ul className="dmms-feed">
          {filtered.map(p => (
            <li key={p.id}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: 15 }}>{formatCurrency(p.bid_amount)}</span>
                    <Badge color={proposalStatusColor[p.status]}>{p.status}</Badge>
                    {p.deliverable_title && (
                      <Link
                        to={`/proposals/review/${p.deliverable_id}`}
                        style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}
                      >
                        {p.deliverable_title}
                      </Link>
                    )}
                  </div>
                  {p.contributor_name && (
                    <p className="meta" style={{ marginBottom: 2 }}>by {p.contributor_name}</p>
                  )}
                  {p.message && <p className="body-sm">{p.message}</p>}
                  <p className="meta">
                    Submitted {formatDate(p.created_at)}
                    {p.eta_date ? ` · ETA ${formatDate(p.eta_date)}` : ''}
                  </p>
                </div>
                {p.status === 'pending' && (
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <Button size="sm" variant="secondary" onClick={() => handleAccept(p.id)}>Accept</Button>
                    <Button size="sm" variant="danger" onClick={() => handleReject(p.id)}>Reject</Button>
                  </div>
                )}
                {p.status !== 'pending' && p.deliverable_id && (
                  <Link to={`/proposals/review/${p.deliverable_id}`}>
                    <Button size="sm" variant="ghost">View</Button>
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
