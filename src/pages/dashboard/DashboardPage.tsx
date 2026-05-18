import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../store/authStore';
import { projectsApi, submissionsApi, proposalsApi, deliverablesApi, rewardsApi } from '../../api';
import type { Project, Submission, Proposal, Deliverable, RewardLedgerEntry } from '../../types';
import { Badge, Spinner } from '../../components/ui';
import { formatCurrency, formatDate, projectStatusColor, proposalStatusColor, deliverableStatusColor, deliverableStatusLabel } from '../../lib/statusColors';

export function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;
  return user.role === 'pm' || user.role === 'admin' ? <PMDashboard /> : <ContributorDashboard />;
}

// ── PM / Admin Dashboard ──────────────────────────────────────────────────────

function KpiTile({
  label, value, sub, color = 'var(--fg-0)', icon,
}: { label: string; value: string | number; sub?: string; color?: string; icon: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border-1)', borderRadius: 'var(--radius-md)', padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', margin: 0 }}>{label}</p>
        <span style={{ color, opacity: 0.7 }}>{icon}</span>
      </div>
      <p style={{ fontSize: 22, fontWeight: 700, color, margin: '0 0 4px' }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: 'var(--fg-4)', margin: 0 }}>{sub}</p>}
    </div>
  );
}

function PMDashboard() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [pending, setPending] = useState<Submission[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([projectsApi.list(100), submissionsApi.pending(), proposalsApi.allForPM()])
      .then(([p, s, pr]) => { setProjects(p.items); setPending(s); setProposals(pr); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  const totalBudget = projects.reduce((s, p) => s + p.budget_total, 0);
  const totalAllocated = projects.reduce((s, p) => s + p.budget_allocated, 0);
  const totalSaved = projects.reduce((s, p) => s + p.budget_saved, 0);
  const activeProjects = projects.filter(p => p.status === 'active').length;
  const pendingProposals = proposals.filter(p => p.status === 'pending');

  const utilizationPct = totalBudget > 0 ? Math.round((totalAllocated / totalBudget) * 100) : 0;

  return (
    <div className="dmms-page">
      <div className="dmms-page-head">
        <div>
          <h1>Dashboard</h1>
          <p className="dmms-page-sub">Welcome back, {user?.name} · Portfolio overview</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {pending.length > 0 && (
            <Link to="/review" style={{ textDecoration: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(239,68,68,0.08)', border: '1px solid var(--rose)', borderRadius: 'var(--radius-md)', padding: '7px 14px' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--rose)' }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--rose)' }}>{pending.length} pending review{pending.length !== 1 ? 's' : ''}</span>
              </div>
            </Link>
          )}
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
        <KpiTile label="Active Projects" value={activeProjects} sub={`${projects.length} total`} color="var(--kamel-blue)"
          icon={<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>} />
        <KpiTile label="Pending Reviews" value={pending.length} sub={pending.length > 0 ? 'needs action' : 'all clear'} color={pending.length > 0 ? 'var(--rose)' : 'var(--emerald)'}
          icon={<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>} />
        <KpiTile label="Budget Utilisation" value={`${utilizationPct}%`} sub={`${formatCurrency(totalAllocated)} of ${formatCurrency(totalBudget)}`} color={utilizationPct > 90 ? 'var(--rose)' : utilizationPct > 70 ? 'var(--amber)' : 'var(--fg-0)'}
          icon={<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>} />
        <KpiTile label="Budget Saved" value={formatCurrency(totalSaved)} sub="via underbids" color="var(--emerald)"
          icon={<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Projects list */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Projects</h3>
            <Link to="/projects" style={{ fontSize: 12, color: 'var(--fg-3)', textDecoration: 'none' }}>View all →</Link>
          </div>
          {projects.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 13, color: 'var(--fg-4)' }}>No projects yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {projects.slice(0, 6).map(p => {
                const pct = p.budget_total > 0 ? (p.budget_allocated / p.budget_total) * 100 : 0;
                return (
                  <div key={p.id} style={{ background: 'var(--bg-1)', border: '1px solid var(--border-1)', borderRadius: 'var(--radius-sm)', padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Link to={`/projects/${p.id}`} style={{ fontWeight: 600, fontSize: 13, color: 'var(--fg-0)', textDecoration: 'none' }}>{p.name}</Link>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <Badge color={projectStatusColor[p.status]}>{p.status}</Badge>
                        <Link to={`/projects/${p.id}/tree`} style={{ fontSize: 11, color: 'var(--fg-4)', textDecoration: 'none' }}>Tree →</Link>
                      </div>
                    </div>
                    <div style={{ height: 4, background: 'var(--bg-3)', borderRadius: 99, overflow: 'hidden', marginBottom: 4 }}>
                      <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: pct > 90 ? 'var(--rose)' : 'var(--kamel-blue)', borderRadius: 99, transition: 'width 0.4s' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--fg-4)' }}>
                      <span>{formatCurrency(p.budget_allocated)} allocated</span>
                      <span>{formatCurrency(p.budget_total)} total</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Action items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Pending submissions */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
                Pending Reviews
                {pending.length > 0 && <span style={{ marginLeft: 7, background: 'var(--rose)', color: '#fff', borderRadius: 99, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>{pending.length}</span>}
              </h3>
              <Link to="/review" style={{ fontSize: 12, color: 'var(--fg-3)', textDecoration: 'none' }}>Review all →</Link>
            </div>
            {pending.length === 0 ? (
              <div style={{ padding: '16px 0', textAlign: 'center', fontSize: 13, color: 'var(--fg-4)' }}>No pending submissions.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pending.slice(0, 3).map(s => (
                  <div key={s.id} style={{ background: 'var(--bg-1)', border: '1px solid var(--border-1)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', marginBottom: 2 }}>Submission #{s.id.slice(0, 8)}</p>
                      <p style={{ fontSize: 11, color: 'var(--fg-4)' }}>Submitted {formatDate(s.submitted_at)}</p>
                    </div>
                    <Link to="/review" style={{ fontSize: 12, color: 'var(--kamel-blue)', textDecoration: 'none', fontWeight: 600 }}>Review →</Link>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Proposals awaiting decision */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
                Open Bids
                {pendingProposals.length > 0 && <span style={{ marginLeft: 7, background: 'var(--amber)', color: '#000', borderRadius: 99, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>{pendingProposals.length}</span>}
              </h3>
              <Link to="/proposals/all" style={{ fontSize: 12, color: 'var(--fg-3)', textDecoration: 'none' }}>View all →</Link>
            </div>
            {pendingProposals.length === 0 ? (
              <div style={{ padding: '16px 0', textAlign: 'center', fontSize: 13, color: 'var(--fg-4)' }}>No open bids.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pendingProposals.slice(0, 3).map(p => (
                  <div key={p.id} style={{ background: 'var(--bg-1)', border: '1px solid var(--border-1)', borderRadius: 'var(--radius-sm)', padding: '10px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{formatCurrency(p.bid_amount)}</span>
                      <Badge color={proposalStatusColor[p.status]}>{p.status}</Badge>
                    </div>
                    {p.deliverable_title && <p style={{ fontSize: 12, color: 'var(--fg-2)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.deliverable_title}</p>}
                    {p.contributor_name && <p style={{ fontSize: 11, color: 'var(--fg-4)' }}>by {p.contributor_name} · {formatDate(p.created_at)}</p>}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

// ── Contributor Dashboard ──────────────────────────────────────────────────────

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

  const assignedIds = new Set(assigned.map(d => d.id));
  const rootAssigned = assigned.filter(d => !d.parent_id || !assignedIds.has(d.parent_id));

  const totalEarned = ledger.reduce((s, e) => s + e.amount, 0);
  const potentialBids = proposals.filter(p => p.status === 'accepted').reduce((s, p) => s + p.bid_amount, 0);
  const pendingBids = proposals.filter(p => p.status === 'pending').reduce((s, p) => s + p.bid_amount, 0);
  const inProgress = assigned.filter(d => ['assigned', 'in_progress', 'revision_requested'].includes(d.status));
  const submitted = assigned.filter(d => d.status === 'submitted');
  const pendingProposals = proposals.filter(p => p.status === 'pending');
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

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
        {[
          { label: 'Total Earned', value: formatCurrency(totalEarned), sub: `${ledger.length} approved deliverable${ledger.length !== 1 ? 's' : ''}`, color: 'var(--emerald)',
            icon: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
          { label: 'Potential Revenue', value: formatCurrency(potentialBids), sub: `${proposals.filter(p => p.status === 'accepted').length} accepted bid${proposals.filter(p => p.status === 'accepted').length !== 1 ? 's' : ''}`, color: 'var(--kamel-blue)',
            icon: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg> },
          { label: 'Bids Under Review', value: formatCurrency(pendingBids), sub: `${pendingProposals.length} pending bid${pendingProposals.length !== 1 ? 's' : ''}`, color: 'var(--amber)',
            icon: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
          { label: 'Active Work', value: String(inProgress.length), sub: `${submitted.length} awaiting review`, color: inProgress.length > 0 ? 'var(--fg-0)' : 'var(--fg-3)',
            icon: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg> },
        ].map(stat => (
          <div key={stat.label} style={{ background: 'var(--bg-1)', border: '1px solid var(--border-1)', borderRadius: 'var(--radius-md)', padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', margin: 0 }}>{stat.label}</p>
              <span style={{ color: stat.color, opacity: 0.7 }}>{stat.icon}</span>
            </div>
            <p style={{ fontSize: 22, fontWeight: 700, color: stat.color, margin: '0 0 4px' }}>{stat.value}</p>
            <p style={{ fontSize: 11, color: 'var(--fg-4)', margin: 0 }}>{stat.sub}</p>
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
            <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 13, color: 'var(--fg-4)' }}>No work assigned yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rootAssigned.slice(0, 5).map(d => (
                <Link key={d.id} to={`/workspace/${d.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border-1)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
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
            </div>
          )}
        </section>

        {/* Pending Proposals */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
              Pending Proposals
              {pendingProposals.length > 0 && <span style={{ marginLeft: 8, background: 'var(--amber)', color: '#000', borderRadius: 99, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>{pendingProposals.length}</span>}
            </h3>
            <Link to="/proposals" style={{ fontSize: 12, color: 'var(--fg-3)', textDecoration: 'none' }}>View all →</Link>
          </div>
          {pendingProposals.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 13, color: 'var(--fg-4)' }}>
              No active bids. <Link to="/marketplace" style={{ color: 'var(--kamel-blue)' }}>Find work →</Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pendingProposals.slice(0, 5).map(p => (
                <div key={p.id} style={{ background: 'var(--bg-1)', border: '1px solid var(--border-1)', borderRadius: 'var(--radius-sm)', padding: '10px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{formatCurrency(p.bid_amount)}</span>
                    <Badge color={proposalStatusColor[p.status]}>{p.status}</Badge>
                  </div>
                  {p.deliverable_title && <p style={{ fontSize: 12, color: 'var(--fg-2)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.deliverable_title}</p>}
                  {p.project_name && <p style={{ fontSize: 11, color: 'var(--fg-4)' }}>{p.project_name} · {formatDate(p.created_at)}</p>}
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
            <p style={{ fontSize: 13, color: 'var(--fg-3)', margin: '0 0 6px' }}>No earnings yet.</p>
            <p style={{ fontSize: 12, color: 'var(--fg-4)', margin: 0 }}>Complete and get approved on deliverables to earn rewards.</p>
          </div>
        ) : (
          <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border-1)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            {recentEarnings.map((e, i) => (
              <div key={e.id} style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTop: i > 0 ? '1px solid var(--border-1)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--emerald)" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{e.deliverable_title ?? 'Deliverable'}</p>
                    <p style={{ fontSize: 11, color: 'var(--fg-4)', margin: 0 }}>{e.project_name ?? ''}{e.project_name ? ' · ' : ''}{formatDate(e.created_at)}</p>
                  </div>
                </div>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--emerald)', flexShrink: 0 }}>+{formatCurrency(e.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
