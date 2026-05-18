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

interface DeliverableGroup {
  deliverableId: string;
  deliverableTitle: string;
  projectName: string;
  proposals: Proposal[];
}

export function AllProposalsPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ProposalStatus | 'all'>('all');
  const [actingId, setActingId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    proposalsApi.allForPM().then(setProposals).finally(() => setLoading(false));
  }, []);

  async function handleAccept(id: string, deliverableId: string) {
    setActingId(id);
    try {
      await proposalsApi.accept(id);
      setProposals(ps => ps.map(p => {
        if (p.id === id) return { ...p, status: 'accepted' as ProposalStatus };
        if (p.deliverable_id === deliverableId && p.status === 'pending') return { ...p, status: 'rejected' as ProposalStatus };
        return p;
      }));
      toast('Proposal accepted — other bids on this deliverable rejected', 'success');
    } catch {
      toast('Failed to accept proposal', 'error');
    } finally {
      setActingId(null);
    }
  }

  async function handleReject(id: string) {
    setActingId(id);
    try {
      await proposalsApi.reject(id);
      setProposals(ps => ps.map(p => p.id === id ? { ...p, status: 'rejected' as ProposalStatus } : p));
      toast('Proposal rejected', 'success');
    } catch {
      toast('Failed to reject proposal', 'error');
    } finally {
      setActingId(null);
    }
  }

  const pendingCount = proposals.filter(p => p.status === 'pending').length;
  const acceptedCount = proposals.filter(p => p.status === 'accepted').length;
  const totalBudgetCommitted = proposals
    .filter(p => p.status === 'accepted')
    .reduce((sum, p) => sum + p.bid_amount, 0);

  // Group proposals by deliverable, applying status filter
  const groups = useMemo<DeliverableGroup[]>(() => {
    const map = new Map<string, DeliverableGroup>();
    proposals.forEach(p => {
      if (!map.has(p.deliverable_id)) {
        map.set(p.deliverable_id, {
          deliverableId: p.deliverable_id,
          deliverableTitle: p.deliverable_title ?? p.deliverable_id,
          projectName: p.project_name ?? '—',
          proposals: [],
        });
      }
      map.get(p.deliverable_id)!.proposals.push(p);
    });

    return Array.from(map.values())
      .map(g => ({
        ...g,
        proposals: filter === 'all' ? g.proposals : g.proposals.filter(p => p.status === filter),
      }))
      .filter(g => g.proposals.length > 0)
      .sort((a, b) => {
        // Groups with pending proposals first
        const aPending = a.proposals.some(p => p.status === 'pending') ? 0 : 1;
        const bPending = b.proposals.some(p => p.status === 'pending') ? 0 : 1;
        return aPending - bPending || a.projectName.localeCompare(b.projectName);
      });
  }, [proposals, filter]);

  if (loading) return <Spinner />;

  return (
    <div className="dmms-page">
      <div className="dmms-page-head">
        <div>
          <h1>All Proposals</h1>
          <p className="dmms-page-sub">
            {proposals.length} total across {new Set(proposals.map(p => p.deliverable_id)).size} deliverables · {pendingCount} awaiting review
          </p>
        </div>
      </div>

      {proposals.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          {([
            { label: 'Total Bids', value: String(proposals.length), sub: `${new Set(proposals.map(p => p.deliverable_id)).size} deliverables`, color: 'var(--fg-1)' },
            { label: 'Pending Review', value: String(pendingCount), sub: 'awaiting your decision', color: 'var(--amber)' },
            { label: 'Accepted', value: String(acceptedCount), sub: 'contributors assigned', color: 'var(--emerald)' },
            { label: 'Budget Committed', value: formatCurrency(totalBudgetCommitted), sub: 'from accepted bids', color: 'var(--kamel-blue)' },
          ]).map(stat => (
            <div key={stat.label} style={{ background: 'var(--bg-1)', border: '1px solid var(--border-1)', borderRadius: 'var(--radius-md)', padding: '14px 16px' }}>
              <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', marginBottom: 4 }}>{stat.label}</p>
              <p style={{ fontSize: stat.label === 'Budget Committed' ? 14 : 22, fontWeight: 700, color: stat.color, marginBottom: 2 }}>{stat.value}</p>
              <p style={{ fontSize: 11, color: 'var(--fg-4)' }}>{stat.sub}</p>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
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

      {groups.length === 0 ? (
        <EmptyState title="No proposals" description="No proposals match the selected filter." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {groups.map(group => {
            const hasPending = group.proposals.some(p => p.status === 'pending');
            const hasAccepted = group.proposals.some(p => p.status === 'accepted');
            return (
              <div key={group.deliverableId} style={{
                border: `1px solid ${hasAccepted ? 'var(--emerald)' : hasPending ? 'var(--kamel-blue)' : 'var(--border-1)'}`,
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
              }}>
                {/* Deliverable header */}
                <div style={{
                  background: hasAccepted ? 'var(--emerald-soft)' : hasPending ? 'var(--kamel-blue-soft)' : 'var(--bg-2)',
                  padding: '12px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  borderBottom: '1px solid var(--border-1)',
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-4)' }}>
                        {group.projectName}
                      </span>
                      <span style={{ color: 'var(--fg-4)', fontSize: 11 }}>›</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-0)' }}>{group.deliverableTitle}</span>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 2 }}>
                      {group.proposals.length} bid{group.proposals.length !== 1 ? 's' : ''}
                      {hasPending && ` · ${group.proposals.filter(p => p.status === 'pending').length} pending`}
                      {hasAccepted && ' · Assigned'}
                    </p>
                  </div>
                  <Link to={`/proposals/review/${group.deliverableId}`} style={{ textDecoration: 'none' }}>
                    <Button size="sm" variant="ghost">View Deliverable</Button>
                  </Link>
                </div>

                {/* Proposals in this group */}
                <div style={{ background: 'var(--bg-1)' }}>
                  {group.proposals.map((p, idx) => (
                    <div key={p.id} style={{
                      padding: '14px 20px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 16,
                      borderTop: idx > 0 ? '1px solid var(--border-1)' : 'none',
                      opacity: p.status === 'withdrawn' ? 0.55 : 1,
                      background: p.status === 'accepted' ? 'rgba(16,185,129,0.04)' : 'transparent',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--fg-0)' }}>{formatCurrency(p.bid_amount)}</span>
                          <Badge color={proposalStatusColor[p.status]}>{p.status}</Badge>
                          {p.status === 'accepted' && (
                            <span style={{ fontSize: 11, color: 'var(--emerald)', fontWeight: 600 }}>✓ Winner</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: p.message ? 8 : 4 }}>
                          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)' }}>{p.contributor_name ?? 'Unknown'}</span>
                          {p.eta_date && (
                            <>
                              <span style={{ color: 'var(--fg-4)' }}>·</span>
                              <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>ETA {formatDate(p.eta_date)}</span>
                            </>
                          )}
                        </div>
                        {p.message && (
                          <p style={{ fontSize: 13, color: 'var(--fg-2)', lineHeight: 1.5, marginBottom: 6, padding: '7px 12px', background: 'var(--bg-2)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--border-2)' }}>
                            "{p.message}"
                          </p>
                        )}
                        <p style={{ fontSize: 12, color: 'var(--fg-4)' }}>Submitted {formatDate(p.created_at)}</p>
                      </div>

                      {p.status === 'pending' && (
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          <Button size="sm" onClick={() => handleAccept(p.id, p.deliverable_id)} disabled={!!actingId}>
                            {actingId === p.id ? 'Accepting…' : 'Accept'}
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => handleReject(p.id)} disabled={!!actingId}>
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
