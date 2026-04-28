import { useEffect, useState, useCallback } from 'react';
import { kanbanApi, projectsApi } from '../../api';
import type { KanbanTask, KanbanComment, Project } from '../../types';
import { Button, Modal, FormField, Input, Textarea, Select, Spinner, EmptyState, Alert } from '../../components/ui';
import { formatDate } from '../../lib/statusColors';
import { useAuth } from '../../store/authStore';

type KanbanStatus = 'backlog' | 'todo' | 'in_progress' | 'done';

const COLUMNS: { key: KanbanStatus; label: string; color: string }[] = [
  { key: 'backlog',     label: 'Backlog',      color: 'var(--fg-4)' },
  { key: 'todo',        label: 'To Do',         color: 'var(--kamel-blue)' },
  { key: 'in_progress', label: 'In Progress',   color: 'var(--amber)' },
  { key: 'done',        label: 'Done',          color: 'var(--emerald)' },
];

export function KanbanPage() {
  const { user } = useAuth();
  if (!user) return null;
  return user.role === 'pm' || user.role === 'admin' ? <PMKanban /> : <ContributorKanban />;
}

// ── PM View ──────────────────────────────────────────────────────────────────

function PMKanban() {
  const [tasks, setTasks] = useState<KanbanTask[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterProject, setFilterProject] = useState('');
  const [filterContributor, setFilterContributor] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<KanbanTask | null>(null);

  const reload = useCallback(() => {
    const params: Record<string, string> = {};
    if (filterProject) params.project_id = filterProject;
    if (filterContributor) params.assigned_to = filterContributor;
    kanbanApi.list(params).then(setTasks).finally(() => setLoading(false));
  }, [filterProject, filterContributor]);

  useEffect(() => {
    projectsApi.list().then(setProjects);
  }, []);

  useEffect(() => {
    setLoading(true);
    reload();
  }, [reload]);

  async function moveTask(id: string, status: KanbanStatus) {
    await kanbanApi.update(id, { status });
    setTasks(ts => ts.map(t => t.id === id ? { ...t, status } : t));
  }

  // Unique contributors from tasks
  const contributors = Array.from(
    new Map(tasks.filter(t => t.assigned_to).map(t => [t.assigned_to, t.assigned_to_name])).entries()
  ).map(([id, name]) => ({ id: id!, name: name ?? id! }));

  return (
    <div className="dmms-page">
      <div className="dmms-page-head">
        <div>
          <h1>Kanban Board</h1>
          <p className="dmms-page-sub">Monitor all task progress across projects</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Task
        </Button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
        <Select value={filterProject} onChange={e => setFilterProject(e.target.value)} style={{ width: 200 }}>
          <option value="">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        <Select value={filterContributor} onChange={e => setFilterContributor(e.target.value)} style={{ width: 200 }}>
          <option value="">All Contributors</option>
          {contributors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        {(filterProject || filterContributor) && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterProject(''); setFilterContributor(''); }}>Clear filters</Button>
        )}
      </div>

      {loading ? <Spinner /> : (
        <KanbanBoard tasks={tasks} onMove={moveTask} onSelect={setSelected} />
      )}

      {showCreate && (
        <CreateTaskModal
          projects={projects}
          onClose={() => setShowCreate(false)}
          onCreate={(t) => { setTasks(ts => [...ts, t]); setShowCreate(false); }}
        />
      )}

      {selected && (
        <TaskDetailModal
          task={selected}
          onClose={() => setSelected(null)}
          onUpdated={(t) => setTasks(ts => ts.map(x => x.id === t.id ? t : x))}
          onDeleted={(id) => { setTasks(ts => ts.filter(t => t.id !== id)); setSelected(null); }}
        />
      )}
    </div>
  );
}

// ── Contributor View ──────────────────────────────────────────────────────────

