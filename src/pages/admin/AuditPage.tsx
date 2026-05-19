import { useEffect, useState, useCallback } from 'react';
import { auditApi } from '../../api';
import type { AuditLog } from '../../types';
import { Spinner, EmptyState, Badge } from '../../components/ui';
import { formatDate } from '../../lib/statusColors';

type BadgeColor = 'blue' | 'green' | 'yellow' | 'red' | 'gray' | 'indigo' | 'purple';

const ENTITY_TYPES = ['', 'project', 'deliverable', 'proposal', 'submission', 'user'];

const ACTION_COLORS: Record<string, BadgeColor> = {
  'project.create': 'green',
  'project.update': 'blue',
  'project.delete': 'red',
  'deliverable.create': 'green',
  'deliverable.update': 'blue',
  'deliverable.delete': 'red',
  'deliverable.open_bids': 'yellow',
  'deliverable.cancel': 'red',
  'deliverable.reopen': 'blue',
  'deliverable.reassign': 'yellow',
  'proposal.submit': 'blue',
  'proposal.accept': 'green',
  'proposal.reject': 'red',
  'proposal.withdraw': 'gray',
  'proposal.revise': 'yellow',
  'submission.submit': 'blue',
  'submission.approve': 'green',
  'submission.reject': 'red',
  'submission.request_revision': 'yellow',
  'user.approve': 'green',
  'user.reject': 'red',
  'user.role_update': 'yellow',
  'user.delete': 'red',
};

const ACTION_LABELS: Record<string, string> = {
  'project.create': 'Created',
  'project.update': 'Updated',
  'project.delete': 'Deleted',
  'deliverable.create': 'Created',
  'deliverable.update': 'Updated',
  'deliverable.delete': 'Deleted',
  'deliverable.open_bids': 'Opened for Bids',
  'deliverable.cancel': 'Cancelled',
  'deliverable.reopen': 'Reopened',
  'deliverable.reassign': 'Reassigned',
  'proposal.submit': 'Submitted Bid',
  'proposal.accept': 'Accepted Bid',
  'proposal.reject': 'Rejected Bid',
  'proposal.withdraw': 'Withdrew Bid',
  'proposal.revise': 'Revised Bid',
  'submission.submit': 'Submitted Work',
  'submission.approve': 'Approved',
  'submission.reject': 'Rejected',
  'submission.request_revision': 'Requested Revision',
  'user.approve': 'Approved User',
  'user.reject': 'Rejected User',
  'user.role_update': 'Changed Role',
  'user.delete': 'Deleted User',
};

const ENTITY_ICONS: Record<string, string> = {
  project: '📁',
  deliverable: '📦',
  proposal: '💬',
  submission: '📤',
  user: '👤',
};

const LIMIT = 50;

