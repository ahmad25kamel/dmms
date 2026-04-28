import { useEffect, useState } from 'react';
import { marketplaceApi, proposalsApi, deliverablesApi } from '../../api';
import type { Deliverable, Task } from '../../types';
import { Card, Badge, Button, Modal, FormField, Input, Textarea, Spinner, EmptyState, Alert } from '../../components/ui';
import { formatCurrency, formatDate, deliverableStatusColor } from '../../lib/statusColors';
import { useAuth } from '../../store/authStore';

export function MarketplacePage() {
  const { user } = useAuth();
  const [bids, setBids] = useState<Deliverable[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Deliverable | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    marketplaceApi.listBids().then(setBids).finally(() => setLoading(false));
  }, []);

  async function openDetail(d: Deliverable) {
    setSelected(d);
    const t = await deliverablesApi.listTasks(d.id).catch(() => []);
    setTasks(t);
  }

  if (loading) return <Spinner />;

  return (
    <div className="dmms-page">
      <div className="dmms-page-head">
        <div>
          <h1>Marketplace</h1>
          <p className="dmms-page-sub">{bids.length} open bid{bids.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {bids.length === 0 ? (
        <EmptyState title="No open bids" description="There are no deliverables open for bidding right now." />
      ) : (
        <div className="dmms-grid dmms-grid-auto">
          {bids.map(d => (
            <Card key={d.id}>
              <div style={{ marginBottom: 8 }}>
                {d.project_name && <p className="eyebrow" style={{ marginBottom: 4 }}>{d.project_name}</p>}
                <h4 style={{ marginBottom: 4 }}>{d.title}</h4>
                {d.brief && <p className="body-sm" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{d.brief}</p>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <span style={{ color: 'var(--emerald)', fontWeight: 600, fontSize: 13 }}>Up to {formatCurrency(d.max_budget)}</span>
                {d.due_date && <span className="meta">{formatDate(d.due_date)}</span>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button size="sm" variant="secondary" onClick={() => openDetail(d)}>Details</Button>
                {user?.role === 'contributor' && <BidButton deliverable={d} />}
              </div>
            </Card>
          ))}
        </div>
      )}

      {selected && (
        <BidDetailModal
          deliverable={selected}
          tasks={tasks}
          userRole={user?.role}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function BidButton({ deliverable }: { deliverable: Deliverable }) {
  const [show, setShow] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setShow(true)}>Place Bid</Button>
      {show && <ProposalForm deliverable={deliverable} onClose={() => setShow(false)} />}
    </>
  );
}

function ProposalForm({ deliverable, onClose }: { deliverable: Deliverable; onClose: () => void }) {
  const [bid, setBid] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(bid);
    if (amount > deliverable.max_budget) {
      setError(`Bid cannot exceed ${formatCurrency(deliverable.max_budget)}`);
      return;
    }
    setSaving(true);
    try {
      await proposalsApi.submit(deliverable.id, { bid_amount: amount, message });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit bid');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`Bid on: ${deliverable.title}`} onClose={onClose}>
      {done ? (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <p style={{ color: 'var(--emerald)', fontWeight: 600, fontSize: 16 }}>Bid submitted!</p>
          <p className="body-sm" style={{ marginTop: 4 }}>The PM will review your proposal.</p>
          <Button style={{ marginTop: 16 }} onClick={onClose}>Close</Button>
        </div>
      ) : (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p className="body-sm">Max budget: <strong>{formatCurrency(deliverable.max_budget)}</strong></p>
          <FormField label="Your bid amount ($)">
            <Input type="number" value={bid} onChange={e => setBid(e.target.value)} max={deliverable.max_budget} min="1" required />
          </FormField>
          <FormField label="Message to PM">
            <Textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} placeholder="Why are you a good fit?" />
          </FormField>
          {error && <Alert type="error">{error}</Alert>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Submitting…' : 'Submit Bid'}</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function BidDetailModal({ deliverable, tasks, userRole, onClose }: {
  deliverable: Deliverable; tasks: Task[]; userRole?: string; onClose: () => void;
}) {
  const [showBid, setShowBid] = useState(false);
  return (
    <Modal title={deliverable.title} onClose={onClose} footer={
      userRole === 'contributor' && !showBid
        ? <Button onClick={() => setShowBid(true)} style={{ width: '100%', justifyContent: 'center' }}>Place Bid</Button>
        : undefined
    }>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Badge color={deliverableStatusColor[deliverable.status]}>{deliverable.status}</Badge>
          <span className="meta">Max {formatCurrency(deliverable.max_budget)}</span>
          {deliverable.due_date && <span className="meta">Due {formatDate(deliverable.due_date)}</span>}
        </div>
        {deliverable.brief && (
          <div>
            <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Brief</p>
            <p className="body-sm">{deliverable.brief}</p>
          </div>
        )}
        {deliverable.scope && (
          <div>
            <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Scope</p>
            <p className="body-sm">{deliverable.scope}</p>
          </div>
        )}
        {tasks.length > 0 && (
          <div>
            <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Checklist</p>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {tasks.map(t => (
                <li key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <span style={{ width: 14, height: 14, borderRadius: 3, border: '1.5px solid var(--border-2)', flexShrink: 0 }} />
                  {t.title}
                  {t.is_required && <span style={{ color: 'var(--rose)', fontSize: 11 }}>*required</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
        {showBid && <ProposalForm deliverable={deliverable} onClose={onClose} />}
      </div>
    </Modal>
  );
}
