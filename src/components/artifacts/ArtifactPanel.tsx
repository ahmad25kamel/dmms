import { useState, useEffect, useRef } from 'react';
import { artifactsApi } from '../../api';
import type { SubmissionArtifact, Task } from '../../types';
import { useToast } from '../ui';

interface Props {
  deliverableId: string;
  tasks: Task[];
  readOnly?: boolean;
  onArtifactsChange?: (artifacts: SubmissionArtifact[]) => void;
}

export function ArtifactPanel({ deliverableId, tasks, readOnly, onArtifactsChange }: Props) {
  const [artifacts, setArtifacts] = useState<SubmissionArtifact[]>([]);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [showFileForm, setShowFileForm] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [linkTaskId, setLinkTaskId] = useState('');
  const [fileLabel, setFileLabel] = useState('');
  const [fileTaskId, setFileTaskId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    artifactsApi.list(deliverableId).then((items: SubmissionArtifact[]) => {
      setArtifacts(items);
      onArtifactsChange?.(items);
    }).catch(() => {});
  }, [deliverableId]);

  const refresh = async () => {
    const items = await artifactsApi.list(deliverableId);
    setArtifacts(items);
    onArtifactsChange?.(items);
  };

  const handleAddLink = async () => {
    if (!linkUrl.trim()) return;
    setSubmitting(true);
    try {
      await artifactsApi.addLink(deliverableId, {
        url: linkUrl.trim(),
        label: linkLabel.trim(),
        task_id: linkTaskId || undefined,
      });
      setLinkUrl('');
      setLinkLabel('');
      setLinkTaskId('');
      setShowLinkForm(false);
      await refresh();
      toast('Link added to submission artifacts', 'success');
    } catch (e: any) {
      toast(e.message || 'Failed to add link', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadFile = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setSubmitting(true);
    try {
      await artifactsApi.uploadFile(deliverableId, file, fileLabel.trim(), fileTaskId || undefined);
      setFileLabel('');
      setFileTaskId('');
      setShowFileForm(false);
      if (fileRef.current) fileRef.current.value = '';
      await refresh();
      toast('File added to submission artifacts', 'success');
    } catch (e: any) {
      toast(e.message || 'Failed to upload file', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (artifact: SubmissionArtifact) => {
    try {
      await artifactsApi.delete(deliverableId, artifact.id);
      await refresh();
      toast('Artifact removed', 'success');
    } catch (e: any) {
      toast(e.message || 'Failed to remove artifact', 'error');
    }
  };

  // Group artifacts by task
  const grouped = new Map<string, { title: string; items: SubmissionArtifact[] }>();
  for (const a of artifacts) {
    const key = a.task_id || '__general__';
    const title = a.task_title || (a.task_id ? `Task ${a.task_id.slice(0, 6)}` : 'General');
    if (!grouped.has(key)) grouped.set(key, { title, items: [] });
    grouped.get(key)!.items.push(a);
  }

  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 16, marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
          Submission Artifacts
          {artifacts.length > 0 && (
            <span style={{
              marginLeft: 8, background: 'var(--color-primary)', color: '#fff',
              borderRadius: 10, padding: '1px 7px', fontSize: 11
            }}>{artifacts.length}</span>
          )}
        </h4>
        {!readOnly && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => { setShowLinkForm(v => !v); setShowFileForm(false); }}
              style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer' }}
            >
              + Link
            </button>
            <button
              onClick={() => { setShowFileForm(v => !v); setShowLinkForm(false); }}
              style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer' }}
            >
              + File
            </button>
          </div>
        )}
      </div>

      {showLinkForm && !readOnly && (
        <div style={{ background: 'var(--color-surface)', borderRadius: 8, padding: 12, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            placeholder="URL (e.g. https://github.com/...)"
            value={linkUrl}
            onChange={e => setLinkUrl(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: 13, width: '100%', boxSizing: 'border-box' }}
          />
          <input
            placeholder="Label (optional)"
            value={linkLabel}
            onChange={e => setLinkLabel(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: 13, width: '100%', boxSizing: 'border-box' }}
          />
          <select
            value={linkTaskId}
            onChange={e => setLinkTaskId(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: 13 }}
          >
            <option value="">— No specific task (General) —</option>
            {tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleAddLink}
              disabled={submitting || !linkUrl.trim()}
              style={{ padding: '6px 14px', borderRadius: 6, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13 }}
            >
              {submitting ? 'Saving…' : 'Add Link'}
            </button>
            <button
              onClick={() => setShowLinkForm(false)}
              style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer', fontSize: 13 }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showFileForm && !readOnly && (
        <div style={{ background: 'var(--color-surface)', borderRadius: 8, padding: 12, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input ref={fileRef} type="file" style={{ fontSize: 13 }} />
          <input
            placeholder="Label (optional)"
            value={fileLabel}
            onChange={e => setFileLabel(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: 13, width: '100%', boxSizing: 'border-box' }}
          />
          <select
            value={fileTaskId}
            onChange={e => setFileTaskId(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: 13 }}
          >
            <option value="">— No specific task (General) —</option>
            {tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleUploadFile}
              disabled={submitting}
              style={{ padding: '6px 14px', borderRadius: 6, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13 }}
            >
              {submitting ? 'Uploading…' : 'Upload File'}
            </button>
            <button
              onClick={() => setShowFileForm(false)}
              style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer', fontSize: 13 }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {artifacts.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0, textAlign: 'center', padding: '12px 0' }}>
          {readOnly ? 'No artifacts attached.' : 'No artifacts yet. Add links or files as you complete each task.'}
        </p>
      ) : (
        Array.from(grouped.entries()).map(([key, group]) => (
          <div key={key} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', marginBottom: 6 }}>
              {group.title}
            </div>
            {group.items.map(a => (
              <div key={a.id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 0', borderBottom: '1px solid var(--color-border)'
              }}>
                <span style={{ fontSize: 14 }}>{a.kind === 'link' ? '🔗' : '📎'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {a.kind === 'link' ? (
                    <a href={a.url} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 13, color: 'var(--color-primary)', wordBreak: 'break-all' }}>
                      {a.label || a.url}
                    </a>
                  ) : (
                    <a href={a.url} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 13, color: 'var(--color-primary)' }}>
                      {a.label || a.url.split('/').pop()}
                    </a>
                  )}
                  {a.label && a.kind === 'link' && (
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', wordBreak: 'break-all' }}>{a.url}</div>
                  )}
                </div>
                {!readOnly && (
                  <button
                    onClick={() => handleDelete(a)}
                    title="Remove artifact"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger, #ef4444)', fontSize: 14, padding: 2 }}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
