import { useEffect, useMemo, useState } from 'react';
import { deliverablesApi, proposalsApi } from '../../api';
import type { Deliverable, Proposal } from '../../types';
import { Spinner, EmptyState } from '../../components/ui';
import { useAuth } from '../../store/authStore';
import { formatDate, deliverableStatusLabel } from '../../lib/statusColors';

interface TItem {
  id: string;
  title: string;
  project: string;
  startMs: number | null;
  endMs: number | null;
  color: string;
  striped: boolean;
  tooltip: string;
  groupLabel?: string; // if set, render as a section header row
}

type FilterMode = 'all' | 'assigned' | 'proposed';

export function TimelinePage() {
  const { user } = useAuth();
  if (user?.role === 'contributor') return <ContributorTimeline />;
  return <PMTimeline />;
}

// ─── Contributor view ──────────────────────────────────────────────────────────

function ContributorTimeline() {
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterMode>('all');

  useEffect(() => {
    Promise.all([
      deliverablesApi.myAssigned(),
      proposalsApi.mine(),
    ]).then(([d, p]) => {
      setDeliverables(d);
      setProposals(p);
    }).finally(() => setLoading(false));
  }, []);

  const items = useMemo<TItem[]>(() => {
    const out: TItem[] = [];
    const assignedIds = new Set(deliverables.map(d => d.id));

    if (filter !== 'proposed') {
      deliverables.forEach(d => {
        out.push({
          id: d.id,
          title: d.title,
          project: d.project_name ?? '',
          startMs: d.start_date ? new Date(d.start_date).getTime() : null,
          endMs: d.due_date ? new Date(d.due_date).getTime() : null,
          color: 'var(--kamel-blue)',
          striped: false,
          tooltip: [
            d.title,
            `Status: ${deliverableStatusLabel[d.status]}`,
            d.start_date ? `Start: ${formatDate(d.start_date)}` : null,
            d.due_date ? `Due: ${formatDate(d.due_date)}` : null,
          ].filter(Boolean).join('\n'),
        });
      });
    }

    if (filter !== 'assigned') {
      proposals
        .filter(p => p.status === 'pending' && p.eta_date && !assignedIds.has(p.deliverable_id))
        .forEach(p => {
          out.push({
            id: `p-${p.id}`,
            title: p.deliverable_title ?? 'Deliverable',
            project: p.project_name ?? '',
            startMs: null,
            endMs: p.eta_date ? new Date(p.eta_date).getTime() : null,
            color: 'var(--amber)',
            striped: true,
            tooltip: [
              p.deliverable_title ?? 'Deliverable',
              'Proposal Pending',
              p.eta_date ? `ETA: ${formatDate(p.eta_date)}` : null,
            ].filter(Boolean).join('\n'),
          });
        });
    }

    return out.sort((a, b) => (a.startMs ?? a.endMs ?? 0) - (b.startMs ?? b.endMs ?? 0));
  }, [deliverables, proposals, filter]);

  if (loading) return <Spinner />;

  const pendingWithEta = proposals.filter(p => p.status === 'pending' && p.eta_date).length;

  return (
    <div className="dmms-page">
      <div className="dmms-page-head">
        <div>
          <h1>My Timeline</h1>
          <p className="dmms-page-sub">
            {deliverables.length} assigned · {pendingWithEta} pending proposals with ETA
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['all', 'assigned', 'proposed'] as FilterMode[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-1)',
              background: filter === f ? 'var(--kamel-blue)' : 'var(--bg-1)',
              color: filter === f ? '#fff' : 'var(--fg-2)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {f === 'all' ? 'All' : f === 'assigned' ? 'Assigned' : 'Proposed'}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="No timeline items"
          description={
            filter === 'all'
              ? "You don't have any assigned deliverables or pending proposals with ETA dates yet."
              : `No ${filter} items found.`
          }
        />
      ) : (
        <FlatGantt items={items} showLegend />
      )}
    </div>
  );
}

// ─── PM view ──────────────────────────────────────────────────────────────────

const CONTRIBUTOR_PALETTE = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
];

