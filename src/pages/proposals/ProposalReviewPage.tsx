import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { proposalsApi, deliverablesApi } from '../../api';
import type { Proposal, Deliverable } from '../../types';
import { Badge, Button, Spinner, EmptyState } from '../../components/ui';
import { formatCurrency, formatDate, proposalStatusColor } from '../../lib/statusColors';

export function ProposalReviewPage() {
  const { deliverableId } = useParams<{ deliverableId: string }>();
  const [deliverable, setDeliverable] = useState<Deliverable | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    if (!deliverableId) return;
    Promise.all([deliverablesApi.get(deliverableId), proposalsApi.list(deliverableId)])
      .then(([d, p]) => { setDeliverable(d); setProposals(p); })
      .finally(() => setLoading(false));
  }, [deliverableId]);

  async function accept(id: string) {
    setActing(true);
    try {
      await proposalsApi.accept(id);
      setProposals(ps => ps.map(p => ({
        ...p,
        status: p.id === id ? 'accepted' : p.status === 'pending' ? 'rejected' : p.status,
      })));
    } finally { setActing(false); }
  }

  async function reject(id: string) {
    setActing(true);
    try {
      await proposalsApi.reject(id);
      setProposals(ps => ps.map(p => p.id === id ? { ...p, status: 'rejected' } : p));
    } finally { setActing(false); }
  }

  if (loading) return <Spinner />;

  return (
    <div className="dmms-page" style={{ maxWidth: 680 }}>
      <div className="dmms-page-head">
        <div>
          <h1>Proposals</h1>
          {deliverable && (
            <p className="dmms-page-sub">{deliverable.title} · Max {formatCurrency(deliverable.max_budget)}</p>
          )}
        </div>
      </div>

      {proposals.length === 0 ? (
        <EmptyState title="No proposals yet" description="Proposals will appear here when contributors bid." />
      ) : (
        <ul className="dmms-feed">
          {proposals.map(p => (
            <li key={p.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>{p.contributor_name}</span>
                  <Badge color={proposalStatusColor[p.status]}>{p.status}</Badge>
                </div>
                <div style={{ display: 'flex', gap: 12, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, color: 'var(--kamel-blue)', fontSize: 14 }}>{formatCurrency(p.bid_amount)}</span>
                  {p.eta_date && <span className="meta">ETA {formatDate(p.eta_date)}</span>}
                </div>
                {p.message && <p className="body-sm">{p.message}</p>}
                <p className="meta" style={{ marginTop: 2 }}>{formatDate(p.created_at)}</p>
              </div>
              {p.status === 'pending' && (
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <Button size="sm" onClick={() => accept(p.id)} disabled={acting}>Accept</Button>
                  <Button size="sm" variant="secondary" onClick={() => reject(p.id)} disabled={acting}>Reject</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
