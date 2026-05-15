import { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { projectsApi, deliverablesApi } from '../../api';
import type { Project, Deliverable } from '../../types';
import { Badge, Button, KpiCard, Spinner, ProgressBar, Alert, Modal, Input, Textarea, FormField } from '../../components/ui';
import { formatCurrency, formatDate, projectStatusColor } from '../../lib/statusColors';
import { useAuth } from '../../store/authStore';

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [tree, setTree] = useState<Deliverable[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Project>>({});
  const [editSaving, setEditSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleEditOpen = () => {
    if (!project) return;
    setEditForm({
      name: project.name,
      description: project.description,
      budget_total: project.budget_total,
      start_date: project.start_date ? project.start_date.split('T')[0] : '',
      end_date: project.end_date ? project.end_date.split('T')[0] : ''
    });
    setIsEditing(true);
  };

  const handleEditSave = async () => {
    if (!projectId) return;
    if (!editForm.name?.trim()) {
      setError('Project name cannot be empty');
      return;
    }
    setEditSaving(true);
    try {
      await projectsApi.update(projectId, {
        name: editForm.name,
        description: editForm.description,
        budget_total: Number(editForm.budget_total),
        start_date: editForm.start_date ? new Date(editForm.start_date).toISOString() : undefined,
        end_date: editForm.end_date ? new Date(editForm.end_date).toISOString() : undefined,
      });
      setIsEditing(false);
      loadData();
    } catch (err) {
      setError('Failed to update project');
    } finally {
      setEditSaving(false);
    }
  };

  const loadData = () => {
    if (!projectId) return;
    setLoading(true);
    Promise.all([
      projectsApi.get(projectId),
      deliverablesApi.tree(projectId)
    ])
    .then(([p, t]) => {
      setProject(p);
      const sortTree = (nodes: Deliverable[]): Deliverable[] => {
        return nodes.map(n => ({
          ...n,
          children: n.children ? sortTree(n.children) : []
        })).sort((a, b) => {
          const s1 = a.start_date ? new Date(a.start_date).getTime() : Infinity;
          const s2 = b.start_date ? new Date(b.start_date).getTime() : Infinity;
          
          if (s1 !== s2) {
            return s1 - s2;
          }
          
          const e1 = a.due_date ? new Date(a.due_date).getTime() : -Infinity;
          const e2 = b.due_date ? new Date(b.due_date).getTime() : -Infinity;
          return e2 - e1;
        });
      };
      setTree(sortTree(t));
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

  const handleDeleteProject = () => setConfirmDelete(true);

  const doDeleteProject = async () => {
    if (!projectId) return;
    setConfirmDelete(false);
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
              <Button variant="secondary" onClick={handleEditOpen}>Edit Project</Button>
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

      {error && <Alert type="error">{error}</Alert>}

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
          <GanttChart tree={tree} project={project} />
        )}
      </div>

      {isEditing && project && (
        <Modal
          title="Edit Project"
          onClose={() => setIsEditing(false)}
          footer={
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', width: '100%' }}>
              <Button variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
              <Button onClick={handleEditSave} disabled={editSaving}>
                {editSaving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <FormField label="Project Name">
              <Input
                value={editForm.name || ''}
                onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Name"
              />
            </FormField>
            <FormField label="Description">
              <Textarea
                value={editForm.description || ''}
                onChange={e => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Description"
                rows={3}
              />
            </FormField>
            <FormField label="Total Budget">
              <Input
                type="number"
                value={editForm.budget_total || ''}
                onChange={e => setEditForm(prev => ({ ...prev, budget_total: Number(e.target.value) }))}
                placeholder="0"
              />
            </FormField>
            <div style={{ display: 'flex', gap: 16 }}>
              <FormField label="Start Date">
                <Input
                  type="date"
                  value={editForm.start_date || ''}
                  onChange={e => setEditForm(prev => ({ ...prev, start_date: e.target.value }))}
                />
              </FormField>
              <FormField label="End Date">
                <Input
                  type="date"
                  value={editForm.end_date || ''}
                  onChange={e => setEditForm(prev => ({ ...prev, end_date: e.target.value }))}
                />
              </FormField>
            </div>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Delete project?" onClose={() => setConfirmDelete(false)} footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="danger" onClick={doDeleteProject}>Delete Project</Button>
          </div>
        }>
          <p>This will permanently delete the project and all its deliverables. This action cannot be undone.</p>
        </Modal>
      )}
    </div>
  );
}

function GanttChart({ tree, project }: { tree: Deliverable[], project?: Project }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggleCollapse = (id: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Flatten tree for chart with collapsed state
  const flat: { d: Deliverable; depth: number; hasChildren: boolean }[] = [];
  function flatten(nodes: Deliverable[], depth = 0) {
    nodes.forEach(n => {
      const hasChildren = !!(n.children && n.children.length > 0);
      flat.push({ d: n, depth, hasChildren });
      if (hasChildren && !collapsed.has(n.id)) {
        flatten(n.children!, depth + 1);
      }
    });
  }
  flatten(tree);

  // Find absolute date bounds (including project dates and hidden nodes)
  let minDate = new Date();
  let maxDate = new Date();
  let hasDates = false;

  const updateBounds = (d: Date) => {
    const t = d.getTime();
    if (isNaN(t)) return;
    if (!hasDates) {
      minDate = new Date(t);
      maxDate = new Date(t);
      hasDates = true;
    } else {
      if (t < minDate.getTime()) minDate = new Date(t);
      if (t > maxDate.getTime()) maxDate = new Date(t);
    }
  };

  // Include project dates
  if (project?.start_date) updateBounds(new Date(project.start_date));
  if (project?.end_date) updateBounds(new Date(project.end_date));

  // Include all deliverable dates
  function findBounds(nodes: Deliverable[]) {
    nodes.forEach(n => {
      if (n.start_date) updateBounds(new Date(n.start_date));
      if (n.due_date) updateBounds(new Date(n.due_date));
      if (n.children?.length) findBounds(n.children);
    });
  }
  findBounds(tree);

  // Default range if no dates found
  if (!hasDates) {
    const now = new Date();
    minDate = new Date(now.getFullYear(), now.getMonth(), 1);
    maxDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  }

  // Generate months and weeks
  const months: { name: string; year: number; weeks: { label: string; start: number; end: number }[] }[] = [];
  
  const startY = minDate.getFullYear();
  const startM = minDate.getMonth();
  const endY = maxDate.getFullYear();
  const endM = maxDate.getMonth();

  for (let y = startY; y <= endY; y++) {
    const mFrom = y === startY ? startM : 0;
    const mTo = y === endY ? endM : 11;
    
    for (let m = mFrom; m <= mTo; m++) {
      const date = new Date(y, m, 1);
      const monthName = date.toLocaleString('id-ID', { month: 'long' });
      const monthWeeks: { label: string; start: number; end: number }[] = [];
      
      const daysInMonth = new Date(y, m + 1, 0).getDate();
      for (let i = 0; i < daysInMonth; i += 7) {
        const weekNum = Math.floor(i / 7) + 1;
        const weekStart = new Date(y, m, i + 1);
        const weekEnd = new Date(y, m, Math.min(i + 7, daysInMonth));
        monthWeeks.push({
          label: `W${weekNum}`,
          start: weekStart.getTime(),
          end: weekEnd.getTime()
        });
      }
      
      months.push({ name: monthName, year: y, weeks: monthWeeks });
    }
  }

  const startMonth = new Date(startY, startM, 1);
  const endMonth = new Date(endY, endM + 1, 0);

  const WEEK_WIDTH = 50;
  const totalWeeks = months.reduce((acc, m) => acc + m.weeks.length, 0);
  const timelineWidth = totalWeeks * WEEK_WIDTH;
  const chartStartTime = startMonth.getTime();
  const chartEndTime = endMonth.getTime() + 24 * 60 * 60 * 1000;
  const totalDuration = chartEndTime - chartStartTime;

  const getX = (time: number) => {
    return ((time - chartStartTime) / totalDuration) * 100;
  };

  return (
    <div style={{ 
      background: 'var(--bg-1)', 
      border: '1px solid var(--border-1)', 
      borderRadius: 'var(--radius-lg)', 
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 800 + timelineWidth, display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <div style={{ display: 'flex', position: 'sticky', top: 0, zIndex: 20, background: 'var(--bg-1)' }}>
            <div style={{ width: 350, flexShrink: 0, borderRight: '1px solid var(--border-1)', borderBottom: '1px solid var(--border-1)', background: 'var(--bg-1)', position: 'sticky', left: 0, zIndex: 30, display: 'flex', alignItems: 'center', padding: '0 16px', fontSize: 12, fontWeight: 600, color: 'var(--fg-3)' }}>
              DELIVERABLE
            </div>
            <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
              {/* Months */}
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border-1)' }}>
                {months.map((m, i) => (
                  <div key={i} style={{ 
                    width: m.weeks.length * WEEK_WIDTH, 
                    flexShrink: 0, 
                    padding: '8px 12px', 
                    fontSize: 12, 
                    fontWeight: 600, 
                    borderRight: '1px solid var(--border-1)',
                    background: 'var(--bg-2)'
                  }}>
                    {m.name} {m.year}
                  </div>
                ))}
              </div>
              {/* Weeks */}
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border-1)' }}>
                {months.map((m) => m.weeks.map((w, j) => (
                  <div key={`${m.name}-${j}`} style={{ 
                    width: WEEK_WIDTH, 
                    flexShrink: 0, 
                    textAlign: 'center', 
                    fontSize: 10, 
                    padding: '4px 0', 
                    borderRight: '1px solid var(--border-1)',
                    color: 'var(--fg-3)'
                  }}>
                    {w.label}
                  </div>
                )))}
              </div>
            </div>
          </div>

          {/* Body */}
          <div style={{ position: 'relative' }}>
            {/* Grid Lines */}
            <div style={{ position: 'absolute', top: 0, bottom: 0, left: 350, right: 0, display: 'flex', pointerEvents: 'none' }}>
              {months.map((m) => m.weeks.map((_, j) => (
                <div key={`${m.name}-${j}`} style={{ width: WEEK_WIDTH, flexShrink: 0, borderRight: '1px solid var(--border-1)', opacity: 0.2, height: '100%' }} />
              )))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {flat.map(({ d, depth, hasChildren }) => {
                const s = d.start_date ? new Date(d.start_date).getTime() : null;
                const e = d.due_date ? new Date(d.due_date).getTime() : null;
                
                let left = 0;
                let width = 0;
                let isPoint = false;

                if (s && e) {
                  left = getX(s);
                  width = getX(e) - left;
                } else if (s || e) {
                  left = getX(s || e || 0);
                  width = 1; 
                  isPoint = true;
                }

                return (
                  <div key={d.id} style={{ display: 'flex', alignItems: 'center', height: 40, borderBottom: '1px solid var(--border-1)', position: 'relative' }}>
                    {/* Sticky Title Column */}
                    <div style={{ 
                      width: 350, 
                      flexShrink: 0, 
                      paddingLeft: 16 + depth * 20, 
                      paddingRight: 16,
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 8, 
                      zIndex: 10, 
                      background: 'var(--bg-1)', 
                      position: 'sticky', 
                      left: 0,
                      height: '100%',
                      borderRight: '1px solid var(--border-1)'
                    }}>
                      {hasChildren ? (
                        <button 
                          onClick={() => toggleCollapse(d.id)}
                          style={{ 
                            background: 'none', 
                            border: 'none', 
                            padding: 0, 
                            cursor: 'pointer', 
                            display: 'flex', 
                            alignItems: 'center',
                            color: 'var(--fg-3)',
                            transform: collapsed.has(d.id) ? 'rotate(-90deg)' : 'none',
                            transition: 'transform 0.2s'
                          }}
                        >
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                        </button>
                      ) : (
                        <div style={{ width: 14 }} />
                      )}
                      <span style={{ 
                        fontSize: 13, 
                        fontWeight: depth === 0 ? 600 : 400, 
                        whiteSpace: 'nowrap', 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis',
                        color: depth === 0 ? 'var(--fg-1)' : 'var(--fg-2)'
                      }}>
                        {d.title}
                      </span>
                    </div>

                    {/* Timeline Bar Area */}
                    <div style={{ flexGrow: 1, position: 'relative', height: '100%' }}>
                      {(s || e) && (
                        <div
                          style={{
                            position: 'absolute',
                            left: `${left}%`,
                            width: isPoint ? 'auto' : `${Math.max(0.5, width)}%`,
                            height: 24,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: isPoint ? 'var(--amber)' : 'var(--kamel-blue)',
                            borderRadius: isPoint ? '12px' : '4px',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                            zIndex: 2,
                            minWidth: isPoint ? 24 : 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title={`${d.title}\nStart: ${d.start_date ? formatDate(d.start_date) : '?'}\nEnd: ${d.due_date ? formatDate(d.due_date) : '?'}`}
                        >
                          {isPoint && <div style={{ width: 8, height: 8, background: 'white', borderRadius: '50%' }} />}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
