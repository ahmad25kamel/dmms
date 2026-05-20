// Timeline page
import { Fragment, useEffect, useMemo, useState } from 'react';
import { deliverablesApi, proposalsApi, projectsApi } from '../../api';
import type { Deliverable, Proposal } from '../../types';
import { Spinner, EmptyState } from '../../components/ui';
import { useAuth } from '../../store/authStore';
import { formatDate } from '../../lib/statusColors';

const WEEK_WIDTH = 50;
const LABEL_WIDTH = 320;

const CONTRIBUTOR_COLORS = [
  'var(--kamel-blue)', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444',
  '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#6366f1',
];

const STACK_BAR_H = 10;  // height of each stacked child bar (px)
const STACK_GAP   = 0;   // no gap — flush stacking
const STACK_PAD   = 4;   // top/bottom padding inside the row

// ─── Entry point ──────────────────────────────────────────────────────────────

export function TimelinePage() {
  const { user } = useAuth();
  if (user?.role === 'contributor') return <ContributorTimeline />;
  return <PMTimeline />;
}

// ─── Helper: build project-grouped trees from a flat deliverable list ─────────

function buildProjectTrees(
  items: Deliverable[],
): { projectName: string; tree: Deliverable[] }[] {
  const projMap = new Map<string, { projectName: string; nodes: Map<string, Deliverable> }>();

  items.forEach(d => {
    const key = d.project_name ?? d.project_id;
    if (!projMap.has(key)) projMap.set(key, { projectName: key, nodes: new Map() });
    const proj = projMap.get(key)!;
    proj.nodes.set(d.id, { ...d, children: [] });
  });

  const result: { projectName: string; tree: Deliverable[] }[] = [];

  projMap.forEach(({ projectName, nodes }) => {
    const tree: Deliverable[] = [];
    nodes.forEach(node => {
      if (node.parent_id && nodes.has(node.parent_id)) {
        (nodes.get(node.parent_id)!.children ??= []).push(node);
      } else {
        tree.push(node);
      }
    });

    function sortNodes(ns: Deliverable[]): Deliverable[] {
      return ns
        .sort((a, b) => a.title.localeCompare(b.title))
        .map(n => ({ ...n, children: n.children ? sortNodes(n.children) : [] }));
    }

    result.push({ projectName, tree: sortNodes(tree) });
  });

  return result.sort((a, b) => a.projectName.localeCompare(b.projectName));
}

// ─── Contributor timeline ─────────────────────────────────────────────────────

type FilterMode = 'all' | 'assigned' | 'proposed';

