import { useEffect, useState } from 'react';
import { proposalsApi } from '../../api';
import type { Proposal } from '../../types';
import { Badge, Button, Spinner, EmptyState, Modal, FormField, Input, Textarea } from '../../components/ui';
import { formatCurrency, formatDate, proposalStatusColor } from '../../lib/statusColors';

export function ProposalsPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [editProposal, setEditProposal] = useState<Proposal | null>(null);

  useEffect(() => {
    proposalsApi.mine().then(setProposals).finally(() => setLoading(false));
  }, []);

  async function withdraw(id: string) {
    await proposalsApi.withdraw(id);
    setProposals(ps => ps.map(p => p.id === id ? { ...p, status: 'withdrawn' } : p));
  }

  async function saveRevision(id: string, bid_amount: number, message: string) {
    await proposalsApi.revise(id, { bid_amount, message });
    setProposals(ps => ps.map(p => p.id === id ? { ...p, bid_amount, message } : p));
    setEditProposal(null);
  }

  if (loading) return <Spinner />;

  return (
    <div className="dmms-page">
      <div className="dmms-page-head">
        <div>
          <h1>My Proposals</h1>
          <p className="dmms-page-sub">{proposals.length} proposal{proposals.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {proposals.length === 0 ? (
        <EmptyState title="No proposals yet" description="Browse the marketplace and submit bids to get started." />
      ) : (
        <ul className="dmms-feed">
          {proposals.map(p => (
            <li key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>{formatCurrency(p.bid_amount)}</span>
                  <Badge color={proposalStatusColor[p.status]}>{p.status}</Badge>
                </div>
                {p.message && <p className="body-sm">{p.message}</p>}
                <p className="meta">Submitted {formatDate(p.created_at)}{p.eta_date ? ` · ETA ${formatDate(p.eta_date)}` : ''}</p>
              </div>
              {p.status === 'pending' && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <Button size="sm" variant="secondary" onClick={() => setEditProposal(p)}>Edit</Button>
                  <Button size="sm" variant="danger" onClick={() => withdraw(p.id)}>Withdraw</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {editProposal && (
        <ReviseModal
          proposal={editProposal}
          onClose={() => setEditProposal(null)}
          onSave={saveRevision}
        />
      )}
    </div>
  );
}

function ReviseModal({ proposal, onClose, onSave }: {
  proposal: Proposal;
  onClose: () => void;
  onSave: (id: string, bid_amount: number, message: string) => Promise<void>;
}) {
  const [bidAmount, setBidAmount] = useState(String(proposal.bid_amount));
  const [message, setMessage] = useState(proposal.message || '');
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(proposal.id, parseFloat(bidAmount) || 0, message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Edit Proposal" onClose={onClose} footer={
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
        <Button type="submit" form="revise-proposal-form" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
      </div>
    }>
      <form id="revise-proposal-form" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <FormField label="Bid Amount ($)">
          <Input type="number" value={bidAmount} onChange={e => setBidAmount(e.target.value)} min="0.01" step="0.01" required />
        </FormField>
        <FormField label="Message">
          <Textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} placeholder="Why are you the right fit?" />
        </FormField>
      </form>
    </Modal>
  );
}
