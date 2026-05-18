import { useEffect, useState } from 'react';
import { rewardsApi } from '../../api';
import type { RewardLedgerEntry } from '../../types';
import { Spinner } from '../../components/ui';
import { formatCurrency, formatDate } from '../../lib/statusColors';
import { useAuth } from '../../store/authStore';

export function LedgerPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<RewardLedgerEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    rewardsApi.ledger().then(r => { setEntries(r.entries); setTotal(r.total); }).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  const isPM = user?.role === 'pm' || user?.role === 'admin';

  const monthly: Record<string, RewardLedgerEntry[]> = {};
  entries.forEach(e => {
    const key = new Date(e.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    if (!monthly[key]) monthly[key] = [];
    monthly[key].push(e);
  });
  const months = Object.entries(monthly);

  return (
    <div className="dmms-page">
      <div className="dmms-page-head">
        <div>
          <h1>Reward Ledger</h1>
          <p className="dmms-page-sub">{isPM ? 'Total rewards paid out to contributors' : 'Total earned across all deliverables'}</p>
        </div>
      </div>

      {/* Summary strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 28 }}>
        {[
          { label: isPM ? 'Total Paid Out' : 'Total Earned', value: formatCurrency(total), color: 'var(--emerald)',
            icon: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
          { label: 'Transactions', value: entries.length, color: 'var(--kamel-blue)',
            icon: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> },
          { label: 'Avg. per Deliverable', value: entries.length > 0 ? formatCurrency(total / entries.length) : '—', color: 'var(--fg-0)',
            icon: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
        ].map(stat => (
          <div key={stat.label} style={{ background: 'var(--bg-1)', border: '1px solid var(--border-1)', borderRadius: 'var(--radius-md)', padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)' }}>{stat.label}</p>
              <span style={{ color: stat.color, opacity: 0.7 }}>{stat.icon}</span>
            </div>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: stat.color }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {entries.length === 0 ? (
        <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border-1)', borderRadius: 'var(--radius-md)', padding: '48px 20px', textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="var(--fg-4)" strokeWidth="1.5" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-2)', margin: '0 0 6px' }}>No rewards yet</p>
          <p style={{ fontSize: 13, color: 'var(--fg-4)', margin: 0 }}>Complete and get approved for deliverables to earn rewards.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {months.map(([month, mes]) => {
            const monthTotal = mes.reduce((s, e) => s + e.amount, 0);
            return (
              <section key={month}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{month}</h3>
                    <span style={{ fontSize: 11, color: 'var(--fg-4)' }}>{mes.length} transaction{mes.length !== 1 ? 's' : ''}</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--emerald)' }}>{formatCurrency(monthTotal)}</span>
                </div>
                <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border-1)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  {mes.map((e, i) => (
                    <div key={e.id} style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, borderTop: i > 0 ? '1px solid var(--border-1)' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="var(--emerald)" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ margin: '0 0 3px', fontSize: 14, fontWeight: 600, color: 'var(--fg-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {e.deliverable_title ?? 'Deliverable'}
                          </p>
                          <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 11, color: 'var(--fg-4)' }}>
                            {e.project_name && <span>{e.project_name}</span>}
                            <span>{formatDate(e.created_at)}</span>
                          </div>
                        </div>
                      </div>
                      <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--emerald)', flexShrink: 0 }}>+{formatCurrency(e.amount)}</p>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
