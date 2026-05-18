import { useEffect, useState } from 'react';
import { adminApi } from '../../api';
import type { User } from '../../types';
import { Badge, Button, Select, Spinner, EmptyState, Modal } from '../../components/ui';
import { formatDate } from '../../lib/statusColors';

const PAGE_SIZE = 20;
type Tab = 'pending' | 'approved';

function RoleBadge({ role }: { role: string }) {
  const color = role === 'admin' ? 'red' : role === 'pm' ? 'indigo' : 'gray';
  return <Badge color={color}>{role}</Badge>;
}

function UserAvatar({ name, size = 32 }: { name: string; size?: number }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const hue = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `hsl(${hue},55%,42%)`, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 700,
    }}>{initials}</div>
  );
}

export function AdminPage() {
  const [tab, setTab] = useState<Tab>('pending');
  const [pending, setPending] = useState<User[]>([]);
  const [approved, setApproved] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loadingApproved, setLoadingApproved] = useState(true);
  const [loadingPending, setLoadingPending] = useState(true);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [newRole, setNewRole] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<User | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [approvedError, setApprovedError] = useState('');

  function loadPending() {
    setLoadingPending(true);
    adminApi.listPending()
      .then(setPending)
      .catch(() => {})
      .finally(() => setLoadingPending(false));
  }

  function loadApproved(p: number) {
    setLoadingApproved(true);
    setApprovedError('');
    adminApi.listUsers(PAGE_SIZE, p * PAGE_SIZE)
      .then(res => {
        setApproved(res.items ?? []);
        setTotal(res.total ?? 0);
        setPage(p);
      })
      .catch(err => setApprovedError(err instanceof Error ? err.message : 'Failed to load users'))
      .finally(() => setLoadingApproved(false));
  }

  useEffect(() => {
    loadPending();
    loadApproved(0);
  }, []);

  async function approve(u: User) {
    setActing(u.id);
    try {
      await adminApi.approveUser(u.id);
      setPending(ps => ps.filter(p => p.id !== u.id));
      setApproved(as => [{ ...u, approved: true }, ...as]);
    } finally { setActing(null); }
  }

  async function reject(u: User) {
    setActing(u.id);
    try {
      await adminApi.rejectUser(u.id);
      setPending(ps => ps.filter(p => p.id !== u.id));
    } finally { setActing(null); }
  }

  async function updateRole() {
    if (!editUser) return;
    await adminApi.updateRole(editUser.id, newRole);
    setApproved(us => us.map(u => u.id === editUser.id ? { ...u, role: newRole as User['role'] } : u));
    setEditUser(null);
  }

  async function doDelete() {
    if (!confirmDelete) return;
    await adminApi.deleteUser(confirmDelete.id);
    setApproved(us => us.filter(u => u.id !== confirmDelete.id));
    setPending(ps => ps.filter(p => p.id !== confirmDelete.id));
    setTotal(t => t - 1);
    setConfirmDelete(null);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="dmms-page">
      <div className="dmms-page-head">
        <div>
          <h1>Users</h1>
          <p className="dmms-page-sub">Manage access and roles</p>
        </div>
        {pending.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(245,158,11,0.1)', border: '1px solid var(--amber)', borderRadius: 'var(--radius-md)', padding: '6px 14px' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--amber)', display: 'inline-block' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--amber)' }}>{pending.length} pending approval</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border-1)', marginBottom: 20 }}>
        {(['pending', 'approved'] as Tab[]).map(key => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
              color: tab === key ? 'var(--kamel-blue)' : 'var(--fg-3)',
              borderBottom: `2px solid ${tab === key ? 'var(--kamel-blue)' : 'transparent'}`,
              marginBottom: -1, transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: 7,
            }}
          >
            {key === 'pending' ? 'Pending Approval' : 'All Users'}
            {key === 'pending' && pending.length > 0 && (
              <span style={{ background: 'var(--amber)', color: '#fff', borderRadius: 99, fontSize: 10, fontWeight: 700, padding: '1px 6px', lineHeight: '16px' }}>
                {pending.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Pending tab */}
      {tab === 'pending' && (
        loadingPending ? <div style={{ padding: '40px 0', display: 'flex', justifyContent: 'center' }}><Spinner /></div> :
        pending.length === 0 ? (
          <EmptyState title="No pending requests" description="New user registrations will appear here for review." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pending.map(u => (
              <div key={u.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
                background: 'var(--bg-1)', border: '1px solid var(--amber)',
                borderRadius: 'var(--radius-md)', padding: '14px 16px',
                boxShadow: 'var(--shadow-1)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <UserAvatar name={u.name} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{u.name}</span>
                      <RoleBadge role={u.role} />
                    </div>
                    <p className="meta">@{u.username}{u.email ? ` · ${u.email}` : ''} · Registered {formatDate(u.created_at)}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <Button size="sm" variant="danger" onClick={() => reject(u)} disabled={acting === u.id}>
                    Reject
                  </Button>
                  <Button size="sm" onClick={() => approve(u)} disabled={acting === u.id}>
                    {acting === u.id ? '…' : 'Approve'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* All users tab */}
      {tab === 'approved' && (
        loadingApproved ? <div style={{ padding: '40px 0', display: 'flex', justifyContent: 'center' }}><Spinner /></div> :
        approvedError ? (
          <div style={{ padding: '20px', background: 'var(--rose-soft)', border: '1px solid var(--rose)', borderRadius: 'var(--radius-md)', color: 'var(--rose)', fontSize: 13 }}>
            Failed to load users: {approvedError}
          </div>
        ) : (
          <>
            {approved.length === 0 ? (
              <EmptyState title="No approved users yet" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {approved.map(u => (
                  <div key={u.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
                    background: 'var(--bg-1)', border: '1px solid var(--border-1)',
                    borderRadius: 'var(--radius-md)', padding: '12px 16px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                      <UserAvatar name={u.name} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                          <span style={{ fontWeight: 500, fontSize: 14 }}>{u.name}</span>
                          <RoleBadge role={u.role} />
                        </div>
                        <p className="meta">@{u.username}{u.email ? ` · ${u.email}` : ''} · Joined {formatDate(u.created_at)}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <Button size="sm" variant="secondary" onClick={() => { setEditUser(u); setNewRole(u.role); }}>Change Role</Button>
                      <Button size="sm" variant="danger" onClick={() => setConfirmDelete(u)}>
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {totalPages > 1 && (
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
                <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => loadApproved(page - 1)}>← Prev</Button>
                <span style={{ lineHeight: '30px', fontSize: 13 }}>{page + 1} / {totalPages}</span>
                <Button variant="secondary" size="sm" disabled={page >= totalPages - 1} onClick={() => loadApproved(page + 1)}>Next →</Button>
              </div>
            )}
          </>
        )
      )}

      {confirmDelete && (
        <Modal title="Delete user?" onClose={() => setConfirmDelete(null)} footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="danger" onClick={doDelete}>Delete User</Button>
          </div>
        }>
          <p>Are you sure you want to delete <strong>{confirmDelete.name}</strong> (@{confirmDelete.username})? This cannot be undone.</p>
        </Modal>
      )}

      {editUser && (
        <Modal title={`Change role — ${editUser.name}`} onClose={() => setEditUser(null)} footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button onClick={updateRole}>Save</Button>
          </div>
        }>
          <Select value={newRole} onChange={e => setNewRole(e.target.value)}>
            <option value="contributor">Contributor</option>
            <option value="pm">PM</option>
            <option value="admin">Admin</option>
          </Select>
        </Modal>
      )}
    </div>
  );
}