function PMTimeline() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContributor, setSelectedContributor] = useState(''); // '' = all

  useEffect(() => {
    proposalsApi.allForPM().then(setProposals).finally(() => setLoading(false));
  }, []);

  const contributors = useMemo(() => {
    const map = new Map<string, string>();
    proposals.forEach(p => {
      if (p.contributor_id && p.contributor_name) {
        map.set(p.contributor_id, p.contributor_name);
      }
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [proposals]);

  const colorMap = useMemo(() => {
    const m = new Map<string, string>();
    contributors.forEach((c, i) => m.set(c.id, CONTRIBUTOR_PALETTE[i % CONTRIBUTOR_PALETTE.length]));
    return m;
  }, [contributors]);

  const items = useMemo<TItem[]>(() => {
    const filtered = selectedContributor
      ? proposals.filter(p => p.contributor_id === selectedContributor)
      : proposals;

    // Build rows per contributor, sorted by contributor name then by start/end date
    const byContributor = new Map<string, Proposal[]>();
    filtered.forEach(p => {
      if (!byContributor.has(p.contributor_id)) byContributor.set(p.contributor_id, []);
      byContributor.get(p.contributor_id)!.push(p);
    });

    const out: TItem[] = [];
    const sortedContributorIds = [...byContributor.keys()].sort((a, b) => {
      const na = byContributor.get(a)![0].contributor_name ?? '';
      const nb = byContributor.get(b)![0].contributor_name ?? '';
      return na.localeCompare(nb);
    });

    sortedContributorIds.forEach(cid => {
      const cProposals = byContributor.get(cid)!;
      const color = colorMap.get(cid) ?? '#6B7280';
      const name = cProposals[0].contributor_name ?? cid;

      const rowItems: TItem[] = cProposals
        .map(p => {
          const isAccepted = p.status === 'accepted';
          const isPending = p.status === 'pending';

          // Use deliverable dates for accepted items; eta as fallback end
          const startMs = isAccepted && p.deliverable_start_date
            ? new Date(p.deliverable_start_date).getTime()
            : null;
          const endMs = isAccepted
            ? (p.deliverable_due_date
                ? new Date(p.deliverable_due_date).getTime()
                : p.eta_date ? new Date(p.eta_date).getTime() : null)
            : p.eta_date ? new Date(p.eta_date).getTime() : null;

          if (startMs === null && endMs === null) return null;

          const hierarchyParts: string[] = [];
          if (p.grandparent_deliverable_title) hierarchyParts.push(p.grandparent_deliverable_title);
          if (p.parent_deliverable_title) hierarchyParts.push(p.parent_deliverable_title);
          const hierarchy = hierarchyParts.join(' › ');

          return {
            id: `p-${p.id}`,
            title: p.deliverable_title ?? 'Deliverable',
            project: hierarchy || (p.project_name ?? ''),
            startMs,
            endMs,
            color: isAccepted ? color : isPending ? color : '#9CA3AF',
            striped: isPending,
            tooltip: [
              name,
              p.deliverable_title ?? 'Deliverable',
              hierarchy,
              `Project: ${p.project_name ?? ''}`,
              `Status: ${p.status}`,
              p.deliverable_start_date ? `Start: ${formatDate(p.deliverable_start_date)}` : null,
              p.deliverable_due_date ? `Due: ${formatDate(p.deliverable_due_date)}` : null,
              p.eta_date ? `ETA: ${formatDate(p.eta_date)}` : null,
            ].filter(Boolean).join('\n'),
          } satisfies TItem;
        })
        .filter((x): x is TItem => x !== null)
        .sort((a, b) => (a.startMs ?? a.endMs ?? 0) - (b.startMs ?? b.endMs ?? 0));

      if (rowItems.length === 0) return;

      // Group header row
      out.push({
        id: `group-${cid}`,
        groupLabel: name,
        title: '',
        project: '',
        startMs: null,
        endMs: null,
        color,
        striped: false,
        tooltip: '',
      });
      out.push(...rowItems);
    });

    return out;
  }, [proposals, selectedContributor, colorMap]);

  if (loading) return <Spinner />;

  const totalItems = items.filter(i => !i.groupLabel).length;

  return (
    <div className="dmms-page">
      <div className="dmms-page-head">
        <div>
          <h1>Contributor Timeline</h1>
          <p className="dmms-page-sub">
            {contributors.length} contributor{contributors.length !== 1 ? 's' : ''} · {totalItems} scheduled item{totalItems !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Contributor filter pills */}
      {contributors.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={() => setSelectedContributor('')}
            style={{
              padding: '5px 14px', borderRadius: 'var(--radius-sm)',
              border: `2px solid ${selectedContributor === '' ? 'var(--kamel-blue)' : 'var(--border-1)'}`,
              background: selectedContributor === '' ? 'var(--kamel-blue)' : 'var(--bg-1)',
              color: selectedContributor === '' ? '#fff' : 'var(--fg-2)',
              fontSize: 13, fontWeight: 500, cursor: 'pointer',
            }}
          >
            All
          </button>
          {contributors.map((c, i) => {
            const color = CONTRIBUTOR_PALETTE[i % CONTRIBUTOR_PALETTE.length];
            const active = selectedContributor === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setSelectedContributor(active ? '' : c.id)}
                style={{
                  padding: '5px 14px', borderRadius: 'var(--radius-sm)',
                  border: `2px solid ${active ? color : 'var(--border-1)'}`,
                  background: active ? color : 'var(--bg-1)',
                  color: active ? '#fff' : 'var(--fg-2)',
                  fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                {c.name}
              </button>
            );
          })}
        </div>
      )}

      {contributors.length === 0 ? (
        <EmptyState
          title="No contributor data"
          description="No proposals have been submitted on your projects yet."
        />
      ) : items.filter(i => !i.groupLabel).length === 0 ? (
        <EmptyState
          title="No timeline data"
          description="No proposals with scheduled dates found. Contributors need to set ETA dates or deliverables need start/due dates."
        />
      ) : (
        <FlatGantt items={items} showLegend contributorColorMap={colorMap} />
      )}
    </div>
  );
}

// ─── Flat Gantt chart ─────────────────────────────────────────────────────────

const WEEK_WIDTH = 50;
const LABEL_WIDTH = 300;

function FlatGantt({ items, showLegend, contributorColorMap }: { items: TItem[]; showLegend?: boolean; contributorColorMap?: Map<string, string> }) {
  let minMs = Infinity;
  let maxMs = -Infinity;

  items.forEach(item => {
    if (item.startMs) { minMs = Math.min(minMs, item.startMs); maxMs = Math.max(maxMs, item.startMs); }
    if (item.endMs)   { minMs = Math.min(minMs, item.endMs);   maxMs = Math.max(maxMs, item.endMs); }
  });

  const now = new Date();
  if (!isFinite(minMs)) {
    minMs = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    maxMs = new Date(now.getFullYear(), now.getMonth() + 2, 0).getTime();
  }

  const minDate = new Date(minMs);
  const maxDate = new Date(maxMs);
  const startY = minDate.getFullYear();
  const startM = minDate.getMonth();
  const endY = maxDate.getFullYear();
  const endM = maxDate.getMonth();

  const months: { name: string; year: number; weeks: { label: string }[] }[] = [];
  for (let y = startY; y <= endY; y++) {
    const mFrom = y === startY ? startM : 0;
    const mTo = y === endY ? endM : 11;
    for (let m = mFrom; m <= mTo; m++) {
      const daysInMonth = new Date(y, m + 1, 0).getDate();
      const weeks: { label: string }[] = [];
      for (let i = 0; i < daysInMonth; i += 7) {
        weeks.push({ label: `W${Math.floor(i / 7) + 1}` });
      }
      months.push({ name: new Date(y, m, 1).toLocaleString('id-ID', { month: 'long' }), year: y, weeks });
    }
  }

  const totalWeeks = months.reduce((acc, m) => acc + m.weeks.length, 0);
  const timelineWidth = totalWeeks * WEEK_WIDTH;
  const chartStartMs = new Date(startY, startM, 1).getTime();
  const chartEndMs = new Date(endY, endM + 1, 0).getTime() + 86400000;
  const totalDuration = chartEndMs - chartStartMs;
  const getX = (ms: number) => ((ms - chartStartMs) / totalDuration) * 100;

  const todayX = now.getTime() >= chartStartMs && now.getTime() <= chartEndMs
    ? getX(now.getTime())
    : null;

  return (
    <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border-1)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: LABEL_WIDTH + timelineWidth, display: 'flex', flexDirection: 'column' }}>

          {/* Header */}
          <div style={{ display: 'flex', position: 'sticky', top: 0, zIndex: 20, background: 'var(--bg-1)' }}>
            <div style={{
              width: LABEL_WIDTH, flexShrink: 0,
              borderRight: '1px solid var(--border-1)', borderBottom: '1px solid var(--border-1)',
              background: 'var(--bg-2)', position: 'sticky', left: 0, zIndex: 30,
              display: 'flex', alignItems: 'center', padding: '0 16px',
              fontSize: 11, fontWeight: 600, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              DELIVERABLE
            </div>
            <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border-1)' }}>
                {months.map((m, i) => (
                  <div key={i} style={{ width: m.weeks.length * WEEK_WIDTH, flexShrink: 0, padding: '8px 12px', fontSize: 12, fontWeight: 600, borderRight: '1px solid var(--border-1)', background: 'var(--bg-2)' }}>
                    {m.name} {m.year}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border-1)' }}>
                {months.flatMap((m, mi) => m.weeks.map((w, j) => (
                  <div key={`${mi}-${j}`} style={{ width: WEEK_WIDTH, flexShrink: 0, textAlign: 'center', fontSize: 10, padding: '4px 0', borderRight: '1px solid var(--border-1)', color: 'var(--fg-3)' }}>
                    {w.label}
                  </div>
                )))}
              </div>
            </div>
          </div>

          {/* Body */}
          <div style={{ position: 'relative' }}>
            {/* Grid lines */}
            <div style={{ position: 'absolute', top: 0, bottom: 0, left: LABEL_WIDTH, right: 0, display: 'flex', pointerEvents: 'none' }}>
              {months.flatMap((m, mi) => m.weeks.map((_, j) => (
                <div key={`${mi}-g-${j}`} style={{ width: WEEK_WIDTH, flexShrink: 0, borderRight: '1px solid var(--border-1)', opacity: 0.15, height: '100%' }} />
              )))}
            </div>

            {/* Today line */}
            {todayX !== null && (
              <div style={{
                position: 'absolute', top: 0, bottom: 0,
                left: `calc(${LABEL_WIDTH}px + ${todayX}%)`,
                width: 2, background: 'rgba(239,68,68,0.5)',
                zIndex: 5, pointerEvents: 'none',
              }} />
            )}

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {items.map(item => {
                // Group header row
                if (item.groupLabel) {
                  return (
                    <div key={item.id} style={{ display: 'flex', height: 32, borderBottom: '1px solid var(--border-1)', background: 'var(--bg-2)', position: 'sticky', left: 0 }}>
                      <div style={{
                        width: LABEL_WIDTH, flexShrink: 0,
                        paddingLeft: 12, display: 'flex', alignItems: 'center', gap: 8,
                        position: 'sticky', left: 0, zIndex: 10, background: 'var(--bg-2)',
                        borderRight: '1px solid var(--border-1)',
                      }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.groupLabel}
                        </span>
                      </div>
                      <div style={{ flexGrow: 1 }} />
                    </div>
                  );
                }

                const s = item.startMs;
                const e = item.endMs;
                let leftPct = 0, widthPct = 0, isPoint = false;
                if (s && e) {
                  leftPct = getX(s);
                  widthPct = getX(e) - leftPct;
                } else if (s || e) {
                  leftPct = getX(s ?? e ?? 0);
                  isPoint = true;
                }

                const barBg = item.striped
                  ? `repeating-linear-gradient(45deg, ${item.color} 0, ${item.color} 4px, transparent 4px, transparent 9px)`
                  : item.color;

                return (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', height: 48, borderBottom: '1px solid var(--border-1)', position: 'relative' }}>
                    <div style={{
                      width: LABEL_WIDTH, flexShrink: 0,
                      paddingLeft: 16, paddingRight: 12,
                      display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2,
                      zIndex: 10, background: 'var(--bg-1)',
                      position: 'sticky', left: 0, height: '100%',
                      borderRight: '1px solid var(--border-1)',
                    }}>
                      <span style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--fg-1)' }}>
                        {item.title}
                      </span>
                      {item.project && (
                        <span style={{ fontSize: 11, color: 'var(--fg-4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.project}
                        </span>
                      )}
                    </div>

                    <div style={{ flexGrow: 1, position: 'relative', height: '100%' }}>
                      {(s || e) && (
                        <div
                          title={item.tooltip}
                          style={{
                            position: 'absolute',
                            left: `${leftPct}%`,
                            width: isPoint ? 'auto' : `${Math.max(0.5, widthPct)}%`,
                            height: 24, top: '50%', transform: 'translateY(-50%)',
                            background: barBg,
                            borderRadius: isPoint ? '50%' : '4px',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                            zIndex: 2, minWidth: isPoint ? 20 : 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          {isPoint && <div style={{ width: 8, height: 8, background: 'white', borderRadius: '50%' }} />}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {showLegend && (
        <div style={{ display: 'flex', gap: 20, padding: '10px 16px', borderTop: '1px solid var(--border-1)', fontSize: 12, color: 'var(--fg-3)', flexWrap: 'wrap' }}>
          {contributorColorMap
            ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 20, height: 10, background: '#9CA3AF', borderRadius: 2 }} />
                  Solid = Accepted
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 20, height: 10, borderRadius: 2, background: 'repeating-linear-gradient(45deg, #9CA3AF 0, #9CA3AF 4px, transparent 4px, transparent 9px)' }} />
                  Striped = Pending
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 20, height: 10, background: 'var(--kamel-blue)', borderRadius: 2 }} />
                  Assigned
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 20, height: 10, borderRadius: 2, background: 'repeating-linear-gradient(45deg, var(--amber) 0, var(--amber) 4px, transparent 4px, transparent 9px)' }} />
                  Proposed (pending)
                </div>
              </>
            )
          }
          {todayX !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 2, height: 14, background: 'rgba(239,68,68,0.5)' }} />
              Today
            </div>
          )}
        </div>
      )}
    </div>
  );
}
