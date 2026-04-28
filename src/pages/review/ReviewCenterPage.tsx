import { useEffect, useState } from 'react';
import { submissionsApi } from '../../api';
import type { Submission } from '../../types';
import { Badge, Button, Textarea, Modal, FormField, Spinner, EmptyState } from '../../components/ui';
import { formatDate, submissionStatusColor } from '../../lib/statusColors';

export function ReviewCenterPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Submission | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [acting, setActing] = useState(false);

  useEffect(() => {
    submissionsApi.pending().then(setSubmissions).finally(() => setLoading(false));
  }, []);

  async function approve(id: string) {
    setActing(true);
    try {
      await submissionsApi.approve(id);
      setSubmissions(ss => ss.filter(s => s.id !== id));
      setSelected(null);
    } finally { setActing(false); }
  }

  async function requestRevision(id: string) {
    setActing(true);
    try {
      await submissionsApi.requestRevision(id, reviewNotes);
      setSubmissions(ss => ss.filter(s => s.id !== id));
      setSelected(null);
      setReviewNotes('');
    } finally { setActing(false); }
  }

  async function reject(id: string) {
    setActing(true);
    try {
      await submissionsApi.reject(id, reviewNotes);
      setSubmissions(ss => ss.filter(s => s.id !== id));
      setSelected(null);
      setReviewNotes('');
    } finally { setActing(false); }
  }

  if (loading) return <Spinner />;

  return (
    <div className="dmms-page">
      <div className="dmms-page-head">
        <div>
          <h1>Review Center</h1>
          <p className="dmms-page-sub">{submissions.length} pending review{submissions.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {submissions.length === 0 ? (
        <EmptyState title="No pending reviews" description="All submissions have been reviewed." />
      ) : (
        <ul className="dmms-feed">
          {submissions.map(s => (
            <li key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontWeight: 500 }}>Submission</span>
                  <Badge color={submissionStatusColor[s.status]}>{s.status}</Badge>
                </div>
                <p className="meta">Submitted {formatDate(s.submitted_at)}</p>
                {s.notes && <p className="body-sm" style={{ marginTop: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{s.notes}</p>}
              </div>
              <Button size="sm" variant="secondary" onClick={() => setSelected(s)}>Review</Button>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <Modal title="Review Submission" onClose={() => setSelected(null)} footer={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={() => approve(selected.id)} disabled={acting} style={{ flex: 1, justifyContent: 'center' }}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              Approve
            </Button>
            <Button variant="secondary" onClick={() => requestRevision(selected.id)} disabled={acting} style={{ flex: 1, justifyContent: 'center' }}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
              Revision
            </Button>
            <Button variant="danger" onClick={() => reject(selected.id)} disabled={acting} style={{ flex: 1, justifyContent: 'center' }}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              Reject
            </Button>
          </div>
        }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Contributor Notes</p>
              <p className="body-sm">{selected.notes || '(no notes)'}</p>
            </div>
            {selected.pr_links && selected.pr_links !== '[]' && (
              <div>
                <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>PR Links</p>
                {JSON.parse(selected.pr_links).map((link: string, i: number) => (
                  <a key={i} href={link} target="_blank" rel="noopener noreferrer" style={{ display: 'block', fontSize: 13, marginTop: 2 }}>{link}</a>
                ))}
              </div>
            )}
            <FormField label="Review Notes (optional)">
              <Textarea value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} rows={3} placeholder="Feedback for the contributor…" />
            </FormField>
          </div>
        </Modal>
      )}
    </div>
  );
}
