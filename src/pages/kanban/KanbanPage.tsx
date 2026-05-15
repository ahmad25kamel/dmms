import React, { useEffect, useState, useCallback, useRef } from 'react';
import { kanbanApi, projectsApi, usersApi } from '../../api';
import type { KanbanTask, KanbanComment, Project, User } from '../../types';
import { Button, Modal, FormField, Input, Select, Spinner, Alert, MentionsTextarea } from '../../components/ui';
import { formatDate } from '../../lib/statusColors';
import { useAuth } from '../../store/authStore';

type KanbanStatus = 'backlog' | 'todo' | 'in_progress' | 'done';

function Avatar({ name, size = 24 }: { name?: string | null; size?: number }) {
  if (!name) return null;
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const hue = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div title={name} style={{
      width: size, height: size, borderRadius: '50%',
      background: `hsl(${hue}, 60%, 45%)`, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.42, fontWeight: 700, flexShrink: 0,
      border: '2px solid var(--bg-1)',
    }}>
      {initials}
    </div>
  );
}

function daysUntil(dateStr: string): { label: string; urgent: boolean } {
  const diff = Math.ceil((new Date(dateStr).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000);
  if (diff === 0) return { label: 'Due today', urgent: true };
  if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, urgent: true };
  if (diff <= 3) return { label: `-${diff}d`, urgent: true };
  return { label: `-${diff}d`, urgent: false };
}

const COLUMNS: { key: KanbanStatus; label: string; color: string }[] = [
  { key: 'backlog',     label: 'Backlog',      color: 'var(--fg-4)' },
  { key: 'todo',        label: 'To Do',         color: 'var(--kamel-blue)' },
  { key: 'in_progress', label: 'In Progress',   color: 'var(--amber)' },
  { key: 'done',        label: 'Done',          color: 'var(--emerald)' },
];

export function KanbanPage() {
  const { user } = useAuth();
  if (!user) return null;
  return user.role === 'pm' || user.role === 'admin' ? <PMKanban /> : <ContributorKanban />;
}

// ── PM View ──────────────────────────────────────────────────────────────────

