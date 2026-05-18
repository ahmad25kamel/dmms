import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { deliverablesApi } from '../../api';
import type { Deliverable } from '../../types';
import { Badge, Button, Spinner, EmptyState } from '../../components/ui';
import { formatCurrency, formatDate, deliverableStatusColor, deliverableStatusLabel } from '../../lib/statusColors';

interface ProjectGroup {
  projectId: string;
  projectName: string;
  deliverables: Deliverable[];
}

export function WorkspaceListPage() {
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    deliverablesApi.myAssigned().then(setDeliverables).finally(() => setLoading(false));
  }, []);

  // Only show root-level entries (parent_id = null) or standalone children
  // whose parent is NOT also in the assigned list (i.e. individually assigned child)
  const rootEntries = useMemo(() => {
    const assignedIds = new Set(deliverables.map(d => d.id));
    return deliverables.filter(d => !d.parent_id || !assignedIds.has(d.parent_id));
  }, [deliverables]);

  const groups = useMemo<ProjectGroup[]>(() => {
    const map = new Map<string, ProjectGroup>();
    rootEntries.forEach(d => {
      const key = d.project_id;
      if (!map.has(key)) {
        map.set(key, { projectId: key, projectName: d.project_name ?? key, deliverables: [] });
      }
      map.get(key)!.deliverables.push(d);
    });
    return Array.from(map.values()).sort((a, b) => a.projectName.localeCompare(b.projectName));
  }, [rootEntries]);

  if (loading) return <Spinner />;

  return (
    <div className="dmms-page">
      <div className="dmms-page-head">
        <div>
          <h1>My Work</h1>
          <p className="dmms-page-sub">
            {rootEntries.length} deliverable{rootEntries.length !== 1 ? 's' : ''} across {groups.length} project{groups.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          title="No work assigned yet"
          description="Browse the marketplace to find and bid on deliverables."
          action={<Link to="/marketplace"><Button>Browse Marketplace</Button></Link>}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {groups.map(group => (
            <div key={group.projectId}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--fg-4)', marginBottom: 10 }}>
                {group.projectName}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {group.deliverables.map(d => (
                  <DeliverableRow key={d.id} deliverable={d} allAssigned={deliverables} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DeliverableRow({ deliverable: d, allAssigned }: { deliverable: Deliverable; allAssigned: Deliverable[] }) {
  const childCount = allAssigned.filter(x => x.parent_id === d.id).length;
  const approvedCount = allAssigned.filter(x => x.parent_id === d.id && x.status === 'approved').length;

  return (
    <div style={{
      background: 'var(--bg-1)',
      border: '1px solid var(--border-1)',
      borderRadius: 'var(--radius-md)',
      padding: '14px 18px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--fg-0)' }}>{d.title}</span>
          <Badge color={deliverableStatusColor[d.status]}>{deliverableStatusLabel[d.status]}</Badge>
        </div>
        <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--fg-3)', flexWrap: 'wrap' }}>
          <span>Budget {formatCurrency(d.accepted_budget ?? d.max_budget)}</span>
          {d.due_date && <span>Due {formatDate(d.due_date)}</span>}
          {childCount > 0 && (
            <span style={{ color: approvedCount === childCount ? 'var(--emerald)' : 'var(--fg-3)' }}>
              {approvedCount}/{childCount} sub-deliverables approved
            </span>
          )}
        </div>
      </div>
      <Link to={`/workspace/${d.id}`} style={{ textDecoration: 'none', flexShrink: 0 }}>
        <Button size="sm">Open →</Button>
      </Link>
    </div>
  );
}
