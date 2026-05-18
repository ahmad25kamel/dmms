import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../store/authStore';
import { projectsApi, submissionsApi, proposalsApi, deliverablesApi, rewardsApi } from '../../api';
import type { Project, Submission, Proposal, Deliverable, RewardLedgerEntry } from '../../types';
import { KpiCard, Badge, Spinner } from '../../components/ui';
import { formatCurrency, formatDate, projectStatusColor, proposalStatusColor, deliverableStatusColor, deliverableStatusLabel } from '../../lib/statusColors';

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
  const { user } = useAuth();
  const [assigned, setAssigned] = useState<Deliverable[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [ledger, setLedger] = useState<RewardLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      deliverablesApi.myAssigned(),
      proposalsApi.mine(),
      rewardsApi.ledger(user?.id).catch(() => ({ entries: [], total: 0 })),
    ])
      .then(([a, p, r]) => { setAssigned(a); setProposals(p); setLedger(r.entries); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  // Root-level assigned deliverables only
  const assignedIds = new Set(assigned.map(d => d.id));
  const rootAssigned = assigned.filter(d => !d.parent_id || !assignedIds.has(d.parent_id));

  // Financial stats
  const totalEarned = ledger.reduce((s, e) => s + e.amount, 0);
  const potentialBids = proposals.filter(p => p.status === 'accepted').reduce((s, p) => s + p.bid_amount, 0);
  const pendingBids = proposals.filter(p => p.status === 'pending').reduce((s, p) => s + p.bid_amount, 0);

  // Work pipeline
  const inProgress = assigned.filter(d => ['assigned', 'in_progress', 'revision_requested'].includes(d.status));
  const submitted = assigned.filter(d => d.status === 'submitted');
  const approved = assigned.filter(d => d.status === 'approved');

  // Active proposals (pending)
  const pendingProposals = proposals.filter(p => p.status === 'pending');

  // Recent earnings
  const recentEarnings = [...ledger].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);

  return (
    <div className="dmms-page">
      <div className="dmms-page-head">
        <div>
          <h1>My Dashboard</h1>
          <p className="dmms-page-sub">Welcome back, {user?.name} · Your contribution overview</p>
        </div>
        <Link to="/marketplace">
          <button style={{ padding: '8px 16px', background: 'var(--kamel-blue)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Browse Marketplace
          </button>
        </Link>
      </div>

      {/* Financial KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
        {[
          {
            label: 'Total Earned',
            value: formatCurrency(totalEarned),
            sub: `${ledger.length} approved deliverable${ledger.length !== 1 ? 's' : ''}`,
            color: 'var(--emerald)',
            icon: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
          },
          {
            label: 'Potential Revenue',
            value: formatCurrency(potentialBids),
            sub: `${proposals.filter(p => p.status === 'accepted').length} accepted bid${proposals.filter(p => p.status === 'accepted').length !== 1 ? 's' : ''}`,
            color: 'var(--kamel-blue)',
            icon: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
          },
          {
            label: 'Bids Under Review',
            value: formatCurrency(pendingBids),
            sub: `${pendingProposals.length} pending bid${pendingProposals.length !== 1 ? 's' : ''}`,
            color: 'var(--amber)',
            icon: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
          },
          {
            label: 'Active Work',
            value: String(inProgress.length),
            sub: `${submitted.length} awaiting review · ${approved.length} approved`,
            color: inProgress.length > 0 ? 'var(--fg-0)' : 'var(--fg-3)',
            icon: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
          },
        ].map(stat => (
          <div key={stat.label} style={{ background: 'var(--bg-1)', border: '1px solid var(--border-1)', borderRadius: 'var(--radius-md)', padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)' }}>{stat.label}</p>
              <span style={{ color: stat.color, opacity: 0.7 }}>{stat.icon}</span>
            </div>
            <p style={{ fontSize: stat.label === 'Active Work' ? 28 : 18, fontWeight: 700, color: stat.color, marginBottom: 4 }}>{stat.value}</p>
            <p style={{ fontSize: 11, color: 'var(--fg-4)' }}>{stat.sub}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Active Work */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Active Work</h3>
            <Link to="/workspace" style={{ fontSize: 12, color: 'var(--fg-3)', textDecoration: 'none' }}>View all →</Link>
          </div>
          {rootAssigned.length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 13, color: 'var(--fg-4)' }}>No work assigned yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rootAssigned.slice(0, 5).map(d => (
                <Link key={d.id} to={`/workspace/${d.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{
                    background: 'var(--bg-1)',
                    border: '1px solid var(--border-1)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    transition: 'border-color 0.15s',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</p>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11 }}>
                        <Badge color={deliverableStatusColor[d.status]}>{deliverableStatusLabel[d.status]}</Badge>
                        <span style={{ color: 'var(--fg-4)' }}>{formatCurrency(d.accepted_budget ?? d.max_budget)}</span>
                        {d.due_date && <span style={{ color: 'var(--fg-4)' }}>Due {formatDate(d.due_date)}</span>}
                      </div>
                    </div>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--fg-4)" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </div>
                </Link>
              ))}
              {rootAssigned.length > 5 && (
                <Link to="/workspace" style={{ fontSize: 12, color: 'var(--fg-3)', textDecoration: 'none', textAlign: 'center', padding: '6px 0' }}>
                  +{rootAssigned.length - 5} more →
                </Link>
              )}
            </div>
          )}
        </section>

        {/* Pending Proposals */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
              Pending Proposals
              {pendingProposals.length > 0 && (
                <span style={{ marginLeft: 8, background: 'var(--amber)', color: '#000', borderRadius: 99, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>
                  {pendingProposals.length}
                </span>
              )}
            </h3>
            <Link to="/proposals" style={{ fontSize: 12, color: 'var(--fg-3)', textDecoration: 'none' }}>View all →</Link>
          </div>
          {pendingProposals.length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 13, color: 'var(--fg-4)' }}>
              No active bids. <Link to="/marketplace" style={{ color: 'var(--kamel-blue)' }}>Find work →</Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pendingProposals.slice(0, 5).map(p => (
                <div key={p.id} style={{ background: 'var(--bg-1)', border: '1px solid var(--border-1)', borderRadius: 'var(--radius-sm)', padding: '10px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-0)' }}>{formatCurrency(p.bid_amount)}</span>
                    <Badge color={proposalStatusColor[p.status]}>{p.status}</Badge>
                  </div>
                  {p.deliverable_title && (
                    <p style={{ fontSize: 12, color: 'var(--fg-2)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.deliverable_title}</p>
                  )}
                  {p.project_name && (
                    <p style={{ fontSize: 11, color: 'var(--fg-4)' }}>{p.project_name} · Submitted {formatDate(p.created_at)}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Earnings History */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Earnings History</h3>
          <Link to="/ledger" style={{ fontSize: 12, color: 'var(--fg-3)', textDecoration: 'none' }}>View full ledger →</Link>
        </div>
        {recentEarnings.length === 0 ? (
          <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border-1)', borderRadius: 'var(--radius-md)', padding: '28px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: 'var(--fg-3)', marginBottom: 6 }}>No earnings yet.</p>
            <p style={{ fontSize: 12, color: 'var(--fg-4)' }}>Complete and get approved on deliverables to earn rewards.</p>
          </div>
        ) : (
          <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border-1)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            {recentEarnings.map((e, i) => (
              <div key={e.id} style={{
                padding: '12px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                borderTop: i > 0 ? '1px solid var(--border-1)' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--emerald)" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.deliverable_title ?? 'Deliverable'}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--fg-4)' }}>
                      {e.project_name ?? ''}{e.project_name ? ' · ' : ''}{formatDate(e.created_at)}
                    </p>
                  </div>
                </div>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--emerald)', flexShrink: 0 }}>+{formatCurrency(e.amount)}</span>
              </div>
            ))}
            {ledger.length > 5 && (
              <div style={{ padding: '10px 18px', borderTop: '1px solid var(--border-1)', textAlign: 'center' }}>
                <Link to="/ledger" style={{ fontSize: 12, color: 'var(--fg-3)', textDecoration: 'none' }}>View all {ledger.length} entries →</Link>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
