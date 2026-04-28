import { useEffect, useState } from 'react';
import { rewardsApi } from '../../api';
import type { RewardLedgerEntry } from '../../types';
import { KpiCard, Spinner, EmptyState } from '../../components/ui';
import { formatCurrency, formatDate } from '../../lib/statusColors';

export function LedgerPage() {
  const [entries, setEntries] = useState<RewardLedgerEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    rewardsApi.ledger().then(r => { setEntries(r.entries); setTotal(r.total); }).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  return (
    <div className="dmms-page">
      <div className="dmms-page-head">
        <div>
          <h1>Reward Ledger</h1>
          <p className="dmms-page-sub">Total earned across all deliverables</p>
        </div>
      </div>

      <div className="dmms-grid dmms-grid-2" style={{ maxWidth: 480 }}>
        <KpiCard label="Total Earned" value={formatCurrency(total)} deltaDir="up" />
        <KpiCard label="Transactions" value={entries.length} />
      </div>

      {entries.length === 0 ? (
        <EmptyState title="No rewards yet" description="Complete and get approved for deliverables to earn rewards." />
      ) : (
        <ul className="dmms-feed">
          {entries.map(e => (
            <li key={e.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontWeight: 500 }}>{e.deliverable_title}</span>
                <p className="meta">{e.project_name} · {formatDate(e.created_at)}</p>
              </div>
              <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--emerald)' }}>{formatCurrency(e.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
