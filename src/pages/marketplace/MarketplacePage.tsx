import { useEffect, useState } from 'react';
import { marketplaceApi, proposalsApi, deliverablesApi } from '../../api';
import type { Deliverable, Task } from '../../types';
import { Badge, Button, Modal, FormField, Input, Textarea, Spinner, EmptyState, Alert } from '../../components/ui';
import { formatCurrency, formatDate, deliverableStatusColor } from '../../lib/statusColors';
import { useAuth } from '../../store/authStore';

export function MarketplacePage() {
  const { user } = useAuth();
  const [bids, setBids] = useState<Deliverable[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Deliverable | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    marketplaceApi.listBids().then(setBids).finally(() => setLoading(false));
  }, []);

  async function openDetail(d: Deliverable) {
    setSelected(d);
    const t = await deliverablesApi.listTasks(d.id).catch(() => []);
    setTasks(t);
  }

  if (loading) return <Spinner />;

  const q = search.trim().toLowerCase();
  const filteredBids = q
    ? bids.filter(b => b.title.toLowerCase().includes(q) || (b.brief ?? '').toLowerCase().includes(q))
    : bids;
  const projectTrees = buildTreesByProject(filteredBids);

  return (
    <div className="dmms-page">
      <div className="dmms-page-head">
        <div>
          <h1>Marketplace</h1>
          <p className="dmms-page-sub">{filteredBids.length} of {bids.length} open bid{bids.length !== 1 ? 's' : ''}</p>
        </div>
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search deliverables…"
          style={{ width: 220 }}
        />
      </div>

      {bids.length === 0 ? (
        <EmptyState title="No open bids" description="There are no deliverables open for bidding right now." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {projectTrees.map(({ projectName, tree }) => (
            <div key={projectName}>
              <h3 style={{ marginBottom: 12, fontSize: 16, borderBottom: '1px solid var(--border-1)', paddingBottom: 8 }}>{projectName}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {tree.map(node => (
                  <MarketplaceNode
                    key={node.id}
                    deliverable={node}
                    depth={0}
                    userRole={user?.role}
                    onOpenDetail={openDetail}
                  />
                ))}
              </div>
            </div>
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

function buildTreesByProject(bids: Deliverable[]) {
  const projectsMap = new Map<string, Deliverable[]>();
  
  bids.forEach(b => {
    const projectName = b.project_name || 'Individual Bids';
    if (!projectsMap.has(projectName)) projectsMap.set(projectName, []);
    projectsMap.get(projectName)!.push(b);
  });

  const result: { projectName: string; tree: Deliverable[] }[] = [];

  projectsMap.forEach((projectBids, projectName) => {
    const bidMap = new Map<string, Deliverable & { children: Deliverable[] }>();
    projectBids.forEach(b => bidMap.set(b.id, { ...b, children: [] }));

    const tree: Deliverable[] = [];
    projectBids.forEach(b => {
      const node = bidMap.get(b.id)!;
      if (b.parent_id && bidMap.has(b.parent_id)) {
        bidMap.get(b.parent_id)!.children.push(node);
      } else {
        tree.push(node);
      }
    });

    const sortTree = (nodes: Deliverable[]): Deliverable[] => {
      return nodes.map(n => ({
        ...n,
        children: n.children ? sortTree(n.children) : []
      })).sort((a, b) => {
        const s1 = a.start_date ? new Date(a.start_date).getTime() : Infinity;
        const s2 = b.start_date ? new Date(b.start_date).getTime() : Infinity;
        if (s1 !== s2) return s1 - s2;
        const e1 = a.due_date ? new Date(a.due_date).getTime() : -Infinity;
        const e2 = b.due_date ? new Date(b.due_date).getTime() : -Infinity;
        return e2 - e1;
      });
    };

    result.push({ projectName, tree: sortTree(tree) });
  });

  return result;
}

function MarketplaceNode({ deliverable: d, depth, userRole, onOpenDetail }: {
  deliverable: Deliverable;
  depth: number;
  userRole?: string;
  onOpenDetail: (d: Deliverable) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = d.children && d.children.length > 0;

  return (
    <div>
      <div className="dmms-tree-node" style={{ marginLeft: depth * 24 }}>
        <button className="dmms-tree-toggle" onClick={() => setExpanded(e => !e)}>
          {hasChildren ? (
            expanded
              ? <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
              : <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 6 15 12 9 18"/></svg>
          ) : <span style={{ width: 12, display: 'inline-block' }} />}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{d.title}</span>
            <span style={{ color: 'var(--emerald)', fontWeight: 600, fontSize: 12 }}>{formatCurrency(d.max_budget)}</span>
            {d.due_date && <span className="meta">Due {formatDate(d.due_date)}</span>}
          </div>
          {d.brief && depth === 0 && (
            <p className="body-sm" style={{ marginTop: 2, color: 'var(--fg-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {d.brief}
            </p>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <Button size="sm" variant="secondary" onClick={() => onOpenDetail(d)}>Details</Button>
          {userRole === 'contributor' && <BidButton deliverable={d} />}
        </div>
      </div>

      {expanded && hasChildren && d.children!.map(child => (
        <MarketplaceNode
          key={child.id}
          deliverable={child}
          depth={depth + 1}
          userRole={userRole}
          onOpenDetail={onOpenDetail}
        />
      ))}
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
