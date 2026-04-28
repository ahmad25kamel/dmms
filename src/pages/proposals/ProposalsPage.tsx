import { useEffect, useState } from 'react';
import { proposalsApi } from '../../api';
import type { Proposal } from '../../types';
import { Badge, Button, Spinner, EmptyState } from '../../components/ui';
import { formatCurrency, formatDate, proposalStatusColor } from '../../lib/statusColors';

export function ProposalsPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    proposalsApi.mine().then(setProposals).finally(() => setLoading(false));
  }, []);

  async function withdraw(id: string) {
    await proposalsApi.withdraw(id);
    setProposals(ps => ps.map(p => p.id === id ? { ...p, status: 'withdrawn' } : p));
  }

  if (loading) return <Spinner />;

  return (
    <div className="dmms-page">
      <div className="dmms-page-head">
        <div>
          <h1>My Proposals</h1>
          <p className="dmms-page-sub">{proposals.length} proposal{proposals.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {proposals.length === 0 ? (
        <EmptyState title="No proposals yet" description="Browse the marketplace and submit bids to get started." />
      ) : (
        <ul className="dmms-feed">
          {proposals.map(p => (
            <li key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>{formatCurrency(p.bid_amount)}</span>
                  <Badge color={proposalStatusColor[p.status]}>{p.status}</Badge>
                </div>
                {p.message && <p className="body-sm">{p.message}</p>}
                <p className="meta">Submitted {formatDate(p.created_at)}{p.eta_date ? ` · ETA ${formatDate(p.eta_date)}` : ''}</p>
              </div>
              {p.status === 'pending' && (
                <Button size="sm" variant="danger" onClick={() => withdraw(p.id)}>Withdraw</Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
