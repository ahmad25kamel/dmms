import React, { useEffect, useState, useCallback, useRef } from 'react';
import { kanbanApi, projectsApi, usersApi } from '../../api';
import type { KanbanTask, KanbanComment, Project, User } from '../../types';
import { Button, Modal, FormField, Input, Select, Spinner, Alert, MentionsTextarea } from '../../components/ui';
import { formatDate } from '../../lib/statusColors';
import { useAuth } from '../../store/authStore';

type KanbanStatus = 'backlog' | 'todo' | 'in_progress' | 'done';

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
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [filterProject, setFilterProject] = useState('');
  const [filterDeliverable, setFilterDeliverable] = useState('');
  const [filterContributor, setFilterContributor] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<KanbanTask | null>(null);

  useEffect(() => {
    projectsApi.list().then(setProjects);
    usersApi.list().then(setUsers);
  }, []);

  const loadMore = useCallback(async (status: KanbanStatus, offset: number) => {
    const params: any = { status, limit: 20, offset };
    if (filterProject) params.project_id = filterProject;
    if (filterDeliverable) params.deliverable_id = filterDeliverable;
    if (filterContributor) params.assigned_to = filterContributor;
    
    const newTasks = await kanbanApi.list(params);
    setTasksMap(prev => ({
      ...prev,
      [status]: offset === 0 ? newTasks : [...prev[status], ...newTasks]
    }));
    return newTasks.length;
  }, [filterProject, filterDeliverable, filterContributor]);

  useEffect(() => {
    COLUMNS.forEach(col => loadMore(col.key, 0));
  }, [loadMore]);

  async function moveTask(taskId: string, sourceStatus: KanbanStatus, destStatus: KanbanStatus, dropIndex: number) {
    const task = tasksMap[sourceStatus].find(t => t.id === taskId);
    if (!task) return;

    // Local update
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
    <div className="dmms-page" style={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>
      <div className="dmms-page-head" style={{ flexShrink: 0 }}>
        <div>
          <h1>Kanban Board</h1>
          <p className="dmms-page-sub">Monitor all task progress across projects</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Task
        </Button>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, flexShrink: 0 }}>
        <Select value={filterProject} onChange={e => setFilterProject(e.target.value)} style={{ width: 200 }}>
          <option value="">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        <Select value={filterContributor} onChange={e => setFilterContributor(e.target.value)} style={{ width: 200 }}>
          <option value="">All Contributors</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </Select>
        {(filterProject || filterDeliverable || filterContributor) && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterProject(''); setFilterDeliverable(''); setFilterContributor(''); }}>Clear filters</Button>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <KanbanBoard tasksMap={tasksMap} onMove={moveTask} onSelect={setSelected} onLoadMore={loadMore} />
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
             // If status changed, we need to move it in the map
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
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState<KanbanTask | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    projectsApi.list().then(setProjects);
    usersApi.list().then(setUsers);
  }, []);

  const loadMore = useCallback(async (status: KanbanStatus, offset: number) => {
    const newTasks = await kanbanApi.mine({ status, limit: 20, offset });
    setTasksMap(prev => ({
      ...prev,
      [status]: offset === 0 ? newTasks : [...prev[status], ...newTasks]
    }));
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
    <div className="dmms-page" style={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>
      <div className="dmms-page-head">
        <div>
          <h1>My Task Board</h1>
          <p className="dmms-page-sub">Your personal kanban — tasks across all assigned deliverables</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Task
        </Button>
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <KanbanBoard tasksMap={tasksMap} onMove={moveTask} onSelect={setSelected} onLoadMore={loadMore} />
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

function KanbanBoard({ tasksMap, onMove, onSelect, onLoadMore }: {
  tasksMap: Record<KanbanStatus, KanbanTask[]>;
  onMove: (id: string, source: KanbanStatus, dest: KanbanStatus, index: number) => void;
  onSelect: (t: KanbanTask) => void;
  onLoadMore: (status: KanbanStatus, offset: number) => Promise<number>;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, height: '100%', alignItems: 'stretch' }}>
      {COLUMNS.map(col => (
        <KanbanColumn
          key={col.key}
          status={col.key}
          label={col.label}
          color={col.color}
          tasks={tasksMap[col.key]}
          onMove={onMove}
          onSelect={onSelect}
          onLoadMore={onLoadMore}
        />
      ))}
    </div>
  );
}

function KanbanColumn({ status, label, color, tasks, onMove, onSelect, onLoadMore }: {
  status: KanbanStatus;
  label: string;
  color: string;
  tasks: KanbanTask[];
  onMove: (id: string, source: KanbanStatus, dest: KanbanStatus, index: number) => void;
  onSelect: (t: KanbanTask) => void;
  onLoadMore: (status: KanbanStatus, offset: number) => Promise<number>;
}) {
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

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
    if (el.scrollHeight - el.scrollTop <= el.clientHeight + 50 && !loading && hasMore) {
      setLoading(true);
      const count = await onLoadMore(status, tasks.length);
      setHasMore(count === 20);
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px 12px' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
        <span style={{ fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--fg-1)' }}>{label}</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--fg-4)', fontWeight: 600, background: 'var(--bg-3)', padding: '2px 8px', borderRadius: 10 }}>{tasks.length}</span>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        onDragOver={(e) => handleDragOver(e, tasks.length)}
        onDrop={(e) => handleDrop(e, tasks.length)}
        onDragLeave={() => setDragOverIndex(null)}
        style={{
          flex: 1,
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
        {loading && <Spinner />}
        <div style={{ height: 20, flexShrink: 0 }} />
      </div>
    </div>
  );
}

function KanbanCard({ task: t, onSelect }: {
  task: KanbanTask;
  onSelect: (t: KanbanTask) => void;
}) {
  const isOverdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done';

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
        border: '1px solid var(--border-1)',
        borderRadius: 'var(--radius-md)',
        padding: '12px 14px',
        cursor: 'grab',
        boxShadow: 'var(--shadow-1)',
        transition: 'all var(--dur-base) var(--ease-out)',
      }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = 'var(--shadow-2)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'var(--shadow-1)')}
    >
      {/* Project + deliverable context */}
      {t.project_name && (
        <div style={{ display: 'inline-flex', padding: '2px 6px', background: 'var(--kamel-blue-soft)', color: 'var(--kamel-blue)', fontSize: 10, fontWeight: 700, borderRadius: 4, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {t.project_name}
        </div>
      )}
      {t.deliverable_title && (
        <p className="meta" style={{ marginBottom: 4 }}>{t.deliverable_title}</p>
      )}

      <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--fg-0)', marginBottom: t.description ? 6 : 0, lineHeight: 1.4 }}>{t.title}</p>
      {t.description && (
        <p style={{ fontSize: 12, color: 'var(--fg-3)', marginBottom: 8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.4 }}>
          {t.description}
        </p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {t.due_date && (
            <span style={{ fontSize: 11, background: isOverdue ? 'var(--rose-soft)' : 'var(--bg-2)', color: isOverdue ? 'var(--rose)' : 'var(--fg-3)', padding: '2px 6px', borderRadius: 4, fontWeight: isOverdue ? 600 : 500, display: 'flex', alignItems: 'center', gap: 4 }}>
              {isOverdue ? '⚠ ' : '📅 '} {formatDate(t.due_date)}
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
        {t.assigned_to_name && (
          <div title={t.assigned_to_name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, background: 'var(--fg-1)', color: 'var(--bg-0)', borderRadius: '50%', fontSize: 10, fontWeight: 700 }}>
            {t.assigned_to_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
          </div>
        )}
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
  const [t, setT] = useState(task);

  useEffect(() => {
    kanbanApi.listComments(task.id).then(setComments).finally(() => setLoadingComments(false));
  }, [task.id]);

  async function sendComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentBody.trim() && commentFiles.length === 0) return;
    setSendingComment(true);
    try {
      // Upload all files first
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
    if (file.size > 5 * 1024 * 1024) {
      alert("File too large (max 5MB)");
      return;
    }
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

  const colColor = COLUMNS.find(c => c.key === t.status)?.color ?? 'var(--fg-4)';
  const isOverdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done';

  return (
    <Modal
      title={t.title}
      subtitle={`${t.project_name ?? ''}${t.deliverable_title ? ' · ' + t.deliverable_title : ''}`}
      onClose={onClose}
    >
      {editing ? (
        <EditTaskForm
          task={t}
          users={users}
          onSaved={(updated) => { setT(updated); onUpdated(updated); setEditing(false); }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Status row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: colColor }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: colColor }} />
              {COLUMNS.find(c => c.key === t.status)?.label}
            </span>
            {t.assigned_to_name && <span className="meta">Assignee: {t.assigned_to_name}</span>}
            {t.due_date && (
              <span style={{ fontSize: 12, color: isOverdue ? 'var(--rose)' : 'var(--fg-3)', fontWeight: isOverdue ? 600 : 400 }}>
                {isOverdue ? '⚠ Overdue · ' : 'Due: '}{formatDate(t.due_date)}
              </span>
            )}
          </div>

          {/* Move to */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {COLUMNS.filter(c => c.key !== t.status).map(c => (
              <Button key={c.key} size="sm" variant="secondary" onClick={() => moveStatus(c.key)}>
                → {c.label}
              </Button>
            ))}
          </div>

          {t.description && (
            <div>
              <p style={{ fontWeight: 600, fontSize: 12, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Description</p>
              <p className="body-sm" style={{ whiteSpace: 'pre-wrap', marginBottom: 6 }}>
                {t.description.split(/(@[^\s,.]+)/).map((part, i) =>
                   part.startsWith('@') ? <span key={i} style={{ color: 'var(--kamel-blue)', fontWeight: 600 }}>{part}</span> : part
                )}
              </p>
            </div>
          )}

          {/* Attachments */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
               <p style={{ fontWeight: 600, fontSize: 12, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Attachments</p>
               <label className="dmms-btn dmms-btn-secondary dmms-btn-sm" style={{ cursor: 'pointer' }}>
                 <input type="file" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
                 Upload
               </label>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {JSON.parse(t.file_uploads || '[]').map((path: string, i: number) => (
                <a key={i} href={path} target="_blank" rel="noreferrer" style={{ padding: '6px 10px', background: 'var(--bg-2)', border: '1px solid var(--border-1)', borderRadius: 6, fontSize: 12, color: 'var(--kamel-blue)', textDecoration: 'none' }}>
                  File {i + 1}
                </a>
              ))}
              {JSON.parse(t.file_uploads || '[]').length === 0 && <p className="meta">No attachments</p>}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8 }}>
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>Edit</Button>
            <Button size="sm" variant="danger" onClick={() => { kanbanApi.delete(t.id); onDeleted(t.id); }}>Delete</Button>
          </div>

          {/* Comments */}
          <div>
            <p style={{ fontWeight: 600, fontSize: 12, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Comments {comments.length > 0 && `(${comments.length})`}
            </p>
            {loadingComments ? <Spinner /> : (
              <>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 14 }}>
                  {comments.map(c => (
                    <li key={c.id}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--kamel-blue-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--kamel-blue)' }}>
                          {(c.author_name ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                        </span>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{c.author_name}</span>
                        <span className="meta">{formatDate(c.created_at)}</span>
                      </div>
                      <div style={{ marginLeft: 32 }}>
                        <p className="body-sm" style={{ whiteSpace: 'pre-wrap', marginBottom: 6 }}>
                          {c.body.split(/(@[^\s,.]+)/).map((part, i) =>
                            part.startsWith('@') ? <span key={i} style={{ color: 'var(--kamel-blue)', fontWeight: 600 }}>{part}</span> : part
                          )}
                        </p>
                        
                        {c.file_uploads && JSON.parse(c.file_uploads).length > 0 && (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                            {JSON.parse(c.file_uploads).map((path: string, i: number) => (
                              <a key={i} href={path} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--kamel-blue)', textDecoration: 'none', background: 'var(--bg-3)', padding: '2px 8px', borderRadius: 12, border: '1px solid var(--border-1)' }}>
                                📎 Attachment {i+1}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                  {comments.length === 0 && <li><p className="meta">No comments yet.</p></li>}
                </ul>
                <form onSubmit={sendComment} style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--bg-2)', padding: 12, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-1)' }}>
                  <MentionsTextarea
                    value={commentBody}
                    onChangeValue={setCommentBody}
                    users={users}
                    placeholder={user?.role === 'pm' ? 'Leave feedback or instructions…' : 'Ask a question or give an update…'}
                    rows={2}
                    style={{ background: 'var(--bg-1)' }}
                  />
                  
                  {commentFiles.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {commentFiles.map((f, i) => (
                        <span key={i} style={{ fontSize: 11, background: 'var(--bg-3)', padding: '2px 8px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                          {f.name}
                          <button type="button" onClick={() => setCommentFiles(fs => fs.filter((_, idx) => idx !== i))} style={{ border: 'none', background: 'none', color: 'var(--rose)', cursor: 'pointer', padding: 0 }}>×</button>
                        </span>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ cursor: 'pointer' }}>
                       <input type="file" multiple style={{ display: 'none' }} onChange={e => e.target.files && setCommentFiles(fs => [...fs, ...Array.from(e.target.files!)])} />
                       <span style={{ fontSize: 13, color: 'var(--kamel-blue)', fontWeight: 500 }}>📎 Attach files</span>
                    </label>
                    <Button type="submit" size="sm" disabled={sendingComment || (!commentBody.trim() && commentFiles.length === 0)}>
                      {sendingComment ? 'Sending…' : 'Send Comment'}
                    </Button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

// ── Edit Task Form ────────────────────────────────────────────────────────────

function EditTaskForm({ task, users, onSaved, onCancel }: {
  task: KanbanTask;
  users: User[];
  onSaved: (t: KanbanTask) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    title: task.title,
    description: task.description ?? '',
    due_date: task.due_date?.slice(0, 10) ?? '',
    status: task.status,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const updated = await kanbanApi.update(task.id, {
        title: form.title,
        description: form.description,
        due_date: form.due_date || '',
        status: form.status as KanbanTask['status'],
      });
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
        <FormField label="Due Date (optional)">
          <Input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
        </FormField>
      </div>
      {error && <Alert type="error">{error}</Alert>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button variant="secondary" onClick={onCancel} type="button">Cancel</Button>
        <Button type="submit" disabled={saving || !form.title}>{saving ? 'Saving…' : 'Save'}</Button>
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
          function flatten(nodes: any[], depth = 0) {
            nodes.forEach(n => {
              flat.push({ id: n.id, title: ('  '.repeat(depth)) + n.title });
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
      } as any);
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
          <FormField label="Due Date (optional)">
            <Input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
          </FormField>
        </div>
        {error && <Alert type="error">{error}</Alert>}
      </form>
    </Modal>
  );
}
