import { useState, useEffect, useMemo, useCallback } from 'react';
import { kanbanApi } from '../../api';
import type { KanbanTask } from '../../types';

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  backlog:     { bg: '#F3F4F6', text: '#6B7280', border: '#D1D5DB' },
  todo:        { bg: '#DBEAFE', text: '#1D4ED8', border: '#BFDBFE' },
  in_progress: { bg: '#FEF3C7', text: '#B45309', border: '#FDE68A' },
  done:        { bg: '#D1FAE5', text: '#065F46', border: '#A7F3D0' },
};

const STATUS_LABELS: Record<string, string> = {
  backlog: 'Backlog', todo: 'To Do', in_progress: 'In Progress', done: 'Done',
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function buildGrid(monthStart: Date): Date[] {
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid: Date[] = [];
  for (let i = firstDow - 1; i >= 0; i--) grid.push(new Date(year, month, -i));
  for (let d = 1; d <= daysInMonth; d++) grid.push(new Date(year, month, d));
  const tail = (7 - (grid.length % 7)) % 7;
  for (let i = 1; i <= tail; i++) grid.push(new Date(year, month + 1, i));
  return grid;
}

// ── Task pill ─────────────────────────────────────────────────────────────────

function TaskPill({ task, onClick }: { task: KanbanTask; onClick: () => void }) {
  const s = STATUS_STYLE[task.status] ?? STATUS_STYLE.backlog;
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={`${task.title} — ${STATUS_LABELS[task.status] ?? task.status}`}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: '2px 6px', marginBottom: 2,
        borderRadius: 'var(--radius-sm)',
        background: isOverdue ? '#FEE2E2' : s.bg,
        color: isOverdue ? '#991B1B' : s.text,
        border: `1px solid ${isOverdue ? '#FECACA' : s.border}`,
        font: '500 11px/1.4 var(--font-sans)',
        cursor: 'pointer', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
        maxWidth: '100%',
      }}
    >
      {task.title}
    </button>
  );
}

// ── Calendar cell ─────────────────────────────────────────────────────────────

function CalendarCell({
  date, isCurrentMonth, isToday, tasks, maxVisible, onSelectTask, onClickDate, canCreate,
}: {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  tasks: KanbanTask[];
  maxVisible: number;
  onSelectTask: (t: KanbanTask) => void;
  onClickDate: (dateStr: string) => void;
  canCreate: boolean;
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? tasks : tasks.slice(0, maxVisible);
  const overflow = tasks.length - maxVisible;
  const dateStr = toDateKey(date);

  return (
    <div
      onClick={() => canCreate && onClickDate(dateStr)}
      style={{
        minHeight: 100, padding: '6px 5px 4px',
        borderRight: '1px solid var(--border-1)',
        borderBottom: '1px solid var(--border-1)',
        background: isToday ? 'rgba(37,99,235,0.04)' : isCurrentMonth ? 'var(--bg-1)' : 'var(--bg-0)',
        cursor: canCreate ? 'pointer' : 'default',
        position: 'relative',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => { if (canCreate) (e.currentTarget as HTMLDivElement).style.background = isToday ? 'rgba(37,99,235,0.07)' : 'var(--bg-2)'; }}
      onMouseLeave={e => { if (canCreate) (e.currentTarget as HTMLDivElement).style.background = isToday ? 'rgba(37,99,235,0.04)' : isCurrentMonth ? 'var(--bg-1)' : 'var(--bg-0)'; }}
    >
      {/* Day number */}
      <div style={{ marginBottom: 4, display: 'flex', justifyContent: 'center' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 24, height: 24, borderRadius: '50%',
          font: `${isToday ? 700 : 500} 12px/1 var(--font-sans)`,
          color: isToday ? '#fff' : isCurrentMonth ? 'var(--fg-1)' : 'var(--fg-4)',
          background: isToday ? 'var(--kamel-blue)' : 'transparent',
          flexShrink: 0,
        }}>
          {date.getDate()}
        </span>
      </div>

      {/* Task pills */}
      <div onClick={e => e.stopPropagation()}>
        {visible.map(t => (
          <TaskPill key={t.id} task={t} onClick={() => onSelectTask(t)} />
        ))}
        {!showAll && overflow > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowAll(true); }}
            style={{
              display: 'block', width: '100%', padding: '2px 6px',
              border: 'none', background: 'transparent',
              font: '500 10px/1.4 var(--font-sans)', color: 'var(--kamel-blue)',
              cursor: 'pointer', textAlign: 'left',
            }}
          >
            +{overflow} more
          </button>
        )}
        {showAll && tasks.length > maxVisible && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowAll(false); }}
            style={{
              display: 'block', width: '100%', padding: '2px 6px',
              border: 'none', background: 'transparent',
              font: '500 10px/1.4 var(--font-sans)', color: 'var(--fg-3)',
              cursor: 'pointer', textAlign: 'left',
            }}
          >
            show less
          </button>
        )}
      </div>
    </div>
  );
}