function ContributorTimeline() {
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterMode>('all');

  useEffect(() => {
    Promise.all([deliverablesApi.myAssigned(), proposalsApi.mine()])
      .then(([d, p]) => { setDeliverables(d); setProposals(p); })
      .finally(() => setLoading(false));
  }, []);

  const assignedIds = useMemo(() => new Set(deliverables.map(d => d.id)), [deliverables]);

  // Pending proposals whose deliverable is not in the assigned list → fake nodes
  const pendingFakeNodes = useMemo<Deliverable[]>(() => {
    const seen = new Set<string>();
    return proposals
      .filter(p => p.status === 'pending' && p.eta_date && !assignedIds.has(p.deliverable_id))
      .filter(p => { if (seen.has(p.deliverable_id)) return false; seen.add(p.deliverable_id); return true; })
      .map(p => ({
        id: p.deliverable_id,
        project_id: p.project_name ?? '',
        parent_id: null,
        title: p.deliverable_title ?? 'Deliverable',
        brief: '', scope: '', acceptance_criteria: '',
        max_budget: p.deliverable_max_budget ?? 0,
        accepted_budget: null,
        start_date: undefined,
        due_date: p.eta_date,
        dependency_id: null,
        visibility: 'public' as const,
        status: 'open_for_bids' as const,
        owner_id: null,
        created_at: '', updated_at: '',
        project_name: p.project_name ?? '',
        children: [],
      }));
  }, [proposals, assignedIds]);

  const groups = useMemo(() => {
    const nodes: Deliverable[] = [];
    if (filter !== 'proposed') nodes.push(...deliverables);
    if (filter !== 'assigned') nodes.push(...pendingFakeNodes);
    return buildProjectTrees(nodes);
  }, [deliverables, pendingFakeNodes, filter]);

  if (loading) return <Spinner />;

  const pendingCount = proposals.filter(p => p.status === 'pending' && p.eta_date).length;

  return (
    <div className="dmms-page">
      <div className="dmms-page-head">
        <div>
          <h1>My Timeline</h1>
          <p className="dmms-page-sub">
            {deliverables.length} assigned · {pendingCount} pending proposals with ETA
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
              fontSize: 13, fontWeight: 500, cursor: 'pointer',
            }}
          >
            {f === 'all' ? 'All' : f === 'assigned' ? 'Assigned' : 'Proposed'}
          </button>
        ))}
      </div>

      {groups.length === 0 ? (
        <EmptyState
          title="No timeline items"
          description={
            filter === 'all'
              ? "You don't have any assigned deliverables or pending proposals with ETA dates yet."
              : `No ${filter} items found.`
          }
        />
      ) : (
        <TreeGantt
          groups={groups}
          proposals={[]}
          assignedDeliverableIds={assignedIds}
          showLegend
        />
      )}
    </div>
  );
}

// ─── PM timeline ──────────────────────────────────────────────────────────────

