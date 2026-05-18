import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { projectsApi } from '../../api';
import type { Project } from '../../types';
import { Spinner, EmptyState, Badge } from '../../components/ui';
import { formatCurrency, projectStatusColor } from '../../lib/statusColors';

export function BudgetPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    projectsApi.list(100).then(res => setProjects(res.items)).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  const totalBudget = projects.reduce((s, p) => s + p.budget_total, 0);
  const totalAllocated = projects.reduce((s, p) => s + p.budget_allocated, 0);
  const totalSaved = projects.reduce((s, p) => s + p.budget_saved, 0);
  const totalRemaining = totalBudget - totalAllocated;
  const utilizationPct = totalBudget > 0 ? Math.round((totalAllocated / totalBudget) * 100) : 0;

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

      {/* Per-project breakdown */}
      {projects.length === 0 ? (
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
      )}
    </div>
  );
}