function ContributorKanban() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<KanbanTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<KanbanTask | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);

  const reload = useCallback(() => {
    kanbanApi.mine().then(setTasks).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    projectsApi.list().then(setProjects);
    reload();
  }, [reload]);

  async function moveTask(id: string, status: KanbanStatus) {
    await kanbanApi.update(id, { status });
    setTasks(ts => ts.map(t => t.id === id ? { ...t, status } : t));
  }

  if (!user) return null;

  return (
    <div className="dmms-page">
      <div className="dmms-page-head">
        <div>
          <h1>My Task Board</h1>
          <p className="dmms-page-sub">Your personal kanban — tasks across all assigned deliverables</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Task
        </Button>
      </div>

      {loading ? <Spinner /> : tasks.length === 0 ? (
        <EmptyState
          title="No tasks yet"
          description="Add tasks to track your daily work across deliverables."
          action={<Button onClick={() => setShowCreate(true)}>Add Task</Button>}
        />
      ) : (
        <KanbanBoard tasks={tasks} onMove={moveTask} onSelect={setSelected} />
      )}

      {showCreate && (
        <CreateTaskModal
          projects={projects}
          assignedTo={user.id}
          onClose={() => setShowCreate(false)}
          onCreate={(t) => { setTasks(ts => [...ts, t]); setShowCreate(false); }}
        />
      )}

      {selected && (
        <TaskDetailModal
          task={selected}
          onClose={() => setSelected(null)}
          onUpdated={(t) => setTasks(ts => ts.map(x => x.id === t.id ? t : x))}
          onDeleted={(id) => { setTasks(ts => ts.filter(t => t.id !== id)); setSelected(null); }}
        />
      )}
    </div>
  );
}

// ── Kanban Board ──────────────────────────────────────────────────────────────