export function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [entityType, setEntityType] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async (off: number, et: string) => {
    setLoading(true);
    try {
      const res = await auditApi.list({ limit: LIMIT, offset: off, entity_type: et || undefined });
      setLogs(res.items ?? []);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(offset, entityType);
  }, [load, offset, entityType]);

  function changeFilter(et: string) {
    setEntityType(et);
    setOffset(0);
  }

  const filtered = search.trim()
    ? logs.filter(l =>
        l.entity_name?.toLowerCase().includes(search.toLowerCase()) ||
        l.user_name?.toLowerCase().includes(search.toLowerCase()) ||
        l.action.includes(search.toLowerCase())
      )
    : logs;

  return (
    <div className="dmms-page">
      <div className="dmms-page-head">
        <div>
          <h1>Audit Trail</h1>
          <p className="dmms-page-sub">{total} events logged</p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {ENTITY_TYPES.map(et => (
            <button
              key={et}
              onClick={() => changeFilter(et)}
              style={{
                padding: '5px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-1)',
                background: entityType === et ? 'var(--kamel-blue)' : 'transparent',
                color: entityType === et ? '#fff' : 'var(--fg-2)',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: entityType === et ? 600 : 400,
                textTransform: 'capitalize',
              }}
            >
              {et || 'All'}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search…"
          style={{
            padding: '5px 10px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-1)',
            background: 'var(--bg-1)',
            color: 'var(--fg-0)',
            fontSize: 13,
            width: 200,
          }}
        />
      </div>

      {loading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <EmptyState title="No audit events" description="Actions will appear here as users interact with the system." />
      ) : (
        <>
          <div style={{ border: '1px solid var(--border-1)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border-1)' }}>
                  <th style={thStyle}>When</th>
                  <th style={thStyle}>User</th>
                  <th style={thStyle}>Action</th>
                  <th style={thStyle}>Entity</th>
                  <th style={thStyle}>Detail</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((log, i) => (
                  <tr
                    key={log.id}
                    style={{
                      borderTop: i > 0 ? '1px solid var(--border-1)' : 'none',
                      background: i % 2 === 0 ? 'var(--bg-1)' : 'var(--bg-0)',
                    }}
                  >
                    <td style={tdStyle}>
                      <span style={{ color: 'var(--fg-3)', whiteSpace: 'nowrap' }}>{formatDate(log.created_at)}</span>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <span style={{ fontWeight: 600, color: 'var(--fg-0)' }}>{log.user_name ?? '—'}</span>
                        {log.user_role && (
                          <span style={{ fontSize: 11, color: 'var(--fg-4)', textTransform: 'capitalize' }}>{log.user_role}</span>
                        )}
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <Badge color={ACTION_COLORS[log.action] ?? 'gray'}>
                        {ACTION_LABELS[log.action] ?? log.action}
                      </Badge>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{ENTITY_ICONS[log.entity_type] ?? '•'}</span>
                        <div>
                          <span style={{ textTransform: 'capitalize', fontSize: 11, color: 'var(--fg-4)' }}>{log.entity_type}</span>
                          <div style={{ fontWeight: 600, color: 'var(--fg-0)' }}>{log.entity_name || log.entity_id}</div>
                        </div>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      {log.meta && log.meta !== '{}' && log.meta !== '' && (
                        <MetaDisplay meta={log.meta} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {total > LIMIT && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
              <button
                onClick={() => setOffset(Math.max(0, offset - LIMIT))}
                disabled={offset === 0}
                style={pageBtnStyle}
              >
                ← Prev
              </button>
              <span style={{ fontSize: 13, color: 'var(--fg-3)', alignSelf: 'center' }}>
                {offset + 1}–{Math.min(offset + LIMIT, total)} of {total}
              </span>
              <button
                onClick={() => setOffset(offset + LIMIT)}
                disabled={offset + LIMIT >= total}
                style={pageBtnStyle}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MetaDisplay({ meta }: { meta: string }) {
  try {
    const obj = JSON.parse(meta);
    const entries = Object.entries(obj).filter(([, v]) => v !== '' && v !== null);
    if (entries.length === 0) return null;
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {entries.map(([k, v]) => (
          <span key={k} style={{ fontSize: 11, background: 'var(--bg-2)', border: '1px solid var(--border-1)', borderRadius: 4, padding: '1px 6px', color: 'var(--fg-3)' }}>
            <span style={{ color: 'var(--fg-4)' }}>{k}:</span> {String(v)}
          </span>
        ))}
      </div>
    );
  } catch {
    return <span style={{ fontSize: 11, color: 'var(--fg-4)' }}>{meta}</span>;
  }
}

const thStyle: React.CSSProperties = {
  padding: '10px 14px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--fg-3)',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 14px',
  verticalAlign: 'top',
};

const pageBtnStyle: React.CSSProperties = {
  padding: '6px 14px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-1)',
  background: 'transparent',
  color: 'var(--fg-2)',
  cursor: 'pointer',
  fontSize: 13,
};
