import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { deliverablesApi } from '../../api';
import type { Deliverable, Task, Subtask, Submission } from '../../types';
import { Card, Badge, Button, Input, Textarea, FormField, Spinner, Modal } from '../../components/ui';
import { formatCurrency, formatDate, deliverableStatusColor, deliverableStatusLabel } from '../../lib/statusColors';

export function WorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const [deliverable, setDeliverable] = useState<Deliverable | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [subtasks, setSubtasks] = useState<Task[]>([]); // Unified type
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSubmit, setShowSubmit] = useState(false);

  async function load() {
    if (!id) return;
    try {
      const [d, t, s, sub] = await Promise.all([
        deliverablesApi.get(id),
        deliverablesApi.listTasks(id),
        deliverablesApi.listSubtasks(id),
        deliverablesApi.getSubmission(id).catch(() => null),
      ]);
      setDeliverable(d);
      setTasks(t);
      setSubtasks(s);
      setSubmission(sub);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function addSubtask(title: string) {
    const s = await deliverablesApi.createSubtask(id!, { title, position: subtasks.length });
    setSubtasks(ss => [...ss, s]);
  }

  async function toggleSubtask(task: Task) {
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    await deliverablesApi.updateSubtask(id!, task.id, { ...task, status: newStatus });
    setSubtasks(ss => ss.map(s => s.id === task.id ? { ...s, status: newStatus } : s));
  }

  if (loading) return <Spinner />;
  if (!deliverable) return <div className="dmms-page"><p className="body-sm">Deliverable not found</p></div>;

  const doneCount = subtasks.filter(s => s.status === 'done').length;

  return (
    <div className="dmms-page" style={{ maxWidth: 760 }}>
      <div className="dmms-page-head">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h1 style={{ margin: 0 }}>{deliverable.title}</h1>
            <Badge color={deliverableStatusColor[deliverable.status]}>{deliverableStatusLabel[deliverable.status]}</Badge>
          </div>
          <p className="dmms-page-sub">
            Budget {formatCurrency(deliverable.accepted_budget ?? deliverable.max_budget)}
            {deliverable.due_date ? ` · Due ${formatDate(deliverable.due_date)}` : ''}
          </p>
        </div>
      </div>

      {deliverable.brief && (
        <Card>
          <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Brief</p>
          <p className="body-sm">{deliverable.brief}</p>
        </Card>
      )}

      {tasks.length > 0 && (
        <Card>
          <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Acceptance Checklist</p>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tasks.map(t => (
              <li key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--fg-2)' }}>
                <span style={{ width: 14, height: 14, borderRadius: 3, border: '1.5px solid var(--border-2)', flexShrink: 0 }} />
                {t.title}
                {t.is_required && <span style={{ color: 'var(--rose)', fontSize: 11 }}>*</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <div className="dmms-row-between" style={{ marginBottom: 10 }}>
          <p style={{ fontWeight: 600, fontSize: 13 }}>My Subtasks ({doneCount}/{subtasks.length})</p>
        </div>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {subtasks.map(s => (
            <li key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={() => toggleSubtask(s)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                {s.status === 'done'
                  ? <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--emerald)" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><polyline points="9 12 11 14 15 10"/></svg>
                  : <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--border-2)" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
                }
              </button>
              <span style={{ fontSize: 13, color: s.status === 'done' ? 'var(--fg-4)' : 'var(--fg-2)', textDecoration: s.status === 'done' ? 'line-through' : 'none' }}>{s.title}</span>
            </li>
          ))}
        </ul>
        <AddSubtaskInput onAdd={addSubtask} />
      </Card>

      {submission ? (
        <Card>
          <p style={{ fontWeight: 600, fontSize: 13 }}>Submission — <span style={{ textTransform: 'capitalize' }}>{submission.status}</span></p>
          <p className="body-sm" style={{ marginTop: 4 }}>{submission.notes}</p>
          {submission.review_notes && (
            <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--amber-soft)', borderRadius: 'var(--radius-sm)', fontSize: 13, color: '#92400E' }}>
              <strong>PM Feedback:</strong> {submission.review_notes}
            </div>
          )}
        </Card>
      ) : (
        deliverable.status !== 'approved' && deliverable.status !== 'cancelled' && deliverable.status !== 'rejected' && (
          <Button onClick={() => setShowSubmit(true)}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            Submit for Review
          </Button>
        )
      )}

      {showSubmit && (
        <SubmitModal
          deliverableId={id!}
          tasks={tasks}
          onClose={() => setShowSubmit(false)}
          onSubmitted={(s) => { setSubmission(s); setShowSubmit(false); }}
        />
      )}
    </div>
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
      <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Add subtask…" style={{ flex: 1 }} />
      <Button type="submit" size="sm" variant="secondary">Add</Button>
    </form>
  );
}

function SubmitModal({ deliverableId, tasks, onClose, onSubmitted }: {
  deliverableId: string; tasks: Task[]; onClose: () => void; onSubmitted: (s: Submission) => void;
}) {
  const [notes, setNotes] = useState('');
  const [prLinks, setPrLinks] = useState('');
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  function toggleTask(id: string) { setChecklist(c => ({ ...c, [id]: !c[id] })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const prArray = prLinks.split('\n').filter(l => l.trim());
      const s = await deliverablesApi.submit(deliverableId, {
        notes,
        checklist_completion: JSON.stringify(checklist),
        pr_links: JSON.stringify(prArray),
        file_uploads: '[]',
      });
      onSubmitted(s);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Submit for Review" onClose={onClose} footer={
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
        <Button type="submit" form="submit-review-form" disabled={saving}>{saving ? 'Submitting…' : 'Submit'}</Button>
      </div>
    }>
      <form id="submit-review-form" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <FormField label="Notes">
          <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Describe your work…" />
        </FormField>
        {tasks.length > 0 && (
          <div>
            <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Checklist</p>
            {tasks.map(t => (
              <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', padding: '4px 0' }}>
                <input type="checkbox" checked={!!checklist[t.id]} onChange={() => toggleTask(t.id)} />
                {t.title}
              </label>
            ))}
          </div>
        )}
        <FormField label="PR Links (one per line)">
          <Textarea value={prLinks} onChange={e => setPrLinks(e.target.value)} rows={2} placeholder="https://github.com/…" />
        </FormField>
      </form>
    </Modal>
  );
}