function KanbanBoard({ tasks, onMove, onSelect }: {
  tasks: KanbanTask[];
  onMove: (id: string, status: KanbanStatus) => void;
  onSelect: (t: KanbanTask) => void;
}) {
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, status: KanbanStatus) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('taskId');
    if (id) onMove(id, status);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, alignItems: 'start' }}>
      {COLUMNS.map(col => {
        const colTasks = tasks.filter(t => t.status === col.key);
        return (
          <div
            key={col.key}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, col.key)}
            style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            {/* Column header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 2px' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: col.color, flexShrink: 0 }} />
              <span style={{ fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)' }}>{col.label}</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--fg-4)', fontWeight: 600 }}>{colTasks.length}</span>
            </div>

            {/* Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 150, background: 'var(--bg-2)', borderRadius: 'var(--radius-lg)', padding: 4 }}>
              {colTasks.map(t => (
                <KanbanCard key={t.id} task={t} onSelect={onSelect} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KanbanCard({ task: t, onSelect }: {
  task: KanbanTask;
  onSelect: (t: KanbanTask) => void;
}) {
  const isOverdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done';

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('taskId', t.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={() => onSelect(t)}
      style={{
        background: 'var(--bg-1)',
        border: '1px solid var(--border-1)',
        borderRadius: 'var(--radius-md)',
        padding: '12px 14px',
        cursor: 'grab',
        boxShadow: 'var(--shadow-1)',
        transition: 'all var(--dur-base) var(--ease-out)',
      }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = 'var(--shadow-2)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'var(--shadow-1)')}
    >
      {/* Project + deliverable context */}
      {t.project_name && (
        <p className="eyebrow" style={{ marginBottom: 4, color: 'var(--kamel-blue)' }}>{t.project_name}</p>
      )}
      {t.deliverable_title && (
        <p className="meta" style={{ marginBottom: 4 }}>{t.deliverable_title}</p>
      )}

      <p style={{ fontWeight: 500, fontSize: 13, color: 'var(--fg-0)', marginBottom: t.description ? 6 : 0 }}>{t.title}</p>
      {t.description && (
        <p className="meta" style={{ marginBottom: 6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {t.description}
        </p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {t.due_date && (
            <span style={{ fontSize: 11, color: isOverdue ? 'var(--rose)' : 'var(--fg-3)', fontWeight: isOverdue ? 600 : 400 }}>
              {isOverdue ? '⚠ ' : ''}{formatDate(t.due_date)}
            </span>
          )}
          {(t.comment_count ?? 0) > 0 && (
            <span style={{ fontSize: 11, color: 'var(--fg-4)' }}>
              💬 {t.comment_count}
            </span>
          )}
        </div>
        {t.assigned_to_name && (
          <span style={{ fontSize: 11, background: 'var(--bg-2)', borderRadius: 'var(--radius-pill)', padding: '2px 8px', color: 'var(--fg-2)' }}>
            {t.assigned_to_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>

    </div>
  );
}

// ── Task Detail Modal ─────────────────────────────────────────────────────────

function TaskDetailModal({ task, onClose, onUpdated, onDeleted }: {
  task: KanbanTask;
  onClose: () => void;
  onUpdated: (t: KanbanTask) => void;
  onDeleted: (id: string) => void;
}) {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [comments, setComments] = useState<KanbanComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [commentBody, setCommentBody] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [t, setT] = useState(task);

  useEffect(() => {
    kanbanApi.listComments(task.id).then(setComments).finally(() => setLoadingComments(false));
  }, [task.id]);

  async function sendComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentBody.trim()) return;
    setSendingComment(true);
    try {
      const c = await kanbanApi.addComment(task.id, commentBody.trim());
      setComments(cs => [...cs, c]);
      setCommentBody('');
    } finally {
      setSendingComment(false);
    }
  }

  async function moveStatus(status: KanbanTask['status']) {
    const updated = await kanbanApi.update(task.id, { status });
    setT(updated);
    onUpdated(updated);
  }

  const colColor = COLUMNS.find(c => c.key === t.status)?.color ?? 'var(--fg-4)';
  const isOverdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done';

  return (
    <Modal
      title={t.title}
      subtitle={`${t.project_name ?? ''}${t.deliverable_title ? ' · ' + t.deliverable_title : ''}`}
      onClose={onClose}
    >
      {editing ? (
        <EditTaskForm
          task={t}
          onSaved={(updated) => { setT(updated); onUpdated(updated); setEditing(false); }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Status row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: colColor }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: colColor }} />
              {COLUMNS.find(c => c.key === t.status)?.label}
            </span>
            {t.assigned_to_name && <span className="meta">Assignee: {t.assigned_to_name}</span>}
            {t.due_date && (
              <span style={{ fontSize: 12, color: isOverdue ? 'var(--rose)' : 'var(--fg-3)', fontWeight: isOverdue ? 600 : 400 }}>
                {isOverdue ? '⚠ Overdue · ' : 'Due: '}{formatDate(t.due_date)}
              </span>
            )}
          </div>

          {/* Move to */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {COLUMNS.filter(c => c.key !== t.status).map(c => (
              <Button key={c.key} size="sm" variant="secondary" onClick={() => moveStatus(c.key)}>
                → {c.label}
              </Button>
            ))}
          </div>

          {t.description && (
            <div>
              <p style={{ fontWeight: 600, fontSize: 12, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Description</p>
              <p className="body-sm" style={{ whiteSpace: 'pre-wrap' }}>{t.description}</p>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8 }}>
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>Edit</Button>
            <Button size="sm" variant="danger" onClick={() => { kanbanApi.delete(t.id); onDeleted(t.id); }}>Delete</Button>
          </div>

          {/* Comments */}
          <div>
            <p style={{ fontWeight: 600, fontSize: 12, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Comments {comments.length > 0 && `(${comments.length})`}
            </p>
            {loadingComments ? <Spinner /> : (
              <>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 14 }}>
                  {comments.map(c => (
                    <li key={c.id}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--kamel-blue-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--kamel-blue)' }}>
                          {(c.author_name ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                        </span>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{c.author_name}</span>
                        <span className="meta">{formatDate(c.created_at)}</span>
                      </div>
                      <p className="body-sm" style={{ marginLeft: 32, whiteSpace: 'pre-wrap' }}>{c.body}</p>
                    </li>
                  ))}
                  {comments.length === 0 && <li><p className="meta">No comments yet.</p></li>}
                </ul>
                <form onSubmit={sendComment} style={{ display: 'flex', gap: 8 }}>
                  <Textarea
                    value={commentBody}
                    onChange={e => setCommentBody(e.target.value)}
                    placeholder={user?.role === 'pm' ? 'Leave feedback or instructions…' : 'Ask a question or give an update…'}
                    rows={2}
                    style={{ flex: 1 }}
                  />
                  <Button type="submit" size="sm" disabled={sendingComment || !commentBody.trim()} style={{ alignSelf: 'flex-end' }}>
                    Send
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

// ── Edit Task Form ────────────────────────────────────────────────────────────

function EditTaskForm({ task, onSaved, onCancel }: {
  task: KanbanTask;
  onSaved: (t: KanbanTask) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    title: task.title,
    description: task.description ?? '',
    due_date: task.due_date?.slice(0, 10) ?? '',
    status: task.status,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const updated = await kanbanApi.update(task.id, {
        title: form.title,
        description: form.description,
        due_date: form.due_date || '',
        status: form.status as KanbanTask['status'],
      });
      onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <FormField label="Title">
        <Input value={form.title} onChange={e => set('title', e.target.value)} required />
      </FormField>
      <FormField label="Description">
        <Textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3} />
      </FormField>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <FormField label="Status">
          <Select value={form.status} onChange={e => set('status', e.target.value)}>
            {COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </Select>
        </FormField>
        <FormField label="Due Date (optional)">
          <Input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
        </FormField>
      </div>
      {error && <Alert type="error">{error}</Alert>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button variant="secondary" onClick={onCancel} type="button">Cancel</Button>
        <Button type="submit" disabled={saving || !form.title}>{saving ? 'Saving…' : 'Save'}</Button>
      </div>
    </form>
  );
}

// ── Create Task Modal ─────────────────────────────────────────────────────────

function CreateTaskModal({ projects, assignedTo, onClose, onCreate }: {
  projects: Project[];
  assignedTo?: string;
  onClose: () => void;
  onCreate: (t: KanbanTask) => void;
}) {
  const [projectId, setProjectId] = useState('');
  const [deliverables, setDeliverables] = useState<{ id: string; title: string }[]>([]);
  const [deliverableId, setDeliverableId] = useState('');
  const [form, setForm] = useState({ title: '', description: '', status: 'backlog', due_date: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!projectId) { setDeliverables([]); setDeliverableId(''); return; }
    import('../../api').then(({ deliverablesApi }) =>
      deliverablesApi.tree(projectId).then(tree => {
        const flat: { id: string; title: string }[] = [];
        function flatten(nodes: any[], depth = 0) {
          nodes.forEach(n => {
            flat.push({ id: n.id, title: ('  '.repeat(depth)) + n.title });
            if (n.children?.length) flatten(n.children, depth + 1);
          });
        }
        flatten(tree);
        setDeliverables(flat);
      })
    );
  }, [projectId]);

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId || !deliverableId || !form.title) {
      setError('Project, deliverable, and title are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const t = await kanbanApi.create({
        project_id: projectId,
        deliverable_id: deliverableId,
        title: form.title,
        description: form.description,
        status: form.status as KanbanTask['status'],
        assigned_to: assignedTo ?? null,
        due_date: form.due_date || undefined,
      } as any);
      onCreate(t);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="New Task" onClose={onClose} footer={
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
        <Button type="submit" form="create-kanban-form" disabled={saving || !form.title}>{saving ? 'Creating…' : 'Create Task'}</Button>
      </div>
    }>
      <form id="create-kanban-form" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <FormField label="Project">
          <Select value={projectId} onChange={e => setProjectId(e.target.value)}>
            <option value="">Select project…</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </FormField>
        <FormField label="Deliverable">
          <Select value={deliverableId} onChange={e => setDeliverableId(e.target.value)} disabled={!projectId}>
            <option value="">Select deliverable…</option>
            {deliverables.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
          </Select>
        </FormField>
        <FormField label="Title">
          <Input value={form.title} onChange={e => set('title', e.target.value)} placeholder="What needs to be done?" required />
        </FormField>
        <FormField label="Description (optional)">
          <Textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} />
        </FormField>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Start in column">
            <Select value={form.status} onChange={e => set('status', e.target.value)}>
              {COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </Select>
          </FormField>
          <FormField label="Due Date (optional)">
            <Input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
          </FormField>
        </div>
        {error && <Alert type="error">{error}</Alert>}
      </form>
    </Modal>
  );
}
