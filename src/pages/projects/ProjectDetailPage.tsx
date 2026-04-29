import { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { projectsApi, deliverablesApi } from '../../api';
import type { Project, Deliverable } from '../../types';
import { Badge, Button, KpiCard, Spinner, ProgressBar, Alert } from '../../components/ui';
import { formatCurrency, formatDate, projectStatusColor } from '../../lib/statusColors';
import { useAuth } from '../../store/authStore';

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [tree, setTree] = useState<Deliverable[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  const loadData = () => {
    if (!projectId) return;
    setLoading(true);
    Promise.all([
      projectsApi.get(projectId),
      deliverablesApi.tree(projectId)
    ])
    .then(([p, t]) => {
      setProject(p);
      setTree(t);
    })
    .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [projectId]);

  const handleDownloadTemplate = async () => {
    if (!projectId) return;
    try {
      const template = await deliverablesApi.downloadTemplate(projectId);
      const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `deliverables_template.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to download template');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !projectId) return;
    setImporting(true);
    setError('');
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      await deliverablesApi.importJSON(projectId, json);
      loadData();
    } catch (err) {
      setError('Failed to import JSON. Ensure it matches the template format.');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteProject = async () => {
    if (!projectId) return;
    if (!confirm('Are you sure you want to delete this project?')) return;
    try {
      await projectsApi.delete(projectId);
      navigate('/projects');
    } catch (err) {
      setError('Failed to delete project');
    }
  };

  if (loading) return <Spinner />;
  if (!project) return <div className="dmms-page"><p className="body-sm">Project not found.</p></div>;

  const remaining = project.budget_total - project.budget_allocated;

  return (
    <div className="dmms-page" style={{ paddingBottom: 60 }}>
      <div className="dmms-page-head">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h1 style={{ margin: 0 }}>{project.name}</h1>
            <Badge color={projectStatusColor[project.status]}>{project.status}</Badge>
          </div>
          {project.description && <p className="dmms-page-sub">{project.description}</p>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(user?.role === 'pm' || user?.role === 'admin') && (
            <>
              <input type="file" accept=".json" style={{ display: 'none' }} ref={fileInputRef} onChange={handleImport} />
              <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={importing}>
                {importing ? 'Importing...' : 'Import JSON'}
              </Button>
              <Button variant="ghost" onClick={handleDownloadTemplate}>Template</Button>
              <Button variant="danger" onClick={handleDeleteProject}>Delete Project</Button>
            </>
          )}
          <Link to={`/projects/${project.id}/tree`}>
            <Button>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
              Deliverable Tree
            </Button>
          </Link>
        </div>
      </div>

      {error && <Alert type="error" style={{ marginBottom: 20 }}>{error}</Alert>}

      <div className="dmms-grid dmms-grid-4" style={{ marginBottom: 32 }}>
        <KpiCard label="Total Budget" value={formatCurrency(project.budget_total)} />
        <KpiCard label="Allocated" value={formatCurrency(project.budget_allocated)} />
        <KpiCard label="Remaining" value={formatCurrency(remaining)} />
        <KpiCard label="Saved" value={formatCurrency(project.budget_saved)} deltaDir="up" delta={project.budget_saved > 0 ? 'underbids' : undefined} />
      </div>

      <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap', marginBottom: 40 }}>
        <div style={{ flex: '1 1 400px' }}>
          <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--fg-3)' }}>Budget Utilization</p>
          <ProgressBar value={project.budget_allocated} max={project.budget_total} color="blue" />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <span className="meta">{project.budget_total > 0 ? Math.round((project.budget_allocated / project.budget_total) * 100) : 0}% allocated</span>
            <span className="meta">{formatCurrency(remaining)} free</span>
          </div>
        </div>

        <ul className="dmms-feed" style={{ flex: '1 1 300px', margin: 0 }}>
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
        </ul>
      </div>

      <div style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 18, marginBottom: 16 }}>Deliverable Timeline</h2>
        {tree.length === 0 ? (
          <p className="meta">No deliverables found.</p>
        ) : (
          <GanttChart tree={tree} />
        )}
      </div>
    </div>
  );
}

function GanttChart({ tree }: { tree: Deliverable[] }) {
  // Flatten tree for chart
  const flat: { d: Deliverable; depth: number }[] = [];
  function flatten(nodes: Deliverable[], depth = 0) {
    nodes.forEach(n => {
      flat.push({ d: n, depth });
      if (n.children?.length) flatten(n.children, depth + 1);
    });
  }
  flatten(tree);

  // Find bounds
  let minStart = Infinity;
  let maxEnd = -Infinity;

  flat.forEach(({ d }) => {
    if (d.start_date) {
      const t = new Date(d.start_date).getTime();
      if (t < minStart) minStart = t;
    }
    if (d.due_date) {
      const t = new Date(d.due_date).getTime();
      if (t > maxEnd) maxEnd = t;
    }
  });

  const hasDates = minStart !== Infinity && maxEnd !== -Infinity && minStart <= maxEnd;
  const paddingMs = 7 * 24 * 60 * 60 * 1000; // 7 days padding

  let chartStart = minStart - paddingMs;
  let chartEnd = maxEnd + paddingMs;
  if (!hasDates) {
    const now = Date.now();
    chartStart = now - paddingMs;
    chartEnd = now + paddingMs;
  }
  
  const duration = chartEnd - chartStart;

  return (
    <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border-1)', borderRadius: 'var(--radius-lg)', overflowX: 'auto', padding: '16px 0' }}>
      <div style={{ minWidth: 800, padding: '0 20px' }}>
        {/* Header dates (rough ticks) */}
        <div style={{ display: 'flex', position: 'relative', height: 24, borderBottom: '1px solid var(--border-1)', marginBottom: 12 }}>
          <span className="meta" style={{ position: 'absolute', left: '30%' }}>{new Date(chartStart).toLocaleDateString()}</span>
          <span className="meta" style={{ position: 'absolute', right: 0 }}>{new Date(chartEnd).toLocaleDateString()}</span>
        </div>

        {/* Rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {flat.map(({ d, depth }) => {
            let leftPct = 0;
            let widthPct = 0;
            const hasStart = !!d.start_date;
            const hasEnd = !!d.due_date;

            if (hasStart && hasEnd) {
              const s = new Date(d.start_date!).getTime();
              const e = new Date(d.due_date!).getTime();
              leftPct = ((s - chartStart) / duration) * 100;
              widthPct = ((e - s) / duration) * 100;
            } else if (hasStart || hasEnd) {
              const time = new Date((d.start_date || d.due_date)!).getTime();
              leftPct = ((time - chartStart) / duration) * 100;
              widthPct = 2; // Fixed small width for single dates
            }

            const isMilestone = widthPct === 2;

            return (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', position: 'relative', height: 32 }}>
                {/* Title */}
                <div style={{ width: '30%', flexShrink: 0, paddingLeft: depth * 16, display: 'flex', alignItems: 'center', gap: 8, zIndex: 2, background: 'var(--bg-1)' }}>
                  <Badge color={projectStatusColor[d.status] || 'gray'}>{d.status.replace(/_/g, ' ')}</Badge>
                  <span style={{ fontSize: 13, fontWeight: depth === 0 ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {d.title}
                  </span>
                </div>

                {/* Bar area */}
                <div style={{ width: '70%', flexGrow: 1, position: 'relative', height: '100%', background: 'var(--bg-2)', borderRadius: 4 }}>
                  {(hasStart || hasEnd) && (
                    <div
                      style={{
                        position: 'absolute',
                        left: `${Math.max(0, leftPct)}%`,
                        width: `${Math.max(2, widthPct)}%`,
                        height: isMilestone ? 16 : 20,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: isMilestone ? 'var(--amber)' : 'var(--kamel-blue)',
                        borderRadius: isMilestone ? '50%' : 4,
                        boxShadow: 'var(--shadow-1)'
                      }}
                      title={`${d.title}\nStart: ${d.start_date ? formatDate(d.start_date) : '?'}\nEnd: ${d.due_date ? formatDate(d.due_date) : '?'}`}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
