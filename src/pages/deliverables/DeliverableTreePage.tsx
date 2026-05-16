import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { deliverablesApi, projectsApi } from '../../api';
import type { Deliverable, Project, Task } from '../../types';
import { Badge, Button, Modal, FormField, Input, Textarea, Select, Spinner, EmptyState, Alert } from '../../components/ui';
import { formatCurrency, formatDate, deliverableStatusColor, deliverableStatusLabel } from '../../lib/statusColors';
import { useAuth } from '../../store/authStore';

export function DeliverableTreePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [rawTree, setRawTree] = useState<Deliverable[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState<string | null>(null);
  const [editDeliverable, setEditDeliverable] = useState<Deliverable | null>(null);
  const [taskDeliverable, setTaskDeliverable] = useState<Deliverable | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!projectId) return;
    Promise.all([projectsApi.get(projectId), deliverablesApi.tree(projectId)])
      .then(([p, t]) => { setProject(p); setRawTree(t); })
      .finally(() => setLoading(false));
  }, [projectId]);

  const tree = useMemo(() => {
    const sortTree = (nodes: Deliverable[]): Deliverable[] =>
      nodes.map(n => ({ ...n, children: n.children ? sortTree(n.children) : [] }))
        .sort((a, b) => {
          const s1 = a.start_date ? new Date(a.start_date).getTime() : Infinity;
          const s2 = b.start_date ? new Date(b.start_date).getTime() : Infinity;
          if (s1 !== s2) return s1 - s2;
          const e1 = a.due_date ? new Date(a.due_date).getTime() : -Infinity;
          const e2 = b.due_date ? new Date(b.due_date).getTime() : -Infinity;
          return e2 - e1;
        });
    return sortTree(rawTree);
  }, [rawTree]);

  useEffect(() => { reload(); }, [reload]);

  async function handleOpenBids(id: string) { await deliverablesApi.openForBids(id); reload(); }
  async function handleCancel(id: string) { await deliverablesApi.cancel(id); reload(); }
  async function handleReopen(id: string) { await deliverablesApi.reopen(id); reload(); }
  async function handleReassign(id: string) { await deliverablesApi.reassign(id); reload(); }
  async function handleDelete(id: string) {
    setConfirmDeleteId(id);
  }

  async function confirmDelete() {
    if (!confirmDeleteId) return;
    await deliverablesApi.delete(confirmDeleteId);
    setConfirmDeleteId(null);
    reload();
  }

  if (loading) return <Spinner />;

  return (
    <div className="dmms-page">
      <div className="dmms-page-head">
        <div>
          <h1>{project?.name ?? 'Project'} — Deliverable Tree</h1>
          {project && (
            <p className="dmms-page-sub">
              Budget {formatCurrency(project.budget_total)} · Allocated {formatCurrency(project.budget_allocated)} · Saved <span style={{ color: 'var(--emerald)' }}>{formatCurrency(project.budget_saved)}</span>
            </p>
          )}
        </div>
        <Button onClick={() => setShowCreate('root')}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Add Deliverable
        </Button>
      </div>

      {tree.length === 0 ? (
        <EmptyState
          title="No deliverables yet"
          description="Add your first deliverable to start building the project structure."
          action={<Button onClick={() => setShowCreate('root')}>Add Deliverable</Button>}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {tree.map(d => (
            <DeliverableNode
              key={d.id}
              deliverable={d}
              depth={0}
              projectId={projectId!}
              onAddChild={(parentId) => setShowCreate(parentId)}
              onEdit={setEditDeliverable}
              onManageTasks={setTaskDeliverable}
              onOpenBids={handleOpenBids}
              onCancel={handleCancel}
              onReopen={handleReopen}
              onReassign={handleReassign}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {showCreate !== null && (
        <CreateDeliverableModal
          projectId={projectId!}
          parentId={showCreate === 'root' ? undefined : showCreate}
          onClose={() => setShowCreate(null)}
          onCreate={() => { setShowCreate(null); reload(); }}
        />
      )}

      {editDeliverable && (
        <EditDeliverableModal
          deliverable={editDeliverable}
          onClose={() => setEditDeliverable(null)}
          onSaved={() => { setEditDeliverable(null); reload(); }}
        />
      )}

      {taskDeliverable && (
        <TaskManagerModal
          deliverable={taskDeliverable}
          onClose={() => setTaskDeliverable(null)}
        />
      )}

      {confirmDeleteId && (
        <Modal title="Delete deliverable?" onClose={() => setConfirmDeleteId(null)} footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
            <Button variant="danger" onClick={confirmDelete}>Delete</Button>
          </div>
        }>
          <p>This will permanently delete the deliverable and all its children. This action cannot be undone.</p>
        </Modal>
      )}
    </div>
  );
}

interface NodeProps {
  deliverable: Deliverable;
  depth: number;
  projectId: string;
  onAddChild: (parentId: string) => void;
  onEdit: (d: Deliverable) => void;
  onManageTasks: (d: Deliverable) => void;
  onOpenBids: (id: string) => void;
  onCancel: (id: string) => void;
  onReopen: (id: string) => void;
  onReassign: (id: string) => void;
  onDelete: (id: string) => void;
}

function DeliverableNode({ deliverable: d, depth, projectId, onAddChild, onEdit, onManageTasks, onOpenBids, onCancel, onReopen, onReassign, onDelete }: NodeProps) {
  const [expanded, setExpanded] = useState(true);
  const { user } = useAuth();
  const hasChildren = d.children && d.children.length > 0;
  const isPM = user?.role === 'pm' || user?.role === 'admin';

  return (
    <div>
      <div className="dmms-tree-node" style={{ marginLeft: depth * 24 }}>
        <button className="dmms-tree-toggle" onClick={() => setExpanded(e => !e)}>
          {hasChildren ? (
            expanded
              ? <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9" /></svg>
              : <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 6 15 12 9 18" /></svg>
          ) : <span style={{ width: 12, display: 'inline-block' }} />}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 500, color: 'var(--fg-0)', fontSize: 14 }}>{d.title}</span>
            <Badge color={deliverableStatusColor[d.status]}>{deliverableStatusLabel[d.status]}</Badge>
            {d.visibility === 'private' && <Badge color="gray">Private</Badge>}
            {(d.proposal_count ?? 0) > 0 && (
              <span style={{ fontSize: 11, fontWeight: 700, background: 'var(--amber)', color: '#000', borderRadius: 99, padding: '1px 7px', lineHeight: 1.6 }}>
                {d.proposal_count} proposal{d.proposal_count !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="meta" style={{ marginTop: 2, display: 'flex', gap: 16 }}>
            {/* <span>Max {formatCurrency(d.max_budget)}</span> */}
            {d.accepted_budget != null && <span>Accepted {formatCurrency(d.accepted_budget)}</span>}
            {d.due_date && <span>Due {formatDate(d.due_date)}</span>}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {isPM && (
            <>
              <Button size="sm" variant="ghost" onClick={() => onManageTasks(d)} title="Tasks">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" /></svg>
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onEdit(d)} title="Edit">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
              </Button>
              {d.status === 'draft' && (
                <Button size="sm" variant="secondary" onClick={() => onOpenBids(d.id)}>Open Bids</Button>
              )}
              {d.status === 'open_for_bids' && (
                <Link to={`/proposals/review/${d.id}`}>
                  <Button size="sm" variant="secondary">Proposals</Button>
                </Link>
              )}
              {(d.status === 'open_for_bids' || d.status === 'draft') && (
                <Button size="sm" variant="ghost" onClick={() => onCancel(d.id)}>Cancel</Button>
              )}
              {(d.status === 'cancelled' || d.status === 'rejected') && (
                <Button size="sm" variant="ghost" onClick={() => d.status === 'rejected' ? onReassign(d.id) : onReopen(d.id)}>
                  Reopen for Bids
                </Button>
              )}
              {(d.status === 'assigned' || d.status === 'in_progress') && (
                <Button size="sm" variant="ghost" onClick={() => onReassign(d.id)}>Reassign</Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => onAddChild(d.id)} title="Add child">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              </Button>
              <Button size="sm" variant="danger" onClick={() => onDelete(d.id)} title="Delete">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
              </Button>
            </>
          )}
        </div>
      </div>

      {expanded && hasChildren && d.children!.map(child => (
        <DeliverableNode
          key={child.id}
          deliverable={child}
          depth={depth + 1}
          projectId={projectId}
          onAddChild={onAddChild}
          onEdit={onEdit}
          onManageTasks={onManageTasks}
          onOpenBids={onOpenBids}
          onCancel={onCancel}
          onReopen={onReopen}
          onReassign={onReassign}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

// ── Task Manager Modal ────────────────────────────────────────────────────────

function TaskManagerModal({ deliverable, onClose }: { deliverable: Deliverable; onClose: () => void }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState('');
  const [newRequired, setNewRequired] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    deliverablesApi.listTasks(deliverable.id).then(setTasks).finally(() => setLoading(false));
  }, [deliverable.id]);

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setAdding(true);
    setError('');
    try {
      const t = await deliverablesApi.createTask(deliverable.id, {
        title: newTitle.trim(),
        is_required: newRequired,
        position: tasks.length,
      });
      setTasks(ts => [...ts, t]);
      setNewTitle('');
      setNewRequired(false);
    } catch {
      setError('Failed to add task');
    } finally {
      setAdding(false);
    }
  }

  async function deleteTask(taskId: string) {
    await deliverablesApi.deleteTask(deliverable.id, taskId);
    setTasks(ts => ts.filter(t => t.id !== taskId));
  }

  async function toggleRequired(task: Task) {
    const updated = await deliverablesApi.updateTask(deliverable.id, task.id, {
      title: task.title,
      is_required: !task.is_required,
      position: task.position,
    });
    setTasks(ts => ts.map(t => t.id === task.id ? updated : t));
  }

  return (
    <Modal
      title={`Tasks — ${deliverable.title}`}
      subtitle="Acceptance checklist & daily tracking items"
      onClose={onClose}
    >
      {loading ? (
        <Spinner />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Task list */}
          {tasks.length === 0 ? (
            <p className="meta" style={{ textAlign: 'center', padding: '12px 0' }}>No tasks yet. Add tasks below to define acceptance criteria.</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 0 }}>
              {tasks.map((t, i) => (
                <li key={t.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 0',
                  borderBottom: i < tasks.length - 1 ? '1px solid var(--border-1)' : 'none',
                }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 13, color: 'var(--fg-1)' }}>{t.title}</span>
                    {t.is_required && (
                      <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--rose)', fontWeight: 600 }}>REQUIRED</span>
                    )}
                  </div>
                  <button
                    onClick={() => toggleRequired(t)}
                    title={t.is_required ? 'Mark optional' : 'Mark required'}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: t.is_required ? 'var(--rose)' : 'var(--fg-4)' }}
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                  </button>
                  <button
                    onClick={() => deleteTask(t.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--fg-4)' }}
                    title="Remove task"
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Add new task */}
          <div style={{ borderTop: '1px solid var(--border-1)', paddingTop: 14 }}>
            <p style={{ fontWeight: 600, fontSize: 12, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Add Task</p>
            <form onSubmit={addTask} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Input
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="e.g. Unit tests passing, Documentation updated…"
              />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', color: 'var(--fg-2)' }}>
                  <input type="checkbox" checked={newRequired} onChange={e => setNewRequired(e.target.checked)} />
                  Mark as required
                </label>
                <Button type="submit" size="sm" disabled={adding || !newTitle.trim()}>
                  {adding ? 'Adding…' : 'Add Task'}
                </Button>
              </div>
              {error && <Alert type="error">{error}</Alert>}
            </form>
          </div>

          {/* Info */}
          <div style={{ background: 'var(--bg-2)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', fontSize: 12, color: 'var(--fg-3)' }}>
            These tasks form the acceptance checklist. Contributors see them in their workspace and check them off when submitting.
          </div>
        </div>
      )}
    </Modal>
  );
}

// ── Edit Deliverable Modal ────────────────────────────────────────────────────

function EditDeliverableModal({ deliverable, onClose, onSaved }: {
  deliverable: Deliverable; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    title: deliverable.title,
    brief: deliverable.brief ?? '',
    scope: deliverable.scope ?? '',
    max_budget: String(deliverable.max_budget),
    start_date: deliverable.start_date?.slice(0, 10) ?? '',
    due_date: deliverable.due_date?.slice(0, 10) ?? '',
    visibility: deliverable.visibility,
    acceptance_criteria: deliverable.acceptance_criteria ?? '[]',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set(field: string, value: string) { setForm(f => ({ ...f, [field]: value })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await deliverablesApi.update(deliverable.id, {
        title: form.title,
        brief: form.brief,
        scope: form.scope,
        max_budget: parseFloat(form.max_budget) || 0,
        start_date: form.start_date || undefined,
        due_date: form.due_date || undefined,
        visibility: form.visibility as 'public' | 'private',
        acceptance_criteria: form.acceptance_criteria || '[]',
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Edit Deliverable" onClose={onClose} footer={
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
        <Button type="submit" form="edit-deliverable-form" disabled={saving || !form.title}>{saving ? 'Saving…' : 'Save Changes'}</Button>
      </div>
    }>
      <form id="edit-deliverable-form" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <FormField label="Title">
          <Input value={form.title} onChange={e => set('title', e.target.value)} required />
        </FormField>
        <FormField label="Brief">
          <Textarea value={form.brief} onChange={e => set('brief', e.target.value)} rows={2} placeholder="Short description of the deliverable" />
        </FormField>
        <FormField label="Scope">
          <Textarea value={form.scope} onChange={e => set('scope', e.target.value)} rows={2} placeholder="What's in and out of scope" />
        </FormField>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Max Budget (Rp)" hint={deliverable.children && deliverable.children.length > 0 ? "Calculated from sub-deliverables" : undefined}>
            <Input
              type="number"
              value={form.max_budget}
              onChange={e => set('max_budget', e.target.value)}
              min="0"
              disabled={deliverable.children && deliverable.children.length > 0}
            />
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <FormField label="Start Date">
              <Input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
            </FormField>
            <FormField label="Due Date">
              <Input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
            </FormField>
          </div>
        </div>
        <FormField label="Visibility">
          <Select value={form.visibility} onChange={e => set('visibility', e.target.value)}>
            <option value="public">Public</option>
            <option value="private">Private</option>
          </Select>
        </FormField>
        {error && <Alert type="error">{error}</Alert>}
      </form>
    </Modal>
  );
}

// ── Create Deliverable Modal ──────────────────────────────────────────────────

function CreateDeliverableModal({ projectId, parentId, onClose, onCreate }: {
  projectId: string; parentId?: string; onClose: () => void; onCreate: () => void;
}) {
  const [form, setForm] = useState({
    title: '', brief: '', scope: '', max_budget: '',
    start_date: '', due_date: '', visibility: 'public', acceptance_criteria: '[]',
  });
  const [saving, setSaving] = useState(false);

  function set(field: string, value: string) { setForm(f => ({ ...f, [field]: value })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await deliverablesApi.create({
        project_id: projectId,
        parent_id: parentId ?? null,
        title: form.title,
        brief: form.brief,
        scope: form.scope,
        max_budget: parseFloat(form.max_budget) || 0,
        start_date: form.start_date || undefined,
        due_date: form.due_date || undefined,
        visibility: form.visibility as 'public' | 'private',
        acceptance_criteria: form.acceptance_criteria || '[]',
      });
      onCreate();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={parentId ? 'Add Child Deliverable' : 'Add Deliverable'} onClose={onClose} footer={
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
        <Button type="submit" form="create-deliverable-form" disabled={saving || !form.title}>{saving ? 'Creating…' : 'Create'}</Button>
      </div>
    }>
      <form id="create-deliverable-form" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <FormField label="Title">
          <Input value={form.title} onChange={e => set('title', e.target.value)} required />
        </FormField>
        <FormField label="Brief">
          <Textarea value={form.brief} onChange={e => set('brief', e.target.value)} rows={2} />
        </FormField>
        <FormField label="Scope">
          <Textarea value={form.scope} onChange={e => set('scope', e.target.value)} rows={2} />
        </FormField>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Max Budget (Rp)">
            <Input type="number" value={form.max_budget} onChange={e => set('max_budget', e.target.value)} min="0" />
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <FormField label="Start Date">
              <Input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
            </FormField>
            <FormField label="Due Date">
              <Input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
            </FormField>
          </div>
        </div>
        <FormField label="Visibility">
          <Select value={form.visibility} onChange={e => set('visibility', e.target.value)}>
            <option value="public">Public</option>
            <option value="private">Private</option>
          </Select>
        </FormField>
      </form>
    </Modal>
  );
}
