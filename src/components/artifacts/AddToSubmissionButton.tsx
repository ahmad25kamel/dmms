import { useState, useRef } from 'react';
import { artifactsApi } from '../../api';
import type { KanbanTask } from '../../types';
import { useToast } from '../ui';

interface Props {
  task: KanbanTask;
  onAdded?: () => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '7px 10px', borderRadius: 6,
  border: '1px solid var(--border-1)', background: 'var(--bg-0)',
  fontSize: 13, color: 'var(--fg-1)', outline: 'none',
};

export function AddToSubmissionButton({ task, onAdded }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'link' | 'file'>('link');
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  if (!task.deliverable_id) return null;

  const reset = () => { setUrl(''); setLabel(''); if (fileRef.current) fileRef.current.value = ''; };

  const handleAddLink = async () => {
    if (!url.trim()) return;
    setSubmitting(true);
    try {
      await artifactsApi.addLink(task.deliverable_id, {
        url: url.trim(), label: label.trim(), task_id: task.id,
      });
      reset();
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
      reset();
      setOpen(false);
      toast('File added to submission artifacts', 'success');
      onAdded?.();
    } catch (e: any) {
      toast(e.message || 'Failed to upload file', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => { setTab('link'); setOpen(true); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: 'pointer',
            border: '1px solid var(--border-1)', background: 'var(--bg-1)', color: 'var(--fg-1)',
          }}
        >
          <span>🔗</span> Add Link
        </button>
        <button
          onClick={() => { setTab('file'); setOpen(true); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: 'pointer',
            border: '1px solid var(--border-1)', background: 'var(--bg-1)', color: 'var(--fg-1)',
          }}
        >
          <span>📎</span> Upload File
        </button>
      </div>
    );
  }

  return (
    <div style={{
      background: 'var(--bg-1)', border: '1px solid var(--border-1)',
      borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 0, borderRadius: 7, overflow: 'hidden', border: '1px solid var(--border-1)', alignSelf: 'flex-start' }}>
        {(['link', 'file'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '5px 16px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              background: tab === t ? 'var(--kamel-blue)' : 'transparent',
              color: tab === t ? '#fff' : 'var(--fg-3)',
              transition: 'all 0.15s',
            }}
          >
            {t === 'link' ? '🔗 Link' : '📎 File'}
          </button>
        ))}
      </div>

      {tab === 'link' ? (
        <>
          <input
            placeholder="URL — e.g. https://github.com/org/repo/pull/42"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddLink()}
            autoFocus
            style={inputStyle}
          />
          <input
            placeholder="Label (optional) — e.g. Auth module PR"
            value={label}
            onChange={e => setLabel(e.target.value)}
            style={inputStyle}
          />
        </>
      ) : (
        <>
          <input
            ref={fileRef}
            type="file"
            style={{ fontSize: 13, color: 'var(--fg-1)' }}
          />
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
          onClick={tab === 'link' ? handleAddLink : handleUploadFile}
          disabled={submitting || (tab === 'link' && !url.trim())}
          style={{
            padding: '7px 18px', borderRadius: 7, border: 'none', cursor: 'pointer',
            background: 'var(--kamel-blue)', color: '#fff', fontSize: 13, fontWeight: 600,
            opacity: submitting || (tab === 'link' && !url.trim()) ? 0.5 : 1,
          }}
        >
          {submitting ? (tab === 'link' ? 'Saving…' : 'Uploading…') : (tab === 'link' ? 'Add Link' : 'Upload File')}
        </button>
        <button
          onClick={() => { reset(); setOpen(false); }}
          style={{
            padding: '7px 14px', borderRadius: 7, border: '1px solid var(--border-1)',
            background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--fg-3)',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
