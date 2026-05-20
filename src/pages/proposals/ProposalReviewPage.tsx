import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { proposalsApi, deliverablesApi } from '../../api';
import type { Proposal, Deliverable } from '../../types';
import { Badge, Button, Spinner, EmptyState, Modal, Textarea } from '../../components/ui';
import { formatCurrency, formatDate, proposalStatusColor } from '../../lib/statusColors';

export function ProposalReviewPage() {
  const { deliverableId } = useParams<{ deliverableId: string }>();
  const [deliverable, setDeliverable] = useState<Deliverable | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [pendingAcceptId, setPendingAcceptId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Proposal | null>(null);
  const [rejectMessage, setRejectMessage] = useState('');

  const childCount = deliverable?.children?.length ?? 0;

  useEffect(() => {
    if (!deliverableId) return;
    Promise.all([deliverablesApi.get(deliverableId), proposalsApi.list(deliverableId)])
      .then(([d, p]) => { setDeliverable(d); setProposals(p); })
      .finally(() => setLoading(false));
  }, [deliverableId]);

  function tryAccept(id: string) {
    if (childCount > 0) {
      setPendingAcceptId(id);
    } else {
      doAccept(id);
    }
  }

  async function doAccept(id: string) {
    setPendingAcceptId(null);
    setActing(true);
    try {
      await proposalsApi.accept(id);
      setProposals(ps => ps.map(p => ({
        ...p,
        status: p.id === id ? 'accepted' : p.status === 'pending' ? 'rejected' : p.status,
      })));
    } finally { setActing(false); }
  }

  function openReject(proposal: Proposal) {
    setRejectTarget(proposal);
    setRejectMessage('');
  }

  async function doReject() {
    if (!rejectTarget) return;
    setActing(true);
    try {
      await proposalsApi.reject(rejectTarget.id, rejectMessage);
      setProposals(ps => ps.map(p => p.id === rejectTarget.id ? { ...p, status: 'rejected', rejection_message: rejectMessage } : p));
      setRejectTarget(null);
    } finally { setActing(false); }
  }

  if (loading) return <Spinner />;

  return (
    <div className="dmms-page" style={{ maxWidth: 680 }}>
      <div className="dmms-page-head">
        <div>
          <h1>Proposals</h1>
          {deliverable && (() => {
            const acceptedProposal = proposals.find(p => p.status === 'accepted');
            const acceptedAmount = acceptedProposal?.bid_amount ?? 0;
            const remaining = deliverable.max_budget - acceptedAmount;
            return (
              <p className="dmms-page-sub">
                {deliverable.title} · Max {formatCurrency(deliverable.max_budget)}
                {' · '}
                <span style={{ color: acceptedAmount > 0 ? 'var(--emerald)' : 'var(--fg-3)', fontWeight: 600 }}>
                  {formatCurrency(remaining)} remaining
                </span>
              </p>
            );
          })()}
        </div>
      </div>

      {proposals.length === 0 ? (
        <EmptyState title="No proposals yet" description="Proposals will appear here when contributors bid." />
      ) : (
        <ul className="dmms-feed">
          {proposals.map(p => (
            <li key={p.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>{p.contributor_name}</span>
                  <Badge color={proposalStatusColor[p.status]}>{p.status}</Badge>
                </div>
                <div style={{ display: 'flex', gap: 12, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, color: 'var(--kamel-blue)', fontSize: 14 }}>{formatCurrency(p.bid_amount)}</span>
                  {p.eta_date && <span className="meta">ETA {formatDate(p.eta_date)}</span>}
                </div>
                {p.message && <p className="body-sm">{p.message}</p>}
                {p.status === 'rejected' && p.rejection_message && (
                  <p style={{ fontSize: 12, color: 'var(--rose)', marginTop: 4, padding: '6px 10px', background: 'color-mix(in srgb, var(--rose) 8%, transparent)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--rose)' }}>
                    Rejection reason: {p.rejection_message}
                  </p>
                )}
                <p className="meta" style={{ marginTop: 2 }}>{formatDate(p.created_at)}</p>
              </div>
              {p.status === 'pending' && (
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <Button size="sm" onClick={() => tryAccept(p.id)} disabled={acting}>Accept</Button>
                  <Button size="sm" variant="secondary" onClick={() => openReject(p)} disabled={acting}>Reject</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

    {pendingAcceptId && (
      <Modal title="Accept proposal?" onClose={() => setPendingAcceptId(null)} footer={
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => setPendingAcceptId(null)}>Cancel</Button>
          <Button onClick={() => doAccept(pendingAcceptId)}>Accept Anyway</Button>
        </div>
      }>
        <p>This deliverable has <strong>{childCount}</strong> child deliverable{childCount !== 1 ? 's' : ''}. Accepting this proposal will also assign them all to the same contributor without a separate bidding process.</p>
      </Modal>
    )}

    {rejectTarget && (
      <Modal title="Reject proposal" onClose={() => setRejectTarget(null)} footer={
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => setRejectTarget(null)}>Cancel</Button>
          <Button variant="danger" onClick={doReject} disabled={acting}>Reject</Button>
        </div>
      }>
        <p style={{ marginBottom: 12 }}>Rejecting <strong>{rejectTarget.contributor_name}</strong>'s bid of <strong>{formatCurrency(rejectTarget.bid_amount)}</strong>.</p>
        <Textarea
          value={rejectMessage}
          onChange={e => setRejectMessage(e.target.value)}
          rows={3}
          placeholder="Reason for rejection (optional — shown to contributor)"
        />
      </Modal>
    )}
    </div>
  );
}
