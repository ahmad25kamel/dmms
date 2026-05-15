import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../store/authStore';
import { projectsApi, submissionsApi, proposalsApi, deliverablesApi } from '../../api';
import type { Project, Submission, Proposal, Deliverable } from '../../types';
import { KpiCard, Badge, Spinner } from '../../components/ui';
import { formatCurrency, formatDate, projectStatusColor, proposalStatusColor } from '../../lib/statusColors';

export function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;
  return user.role === 'pm' || user.role === 'admin' ? <PMDashboard /> : <ContributorDashboard />;
}

function PMDashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [pending, setPending] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([projectsApi.list(), submissionsApi.pending()])
      .then(([p, s]) => { setProjects(p.items); setPending(s); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  const totalBudget = projects.reduce((s, p) => s + p.budget_total, 0);
  const saved = projects.reduce((s, p) => s + p.budget_saved, 0);

  return (
    <div className="dmms-page">
      <div className="dmms-page-head">
        <div>
          <h1>Dashboard</h1>
          <p className="dmms-page-sub">Portfolio overview</p>
        </div>
      </div>

      <div className="dmms-grid dmms-grid-4">
        <KpiCard label="Projects" value={projects.length} />
        <KpiCard label="Pending Reviews" value={pending.length} deltaDir={pending.length > 0 ? 'down' : 'neutral'} delta={pending.length > 0 ? 'needs action' : undefined} />
        <KpiCard label="Total Budget" value={formatCurrency(totalBudget)} />
        <KpiCard label="Budget Saved" value={formatCurrency(saved)} deltaDir="up" delta={saved > 0 ? 'underbids' : undefined} />
      </div>

      <section>
        <div className="dmms-row-between" style={{ marginBottom: 12 }}>
          <h3>Projects</h3>
          <Link to="/projects" className="meta">View all →</Link>
        </div>
        <ul className="dmms-feed">
          {projects.slice(0, 5).map(p => (
            <li key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <Link to={`/projects/${p.id}`} style={{ fontWeight: 500 }}>{p.name}</Link>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                  <Badge color={projectStatusColor[p.status]}>{p.status}</Badge>
                  <span className="meta">{formatCurrency(p.budget_allocated)} / {formatCurrency(p.budget_total)}</span>
                </div>
              </div>
              <Link to={`/projects/${p.id}/tree`} className="meta">Tree →</Link>
            </li>
          ))}
          {projects.length === 0 && <li><span className="meta">No projects yet.</span></li>}
        </ul>
      </section>

      {pending.length > 0 && (
        <section>
          <div className="dmms-row-between" style={{ marginBottom: 12 }}>
            <h3>Pending Reviews</h3>
            <Link to="/review" className="meta">View all →</Link>
          </div>
          <ul className="dmms-feed">
            {pending.slice(0, 3).map(s => (
              <li key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ fontWeight: 500 }}>Submission #{s.id.slice(0, 8)}</span>
                  <p className="meta">Submitted {formatDate(s.submitted_at)}</p>
                </div>
                <Link to="/review" className="meta">Review →</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ContributorDashboard() {
  const [assigned, setAssigned] = useState<Deliverable[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([deliverablesApi.myAssigned(), proposalsApi.mine()])
      .then(([a, p]) => { setAssigned(a); setProposals(p); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  return (
    <div className="dmms-page">
      <div className="dmms-page-head">
        <div>
          <h1>My Dashboard</h1>
          <p className="dmms-page-sub">Your work and proposals</p>
        </div>
      </div>

      <div className="dmms-grid dmms-grid-3">
        <KpiCard label="Assigned" value={assigned.length} />
        <KpiCard label="My Proposals" value={proposals.length} />
        <KpiCard label="Accepted" value={proposals.filter(p => p.status === 'accepted').length} deltaDir="up" />
      </div>

      {assigned.length > 0 && (
        <section>
          <h3 style={{ marginBottom: 12 }}>My Work</h3>
          <ul className="dmms-feed">
            {assigned.map(d => (
              <li key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ fontWeight: 500 }}>{d.title}</span>
                  <p className="meta">Due: {formatDate(d.due_date)} · {formatCurrency(d.accepted_budget ?? d.max_budget)}</p>
                </div>
                <Link to={`/workspace/${d.id}`} className="meta">Open →</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 style={{ marginBottom: 12 }}>My Proposals</h3>
        <ul className="dmms-feed">
          {proposals.map(p => (
            <li key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontWeight: 500 }}>{formatCurrency(p.bid_amount)}</span>
                <p className="meta">{formatDate(p.created_at)}</p>
              </div>
              <Badge color={proposalStatusColor[p.status]}>{p.status}</Badge>
            </li>
          ))}
          {proposals.length === 0 && (
            <li><span className="meta">No proposals yet. <Link to="/marketplace">Browse the marketplace</Link></span></li>
          )}
        </ul>
      </section>
    </div>
  );
}