function PMKanban() {
  const [tasksMap, setTasksMap] = useState<Record<KanbanStatus, KanbanTask[]>>({
    backlog: [], todo: [], in_progress: [], done: []
  });
  const [totalCounts, setTotalCounts] = useState<Record<KanbanStatus, number>>({
    backlog: 0, todo: 0, in_progress: 0, done: 0
  });
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [filterProject, setFilterProject] = useState('');
  const [filterContributor, setFilterContributor] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<KanbanTask | null>(null);
  // resetKey increments on filter change, passed to columns so they reset their hasMore state
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    projectsApi.list().then(setProjects);
    usersApi.list().then(setUsers);
  }, []);

  const loadMore = useCallback(async (status: KanbanStatus, offset: number) => {
    const params: Record<string, string | number> = { status, limit: 20, offset };
    if (filterProject) params.project_id = filterProject;
    if (filterContributor) params.assigned_to = filterContributor;

    const { items: newTasks, total } = await kanbanApi.list(params);
    setTasksMap(prev => ({
      ...prev,
      [status]: offset === 0 ? newTasks : [...prev[status], ...newTasks]
    }));
    setTotalCounts(prev => ({ ...prev, [status]: total }));
    return newTasks.length;
  }, [filterProject, filterContributor]);

  useEffect(() => {
    setResetKey(k => k + 1);
    COLUMNS.forEach(col => loadMore(col.key, 0));
  }, [loadMore]);

  async function moveTask(taskId: string, sourceStatus: KanbanStatus, destStatus: KanbanStatus, dropIndex: number) {
    const task = tasksMap[sourceStatus].find(t => t.id === taskId);
    if (!task) return;
    let updatedDestTasks: KanbanTask[] = [];
    setTasksMap(prev => {
      const newMap = { ...prev };
      newMap[sourceStatus] = newMap[sourceStatus].filter(t => t.id !== taskId);
      const updatedTask = { ...task, status: destStatus };
      updatedDestTasks = [...newMap[destStatus]];
      updatedDestTasks.splice(dropIndex, 0, updatedTask);
      updatedDestTasks.forEach((t, i) => { t.position = i; });
      newMap[destStatus] = updatedDestTasks;
      return newMap;
    });
    await kanbanApi.reorder(updatedDestTasks.map(t => ({ id: t.id, status: destStatus, position: t.position })));
  }

  return (
    <div className="dmms-page" style={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', gap: 0, padding: '12px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexShrink: 0, marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <h1 style={{ margin: 0, font: '600 17px/1.2 var(--font-sans)', color: 'var(--fg-0)' }}>Kanban Board</h1>
          <span style={{ font: '400 12px/1 var(--font-sans)', color: 'var(--fg-3)' }}>Monitor all task progress across projects</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Select value={filterProject} onChange={e => setFilterProject(e.target.value)} style={{ width: 160, height: 28, fontSize: 12 }}>
            <option value="">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <Select value={filterContributor} onChange={e => setFilterContributor(e.target.value)} style={{ width: 160, height: 28, fontSize: 12 }}>
            <option value="">All Contributors</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
          {(filterProject || filterContributor) && (
            <Button variant="ghost" size="sm" onClick={() => { setFilterProject(''); setFilterContributor(''); }}>Clear</Button>
          )}
          <Button onClick={() => setShowCreate(true)} size="sm">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Task
          </Button>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflowX: 'auto' }}>
        <KanbanBoard tasksMap={tasksMap} totalCounts={totalCounts} resetKey={resetKey} onMove={moveTask} onSelect={setSelected} onLoadMore={loadMore} />
      </div>

      {showCreate && (
        <CreateTaskModal
          projects={projects}
          users={users}
          onClose={() => setShowCreate(false)}
          onCreate={(t) => {
            setTasksMap(prev => ({ ...prev, [t.status]: [t, ...prev[t.status]] }));
            setShowCreate(false);
          }}
        />
      )}

      {selected && (
        <TaskDetailModal
          task={selected}
          users={users}
          onClose={() => setSelected(null)}
          onUpdated={(updated) => {
            setTasksMap(prev => {
              const newMap = { ...prev };
              const oldStatus = selected.status;
              const newStatus = updated.status;
              if (oldStatus !== newStatus) {
                newMap[oldStatus] = newMap[oldStatus].filter(x => x.id !== updated.id);
                newMap[newStatus] = [updated, ...newMap[newStatus]];
              } else {
                newMap[oldStatus] = newMap[oldStatus].map(x => x.id === updated.id ? updated : x);
              }
              return newMap;
            });
            setSelected(updated);
          }}
          onDeleted={(id) => {
            setTasksMap(prev => {
              const newMap = { ...prev };
              newMap[selected.status] = newMap[selected.status].filter(t => t.id !== id);
              return newMap;
            });
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}

// ── Contributor View ──────────────────────────────────────────────────────────

function ContributorKanban() {
  const { user } = useAuth();
  const [tasksMap, setTasksMap] = useState<Record<KanbanStatus, KanbanTask[]>>({
    backlog: [], todo: [], in_progress: [], done: []
  });
  const [totalCounts, setTotalCounts] = useState<Record<KanbanStatus, number>>({
    backlog: 0, todo: 0, in_progress: 0, done: 0
  });
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState<KanbanTask | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [resetKey] = useState(0);

  useEffect(() => {
    projectsApi.list().then(setProjects);
    usersApi.list().then(setUsers);
  }, []);

  const loadMore = useCallback(async (status: KanbanStatus, offset: number) => {
    const { items: newTasks, total } = await kanbanApi.mine({ status, limit: 20, offset });
    setTasksMap(prev => ({
      ...prev,
      [status]: offset === 0 ? newTasks : [...prev[status], ...newTasks]
    }));
    setTotalCounts(prev => ({ ...prev, [status]: total }));
    return newTasks.length;
  }, []);

  useEffect(() => {
    COLUMNS.forEach(col => loadMore(col.key, 0));
  }, [loadMore]);

  async function moveTask(taskId: string, sourceStatus: KanbanStatus, destStatus: KanbanStatus, dropIndex: number) {
    const task = tasksMap[sourceStatus].find(t => t.id === taskId);
    if (!task) return;
    let updatedDestTasks: KanbanTask[] = [];
    setTasksMap(prev => {
      const newMap = { ...prev };
      newMap[sourceStatus] = newMap[sourceStatus].filter(t => t.id !== taskId);
      const updatedTask = { ...task, status: destStatus };
      updatedDestTasks = [...newMap[destStatus]];
      updatedDestTasks.splice(dropIndex, 0, updatedTask);
      updatedDestTasks.forEach((t, i) => { t.position = i; });
      newMap[destStatus] = updatedDestTasks;
      return newMap;
    });
    await kanbanApi.reorder(updatedDestTasks.map(t => ({ id: t.id, status: destStatus, position: t.position })));
  }

  if (!user) return null;

  return (
    <div className="dmms-page" style={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', gap: 0, padding: '12px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexShrink: 0, marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <h1 style={{ margin: 0, font: '600 17px/1.2 var(--font-sans)', color: 'var(--fg-0)' }}>My Task Board</h1>
          <span style={{ font: '400 12px/1 var(--font-sans)', color: 'var(--fg-3)' }}>Your personal kanban — tasks across all assigned deliverables</span>
        </div>
        <Button onClick={() => setShowCreate(true)} size="sm">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Task
        </Button>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflowX: 'auto' }}>
        <KanbanBoard tasksMap={tasksMap} totalCounts={totalCounts} resetKey={resetKey} onMove={moveTask} onSelect={setSelected} onLoadMore={loadMore} />
      </div>

      {showCreate && (
        <CreateTaskModal
          projects={projects}
          assignedTo={user.id}
          users={users}
          onClose={() => setShowCreate(false)}
          onCreate={(t) => {
            setTasksMap(prev => ({ ...prev, [t.status]: [t, ...prev[t.status]] }));
            setShowCreate(false);
          }}
        />
      )}

      {selected && (
        <TaskDetailModal
          task={selected}
          users={users}
          onClose={() => setSelected(null)}
          onUpdated={(updated) => {
            setTasksMap(prev => {
              const newMap = { ...prev };
              const oldStatus = selected.status;
              const newStatus = updated.status;
              if (oldStatus !== newStatus) {
                newMap[oldStatus] = newMap[oldStatus].filter(x => x.id !== updated.id);
                newMap[newStatus] = [updated, ...newMap[newStatus]];
              } else {
                newMap[oldStatus] = newMap[oldStatus].map(x => x.id === updated.id ? updated : x);
              }
              return newMap;
            });
            setSelected(updated);
          }}
          onDeleted={(id) => {
            setTasksMap(prev => {
              const newMap = { ...prev };
              newMap[selected.status] = newMap[selected.status].filter(t => t.id !== id);
              return newMap;
            });
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}

// ── Kanban Board ──────────────────────────────────────────────────────────────

function KanbanBoard({ tasksMap, totalCounts, resetKey, onMove, onSelect, onLoadMore }: {
  tasksMap: Record<KanbanStatus, KanbanTask[]>;
  totalCounts: Record<KanbanStatus, number>;
  resetKey: number;
  onMove: (id: string, source: KanbanStatus, dest: KanbanStatus, index: number) => void;
  onSelect: (t: KanbanTask) => void;
  onLoadMore: (status: KanbanStatus, offset: number) => Promise<number>;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(260px, 1fr))', gap: 16, flex: 1, minHeight: 0, alignItems: 'stretch' }}>
      {COLUMNS.map(col => (
        <KanbanColumn
          key={col.key}
          status={col.key}
          label={col.label}
          color={col.color}
          tasks={tasksMap[col.key]}
          totalCount={totalCounts[col.key]}
          resetKey={resetKey}
          onMove={onMove}
          onSelect={onSelect}
          onLoadMore={onLoadMore}
        />
      ))}
    </div>
  );
}

function KanbanColumn({ status, label, color, tasks, totalCount, resetKey, onMove, onSelect, onLoadMore }: {
  status: KanbanStatus;
  label: string;
  color: string;
  tasks: KanbanTask[];
  totalCount: number;
  resetKey: number;
  onMove: (id: string, source: KanbanStatus, dest: KanbanStatus, index: number) => void;
  onSelect: (t: KanbanTask) => void;
  onLoadMore: (status: KanbanStatus, offset: number) => Promise<number>;
}) {
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [loadError, setLoadError] = useState(false);
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(true);

  // Reset hasMore when filters change (parent reloads from offset 0)
  useEffect(() => {
    hasMoreRef.current = true;
  }, [resetKey]);

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverIndex(null);
    const id = e.dataTransfer.getData('taskId');
    const sourceStatus = e.dataTransfer.getData('sourceStatus') as KanbanStatus;
    if (id) onMove(id, sourceStatus, status, index);
  };

  const handleScroll = async (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop <= el.clientHeight + 80 && !loadingRef.current && hasMoreRef.current) {
      loadingRef.current = true;
      setLoadError(false);
      try {
        const count = await onLoadMore(status, tasks.length);
        hasMoreRef.current = count === 20;
      } catch {
        setLoadError(true);
      } finally {
        loadingRef.current = false;
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px 12px' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
        <span style={{ fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--fg-1)' }}>{label}</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--fg-4)', fontWeight: 600, background: 'var(--bg-3)', padding: '2px 8px', borderRadius: 10 }}>
          {tasks.length}{totalCount > tasks.length ? `/${totalCount}` : ''}
        </span>
      </div>

      <div
        onScroll={handleScroll}
        onDragOver={(e) => handleDragOver(e, tasks.length)}
        onDrop={(e) => handleDrop(e, tasks.length)}
        onDragLeave={() => setDragOverIndex(null)}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          background: 'var(--bg-2)',
          borderRadius: 'var(--radius-lg)',
          padding: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          border: '1px solid var(--border-1)'
        }}
      >
        {tasks.map((t, index) => (
          <React.Fragment key={t.id}>
            <div
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              style={{
                height: dragOverIndex === index ? 40 : 0,
                background: 'var(--kamel-blue-soft)',
                borderRadius: 'var(--radius-md)',
                transition: 'all 0.2s'
              }}
            />
            <KanbanCard task={t} onSelect={onSelect} />
          </React.Fragment>
        ))}
        {loadingRef.current && <Spinner />}
        {loadError && (
          <div style={{ fontSize: 12, color: 'var(--fg-3)', textAlign: 'center', padding: '8px 0' }}>
            Failed to load more.{' '}
            <button
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--kamel-blue)', fontSize: 12, textDecoration: 'underline', padding: 0 }}
              onClick={() => { setLoadError(false); onLoadMore(status, tasks.length).catch(() => setLoadError(true)); }}
            >
              Retry
            </button>
          </div>
        )}
        <div style={{ height: 20, flexShrink: 0 }} />
      </div>
    </div>
  );
}

function KanbanCard({ task: t, onSelect }: {
  task: KanbanTask;
  onSelect: (t: KanbanTask) => void;
}) {
  // Effective deadline: task's own due_date, falling back to deliverable's due_date
  const effectiveDue = t.due_date || t.deliverable_due_date;
  const isFromDeliverable = !t.due_date && !!t.deliverable_due_date;
  const taskOverdue = effectiveDue && new Date(effectiveDue) < new Date() && t.status !== 'done';
  const delivOverdue = t.deliverable_due_date && new Date(t.deliverable_due_date) < new Date() && t.status !== 'done';
  const taskDays = effectiveDue ? daysUntil(effectiveDue) : null;
  const delivDays = t.deliverable_due_date && t.due_date ? daysUntil(t.deliverable_due_date) : null;

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('taskId', t.id);
    e.dataTransfer.setData('sourceStatus', t.status);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={() => onSelect(t)}
      style={{
        background: 'var(--bg-1)',
        border: `1px solid ${taskOverdue ? 'var(--rose)' : 'var(--border-1)'}`,
        borderRadius: 'var(--radius-md)',
        padding: '12px 14px',
        cursor: 'grab',
        boxShadow: 'var(--shadow-1)',
        transition: 'all var(--dur-base) var(--ease-out)',
      }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = 'var(--shadow-2)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'var(--shadow-1)')}
    >
      {t.project_name && (
        <div style={{ display: 'inline-flex', padding: '2px 6px', background: 'var(--kamel-blue-soft)', color: 'var(--kamel-blue)', fontSize: 10, fontWeight: 700, borderRadius: 4, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {t.project_name}
        </div>
      )}
      {t.deliverable_title && (
        <p className="meta" style={{ marginBottom: 4, fontSize: 11 }}>{t.deliverable_title}</p>
      )}

      <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--fg-0)', marginBottom: t.description ? 6 : 8, lineHeight: 1.4 }}>{t.title}</p>
      {t.description && (
        <p style={{ fontSize: 12, color: 'var(--fg-3)', marginBottom: 8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.4 }}>
          {t.description}
        </p>
      )}

      {/* Deliverable deadline */}
      {delivDays && (
        <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: delivOverdue ? 'var(--rose)' : delivDays.urgent ? 'var(--amber)' : 'var(--fg-4)', fontWeight: 500 }}>
          <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="2" width="14" height="13" rx="2"/><line x1="1" y1="6" x2="15" y2="6"/><line x1="5" y1="1" x2="5" y2="4"/><line x1="11" y1="1" x2="11" y2="4"/></svg>
          <span>Deliverable: {delivDays.label}</span>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {taskDays && (
            <span style={{
              fontSize: 11,
              background: taskOverdue ? 'var(--rose-soft)' : taskDays.urgent ? 'rgba(245,158,11,0.12)' : 'var(--bg-2)',
              color: taskOverdue ? 'var(--rose)' : taskDays.urgent ? 'var(--amber)' : 'var(--fg-3)',
              padding: '2px 6px', borderRadius: 4, fontWeight: 600
            }}>
              {taskOverdue ? '⚠' : isFromDeliverable ? '📦' : '🎯'} {taskDays.label}
              {isFromDeliverable && <span style={{ fontSize: 10, opacity: 0.7 }}> (deliv)</span>}
            </span>
          )}
          {t.file_uploads && JSON.parse(t.file_uploads).length > 0 && (
            <span style={{ fontSize: 11, color: 'var(--fg-4)' }} title="Attachments">
              📎 {JSON.parse(t.file_uploads).length}
            </span>
          )}
          {(t.comment_count ?? 0) > 0 && (
            <span style={{ fontSize: 11, color: 'var(--fg-4)' }}>
              💬 {t.comment_count}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          {t.assigned_to_name && <Avatar name={t.assigned_to_name} size={24} />}
          {(t.members || []).slice(0, 3).map(m => (
            <Avatar key={m.id} name={m.user_name} size={22} />
          ))}
          {(t.members || []).length > 3 && (
            <span style={{ fontSize: 10, color: 'var(--fg-4)', fontWeight: 600 }}>+{(t.members || []).length - 3}</span>
          )}
          {!t.assigned_to_name && (t.members || []).length === 0 && (
            <span style={{ fontSize: 10, color: 'var(--fg-4)', fontStyle: 'italic' }}>Unassigned</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Task Detail Modal ─────────────────────────────────────────────────────────

function TaskDetailModal({ task, users, onClose, onUpdated, onDeleted }: {
  task: KanbanTask;
  users: User[];
  onClose: () => void;
  onUpdated: (t: KanbanTask) => void;
  onDeleted: (id: string) => void;
}) {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [comments, setComments] = useState<KanbanComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [commentBody, setCommentBody] = useState('');
  const [commentFiles, setCommentFiles] = useState<File[]>([]);
  const [sendingComment, setSendingComment] = useState(false);
  const [assigningTo, setAssigningTo] = useState<string | null>(null);
  const [t, setT] = useState(task);

  useEffect(() => {
    kanbanApi.listComments(task.id).then(setComments).finally(() => setLoadingComments(false));
    // Load full task (with members) from server on modal open
    kanbanApi.get(task.id).then(full => setT(prev => ({ ...prev, members: full.members ?? [] })));
  }, [task.id]);

  async function sendComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentBody.trim() && commentFiles.length === 0) return;
    setSendingComment(true);
    try {
      const filePaths: string[] = [];
      for (const file of commentFiles) {
        const { path } = await kanbanApi.uploadGeneric(file);
        filePaths.push(path);
      }
      const c = await kanbanApi.addComment(task.id, commentBody.trim(), filePaths);
      setComments(cs => [...cs, c]);
      setCommentBody('');
      setCommentFiles([]);
    } finally {
      setSendingComment(false);
    }
  }

  async function handleFileUpload(file: File) {
    if (file.size > 5 * 1024 * 1024) { alert('File too large (max 5MB)'); return; }
    const { path } = await kanbanApi.uploadFile(task.id, file);
    const oldPaths = JSON.parse(t.file_uploads || '[]');
    const updated = { ...t, file_uploads: JSON.stringify([...oldPaths, path]) };
    setT(updated);
    onUpdated(updated);
  }

  async function moveStatus(status: KanbanTask['status']) {
    const updated = await kanbanApi.update(task.id, { status });
    setT(updated);
    onUpdated(updated);
  }

  async function assignTask(newAssignedTo: string | null) {
    try {
      // Backend auto-adds assigned user to members and re-fetches with KanbanRepo.Get
      const updated = await kanbanApi.update(task.id, { assigned_to: newAssignedTo });
      setT(updated);
      onUpdated(updated);
      setAssigningTo(null);
    } catch {
      alert('Failed to assign task');
    }
  }

  const colColor = COLUMNS.find(c => c.key === t.status)?.color ?? 'var(--fg-4)';
  const isOverdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done';
  const taskDays = t.due_date ? daysUntil(t.due_date) : null;
  const delivDays = t.deliverable_due_date ? daysUntil(t.deliverable_due_date) : null;
  const delivOverdue = t.deliverable_due_date && new Date(t.deliverable_due_date) < new Date() && t.status !== 'done';

  return (
    <Modal
      title={t.title}
      subtitle={`${t.project_name ?? ''}${t.deliverable_title ? ' › ' + t.deliverable_title : ''}`}
      onClose={onClose}
      size="xl"
    >
      {editing ? (
        <EditTaskForm
          task={t}
          users={users}
          onSaved={(updated) => { setT(updated); onUpdated(updated); setEditing(false); }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, minHeight: '60vh' }}>
          {/* ── Left: main content ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, overflowY: 'auto', paddingRight: 8 }}>

            {/* Status bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: colColor, background: `${colColor}18`, padding: '4px 10px', borderRadius: 20 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: colColor }} />
                {COLUMNS.find(c => c.key === t.status)?.label}
              </span>
              {t.project_name && (
                <span style={{ display: 'inline-flex', padding: '4px 10px', background: 'var(--kamel-blue-soft)', color: 'var(--kamel-blue)', fontSize: 11, fontWeight: 700, borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {t.project_name}
                </span>
              )}
              {isOverdue && (
                <span style={{ display: 'inline-flex', padding: '4px 10px', background: 'var(--rose-soft)', color: 'var(--rose)', fontSize: 11, fontWeight: 700, borderRadius: 20 }}>
                  ⚠ Overdue
                </span>
              )}
            </div>

            {/* Move status */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
              {COLUMNS.filter(c => c.key !== t.status).map(c => (
                <Button key={c.key} size="sm" variant="secondary" onClick={() => moveStatus(c.key)}>
                  → {c.label}
                </Button>
              ))}
            </div>

            {/* Description */}
            <Section label="Description">
              {t.description ? (
                <p className="body-sm" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, color: 'var(--fg-1)' }}>
                  {t.description.split(/(@[^\s,.]+)/).map((part, i) =>
                    part.startsWith('@') ? <span key={i} style={{ color: 'var(--kamel-blue)', fontWeight: 600 }}>{part}</span> : part
                  )}
                </p>
              ) : (
                <p className="meta" style={{ fontSize: 13 }}>No description</p>
              )}
            </Section>

            {/* Timeline */}
            <Section label="Timeline">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                <MetaItem label="Created" value={formatDate(t.created_at)} />
                {t.due_date ? (
                  <MetaItem
                    label="Task Due"
                    value={formatDate(t.due_date)}
                    badge={taskDays ? {
                      text: taskDays.label,
                      color: isOverdue ? 'var(--rose)' : taskDays.urgent ? 'var(--amber)' : 'var(--fg-3)',
                      bg: isOverdue ? 'var(--rose-soft)' : taskDays.urgent ? 'rgba(245,158,11,0.1)' : 'var(--bg-3)',
                    } : undefined}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    style={{ background: 'var(--bg-2)', border: '1.5px dashed var(--border-2)', borderRadius: 'var(--radius-md)', padding: '10px 12px', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <p style={{ margin: '0 0 2px', fontSize: 10, fontWeight: 700, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Task Due</p>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--kamel-blue)', fontWeight: 600 }}>+ Set due date</p>
                  </button>
                )}
                {t.deliverable_due_date ? (
                  <MetaItem
                    label="Deliverable Deadline"
                    value={formatDate(t.deliverable_due_date)}
                    badge={delivDays ? {
                      text: delivDays.label,
                      color: delivOverdue ? 'var(--rose)' : delivDays.urgent ? 'var(--amber)' : 'var(--fg-3)',
                      bg: delivOverdue ? 'var(--rose-soft)' : delivDays.urgent ? 'rgba(245,158,11,0.1)' : 'var(--bg-3)',
                    } : undefined}
                  />
                ) : (
                  <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border-1)', borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
                    <p style={{ margin: '0 0 2px', fontSize: 10, fontWeight: 700, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Deliverable Deadline</p>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--fg-4)', fontStyle: 'italic' }}>Not set</p>
                  </div>
                )}
                <MetaItem label="Created by" value={t.created_by_name || '—'} />
              </div>
            </Section>

            {/* Deliverable context */}
            {t.deliverable_title && (
              <Section label="Deliverable">
                <p style={{ fontSize: 13, color: 'var(--fg-1)', fontWeight: 500 }}>{t.deliverable_title}</p>
              </Section>
            )}

            {/* Attachments */}
            <Section label="Attachments" action={
              user?.role === 'pm' || user?.role === 'admin' ? (
                <label className="dmms-btn dmms-btn-secondary dmms-btn-sm" style={{ cursor: 'pointer' }}>
                  <input type="file" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
                  Upload
                </label>
              ) : undefined
            }>
              {JSON.parse(t.file_uploads || '[]').length > 0 ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {JSON.parse(t.file_uploads || '[]').map((path: string, i: number) => (
                    <a key={i} href={path} target="_blank" rel="noreferrer" style={{ padding: '6px 10px', background: 'var(--bg-2)', border: '1px solid var(--border-1)', borderRadius: 6, fontSize: 12, color: 'var(--kamel-blue)', textDecoration: 'none' }}>
                      📎 File {i + 1}
                    </a>
                  ))}
                </div>
              ) : (
                <p className="meta" style={{ fontSize: 13 }}>No attachments</p>
              )}
            </Section>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 12 }}>
              <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>Edit Task</Button>
              {user?.role === 'pm' || user?.role === 'admin' && (
                <Button size="sm" variant="danger" onClick={() => { kanbanApi.delete(t.id); onDeleted(t.id); }}>Delete</Button>
              )}
            </div>
          </div>

          {/* ── Right: sidebar ── */}
          <div style={{ borderLeft: '1px solid var(--border-1)', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 0 }}>

            {/* Assignee — PM/admin only */}
            {(user?.role === 'pm' || user?.role === 'admin') && (
              <Section label="Assignee">
                {assigningTo !== null ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <Select value={assigningTo || ''} onChange={e => setAssigningTo(e.target.value)}>
                      <option value="">Unassigned</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </Select>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Button size="sm" onClick={() => assignTask(assigningTo || null)}>Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => setAssigningTo(null)}>Cancel</Button>
                    </div>
                  </div>
                ) : t.assigned_to_name ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar name={t.assigned_to_name} size={32} />
                      <div>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{t.assigned_to_name}</p>
                        <p style={{ margin: 0, fontSize: 11, color: 'var(--fg-4)' }}>Contributor</p>
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setAssigningTo(t.assigned_to || '')}>Reassign</Button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-3)', border: '2px dashed var(--border-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="var(--fg-4)" strokeWidth="1.5"><circle cx="10" cy="7" r="4"/><path d="M3 17a7 7 0 0114 0"/></svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 13, color: 'var(--fg-3)' }}>Unassigned</p>
                    </div>
                    <Button size="sm" onClick={() => setAssigningTo('')}>Assign</Button>
                  </div>
                )}
              </Section>
            )}

            {/* Members — everyone can join/leave */}
            <MembersSection t={t} user={user} setT={setT} onUpdated={onUpdated} />

            {/* Comments */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, marginTop: 4 }}>
              <p style={{ fontWeight: 600, fontSize: 11, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>
                Comments {comments.length > 0 && `(${comments.length})`}
              </p>
              {loadingComments ? <Spinner /> : (
                <>
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', flex: 1, marginBottom: 12 }}>
                    {comments.map(c => (
                      <li key={c.id}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <Avatar name={c.author_name} size={22} />
                          <span style={{ fontWeight: 600, fontSize: 12 }}>{c.author_name}</span>
                          <span className="meta" style={{ fontSize: 11, marginLeft: 'auto' }}>{formatDate(c.created_at)}</span>
                        </div>
                        <div style={{ marginLeft: 30, background: 'var(--bg-2)', borderRadius: 'var(--radius-md)', padding: '8px 10px', border: '1px solid var(--border-1)' }}>
                          <p className="body-sm" style={{ whiteSpace: 'pre-wrap', marginBottom: 0, fontSize: 13, lineHeight: 1.5 }}>
                            {c.body.split(/(@[^\s,.]+)/).map((part, i) =>
                              part.startsWith('@') ? <span key={i} style={{ color: 'var(--kamel-blue)', fontWeight: 600 }}>{part}</span> : part
                            )}
                          </p>
                          {c.file_uploads && JSON.parse(c.file_uploads).length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                              {JSON.parse(c.file_uploads).map((path: string, i: number) => {
                                const filename = path.split('/').pop() || path;
                                const isImage = /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i.test(filename);
                                return isImage ? (
                                  <a key={i} href={path} target="_blank" rel="noreferrer" style={{ display: 'inline-block' }}>
                                    <img src={path} alt={filename} style={{ maxWidth: '100%', maxHeight: 240, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-1)', display: 'block' }} />
                                  </a>
                                ) : (
                                  <a key={i} href={path} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--kamel-blue)', textDecoration: 'none', background: 'var(--bg-3)', padding: '3px 8px', borderRadius: 10, border: '1px solid var(--border-1)', display: 'inline-flex', alignItems: 'center', gap: 4, width: 'fit-content' }}>
                                    📎 {filename}
                                  </a>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                    {comments.length === 0 && (
                      <li style={{ textAlign: 'center', padding: '24px 0' }}>
                        <p style={{ color: 'var(--fg-4)', fontSize: 13, margin: 0 }}>No comments yet</p>
                        <p style={{ color: 'var(--fg-4)', fontSize: 12, margin: '4px 0 0' }}>Be the first to add one</p>
                      </li>
                    )}
                  </ul>
                  <form onSubmit={sendComment} style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--bg-2)', padding: 10, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-1)' }}>
                    <MentionsTextarea
                      value={commentBody}
                      onChangeValue={setCommentBody}
                      users={users}
                      placeholder={user?.role === 'pm' || user?.role === 'admin' ? 'Leave feedback…' : 'Add an update…'}
                      rows={2}
                      style={{ background: 'var(--bg-1)', fontSize: 13 }}
                    />
                    {commentFiles.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {commentFiles.map((f, i) => (
                          <span key={i} style={{ fontSize: 11, background: 'var(--bg-3)', padding: '2px 6px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 2 }}>
                            {f.name}
                            <button type="button" onClick={() => setCommentFiles(fs => fs.filter((_, idx) => idx !== i))} style={{ border: 'none', background: 'none', color: 'var(--rose)', cursor: 'pointer', padding: 0, fontSize: 12 }}>×</button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ cursor: 'pointer' }}>
                        <input type="file" multiple style={{ display: 'none' }} onChange={e => e.target.files && setCommentFiles(fs => [...fs, ...Array.from(e.target.files!)])} />
                        <span style={{ fontSize: 12, color: 'var(--kamel-blue)', fontWeight: 500 }}>📎 Attach</span>
                      </label>
                      <Button type="submit" size="sm" disabled={sendingComment || (!commentBody.trim() && commentFiles.length === 0)}>
                        {sendingComment ? 'Sending…' : 'Send'}
                      </Button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ── Small helper components ────────────────────────────────────────────────────

function MembersSection({ t, user, setT, onUpdated }: {
  t: KanbanTask;
  user: User | null;
  setT: React.Dispatch<React.SetStateAction<KanbanTask>>;
  onUpdated: (t: KanbanTask) => void;
}) {
  const [loading, setLoading] = useState(false);
  const members = t.members || [];
  const isMember = user ? members.some(m => m.user_id === user.id) : false;

  async function handleJoin() {
    if (!user) return;
    setLoading(true);
    try {
      const newMembers = await kanbanApi.joinTask(t.id);
      const updated = { ...t, members: newMembers };
      setT(updated);
      onUpdated(updated);
    } finally {
      setLoading(false);
    }
  }

  async function handleLeave() {
    setLoading(true);
    try {
      const newMembers = await kanbanApi.leaveTask(t.id);
      const updated = { ...t, members: newMembers };
      setT(updated);
      onUpdated(updated);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Section label="Members">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {members.length > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {members.map(m => <Avatar key={m.id} name={m.user_name} size={28} />)}
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--fg-4)', fontStyle: 'italic' }}>No members yet</p>
        )}
        {isMember ? (
          <Button size="sm" variant="secondary" onClick={handleLeave} disabled={loading}>
            {loading ? '…' : 'Leave'}
          </Button>
        ) : (
          <Button size="sm" onClick={handleJoin} disabled={loading}>
            {loading ? '…' : 'Join'}
          </Button>
        )}
      </div>
    </Section>
  );
}

function Section({ label, children, action }: { label: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <p style={{ margin: 0, fontWeight: 600, fontSize: 11, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</p>
        {action}
      </div>
      {children}
    </div>
  );
}

function MetaItem({ label, value, badge }: { label: string; value: string; badge?: { text: string; color: string; bg: string } }) {
  return (
    <div style={{ background: 'var(--bg-2)', borderRadius: 'var(--radius-md)', padding: '10px 12px', border: '1px solid var(--border-1)' }}>
      <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--fg-1)' }}>{value}</p>
        {badge && (
          <span style={{ fontSize: 11, fontWeight: 700, color: badge.color, background: badge.bg, padding: '2px 7px', borderRadius: 10 }}>
            {badge.text}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Edit Task Form ────────────────────────────────────────────────────────────

function EditTaskForm({ task, users, onSaved, onCancel }: {
  task: KanbanTask;
  users: User[];
  onSaved: (t: KanbanTask) => void;
  onCancel: () => void;
}) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    title: task.title,
    description: task.description ?? '',
    due_date: task.due_date?.slice(0, 10) ?? '',
    status: task.status,
    assigned_to: task.assigned_to ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const updateData: Record<string, unknown> = {
        title: form.title,
        description: form.description,
        due_date: form.due_date || '',
        status: form.status as KanbanTask['status'],
      };
      if (user?.role === 'pm' || user?.role === 'admin') {
        updateData.assigned_to = form.assigned_to || null;
      }
      const updated = await kanbanApi.update(task.id, updateData);
      onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <FormField label="Title">
        <Input value={form.title} onChange={e => set('title', e.target.value)} required />
      </FormField>
      <FormField label="Description">
        <MentionsTextarea value={form.description} onChangeValue={v => set('description', v)} users={users} rows={3} />
      </FormField>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <FormField label="Status">
          <Select value={form.status} onChange={e => set('status', e.target.value)}>
            {COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </Select>
        </FormField>
        <FormField label="Task Due Date">
          <Input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
        </FormField>
      </div>
      {user?.role === 'pm' || user?.role === 'admin' && (
        <FormField label="Assign To">
          <Select value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)}>
            <option value="">Unassigned</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
        </FormField>
      )}
      {error && <Alert type="error">{error}</Alert>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button variant="secondary" onClick={onCancel} type="button">Cancel</Button>
        <Button type="submit" disabled={saving || !form.title}>{saving ? 'Saving…' : 'Save Changes'}</Button>
      </div>
    </form>
  );
}

// ── Create Task Modal ─────────────────────────────────────────────────────────

function CreateTaskModal({ projects, users, assignedTo, onClose, onCreate }: {
  projects: Project[];
  users: User[];
  assignedTo?: string;
  onClose: () => void;
  onCreate: (t: KanbanTask) => void;
}) {
  const [projectId, setProjectId] = useState('');
  const [deliverables, setDeliverables] = useState<{ id: string; title: string }[]>([]);
  const [deliverableId, setDeliverableId] = useState('');
  const [form, setForm] = useState({ title: '', description: '', status: 'backlog', due_date: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!projectId) { setDeliverables([]); setDeliverableId(''); return; }
    import('../../api').then(({ deliverablesApi }) => {
      if (assignedTo) {
        deliverablesApi.myAssigned().then(delivs => {
          const projectDelivs = delivs.filter(d => d.project_id === projectId);
          setDeliverables(projectDelivs.map(d => ({ id: d.id, title: d.title })));
        });
      } else {
        deliverablesApi.tree(projectId).then(tree => {
          const flat: { id: string; title: string }[] = [];
          function flatten(nodes: unknown[], depth = 0) {
            (nodes as Array<{ id: string; title: string; children?: unknown[] }>).forEach(n => {
              flat.push({ id: n.id, title: '  '.repeat(depth) + n.title });
              if (n.children?.length) flatten(n.children, depth + 1);
            });
          }
          flatten(tree);
          setDeliverables(flat);
        });
      }
    });
  }, [projectId, assignedTo]);

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId || !deliverableId || !form.title) {
      setError('Project, deliverable, and title are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const t = await kanbanApi.create({
        project_id: projectId,
        deliverable_id: deliverableId,
        title: form.title,
        description: form.description,
        status: form.status as KanbanTask['status'],
        assigned_to: assignedTo ?? null,
        due_date: form.due_date || undefined,
      } as never);
      onCreate(t);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="New Task" onClose={onClose} footer={
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
        <Button type="submit" form="create-kanban-form" disabled={saving || !form.title}>{saving ? 'Creating…' : 'Create Task'}</Button>
      </div>
    }>
      <form id="create-kanban-form" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <FormField label="Project">
          <Select value={projectId} onChange={e => setProjectId(e.target.value)}>
            <option value="">Select project…</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </FormField>
        <FormField label="Deliverable">
          <Select value={deliverableId} onChange={e => setDeliverableId(e.target.value)} disabled={!projectId}>
            <option value="">Select deliverable…</option>
            {deliverables.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
          </Select>
        </FormField>
        <FormField label="Title">
          <Input value={form.title} onChange={e => set('title', e.target.value)} placeholder="What needs to be done?" required />
        </FormField>
        <FormField label="Description (optional)">
          <MentionsTextarea value={form.description} onChangeValue={v => set('description', v)} users={users} rows={2} />
        </FormField>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Start in column">
            <Select value={form.status} onChange={e => set('status', e.target.value)}>
              {COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </Select>
          </FormField>
          <FormField label="Task Due Date (optional)">
            <Input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
          </FormField>
        </div>
        {error && <Alert type="error">{error}</Alert>}
      </form>
    </Modal>
  );
}
