import { useEffect, useState } from 'react';
import { projectsApi } from '../../api';
import type { Project } from '../../types';
import { Card, KpiCard, Spinner, EmptyState, ProgressBar } from '../../components/ui';
import { formatCurrency } from '../../lib/statusColors';

export function BudgetPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    projectsApi.list().then(res => setProjects(res.items)).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  const totalBudget = projects.reduce((s, p) => s + p.budget_total, 0);
  const totalAllocated = projects.reduce((s, p) => s + p.budget_allocated, 0);
  const totalSaved = projects.reduce((s, p) => s + p.budget_saved, 0);
  const totalRemaining = totalBudget - totalAllocated;

  return (
    <div className="dmms-page">
      <div className="dmms-page-head">
        <div>
          <h1>Budget Pool</h1>
          <p className="dmms-page-sub">Across all projects</p>
        </div>
      </div>

      <div className="dmms-grid dmms-grid-4">
        <KpiCard label="Total Budget" value={formatCurrency(totalBudget)} />
        <KpiCard label="Allocated" value={formatCurrency(totalAllocated)} />
        <KpiCard label="Remaining" value={formatCurrency(totalRemaining)} />
        <KpiCard label="Saved (Underbids)" value={formatCurrency(totalSaved)} deltaDir="up" delta={totalSaved > 0 ? 'vs max bids' : undefined} />
      </div>

      {projects.length === 0 ? (
        <EmptyState title="No projects" description="Create projects to track budget allocation." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {projects.map(p => {
            const remaining = p.budget_total - p.budget_allocated;
            return (
              <Card key={p.id}>
                <div className="dmms-row-between" style={{ marginBottom: 10 }}>
                  <h4>{p.name}</h4>
                  <span className="meta">{p.status}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span className="meta">Allocated {formatCurrency(p.budget_allocated)}</span>
                  <span className="meta">Total {formatCurrency(p.budget_total)}</span>
                </div>
                <ProgressBar value={p.budget_allocated} max={p.budget_total} />
                <div className="dmms-grid dmms-grid-3" style={{ marginTop: 12 }}>
                  <div style={{ textAlign: 'center' }}>
                    <p className="eyebrow">Total</p>
                    <p style={{ fontWeight: 600, marginTop: 2 }}>{formatCurrency(p.budget_total)}</p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p className="eyebrow">Remaining</p>
                    <p style={{ fontWeight: 600, marginTop: 2, color: 'var(--kamel-blue)' }}>{formatCurrency(remaining)}</p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p className="eyebrow">Saved</p>
                    <p style={{ fontWeight: 600, marginTop: 2, color: 'var(--emerald)' }}>{formatCurrency(p.budget_saved)}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