function PMTimeline() {
  const [groups, setGroups] = useState<{ projectName: string; tree: Deliverable[] }[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContributors, setSelectedContributors] = useState<Set<string>>(new Set());
  const [showUnassigned, setShowUnassigned] = useState(true);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    Promise.all([projectsApi.list(200), proposalsApi.allForPM()])
      .then(async ([projResult, props]) => {
        setProposals(props);
        const projs = projResult.items;
        const trees = await Promise.all(projs.map(p => deliverablesApi.tree(p.id).catch(() => [])));
        const built = projs
          .map((p, i) => ({ projectName: p.name, tree: trees[i] }))
          .filter(g => g.tree.length > 0)
          .sort((a, b) => a.projectName.localeCompare(b.projectName));
        setGroups(built);
      })
      .finally(() => setLoading(false));
  }, []);

  const contributors = useMemo(() => {
    const map = new Map<string, string>();
    proposals.forEach(p => {
      if (p.contributor_id && p.contributor_name) map.set(p.contributor_id, p.contributor_name);
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [proposals]);

  const contributorColorMap = useMemo(() => {
    const map = new Map<string, string>();
    contributors.forEach((c, i) => map.set(c.id, CONTRIBUTOR_COLORS[i % CONTRIBUTOR_COLORS.length]));
    return map;
  }, [contributors]);

  // Set all contributors selected by default once they load
  useEffect(() => {
    if (!initialized && contributors.length > 0) {
      setSelectedContributors(new Set(contributors.map(c => c.id)));
      setInitialized(true);
    }
  }, [contributors, initialized]);

  const toggleContributor = (id: string) => {
    setSelectedContributors(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allSelected = contributors.length > 0 && contributors.every(c => selectedContributors.has(c.id));

  if (loading) return <Spinner />;

  const totalDeliverables = groups.reduce((acc, g) => {
    function count(ns: Deliverable[]): number {
      return ns.reduce((a, n) => a + 1 + count(n.children ?? []), 0);
    }
    return acc + count(g.tree);
  }, 0);

  return (
    <div className="dmms-page">
      <div className="dmms-page-head">
        <div>
          <h1>Contributor Timeline</h1>
          <p className="dmms-page-sub">
            {groups.length} project{groups.length !== 1 ? 's' : ''} · {totalDeliverables} deliverable{totalDeliverables !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Multi-select filter toolbar */}
      <div style={{ marginBottom: 20, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: 'var(--fg-3)', fontWeight: 500, marginRight: 4 }}>Filter:</span>

        <button
          onClick={() => setShowUnassigned(v => !v)}
          style={{
            padding: '5px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
            border: `1px solid ${showUnassigned ? 'var(--fg-4)' : 'var(--border-1)'}`,
            background: showUnassigned ? 'var(--bg-2)' : 'var(--bg-1)',
            color: showUnassigned ? 'var(--fg-1)' : 'var(--fg-4)',
            fontSize: 12, fontWeight: 500,
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: showUnassigned ? 'var(--fg-3)' : 'var(--fg-4)', display: 'inline-block', flexShrink: 0 }} />
          Unassigned
        </button>

        {contributors.map((c, i) => {
          const color = CONTRIBUTOR_COLORS[i % CONTRIBUTOR_COLORS.length];
          const on = selectedContributors.has(c.id);
          return (
            <button
              key={c.id}
              onClick={() => toggleContributor(c.id)}
              style={{
                padding: '5px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                border: `1px solid ${on ? color : 'var(--border-1)'}`,
                background: on ? `${color}22` : 'var(--bg-1)',
                color: on ? 'var(--fg-1)' : 'var(--fg-4)',
                fontSize: 12, fontWeight: 500,
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: on ? color : 'var(--fg-4)', display: 'inline-block', flexShrink: 0 }} />
              {c.name}
            </button>
          );
        })}

        {(!allSelected || !showUnassigned) && (
          <button
            onClick={() => { setSelectedContributors(new Set(contributors.map(c => c.id))); setShowUnassigned(true); }}
            style={{ fontSize: 12, color: 'var(--fg-3)', background: 'none', border: 'none', cursor: 'pointer', padding: '5px 8px' }}
          >
            Reset
          </button>
        )}
      </div>

      {groups.length === 0 ? (
        <EmptyState title="No timeline data" description="No deliverables found for your projects." />
      ) : (
        <TreeGantt
          groups={groups}
          proposals={proposals}
          selectedContributors={selectedContributors}
          showUnassigned={showUnassigned}
          contributorColorMap={contributorColorMap}
          contributors={contributors}
          showLegend
        />
      )}
    </div>
  );
}

// ─── Tree Gantt ───────────────────────────────────────────────────────────────

interface TreeGanttProps {
  groups: { projectName: string; tree: Deliverable[] }[];
  proposals: Proposal[];
  selectedContributors?: Set<string>;
  showUnassigned?: boolean;
  contributorColorMap?: Map<string, string>;
  contributors?: { id: string; name: string }[];
  assignedDeliverableIds?: Set<string>;
  showLegend?: boolean;
}

function TreeGantt({
  groups,
  proposals,
  selectedContributors,
  showUnassigned = true,
  contributorColorMap,
  contributors,
  assignedDeliverableIds,
  showLegend,
}: TreeGanttProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggleCollapse = (id: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const acceptedByDeliverable = useMemo(() => {
    const map = new Map<string, { name: string; id: string }>();
    proposals.filter(p => p.status === 'accepted').forEach(p => {
      map.set(p.deliverable_id, { name: p.contributor_name ?? '', id: p.contributor_id });
    });
    return map;
  }, [proposals]);

  const pendingByDeliverable = useMemo(() => {
    const map = new Map<string, Proposal[]>();
    proposals.filter(p => p.status === 'pending' && p.eta_date).forEach(p => {
      const list = map.get(p.deliverable_id) ?? [];
      list.push(p);
      map.set(p.deliverable_id, list);
    });
    return map;
  }, [proposals]);

  // Date bounds across all deliverables + proposals
  const { minMs, maxMs } = useMemo(() => {
    let min = Infinity, max = -Infinity;
    function scanDels(ns: Deliverable[]) {
      ns.forEach(d => {
        if (d.start_date) { const t = new Date(d.start_date).getTime(); if (!isNaN(t)) { min = Math.min(min, t); max = Math.max(max, t); } }
        if (d.due_date) { const t = new Date(d.due_date).getTime(); if (!isNaN(t)) { min = Math.min(min, t); max = Math.max(max, t); } }
        if (d.children?.length) scanDels(d.children);
      });
    }
    groups.forEach(g => scanDels(g.tree));
    proposals.forEach(p => {
      if (p.eta_date) { const t = new Date(p.eta_date).getTime(); if (!isNaN(t)) { min = Math.min(min, t); max = Math.max(max, t); } }
    });
    const now = new Date();
    if (!isFinite(min)) {
      min = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      max = new Date(now.getFullYear(), now.getMonth() + 2, 0).getTime();
    }
    // Snap to month boundaries
    const minDate = new Date(min);
    const maxDate = new Date(max);
    return {
      minMs: new Date(minDate.getFullYear(), minDate.getMonth(), 1).getTime(),
      maxMs: new Date(maxDate.getFullYear(), maxDate.getMonth() + 1, 0).getTime(),
    };
  }, [groups, proposals]);

  const startY = new Date(minMs).getFullYear();
  const startM = new Date(minMs).getMonth();
  const endY = new Date(maxMs).getFullYear();
  const endM = new Date(maxMs).getMonth();

  const months = useMemo(() => {
    const ms: { name: string; year: number; weeks: string[] }[] = [];
    for (let y = startY; y <= endY; y++) {
      const mFrom = y === startY ? startM : 0;
      const mTo = y === endY ? endM : 11;
      for (let m = mFrom; m <= mTo; m++) {
        const daysInMonth = new Date(y, m + 1, 0).getDate();
        const weeks: string[] = [];
        for (let i = 0; i < daysInMonth; i += 7) weeks.push(`W${Math.floor(i / 7) + 1}`);
        ms.push({ name: new Date(y, m, 1).toLocaleString('id-ID', { month: 'long' }), year: y, weeks });
      }
    }
    return ms;
  }, [startY, startM, endY, endM]);

  const totalWeeks = months.reduce((acc, m) => acc + m.weeks.length, 0);
  const timelineWidth = totalWeeks * WEEK_WIDTH;
  const chartStartMs = new Date(startY, startM, 1).getTime();
  const chartEndMs = new Date(endY, endM + 1, 0).getTime() + 86400000;
  const totalDuration = chartEndMs - chartStartMs;
  const getX = (ms: number) => ((ms - chartStartMs) / totalDuration) * 100;

  const now = new Date();
  const todayX =
    now.getTime() >= chartStartMs && now.getTime() <= chartEndMs
      ? getX(now.getTime())
      : null;

  // Flatten into render rows
  type Row =
    | { kind: 'project'; name: string }
    | { kind: 'deliverable'; d: Deliverable; depth: number; hasChildren: boolean };

  const rows: Row[] = [];
  function flatten(ns: Deliverable[], depth = 0) {
    ns.forEach(n => {
      const hasChildren = !!(n.children && n.children.length > 0);
      rows.push({ kind: 'deliverable', d: n, depth, hasChildren });
      if (hasChildren && !collapsed.has(n.id)) flatten(n.children!, depth + 1);
    });
  }
  groups.forEach(g => {
    if (g.tree.length > 0) {
      rows.push({ kind: 'project', name: g.projectName });
      flatten(g.tree);
    }
  });

  const isPMView = !!contributorColorMap;

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
                    {w}
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
              {rows.map((row, ri) => {
                if (row.kind === 'project') {
                  return (
                    <div key={`proj-${ri}-${row.name}`} style={{ display: 'flex', alignItems: 'center', height: 34, borderBottom: '1px solid var(--border-1)', background: 'var(--bg-2)', position: 'relative' }}>
                      <div style={{ width: LABEL_WIDTH, flexShrink: 0, paddingLeft: 16, paddingRight: 12, zIndex: 10, background: 'var(--bg-2)', position: 'sticky', left: 0, height: '100%', borderRight: '1px solid var(--border-1)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{row.name}</span>
                      </div>
                      <div style={{ flexGrow: 1 }} />
                    </div>
                  );
                }

                const { d, depth, hasChildren } = row;
                const s = d.start_date ? new Date(d.start_date).getTime() : null;
                const e = d.due_date ? new Date(d.due_date).getTime() : null;
                const contributor = acceptedByDeliverable.get(d.id);
                const pendingProps = pendingByDeliverable.get(d.id) ?? [];

                // Bar color
                const isAssignedToMe = assignedDeliverableIds?.has(d.id);
                const isUnassigned = !contributor && !isAssignedToMe;
                let barColor: string;
                if (contributor && contributorColorMap) {
                  barColor = contributorColorMap.get(contributor.id) ?? 'var(--kamel-blue)';
                } else if (isAssignedToMe) {
                  barColor = 'var(--kamel-blue)';
                } else if (!isPMView && !isAssignedToMe) {
                  barColor = 'var(--amber)';
                } else {
                  barColor = 'var(--fg-4)';
                }

                const isPendingFakeNode = !isPMView && !isAssignedToMe;

                // Dimming logic for PM filter
                let isDimmed = false;
                if (isPMView) {
                  if (isUnassigned) {
                    isDimmed = !showUnassigned;
                  } else if (contributor && selectedContributors) {
                    isDimmed = !selectedContributors.has(contributor.id);
                  }
                }

                // ── Collapsed-parent stacked mode ──────────────────────────
                const isCollapsedParent = hasChildren && collapsed.has(d.id);
                const directChildren = isCollapsedParent ? (d.children ?? []) : [];

                const childBars = directChildren.map(child => {
                  const cs = child.start_date ? new Date(child.start_date).getTime() : null;
                  const ce = child.due_date   ? new Date(child.due_date).getTime()   : null;
                  const childPIC = acceptedByDeliverable.get(child.id);
                  const color = isPMView
                    ? (childPIC && contributorColorMap
                        ? contributorColorMap.get(childPIC.id) ?? 'var(--fg-4)'
                        : 'var(--fg-4)')
                    : (childPIC ? 'var(--kamel-blue)' : 'var(--amber)');
                  return { child, cs, ce, color, picName: childPIC?.name ?? null };
                }).filter(b => b.cs !== null || b.ce !== null);

                // Wrapper = soft rect spanning all child date ranges
                let wrapperLeftPct: number | null = null;
                let wrapperWidthPct = 0;
                if (childBars.length > 0) {
                  const wMin = childBars.reduce((m, b) => Math.min(m, b.cs ?? b.ce ?? Infinity), Infinity);
                  const wMax = childBars.reduce((m, b) => Math.max(m, b.ce ?? b.cs ?? -Infinity), -Infinity);
                  if (isFinite(wMin) && isFinite(wMax)) {
                    wrapperLeftPct = getX(wMin);
                    wrapperWidthPct = Math.max(0.5, getX(wMax) - wrapperLeftPct);
                  }
                }

                // Row height grows to fit stacked bars
                const stackedRowH = isCollapsedParent && childBars.length > 0
                  ? Math.max(44, STACK_PAD * 2 + childBars.length * (STACK_BAR_H + STACK_GAP) - STACK_GAP)
                  : 44;

                let leftPct = 0, widthPct = 0, isPoint = false;
                if (s && e) { leftPct = getX(s); widthPct = getX(e) - leftPct; }
                else if (s || e) { leftPct = getX(s ?? e ?? 0); isPoint = true; }

                const barBg = isPendingFakeNode
                  ? `repeating-linear-gradient(45deg, ${barColor} 0, ${barColor} 4px, transparent 4px, transparent 9px)`
                  : barColor;

                return (
                  <Fragment key={d.id}>
                    <div style={{
                      display: 'flex', alignItems: 'stretch', height: stackedRowH,
                      borderBottom: pendingProps.length === 0 ? '1px solid var(--border-1)' : 'none',
                      position: 'relative',
                      opacity: isDimmed ? 0.12 : 1,
                      transition: 'opacity 0.15s',
                    }}>
                      <div style={{
                        width: LABEL_WIDTH, flexShrink: 0,
                        paddingLeft: 16 + depth * 20, paddingRight: 12,
                        display: 'flex', alignItems: 'center', gap: 8,
                        zIndex: 10, background: 'var(--bg-1)', position: 'sticky', left: 0,
                        height: '100%', borderRight: '1px solid var(--border-1)',
                      }}>
                        {hasChildren ? (
                          <button
                            onClick={() => toggleCollapse(d.id)}
                            aria-label={collapsed.has(d.id) ? `Expand ${d.title}` : `Collapse ${d.title}`}
                            aria-expanded={!collapsed.has(d.id)}
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0, color: 'var(--fg-3)', transform: collapsed.has(d.id) ? 'rotate(-90deg)' : 'none', transition: 'transform 0.2s' }}
                          >
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                          </button>
                        ) : (
                          <div style={{ width: 14, flexShrink: 0 }} />
                        )}
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <div style={{ fontSize: 13, fontWeight: depth === 0 ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: depth === 0 ? 'var(--fg-1)' : 'var(--fg-2)' }}>
                            {d.title}
                          </div>
                          {isCollapsedParent && directChildren.length > 0 ? (
                            <div style={{ fontSize: 10, color: 'var(--fg-4)' }}>
                              {directChildren.length} sub-deliverable{directChildren.length !== 1 ? 's' : ''}
                            </div>
                          ) : contributor ? (
                            <div style={{ fontSize: 10, color: 'var(--fg-4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {contributor.name}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div style={{ flexGrow: 1, position: 'relative', height: '100%' }}>
                        {isCollapsedParent && childBars.length > 0 ? (
                          <>
                            {/* Soft wrapper background spanning all children */}
                            {wrapperLeftPct !== null && (
                              <div style={{
                                position: 'absolute',
                                left: `${wrapperLeftPct}%`,
                                width: `${wrapperWidthPct}%`,
                                top: STACK_PAD - 2,
                                bottom: STACK_PAD - 2,
                                background: 'rgba(120,120,140,0.07)',
                                border: '1px solid rgba(120,120,140,0.14)',
                                borderRadius: 0,
                                zIndex: 1,
                              }} />
                            )}
                            {/* Stacked child bars — flush, no gap, no rounded */}
                            {childBars.map((b, ci) => {
                              let cLeft = 0, cWidth = 0, cPoint = false;
                              if (b.cs && b.ce) { cLeft = getX(b.cs); cWidth = Math.max(0.4, getX(b.ce) - cLeft); }
                              else if (b.cs || b.ce) { cLeft = getX(b.cs ?? b.ce ?? 0); cPoint = true; }
                              const topOffset = STACK_PAD + ci * STACK_BAR_H;
                              const picLine = b.picName ? `\nPIC: ${b.picName}` : '\nPIC: Unassigned';
                              const tooltip = `${b.child.title}${picLine}\nStart: ${b.child.start_date ? formatDate(b.child.start_date) : '?'}\nEnd: ${b.child.due_date ? formatDate(b.child.due_date) : '?'}`;
                              return (
                                <div
                                  key={b.child.id}
                                  title={tooltip}
                                  style={{
                                    position: 'absolute',
                                    left: `${cLeft}%`,
                                    width: cPoint ? 10 : `${cWidth}%`,
                                    height: STACK_BAR_H,
                                    top: topOffset,
                                    background: b.color,
                                    borderRadius: 0,
                                    zIndex: 2,
                                    minWidth: cPoint ? 10 : 4,
                                    opacity: 0.9,
                                  }}
                                />
                              );
                            })}
                          </>
                        ) : (
                          /* Normal single bar */
                          (s || e) && (
                            <div
                              title={`${d.title}\nStart: ${d.start_date ? formatDate(d.start_date) : '?'}\nEnd: ${d.due_date ? formatDate(d.due_date) : '?'}${contributor ? `\nAssigned: ${contributor.name}` : ''}`}
                              style={{
                                position: 'absolute',
                                left: `${leftPct}%`,
                                width: isPoint ? 'auto' : `${Math.max(0.5, widthPct)}%`,
                                height: 24, top: '50%', transform: 'translateY(-50%)',
                                background: barBg,
                                borderRadius: isPoint ? '12px' : '4px',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                zIndex: 2, minWidth: isPoint ? 22 : 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                opacity: isUnassigned && isPMView ? 0.45 : 1,
                              }}
                            >
                              {isPoint && <div style={{ width: 8, height: 8, background: 'white', borderRadius: '50%' }} />}
                            </div>
                          )
                        )}
                      </div>
                    </div>

                    {/* Pending proposal sub-rows (PM view only) */}
                    {isPMView && pendingProps.map((p, pi) => {
                      const etaMs = p.eta_date ? new Date(p.eta_date).getTime() : null;
                      const etaLeft = etaMs ? getX(etaMs) : 0;
                      const isLast = pi === pendingProps.length - 1;
                      const propColor = contributorColorMap?.get(p.contributor_id) ?? 'var(--amber)';
                      const isPropDimmed = selectedContributors !== undefined && !selectedContributors.has(p.contributor_id);
                      return (
                        <div key={`p-${p.id}`} style={{
                          display: 'flex', alignItems: 'center', height: 30,
                          borderBottom: isLast ? '1px solid var(--border-1)' : 'none',
                          position: 'relative',
                          opacity: isPropDimmed ? 0.08 : 0.85,
                        }}>
                          <div style={{
                            width: LABEL_WIDTH, flexShrink: 0,
                            paddingLeft: 16 + (depth + 1) * 20, paddingRight: 12,
                            display: 'flex', alignItems: 'center',
                            zIndex: 10, background: 'var(--bg-1)', position: 'sticky', left: 0,
                            height: '100%', borderRight: '1px solid var(--border-1)',
                          }}>
                            <span style={{ fontSize: 11, color: 'var(--fg-4)', fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              ↳ {p.contributor_name ?? 'Contributor'} — ETA
                            </span>
                          </div>
                          <div style={{ flexGrow: 1, position: 'relative', height: '100%' }}>
                            {etaMs && (
                              <div
                                title={`${p.contributor_name ?? 'Contributor'} — ETA: ${formatDate(p.eta_date!)}`}
                                style={{
                                  position: 'absolute',
                                  left: `${etaLeft}%`,
                                  height: 18, top: '50%', transform: 'translateY(-50%)',
                                  background: `repeating-linear-gradient(45deg, ${propColor} 0, ${propColor} 3px, transparent 3px, transparent 7px)`,
                                  borderRadius: 3,
                                  zIndex: 2,
                                  width: 22, minWidth: 22,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}
                              >
                                <div style={{ width: 5, height: 5, background: 'white', borderRadius: '50%' }} />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </Fragment>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {showLegend && (
        <div style={{ display: 'flex', gap: 16, padding: '10px 16px', borderTop: '1px solid var(--border-1)', fontSize: 12, color: 'var(--fg-3)', flexWrap: 'wrap', alignItems: 'center' }}>
          {isPMView ? (
            <>
              {contributors?.map((c, i) => {
                const color = CONTRIBUTOR_COLORS[i % CONTRIBUTOR_COLORS.length];
                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 20, height: 10, background: color, borderRadius: 2 }} />
                    {c.name}
                  </div>
                );
              })}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 20, height: 10, background: 'var(--fg-4)', borderRadius: 2, opacity: 0.5 }} />
                Unassigned
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 20, height: 10, borderRadius: 2, background: 'repeating-linear-gradient(45deg, var(--fg-3) 0, var(--fg-3) 3px, transparent 3px, transparent 7px)', opacity: 0.7 }} />
                Pending bid ETA
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
          )}
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
