import { useState, useRef } from 'react';
import { artifactsApi } from '../../api';
import type { KanbanTask } from '../../types';
import { useToast } from '../ui';

interface Props {
  task: KanbanTask;
  onAdded?: () => void;
}

export function AddToSubmissionButton({ task, onAdded }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'link' | 'file'>('link');
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  if (!task.deliverable_id) return null;

  const handleAddLink = async () => {
    if (!url.trim()) return;
    setSubmitting(true);
    try {
      await artifactsApi.addLink(task.deliverable_id, {
        url: url.trim(),
        label: label.trim(),
        task_id: task.id,
      });
      setUrl('');
      setLabel('');
      setOpen(false);
      toast('Link added to submission artifacts', 'success');
      onAdded?.();
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
      await artifactsApi.uploadFile(task.deliverable_id, file, label.trim(), task.id);
      setLabel('');
      if (fileRef.current) fileRef.current.value = '';
      setOpen(false);
      toast('File added to submission artifacts', 'success');
      onAdded?.();
    } catch (e: any) {
      toast(e.message || 'Failed to upload file', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(v => !v)}
        title="Add link or file to submission artifacts"
        style={{
          fontSize: 11, padding: '2px 8px', borderRadius: 5,
          border: '1px solid var(--color-primary)',
          color: 'var(--color-primary)', background: 'transparent', cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        + Artifact
      </button>

      {open && (
        <div style={{
          position: 'absolute', bottom: '110%', left: 0, zIndex: 100,
          background: 'var(--color-bg, #fff)', border: '1px solid var(--color-border)',
          borderRadius: 10, padding: 14, width: 300, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        }}>
          <div style={{ display: 'flex', gap: 0, marginBottom: 12, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
            {(['link', 'file'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  flex: 1, padding: '5px 0', border: 'none', cursor: 'pointer', fontSize: 12,
                  background: tab === t ? 'var(--color-primary)' : 'transparent',
                  color: tab === t ? '#fff' : 'inherit',
                  fontWeight: tab === t ? 600 : 400,
                }}
              >
                {t === 'link' ? '🔗 Link' : '📎 File'}
              </button>
            ))}
          </div>

          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 8 }}>
            Task: <strong>{task.title}</strong>
          </div>

          {tab === 'link' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                placeholder="URL (e.g. https://github.com/...)"
                value={url}
                onChange={e => setUrl(e.target.value)}
                autoFocus
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: 13, width: '100%', boxSizing: 'border-box' }}
              />
              <input
                placeholder="Label (optional)"
                value={label}
                onChange={e => setLabel(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: 13, width: '100%', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleAddLink}
                  disabled={submitting || !url.trim()}
                  style={{ flex: 1, padding: '6px 0', borderRadius: 6, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13 }}
                >
                  {submitting ? 'Saving…' : 'Add Link'}
                </button>
                <button
                  onClick={() => setOpen(false)}
                  style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer', fontSize: 13 }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input ref={fileRef} type="file" style={{ fontSize: 12 }} />
              <input
                placeholder="Label (optional)"
                value={label}
                onChange={e => setLabel(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: 13, width: '100%', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleUploadFile}
                  disabled={submitting}
                  style={{ flex: 1, padding: '6px 0', borderRadius: 6, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13 }}
                >
                  {submitting ? 'Uploading…' : 'Upload File'}
                </button>
                <button
                  onClick={() => setOpen(false)}
                  style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer', fontSize: 13 }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
