import { useState, useRef, useEffect } from 'react';
import { artifactsApi } from '../../api';
import type { KanbanTask, SubmissionArtifact } from '../../types';
import { useToast } from '../ui';

interface Props {
  task: KanbanTask;
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '7px 10px', borderRadius: 6,
  border: '1px solid var(--border-1)',
  background: 'var(--bg-0)', color: 'var(--fg-1)',
  fontSize: 13, outline: 'none',
  fontFamily: 'var(--font-sans)',
};

const btnPrimary: React.CSSProperties = {
  padding: '6px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
  background: 'var(--kamel-blue)', color: '#fff',
  fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-sans)',
};

const btnSecondary: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 6,
  border: '1px solid var(--border-1)', background: 'transparent',
  color: 'var(--fg-2)', cursor: 'pointer',
  fontSize: 12, fontFamily: 'var(--font-sans)',
};

export function ArtifactSection({ task }: Props) {
  const [artifacts, setArtifacts] = useState<SubmissionArtifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [tab, setTab] = useState<'link' | 'file'>('link');
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState('');
  const [editLabel, setEditLabel] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!task.deliverable_id) return;
    artifactsApi.list(task.deliverable_id)
      .then(all => setArtifacts(all.filter(a => a.task_id === task.id)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [task.id, task.deliverable_id]);

  if (!task.deliverable_id) return null;

  const refresh = () =>
    artifactsApi.list(task.deliverable_id)
      .then(all => setArtifacts(all.filter(a => a.task_id === task.id)))
      .catch(() => {});

  const handleAdd = async () => {
    if (tab === 'link' && !url.trim()) return;
    if (tab === 'file' && !fileRef.current?.files?.[0]) return;
    setSubmitting(true);
    try {
      if (tab === 'link') {
        await artifactsApi.addLink(task.deliverable_id, { url: url.trim(), label: label.trim(), task_id: task.id });
      } else {
        const file = fileRef.current!.files![0];
        await artifactsApi.uploadFile(task.deliverable_id, file, label.trim(), task.id);
      }
      setUrl(''); setLabel('');
      if (fileRef.current) fileRef.current.value = '';
      setShowAdd(false);
      await refresh();
      toast('Artifact added', 'success');
    } catch (e: any) {
      toast(e.message || 'Failed to add artifact', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (a: SubmissionArtifact) => {
    try {
      await artifactsApi.delete(task.deliverable_id, a.id);
      await refresh();
      toast('Artifact removed', 'success');
    } catch (e: any) {
      toast(e.message || 'Failed to remove', 'error');
    }
  };

  const startEdit = (a: SubmissionArtifact) => {
    setEditingId(a.id);
    setEditUrl(a.url);
    setEditLabel(a.label);
  };

  const handleEditSave = async (a: SubmissionArtifact) => {
    if (!editUrl.trim()) return;
    setEditSubmitting(true);
    try {
      // Delete old and re-create with new values (simplest approach — no update endpoint needed)
      await artifactsApi.delete(task.deliverable_id, a.id);
      await artifactsApi.addLink(task.deliverable_id, {
        url: editUrl.trim(),
        label: editLabel.trim(),
        task_id: task.id,
      });
      setEditingId(null);
      await refresh();
      toast('Artifact updated', 'success');
    } catch (e: any) {
      toast(e.message || 'Failed to update', 'error');
    } finally {
      setEditSubmitting(false);
    }
  };

  return (
    <div>
      {/* Existing artifacts */}
      {loading ? (
        <p style={{ fontSize: 12, color: 'var(--fg-4)', margin: '0 0 10px' }}>Loading…</p>
      ) : artifacts.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--fg-4)', margin: '0 0 10px', fontStyle: 'italic' }}>
          No artifacts yet for this task.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {artifacts.map(a => (
            <div key={a.id}>
              {editingId === a.id ? (
                <div style={{
                  background: 'var(--bg-2)', border: '1px solid var(--border-1)',
                  borderRadius: 8, padding: 12,
                  display: 'flex', flexDirection: 'column', gap: 8,
                }}>
                  <input
                    value={editUrl}
                    onChange={e => setEditUrl(e.target.value)}
                    placeholder="URL"
                    style={inputStyle}
                    autoFocus
                  />
                  <input
                    value={editLabel}
                    onChange={e => setEditLabel(e.target.value)}
                    placeholder="Label (optional)"
                    style={inputStyle}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => handleEditSave(a)}
                      disabled={editSubmitting || !editUrl.trim()}
                      style={{ ...btnPrimary, opacity: editSubmitting ? 0.6 : 1 }}
                    >
                      {editSubmitting ? 'Saving…' : 'Save'}
                    </button>
                    <button onClick={() => setEditingId(null)} style={btnSecondary}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px',
                  background: 'var(--bg-2)', border: '1px solid var(--border-1)',
                  borderRadius: 8,
                }}>
                  <span style={{ fontSize: 15, flexShrink: 0 }}>{a.kind === 'link' ? '🔗' : '📎'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <a
                      href={a.url} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 13, color: 'var(--kamel-blue)', fontWeight: 500, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {a.label || (a.kind === 'file' ? a.url.split('/').pop() : a.url)}
                    </a>
                    {a.label && (
                      <span style={{ fontSize: 11, color: 'var(--fg-4)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.url}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    {a.kind === 'link' && (
                      <button
                        onClick={() => startEdit(a)}
                        title="Edit"
                        style={{
                          padding: '3px 8px', borderRadius: 5, fontSize: 11,
                          border: '1px solid var(--border-1)', background: 'transparent',
                          color: 'var(--fg-3)', cursor: 'pointer',
                        }}
                      >
                        Edit
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(a)}
                      title="Remove"
                      style={{
                        padding: '3px 8px', borderRadius: 5, fontSize: 11,
                        border: '1px solid var(--rose-soft, #fee2e2)', background: 'var(--rose-soft, #fee2e2)',
                        color: 'var(--rose)', cursor: 'pointer',
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      {showAdd ? (
        <div style={{
          background: 'var(--bg-2)', border: '1px solid var(--border-1)',
          borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          {/* Tab */}
          <div style={{ display: 'flex', background: 'var(--bg-1)', borderRadius: 6, padding: 3, gap: 2 }}>
            {(['link', 'file'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  flex: 1, padding: '4px 0', borderRadius: 5, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-sans)',
                  background: tab === t ? 'var(--kamel-blue)' : 'transparent',
                  color: tab === t ? '#fff' : 'var(--fg-3)',
                  transition: 'all 0.12s',
                }}
              >
                {t === 'link' ? '🔗 Link' : '📎 File'}
              </button>
            ))}
          </div>

          {tab === 'link' ? (
            <>
              <input
                placeholder="https://github.com/…"
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                autoFocus
                style={inputStyle}
              />
              <input
                placeholder="Label (optional)"
                value={label}
                onChange={e => setLabel(e.target.value)}
                style={inputStyle}
              />
            </>
          ) : (
            <>
              <input ref={fileRef} type="file" style={{ fontSize: 13, color: 'var(--fg-1)' }} />
              <input
                placeholder="Label (optional)"
                value={label}
                onChange={e => setLabel(e.target.value)}
                style={inputStyle}
              />
            </>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleAdd}
              disabled={submitting || (tab === 'link' && !url.trim())}
              style={{ ...btnPrimary, opacity: submitting || (tab === 'link' && !url.trim()) ? 0.5 : 1 }}
            >
              {submitting ? (tab === 'link' ? 'Saving…' : 'Uploading…') : (tab === 'link' ? 'Add Link' : 'Upload File')}
            </button>
            <button onClick={() => { setShowAdd(false); setUrl(''); setLabel(''); }} style={btnSecondary}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => { setTab('link'); setShowAdd(true); }}
            style={{
              ...btnSecondary,
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 14px',
            }}
          >
            <span>🔗</span> Add Link
          </button>
          <button
            onClick={() => { setTab('file'); setShowAdd(true); }}
            style={{
              ...btnSecondary,
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 14px',
            }}
          >
            <span>📎</span> Upload File
          </button>
        </div>
      )}
    </div>
  );
}

// Keep old name as alias so KanbanPage import still works
export { ArtifactSection as AddToSubmissionButton };
