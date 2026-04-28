import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { projectsApi } from '../../api';
import type { Project } from '../../types';
import { Badge, Button, KpiCard, Spinner, ProgressBar } from '../../components/ui';
import { formatCurrency, formatDate, projectStatusColor } from '../../lib/statusColors';

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    projectsApi.get(projectId).then(setProject).finally(() => setLoading(false));
  }, [projectId]);

  if (loading) return <Spinner />;
  if (!project) return <div className="dmms-page"><p className="body-sm">Project not found.</p></div>;

  const remaining = project.budget_total - project.budget_allocated;

  return (
    <div className="dmms-page">
      <div className="dmms-page-head">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h1 style={{ margin: 0 }}>{project.name}</h1>
            <Badge color={projectStatusColor[project.status]}>{project.status}</Badge>
          </div>
          {project.description && <p className="dmms-page-sub">{project.description}</p>}
        </div>
        <Link to={`/projects/${project.id}/tree`}>
          <Button>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
            Open Tree
          </Button>
        </Link>
      </div>

      <div className="dmms-grid dmms-grid-4">
        <KpiCard label="Total Budget" value={formatCurrency(project.budget_total)} />
        <KpiCard label="Allocated" value={formatCurrency(project.budget_allocated)} />
        <KpiCard label="Remaining" value={formatCurrency(remaining)} />
        <KpiCard label="Saved" value={formatCurrency(project.budget_saved)} deltaDir="up" delta={project.budget_saved > 0 ? 'underbids' : undefined} />
      </div>

      <div style={{ maxWidth: 560 }}>
        <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Budget Utilization</p>
        <ProgressBar value={project.budget_allocated} max={project.budget_total} color="blue" />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
          <span className="meta">{project.budget_total > 0 ? Math.round((project.budget_allocated / project.budget_total) * 100) : 0}% allocated</span>
          <span className="meta">{formatCurrency(remaining)} free</span>
        </div>
      </div>

      <ul className="dmms-feed" style={{ maxWidth: 560 }}>
        <li style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span className="meta">Start date</span>
          <span style={{ fontSize: 13 }}>{formatDate(project.start_date)}</span>
        </li>
        <li style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span className="meta">End date</span>
          <span style={{ fontSize: 13 }}>{formatDate(project.end_date)}</span>
        </li>
        <li style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span className="meta">Created</span>
          <span style={{ fontSize: 13 }}>{formatDate(project.created_at)}</span>
        </li>
        <li style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span className="meta">Status</span>
          <Badge color={projectStatusColor[project.status]}>{project.status}</Badge>
        </li>
      </ul>

      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <Link to={`/projects/${project.id}/tree`}>
          <Button variant="secondary">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
            Deliverable Tree
          </Button>
        </Link>
        <Link to="/projects">
          <Button variant="ghost">← All Projects</Button>
        </Link>
      </div>
    </div>
  );
}
