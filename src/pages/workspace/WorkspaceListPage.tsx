import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { deliverablesApi } from '../../api';
import type { Deliverable } from '../../types';
import { Badge, Button, Spinner, EmptyState } from '../../components/ui';
import { formatCurrency, formatDate, deliverableStatusColor, deliverableStatusLabel } from '../../lib/statusColors';

export function WorkspaceListPage() {
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    deliverablesApi.myAssigned().then(setDeliverables).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  return (
    <div className="dmms-page">
      <div className="dmms-page-head">
        <div>
          <h1>My Work</h1>
          <p className="dmms-page-sub">{deliverables.length} assigned deliverable{deliverables.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {deliverables.length === 0 ? (
        <EmptyState
          title="No work assigned yet"
          description="Browse the marketplace to find and bid on deliverables."
          action={<Link to="/marketplace"><Button>Browse Marketplace</Button></Link>}
        />
      ) : (
        <ul className="dmms-feed">
          {deliverables.map(d => (
            <li key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontWeight: 600 }}>{d.title}</span>
                  <Badge color={deliverableStatusColor[d.status]}>{deliverableStatusLabel[d.status]}</Badge>
                </div>
                <p className="meta">Budget {formatCurrency(d.accepted_budget ?? d.max_budget)}{d.due_date ? ` · Due ${formatDate(d.due_date)}` : ''}</p>
              </div>
              <Link to={`/workspace/${d.id}`}>
                <Button size="sm">Open →</Button>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