// ── CalendarView ──────────────────────────────────────────────────────────────

export interface CalendarViewProps {
  mineOnly: boolean;
  filterProject?: string;
  filterDeliverable?: string;
  filterContributor?: string;
  hideArchived?: boolean;
  canCreate: boolean;
  onSelectTask: (t: KanbanTask) => void;
  onCreateAtDate?: (date: string) => void;
}

export function CalendarView({
  mineOnly, filterProject, filterDeliverable, filterContributor, hideArchived,
  canCreate, onSelectTask, onCreateAtDate,
}: CalendarViewProps) {
  const [tasks, setTasks] = useState<KanbanTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        limit: 500, offset: 0,
        project_id: filterProject || undefined,
        deliverable_id: filterDeliverable || undefined,
        assigned_to: filterContributor || undefined,
        hide_archived: hideArchived,
      };
      const res = mineOnly ? await kanbanApi.mine(params) : await kanbanApi.list(params);
      setTasks(res.items);
    } finally {
      setLoading(false);
    }
  }, [mineOnly, filterProject, filterDeliverable, filterContributor, hideArchived]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const grid = useMemo(() => buildGrid(currentMonth), [currentMonth]);

  const tasksByDate = useMemo(() => {
    const map: Record<string, KanbanTask[]> = {};
    for (const t of tasks) {
      if (!t.due_date) continue;
      const key = t.due_date.slice(0, 10);
      (map[key] ??= []).push(t);
    }
    return map;
  }, [tasks]);

  const undatedTasks = useMemo(() => tasks.filter(t => !t.due_date), [tasks]);

  const today = new Date();
  const todayKey = toDateKey(today);

  function prevMonth() { setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1)); }
  function nextMonth() { setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1)); }
  function goToday() {
    const d = new Date();
    setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1));
  }

  const monthLabel = `${MONTH_NAMES[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;
  const isCurrentMonthToday = currentMonth.getMonth() === today.getMonth() && currentMonth.getFullYear() === today.getFullYear();

  // Count tasks in current month view
  const monthStart = currentMonth;
  const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
  const tasksInMonth = tasks.filter(t => {
    if (!t.due_date) return false;
    const d = new Date(t.due_date);
    return d >= monthStart && d <= monthEnd;
  }).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '8px 0 10px', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={prevMonth}
            style={{
              width: 28, height: 28, border: '1px solid var(--border-1)',
              borderRadius: 'var(--radius-sm)', background: 'var(--bg-1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--fg-2)',
            }}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <button
            onClick={nextMonth}
            style={{
              width: 28, height: 28, border: '1px solid var(--border-1)',
              borderRadius: 'var(--radius-sm)', background: 'var(--bg-1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--fg-2)',
            }}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>

        <span style={{ font: '600 15px/1 var(--font-sans)', color: 'var(--fg-0)', minWidth: 160 }}>
          {monthLabel}
        </span>

        {!isCurrentMonthToday && (
          <button
            onClick={goToday}
            style={{
              height: 26, padding: '0 10px',
              border: '1px solid var(--border-1)',
              borderRadius: 'var(--radius-sm)', background: 'var(--bg-1)',
              font: '500 12px/1 var(--font-sans)', color: 'var(--fg-2)',
              cursor: 'pointer',
            }}
          >
            Today
          </button>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {loading && (
            <span style={{ font: '400 12px/1 var(--font-sans)', color: 'var(--fg-3)' }}>Loading…</span>
          )}
          {!loading && (
            <span style={{ font: '400 12px/1 var(--font-sans)', color: 'var(--fg-3)' }}>
              {tasksInMonth} task{tasksInMonth !== 1 ? 's' : ''} this month
            </span>
          )}
          {/* Legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {Object.entries(STATUS_LABELS).map(([key, label]) => {
              const s = STATUS_STYLE[key];
              return (
                <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: s.text, display: 'inline-block',
                  }} />
                  <span style={{ font: '400 11px/1 var(--font-sans)', color: 'var(--fg-3)' }}>{label}</span>
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Calendar grid */}
      <div style={{
        flex: 1, minHeight: 0,
        display: 'flex', flexDirection: 'column',
        border: '1px solid var(--border-1)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        background: 'var(--border-1)',
      }}>
        {/* Day headers */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
          background: 'var(--bg-2)',
          borderBottom: '1px solid var(--border-1)',
          flexShrink: 0,
        }}>
          {DAY_NAMES.map(d => (
            <div key={d} style={{
              padding: '6px 0',
              textAlign: 'center',
              font: '600 11px/1 var(--font-sans)',
              color: 'var(--fg-3)',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              borderRight: '1px solid var(--border-1)',
            }}>
              {d}
            </div>
          ))}
        </div>

        {/* Weeks */}
        <div style={{
          flex: 1, minHeight: 0, overflowY: 'auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gridAutoRows: 'minmax(100px, 1fr)',
          background: 'var(--border-1)',
          gap: 0,
        }}>
          {grid.map((date, i) => {
            const key = toDateKey(date);
            const cellTasks = tasksByDate[key] ?? [];
            const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
            return (
              <CalendarCell
                key={i}
                date={date}
                isCurrentMonth={isCurrentMonth}
                isToday={key === todayKey}
                tasks={cellTasks}
                maxVisible={3}
                onSelectTask={onSelectTask}
                onClickDate={(ds) => onCreateAtDate?.(ds)}
                canCreate={canCreate}
              />
            );
          })}
        </div>
      </div>

      {/* Undated tasks */}
      {undatedTasks.length > 0 && (
        <div style={{
          marginTop: 12, flexShrink: 0,
          border: '1px solid var(--border-1)',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-1)',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '8px 14px',
            borderBottom: '1px solid var(--border-1)',
            background: 'var(--bg-2)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="var(--fg-3)" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span style={{ font: '600 12px/1 var(--font-sans)', color: 'var(--fg-2)' }}>
              Undated Tasks ({undatedTasks.length})
            </span>
            <span style={{ font: '400 11px/1 var(--font-sans)', color: 'var(--fg-3)' }}>
              Set a due date to appear on the calendar
            </span>
          </div>
          <div style={{
            padding: '8px 14px',
            display: 'flex', flexWrap: 'wrap', gap: 6,
          }}>
            {undatedTasks.map(t => {
              const s = STATUS_STYLE[t.status] ?? STATUS_STYLE.backlog;
              return (
                <button
                  key={t.id}
                  onClick={() => onSelectTask(t)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-pill)',
                    background: s.bg,
                    color: s.text,
                    border: `1px solid ${s.border}`,
                    font: '500 12px/1.4 var(--font-sans)',
                    cursor: 'pointer',
                    maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                  title={`${t.title} — ${STATUS_LABELS[t.status] ?? t.status}`}
                >
                  {t.title}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
