import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { projectsApi, budgetApi } from '../../api';
import type { Project, ContributorBudget } from '../../types';
import { Spinner, EmptyState, Badge } from '../../components/ui';
import { formatCurrency, projectStatusColor } from '../../lib/statusColors';

type Tab = 'projects' | 'contributors';

export function BudgetPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [contributors, setContributors] = useState<ContributorBudget[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('projects');

  useEffect(() => {
    Promise.all([
      projectsApi.list(100).then(res => setProjects(res.items)),
      budgetApi.contributors().then(res => setContributors(res.contributors ?? [])).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  const totalBudget = projects.reduce((s, p) => s + p.budget_total, 0);
  const totalAllocated = projects.reduce((s, p) => s + p.budget_allocated, 0);
  const totalSaved = projects.reduce((s, p) => s + p.budget_saved, 0);
  const totalRemaining = totalBudget - totalAllocated;
  const utilizationPct = totalBudget > 0 ? Math.round((totalAllocated / totalBudget) * 100) : 0;

  const totalDisbursed = contributors.reduce((s, c) => s + c.disbursed, 0);
  const totalApproved = contributors.reduce((s, c) => s + c.approved, 0);
  const totalProjected = contributors.reduce((s, c) => s + c.projected, 0);

  return (
    <div className="dmms-page">
      <div className="dmms-page-head">
        <div>
          <h1>Budget</h1>
          <p className="dmms-page-sub">Portfolio-wide allocation and savings</p>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
        {[
          { label: 'Total Budget', value: formatCurrency(totalBudget), color: 'var(--fg-0)',
            icon: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> },
          { label: 'Allocated', value: formatCurrency(totalAllocated), sub: `${utilizationPct}% utilised`, color: utilizationPct > 90 ? 'var(--rose)' : utilizationPct > 70 ? 'var(--amber)' : 'var(--kamel-blue)',
            icon: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
          { label: 'Remaining', value: formatCurrency(totalRemaining), color: totalRemaining < 0 ? 'var(--rose)' : 'var(--fg-0)',
            icon: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> },
          { label: 'Saved via Underbids', value: formatCurrency(totalSaved), color: 'var(--emerald)',
            icon: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg> },
        ].map(stat => (
          <div key={stat.label} style={{ background: 'var(--bg-1)', border: '1px solid var(--border-1)', borderRadius: 'var(--radius-md)', padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)' }}>{stat.label}</p>
              <span style={{ color: stat.color, opacity: 0.7 }}>{stat.icon}</span>
            </div>
            <p style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: stat.color }}>{stat.value}</p>
            {'sub' in stat && stat.sub && <p style={{ margin: 0, fontSize: 11, color: 'var(--fg-4)' }}>{stat.sub}</p>}
          </div>
        ))}
      </div>

      {/* Overall bar */}
      <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border-1)', borderRadius: 'var(--radius-md)', padding: '18px 20px', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>Portfolio utilisation</p>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: utilizationPct > 90 ? 'var(--rose)' : 'var(--kamel-blue)' }}>{utilizationPct}%</p>
        </div>
        <div style={{ height: 8, background: 'var(--bg-3)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(utilizationPct, 100)}%`, background: utilizationPct > 90 ? 'var(--rose)' : utilizationPct > 70 ? 'var(--amber)' : 'var(--kamel-blue)', borderRadius: 99, transition: 'width 0.4s' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--fg-4)', marginTop: 6 }}>
          <span>{formatCurrency(totalAllocated)} allocated</span>
          <span>{formatCurrency(totalBudget)} total</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border-1)', paddingBottom: 0 }}>
        {(['projects', 'contributors'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '8px 16px',
              fontSize: 13, fontWeight: 600, color: tab === t ? 'var(--kamel-blue)' : 'var(--fg-3)',
              borderBottom: tab === t ? '2px solid var(--kamel-blue)' : '2px solid transparent',
              marginBottom: -1, transition: 'color 0.15s',
            }}
          >
            {t === 'projects' ? 'Per Project' : 'Per Contributor'}
          </button>
        ))}
      </div>

      {tab === 'projects' && (
        projects.length === 0 ? (
          <EmptyState title="No projects" description="Create projects to track budget allocation." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700 }}>Per-project breakdown</h3>
            {projects.map(p => {
              const pct = p.budget_total > 0 ? (p.budget_allocated / p.budget_total) * 100 : 0;
              const remaining = p.budget_total - p.budget_allocated;
              return (
                <div key={p.id} style={{ background: 'var(--bg-1)', border: '1px solid var(--border-1)', borderRadius: 'var(--radius-md)', padding: '16px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Link to={`/projects/${p.id}`} style={{ fontWeight: 600, fontSize: 14, color: 'var(--fg-0)', textDecoration: 'none' }}>{p.name}</Link>
                      <Badge color={projectStatusColor[p.status]}>{p.status}</Badge>
                    </div>
                    <Link to={`/projects/${p.id}/tree`} style={{ fontSize: 12, color: 'var(--fg-4)', textDecoration: 'none' }}>View tree →</Link>
                  </div>

                  <div style={{ height: 6, background: 'var(--bg-3)', borderRadius: 99, overflow: 'hidden', marginBottom: 10 }}>
                    <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: pct > 90 ? 'var(--rose)' : pct > 70 ? 'var(--amber)' : 'var(--kamel-blue)', borderRadius: 99, transition: 'width 0.4s' }} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                    {[
                      { label: 'Total', value: formatCurrency(p.budget_total), color: 'var(--fg-1)' },
                      { label: 'Allocated', value: formatCurrency(p.budget_allocated), color: 'var(--kamel-blue)' },
                      { label: 'Remaining', value: formatCurrency(remaining), color: remaining < 0 ? 'var(--rose)' : 'var(--fg-1)' },
                      { label: 'Saved', value: formatCurrency(p.budget_saved), color: 'var(--emerald)' },
                    ].map(col => (
                      <div key={col.label} style={{ textAlign: 'center', background: 'var(--bg-2)', borderRadius: 'var(--radius-sm)', padding: '8px 4px' }}>
                        <p style={{ margin: '0 0 2px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--fg-4)' }}>{col.label}</p>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: col.color }}>{col.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {tab === 'contributors' && (
        <div>
          {/* Contributor-level KPI summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Projected (Pending Bids)', value: formatCurrency(totalProjected), color: 'var(--amber)',
                desc: 'Sum of pending proposals across all projects' },
              { label: 'Approved (Committed)', value: formatCurrency(totalApproved), color: 'var(--kamel-blue)',
                desc: 'Accepted bids on active/in-progress deliverables' },
              { label: 'Disbursed (Cair)', value: formatCurrency(totalDisbursed), color: 'var(--emerald)',
                desc: 'Total paid out via reward ledger' },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--bg-1)', border: '1px solid var(--border-1)', borderRadius: 'var(--radius-md)', padding: '16px 20px' }}>
                <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)' }}>{s.label}</p>
                <p style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</p>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--fg-4)' }}>{s.desc}</p>
              </div>
            ))}
          </div>

          {contributors.length === 0 ? (
            <EmptyState title="No contributor data" description="No proposals or reward entries found for your projects." />
          ) : (
            <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border-1)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              {/* Table header */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 140px 140px 140px', gap: 0, borderBottom: '1px solid var(--border-1)', padding: '10px 20px', background: 'var(--bg-2)' }}>
                {['Contributor', 'Projected', 'Approved', 'Disbursed', 'Committed'].map((h, i) => (
                  <p key={h} style={{ margin: 0, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', textAlign: i > 0 ? 'right' : 'left' }}
                    title={h === 'Committed' ? 'Approved (active) + Disbursed (paid) — actual money at risk or already paid' : undefined}
                  >{h}</p>
                ))}
              </div>

              {contributors.map((c, idx) => {
                // Committed = approved (active, not yet paid) + disbursed (already paid).
                // Projected (pending bids) is informational — not yet committed money.
                const committed = c.approved + c.disbursed;
                const maxCommitted = contributors.reduce((m, x) => Math.max(m, x.approved + x.disbursed), 1);
                const barPct = maxCommitted > 0 ? (committed / maxCommitted) * 100 : 0;

                return (
                  <div key={c.user_id} style={{ borderBottom: idx < contributors.length - 1 ? '1px solid var(--border-1)' : 'none' }}>
                    {/* Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 140px 140px 140px', gap: 0, padding: '12px 20px', alignItems: 'center' }}>
                      {/* Name */}
                      <div>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: 'var(--fg-0)' }}>{c.user_name}</p>
                      </div>
                      {/* Projected */}
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: c.projected > 0 ? 'var(--amber)' : 'var(--fg-4)', textAlign: 'right' }}>
                        {c.projected > 0 ? formatCurrency(c.projected) : '—'}
                      </p>
                      {/* Approved */}
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: c.approved > 0 ? 'var(--kamel-blue)' : 'var(--fg-4)', textAlign: 'right' }}>
                        {c.approved > 0 ? formatCurrency(c.approved) : '—'}
                      </p>
                      {/* Disbursed */}
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: c.disbursed > 0 ? 'var(--emerald)' : 'var(--fg-4)', textAlign: 'right' }}>
                        {c.disbursed > 0 ? formatCurrency(c.disbursed) : '—'}
                      </p>
                      {/* Committed = approved + disbursed */}
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: committed > 0 ? 'var(--fg-0)' : 'var(--fg-4)', textAlign: 'right' }}>
                        {committed > 0 ? formatCurrency(committed) : '—'}
                      </p>
                    </div>

                    {/* Stacked progress bar — based on committed only */}
                    <div style={{ padding: '0 20px 10px', display: 'flex', gap: 2 }}>
                      <div style={{ flex: 1, height: 4, background: 'var(--bg-3)', borderRadius: 99, overflow: 'hidden', display: 'flex' }}>
                        {/* disbursed segment */}
                        {c.disbursed > 0 && (
                          <div style={{ width: `${(c.disbursed / maxCommitted) * 100}%`, background: 'var(--emerald)', height: '100%', transition: 'width 0.4s' }} title={`Cair: ${formatCurrency(c.disbursed)}`} />
                        )}
                        {/* approved segment */}
                        {c.approved > 0 && (
                          <div style={{ width: `${(c.approved / maxCommitted) * 100}%`, background: 'var(--kamel-blue)', height: '100%', transition: 'width 0.4s' }} title={`Approved: ${formatCurrency(c.approved)}`} />
                        )}
                      </div>
                      <p style={{ margin: 0, fontSize: 10, color: 'var(--fg-4)', whiteSpace: 'nowrap', alignSelf: 'center' }}>
                        {Math.round(barPct)}%
                      </p>
                    </div>
                  </div>
                );
              })}

              {/* Footer totals */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 140px 140px 140px', gap: 0, padding: '12px 20px', background: 'var(--bg-2)', borderTop: '2px solid var(--border-1)' }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</p>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--amber)', textAlign: 'right' }}>{formatCurrency(totalProjected)}</p>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--kamel-blue)', textAlign: 'right' }}>{formatCurrency(totalApproved)}</p>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--emerald)', textAlign: 'right' }}>{formatCurrency(totalDisbursed)}</p>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--fg-0)', textAlign: 'right' }}>{formatCurrency(totalApproved + totalDisbursed)}</p>
              </div>
            </div>
          )}

          {/* Legend */}
          <div style={{ display: 'flex', gap: 20, marginTop: 14, padding: '0 4px' }}>
            {[
              { color: 'var(--amber)', label: 'Projected — pending proposals belum diputuskan' },
              { color: 'var(--kamel-blue)', label: 'Approved — bid diterima, pekerjaan berjalan' },
              { color: 'var(--emerald)', label: 'Disbursed — sudah cair via reward ledger' },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 99, background: l.color, flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: 11, color: 'var(--fg-3)' }}>{l.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
