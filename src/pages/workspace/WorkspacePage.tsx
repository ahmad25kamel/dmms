import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { deliverablesApi } from '../../api';
import type { Deliverable, Task, Submission } from '../../types';
import { Badge, Button, Input, Textarea, FormField, Spinner, Modal } from '../../components/ui';
import { formatCurrency, formatDate, deliverableStatusColor, deliverableStatusLabel } from '../../lib/statusColors';

interface DeliverableWithTasks extends Deliverable {
  tasks: Task[];
  history: Submission[];
  subChildren: DeliverableWithTasks[];
}

export function WorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const [root, setRoot] = useState<Deliverable | null>(null);
  const [children, setChildren] = useState<DeliverableWithTasks[]>([]);
  const [rootTasks, setRootTasks] = useState<Task[]>([]);
  const [rootHistory, setRootHistory] = useState<Submission[]>([]);
  const [subtasks, setSubtasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitTarget, setSubmitTarget] = useState<{ id: string; title: string; tasks: Task[] } | null>(null);

  async function enrichDeliverable(d: Deliverable): Promise<DeliverableWithTasks> {
    const [tasks, history, kids] = await Promise.all([
      deliverablesApi.listTasks(d.id).catch(() => [] as Task[]),
      deliverablesApi.listHistory(d.id).catch(() => [] as Submission[]),
      deliverablesApi.listChildren(d.id).catch(() => [] as Deliverable[]),
    ]);
    const subChildren = await Promise.all(kids.map(k => enrichDeliverable(k)));
    return { ...d, tasks, history, subChildren };
  }

  async function load() {
    if (!id) return;
    try {
      const [d, tasks, subs, history, kids] = await Promise.all([
        deliverablesApi.get(id),
        deliverablesApi.listTasks(id),
        deliverablesApi.listSubtasks(id),
        deliverablesApi.listHistory(id).catch(() => [] as Submission[]),
        deliverablesApi.listChildren(id).catch(() => [] as Deliverable[]),
      ]);
      setRoot(d);
      setRootTasks(tasks);
      setSubtasks(subs);
      setRootHistory(history);
      const enriched = await Promise.all(kids.map(k => enrichDeliverable(k)));
      setChildren(enriched);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  async function addSubtask(title: string) {
    const s = await deliverablesApi.createSubtask(id!, { title, position: subtasks.length });
    setSubtasks(ss => [...ss, s]);
  }

  async function toggleSubtask(task: Task) {
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    await deliverablesApi.updateSubtask(id!, task.id, { ...task, status: newStatus });
    setSubtasks(ss => ss.map(s => s.id === task.id ? { ...s, status: newStatus } : s));
  }

  function updateChildStatus(nodes: DeliverableWithTasks[], targetId: string, s: Submission): DeliverableWithTasks[] {
    return nodes.map(c => {
      if (c.id === targetId) return { ...c, status: 'submitted', history: [...c.history, s] };
      return { ...c, subChildren: updateChildStatus(c.subChildren, targetId, s) };
    });
  }

  function onSubmitted(s: Submission, targetId: string) {
    if (targetId === id) {
      setRootHistory(h => [...h, s]);
      setRoot(r => r ? { ...r, status: 'submitted' } : r);
    } else {
      setChildren(cs => updateChildStatus(cs, targetId, s));
    }
    setSubmitTarget(null);
  }

  if (loading) return <Spinner />;
  if (!root) return <div className="dmms-page"><p className="body-sm">Deliverable not found</p></div>;

  const isTerminal = (s: string) => ['approved', 'cancelled', 'rejected'].includes(s);
  const requiredPending = (tasks: Task[]) => tasks.filter(t => t.is_required && t.status !== 'done').length;

  // Parent can be submitted only if all children are approved
  const allChildrenApproved = children.length === 0 || children.every(c => isTerminal(c.status));
  const rootRequiredPending = requiredPending(rootTasks);
  const canSubmitRoot = !isTerminal(root.status) && root.status !== 'submitted' && allChildrenApproved && rootRequiredPending === 0;

  const approvedCount = children.filter(c => c.status === 'approved').length;
  const totalChildren = children.length;

  return (
    <div className="dmms-page" style={{ maxWidth: 800 }}>
      {/* Header */}
      <div className="dmms-page-head">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h1 style={{ margin: 0 }}>{root.title}</h1>
            <Badge color={deliverableStatusColor[root.status]}>{deliverableStatusLabel[root.status]}</Badge>
          </div>
          <p className="dmms-page-sub">
            {formatCurrency(root.accepted_budget ?? root.max_budget)}
            {root.due_date ? ` · Due ${formatDate(root.due_date)}` : ''}
            {totalChildren > 0 ? ` · ${approvedCount}/${totalChildren} sub-deliverables approved` : ''}
          </p>
        </div>
      </div>

      {/* Brief */}
      {root.brief && (
        <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border-1)', borderRadius: 'var(--radius-md)', padding: '14px 18px', marginBottom: 20 }}>
          <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, color: 'var(--fg-2)' }}>Brief</p>
          <p style={{ fontSize: 13, color: 'var(--fg-1)', lineHeight: 1.6 }}>{root.brief}</p>
        </div>
      )}

      {/* Sub-deliverables */}
      {children.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Sub-deliverables</h2>
            <span style={{ fontSize: 12, color: approvedCount === totalChildren ? 'var(--emerald)' : 'var(--fg-3)', fontWeight: 600 }}>
              {approvedCount}/{totalChildren} approved
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {children.map(child => (
              <SubDeliverableCard
                key={child.id}
                child={child}
                onOpenSubmit={(t) => setSubmitTarget(t)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Root-level tasks (acceptance checklist) */}
      {rootTasks.length > 0 && (
        <section style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Acceptance Checklist</h2>
          <TaskChecklist tasks={rootTasks} />
        </section>
      )}

      {/* Personal subtasks */}
      <section style={{ background: 'var(--bg-1)', border: '1px solid var(--border-1)', borderRadius: 'var(--radius-md)', padding: '14px 18px', marginBottom: 20 }}>
        <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>
          My Notes / Subtasks ({subtasks.filter(s => s.status === 'done').length}/{subtasks.length})
        </p>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8, marginBottom: subtasks.length > 0 ? 12 : 0 }}>
          {subtasks.map(s => (
            <li key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={() => toggleSubtask(s)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                {s.status === 'done'
                  ? <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--emerald)" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><polyline points="9 12 11 14 15 10"/></svg>
                  : <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--border-2)" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
                }
              </button>
              <span style={{ fontSize: 13, color: s.status === 'done' ? 'var(--fg-4)' : 'var(--fg-2)', textDecoration: s.status === 'done' ? 'line-through' : 'none' }}>
                {s.title}
              </span>
            </li>
          ))}
        </ul>
        <AddSubtaskInput onAdd={addSubtask} />
      </section>

      {/* Submission history + submit action */}
      {rootHistory.length > 0 && (
        <section style={{ background: 'var(--bg-1)', border: '1px solid var(--border-1)', borderRadius: 'var(--radius-md)', padding: '14px 18px', marginBottom: 16 }}>
          <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Submission History</p>
          {[...rootHistory].reverse().map((sub, i) => (
            <div key={sub.id} style={{ borderTop: i > 0 ? '1px solid var(--border-1)' : undefined, paddingTop: i > 0 ? 10 : 0, marginTop: i > 0 ? 10 : 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 12, textTransform: 'capitalize', color: sub.status === 'approved' ? 'var(--emerald)' : sub.status === 'rejected' ? 'var(--rose)' : 'var(--amber)' }}>{sub.status}</span>
                <span style={{ fontSize: 11, color: 'var(--fg-4)' }}>{formatDate(sub.submitted_at)}</span>
              </div>
              {sub.notes && <p style={{ fontSize: 13, color: 'var(--fg-2)' }}>{sub.notes}</p>}
              {sub.review_notes && (
                <div style={{ marginTop: 6, padding: '8px 10px', background: 'var(--amber-soft)', borderRadius: 'var(--radius-sm)', fontSize: 12, color: '#92400E' }}>
                  <strong>PM Feedback:</strong> {sub.review_notes}
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {/* Root submit action */}
      {!isTerminal(root.status) && (
        <SubmitSection
          canSubmit={canSubmitRoot}
          isSubmitted={root.status === 'submitted'}
          blockers={getBlockers(root, children, rootRequiredPending, allChildrenApproved)}
          onSubmit={() => setSubmitTarget({ id: id!, title: root.title, tasks: rootTasks })}
        />
      )}

      {submitTarget && (
        <SubmitModal
          deliverableId={submitTarget.id}
          title={submitTarget.title}
          tasks={submitTarget.tasks}
          onClose={() => setSubmitTarget(null)}
          onSubmitted={(s) => onSubmitted(s, submitTarget.id)}
        />
      )}
    </div>
  );
}

function getBlockers(root: Deliverable, children: DeliverableWithTasks[], rootRequiredPending: number, _allChildrenApproved: boolean): string[] {
  const blockers: string[] = [];
  if (root.status === 'submitted') return [];
  const notApproved = children.filter(c => !['approved', 'cancelled', 'rejected'].includes(c.status));
  if (notApproved.length > 0) {
    blockers.push(`${notApproved.length} sub-deliverable${notApproved.length > 1 ? 's' : ''} not yet approved`);
  }
  if (rootRequiredPending > 0) {
    blockers.push(`${rootRequiredPending} required task${rootRequiredPending > 1 ? 's' : ''} not completed`);
  }
  return blockers;
}

function SubmitSection({ canSubmit, isSubmitted, blockers, onSubmit }: {
  canSubmit: boolean;
  isSubmitted: boolean;
  blockers: string[];
  onSubmit: () => void;
}) {
  if (isSubmitted) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: 'var(--bg-1)', border: '1px solid var(--border-1)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--amber)' }}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        Submission pending PM review
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {blockers.length > 0 && (
        <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border-1)', borderRadius: 'var(--radius-md)', padding: '12px 16px' }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-3)', marginBottom: 6 }}>Before you can submit:</p>
          <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {blockers.map(b => (
              <li key={b} style={{ fontSize: 12, color: 'var(--fg-2)' }}>{b}</li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <Button onClick={onSubmit} disabled={!canSubmit}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          Submit for Review
        </Button>
      </div>
    </div>
  );
}

function SubDeliverableCard({ child, onOpenSubmit, depth = 0 }: {
  child: DeliverableWithTasks;
  onOpenSubmit: (target: { id: string; title: string; tasks: Task[] }) => void;
  depth?: number;
}) {
  const isTerminal = ['approved', 'cancelled', 'rejected'].includes(child.status);
  const requiredPending = child.tasks.filter(t => t.is_required && t.status !== 'done').length;
  const allSubChildrenApproved = child.subChildren.length === 0 ||
    child.subChildren.every(c => ['approved', 'cancelled', 'rejected'].includes(c.status));
  const canSubmit = !isTerminal && child.status !== 'submitted' && requiredPending === 0 && allSubChildrenApproved;
  const totalTasks = child.tasks.length;
  const doneTasks = child.tasks.filter(t => t.status === 'done').length;
  const latestSubmission = child.history.length > 0 ? child.history[child.history.length - 1] : null;
  const borderColor = child.status === 'approved' ? 'var(--emerald)' : child.status === 'submitted' ? 'var(--amber)' : 'var(--border-1)';

  return (
    <div style={{
      background: 'var(--bg-1)',
      border: `1px solid ${borderColor}`,
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
      marginLeft: depth > 0 ? 16 : 0,
    }}>
      {/* Header row */}
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            {depth > 0 && <span style={{ fontSize: 11, color: 'var(--fg-4)' }}>{'└'}</span>}
            <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--fg-0)' }}>{child.title}</span>
            <Badge color={deliverableStatusColor[child.status]}>{deliverableStatusLabel[child.status]}</Badge>
          </div>
          <div style={{ display: 'flex', gap: 10, fontSize: 12, color: 'var(--fg-3)', flexWrap: 'wrap' }}>
            <span>{formatCurrency(child.accepted_budget ?? child.max_budget)}</span>
            {child.due_date && <span>Due {formatDate(child.due_date)}</span>}
            {totalTasks > 0 && (
              <span style={{ color: doneTasks === totalTasks ? 'var(--emerald)' : requiredPending > 0 ? 'var(--rose)' : 'var(--fg-3)', fontWeight: 500 }}>
                {doneTasks}/{totalTasks} tasks done
                {requiredPending > 0 && ` · ${requiredPending} required`}
              </span>
            )}
            {child.subChildren.length > 0 && (
              <span style={{ color: allSubChildrenApproved ? 'var(--emerald)' : 'var(--fg-3)', fontWeight: 500 }}>
                {child.subChildren.filter(c => c.status === 'approved').length}/{child.subChildren.length} sub-items approved
              </span>
            )}
          </div>
        </div>
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          {child.status === 'approved' && <span style={{ fontSize: 12, color: 'var(--emerald)', fontWeight: 700 }}>✓ Approved</span>}
          {child.status === 'submitted' && <span style={{ fontSize: 12, color: 'var(--amber)', fontWeight: 600 }}>Awaiting review</span>}
          {canSubmit && (
            <Button size="sm" onClick={() => onOpenSubmit({ id: child.id, title: child.title, tasks: child.tasks })}>Submit</Button>
          )}
          {!isTerminal && child.status !== 'submitted' && !canSubmit && (
            <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>
              {requiredPending > 0 ? `${requiredPending} required task${requiredPending > 1 ? 's' : ''} pending` :
               !allSubChildrenApproved ? 'sub-items pending' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Tasks */}
      {child.tasks.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border-1)', padding: '10px 16px', background: 'var(--bg-2)' }}>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {child.tasks.map(t => (
              <li key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                {t.status === 'done'
                  ? <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--emerald)" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                  : <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke={t.is_required ? 'var(--rose)' : 'var(--border-2)'} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/></svg>
                }
                <span style={{ color: t.status === 'done' ? 'var(--fg-4)' : 'var(--fg-2)', textDecoration: t.status === 'done' ? 'line-through' : 'none' }}>
                  {t.title}
                </span>
                {t.is_required && t.status !== 'done' && (
                  <span style={{ fontSize: 10, color: 'var(--rose)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>required</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* PM Feedback */}
      {latestSubmission?.review_notes && latestSubmission.status === 'revision_requested' && (
        <div style={{ borderTop: '1px solid var(--border-1)', padding: '10px 16px', background: 'var(--amber-soft)', fontSize: 12, color: '#92400E' }}>
          <strong>PM Feedback:</strong> {latestSubmission.review_notes}
        </div>
      )}

      {/* Recursive sub-children */}
      {child.subChildren.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border-1)', padding: '12px 16px', background: 'var(--bg-2)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {child.subChildren.map(sub => (
            <SubDeliverableCard key={sub.id} child={sub} onOpenSubmit={onOpenSubmit} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function TaskChecklist({ tasks }: { tasks: Task[] }) {
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {tasks.map(t => (
        <li key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '6px 0' }}>
          {t.status === 'done'
            ? <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--emerald)" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            : <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke={t.is_required ? 'var(--rose)' : 'var(--border-2)'} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/></svg>
          }
          <span style={{ color: t.status === 'done' ? 'var(--fg-4)' : 'var(--fg-1)', textDecoration: t.status === 'done' ? 'line-through' : 'none' }}>{t.title}</span>
          {t.is_required && t.status !== 'done' && <span style={{ fontSize: 10, color: 'var(--rose)', fontWeight: 700, textTransform: 'uppercase' }}>required</span>}
        </li>
      ))}
    </ul>
  );
}

function AddSubtaskInput({ onAdd }: { onAdd: (title: string) => void }) {
  const [title, setTitle] = useState('');
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onAdd(title.trim());
    setTitle('');
  }
  return (
    <form onSubmit={submit} style={{ display: 'flex', gap: 8 }}>
      <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Add personal note/subtask…" style={{ flex: 1 }} />
      <Button type="submit" size="sm" variant="secondary">Add</Button>
    </form>
  );
}

function SubmitModal({ deliverableId, title, tasks, onClose, onSubmitted }: {
  deliverableId: string; title: string; tasks: Task[]; onClose: () => void; onSubmitted: (s: Submission) => void;
}) {
  const [notes, setNotes] = useState('');
  const [prLinks, setPrLinks] = useState('');
  const [checklist, setChecklist] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(tasks.map(t => [t.id, t.status === 'done']))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function toggleTask(taskId: string) { setChecklist(c => ({ ...c, [taskId]: !c[taskId] })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const prArray = prLinks.split('\n').filter(l => l.trim());
      const s = await deliverablesApi.submit(deliverableId, {
        notes,
        checklist_completion: JSON.stringify(checklist),
        pr_links: JSON.stringify(prArray),
        file_uploads: '[]',
      });
      onSubmitted(s);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to submit');
    } finally {
      setSaving(false);
    }
  }

  const requiredUnchecked = tasks.filter(t => t.is_required && !checklist[t.id]);

  return (
    <Modal title={`Submit: ${title}`} onClose={onClose} footer={
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center', flex: 1 }}>
        {error && <span style={{ fontSize: 12, color: 'var(--rose)', flex: 1 }}>{error}</span>}
        <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
        <Button type="submit" form="submit-review-form" disabled={saving || requiredUnchecked.length > 0}>
          {saving ? 'Submitting…' : 'Submit for Review'}
        </Button>
      </div>
    }>
      <form id="submit-review-form" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {tasks.length > 0 && (
          <div>
            <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Task Completion</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {tasks.map(t => (
                <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!!checklist[t.id]}
                    onChange={() => toggleTask(t.id)}
                    disabled={t.status === 'done'}
                  />
                  <span style={{ textDecoration: checklist[t.id] ? 'line-through' : 'none', color: checklist[t.id] ? 'var(--fg-4)' : 'var(--fg-1)' }}>
                    {t.title}
                  </span>
                  {t.is_required && !checklist[t.id] && (
                    <span style={{ fontSize: 10, color: 'var(--rose)', fontWeight: 700, textTransform: 'uppercase' }}>required</span>
                  )}
                </label>
              ))}
            </div>
            {requiredUnchecked.length > 0 && (
              <p style={{ fontSize: 12, color: 'var(--rose)', marginTop: 8 }}>
                Complete all required tasks before submitting.
              </p>
            )}
          </div>
        )}
        <FormField label="Work Summary">
          <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Describe what you've done and any important notes…" required />
        </FormField>
        <FormField label="PR / Link References (one per line)">
          <Textarea value={prLinks} onChange={e => setPrLinks(e.target.value)} rows={2} placeholder="https://github.com/…" />
        </FormField>
      </form>
    </Modal>
  );
}
