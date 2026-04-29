import React, { useEffect, useState, useCallback } from 'react';
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
  const [filterDeliverable, setFilterDeliverable] = useState('');
  const [filterContributor, setFilterContributor] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<KanbanTask | null>(null);

  const reload = useCallback(() => {
    const params: Record<string, string> = {};
    if (filterProject) params.project_id = filterProject;
    if (filterDeliverable) params.deliverable_id = filterDeliverable;
    if (filterContributor) params.assigned_to = filterContributor;
    kanbanApi.list(params).then(setTasks).finally(() => setLoading(false));
  }, [filterProject, filterDeliverable, filterContributor]);

  useEffect(() => {
    projectsApi.list().then(setProjects);
  }, []);

  useEffect(() => {
    setLoading(true);
    reload();
  }, [reload]);

  async function moveTask(taskId: string, destStatus: KanbanStatus, dropIndex: number) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    let updatedTasks = [...tasks].filter(t => t.id !== taskId);
    const colTasks = updatedTasks.filter(t => t.status === destStatus).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const newTask = { ...task, status: destStatus };
    colTasks.splice(dropIndex, 0, newTask);
    colTasks.forEach((t, i) => { t.position = i; });
    setTasks(ts => {
      const remaining = ts.filter(t => t.status !== destStatus && t.id !== taskId);
      return [...remaining, ...colTasks];
    });
    await kanbanApi.reorder(colTasks.map(t => ({ id: t.id, status: destStatus, position: t.position })));
  }

  // Unique contributors from tasks
  const contributorsMap = new Map<string, string>();
  tasks.forEach(t => {
    if (t.assigned_to) {
      if (t.assigned_to_name || !contributorsMap.has(t.assigned_to)) {
        contributorsMap.set(t.assigned_to, t.assigned_to_name || t.assigned_to);
      }
    }
  });
  const contributors = Array.from(contributorsMap.entries()).map(([id, name]) => ({ id, name }));

  // Unique deliverables from tasks
  const deliverablesMap = new Map<string, string>();
  tasks.forEach(t => {
    if (t.deliverable_id) {
      if (t.deliverable_title || !deliverablesMap.has(t.deliverable_id)) {
        deliverablesMap.set(t.deliverable_id, t.deliverable_title || t.deliverable_id);
      }
    }
  });
  const deliverables = Array.from(deliverablesMap.entries()).map(([id, title]) => ({ id, title }));

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
        <Select value={filterDeliverable} onChange={e => setFilterDeliverable(e.target.value)} style={{ width: 200 }}>
          <option value="">All Deliverables</option>
          {deliverables.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
        </Select>
        <Select value={filterContributor} onChange={e => setFilterContributor(e.target.value)} style={{ width: 200 }}>
          <option value="">All Contributors</option>
          {contributors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        {(filterProject || filterDeliverable || filterContributor) && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterProject(''); setFilterDeliverable(''); setFilterContributor(''); }}>Clear filters</Button>
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

  async function moveTask(taskId: string, destStatus: KanbanStatus, dropIndex: number) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    let updatedTasks = [...tasks].filter(t => t.id !== taskId);
    const colTasks = updatedTasks.filter(t => t.status === destStatus).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const newTask = { ...task, status: destStatus };
    colTasks.splice(dropIndex, 0, newTask);
    colTasks.forEach((t, i) => { t.position = i; });
    setTasks(ts => {
      const remaining = ts.filter(t => t.status !== destStatus && t.id !== taskId);
      return [...remaining, ...colTasks];
    });
    await kanbanApi.reorder(colTasks.map(t => ({ id: t.id, status: destStatus, position: t.position })));
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
  onMove: (id: string, status: KanbanStatus, index: number) => void;
  onSelect: (t: KanbanTask) => void;
}) {
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragOver = (e: React.DragEvent, status: KanbanStatus, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCol(status);
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, status: KanbanStatus, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverCol(null);
    setDragOverIndex(null);
    const id = e.dataTransfer.getData('taskId');
    if (id) onMove(id, status, index);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverCol(null);
    setDragOverIndex(null);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, alignItems: 'start' }}>
      {COLUMNS.map(col => {
        const colTasks = tasks.filter(t => t.status === col.key).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
        return (
          <div
            key={col.key}
            style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%', minHeight: 400 }}
            onDragOver={(e) => handleDragOver(e, col.key, colTasks.length)}
            onDrop={(e) => handleDrop(e, col.key, colTasks.length)}
            onDragLeave={handleDragLeave}
          >
            {/* Column header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 2px' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: col.color, flexShrink: 0 }} />
              <span style={{ fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)' }}>{col.label}</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--fg-4)', fontWeight: 600 }}>{colTasks.length}</span>
            </div>

            {/* Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minHeight: 150, background: 'var(--bg-2)', borderRadius: 'var(--radius-lg)', padding: '6px 4px' }}>
              {colTasks.map((t, index) => (
                <React.Fragment key={t.id}>
                  <div
                    onDragOver={(e) => handleDragOver(e, col.key, index)}
                    onDrop={(e) => handleDrop(e, col.key, index)}
                    style={{
                      height: 12,
                      transition: 'all 0.2s',
                      background: dragOverCol === col.key && dragOverIndex === index ? 'var(--kamel-blue-soft)' : 'transparent',
                      borderRadius: 4
                    }}
                  />
                  <KanbanCard task={t} onSelect={onSelect} />
                </React.Fragment>
              ))}
              <div
                onDragOver={(e) => handleDragOver(e, col.key, colTasks.length)}
                onDrop={(e) => handleDrop(e, col.key, colTasks.length)}
                style={{
                  height: 30,
                  transition: 'all 0.2s',
                  background: dragOverCol === col.key && dragOverIndex === colTasks.length ? 'var(--kamel-blue-soft)' : 'transparent',
                  borderRadius: 4,
                  marginTop: 'auto'
                }}
              />
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
        <div style={{ display: 'inline-flex', padding: '2px 6px', background: 'var(--kamel-blue-soft)', color: 'var(--kamel-blue)', fontSize: 10, fontWeight: 700, borderRadius: 4, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {t.project_name}
        </div>
      )}
      {t.deliverable_title && (
        <p className="meta" style={{ marginBottom: 4 }}>{t.deliverable_title}</p>
      )}

      <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--fg-0)', marginBottom: t.description ? 6 : 0, lineHeight: 1.4 }}>{t.title}</p>
      {t.description && (
        <p style={{ fontSize: 12, color: 'var(--fg-3)', marginBottom: 8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.4 }}>
          {t.description}
        </p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {t.due_date && (
            <span style={{ fontSize: 11, background: isOverdue ? 'var(--rose-soft)' : 'var(--bg-2)', color: isOverdue ? 'var(--rose)' : 'var(--fg-3)', padding: '2px 6px', borderRadius: 4, fontWeight: isOverdue ? 600 : 500, display: 'flex', alignItems: 'center', gap: 4 }}>
              {isOverdue ? '⚠ ' : '📅 '} {formatDate(t.due_date)}
            </span>
          )}
          {(t.comment_count ?? 0) > 0 && (
            <span style={{ fontSize: 11, color: 'var(--fg-4)' }}>
              💬 {t.comment_count}
            </span>
          )}
        </div>
        {t.assigned_to_name && (
          <div title={t.assigned_to_name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, background: 'var(--fg-1)', color: 'var(--bg-0)', borderRadius: '50%', fontSize: 10, fontWeight: 700 }}>
            {t.assigned_to_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
          </div>
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
    import('../../api').then(({ deliverablesApi }) => {
      if (assignedTo) {
        deliverablesApi.myAssigned().then(delivs => {
          const projectDelivs = delivs.filter(d => d.project_id === projectId);
          setDeliverables(projectDelivs.map(d => ({ id: d.id, title: d.title })));
        });
      } else {
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
        });
      }
    });
  }, [projectId, assignedTo]);

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
