import { useEffect, useState } from 'react';
import { adminApi } from '../../api';
import type { User } from '../../types';
import { Badge, Button, Select, Spinner, EmptyState, Modal } from '../../components/ui';
import { formatDate } from '../../lib/statusColors';

const PAGE_SIZE = 20;

export function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [newRole, setNewRole] = useState('');
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<User | null>(null);

  function load(p: number) {
    setLoading(true);
    adminApi.listUsers(PAGE_SIZE, p * PAGE_SIZE)
      .then(res => { setUsers(res.items); setTotal(res.total); setPage(p); })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(0); }, []);

  async function updateRole() {
    if (!editUser) return;
    await adminApi.updateRole(editUser.id, newRole);
    setUsers(us => us.map(u => u.id === editUser.id ? { ...u, role: newRole as User['role'] } : u));
    setEditUser(null);
  }

  async function doDeleteUser() {
    if (!confirmDeleteUser) return;
    await adminApi.deleteUser(confirmDeleteUser.id);
    setUsers(us => us.filter(u => u.id !== confirmDeleteUser.id));
    setTotal(t => t - 1);
    setConfirmDeleteUser(null);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  if (loading) return <Spinner />;

  return (
    <div className="dmms-page">
      <div className="dmms-page-head">
        <div>
          <h1>Admin</h1>
          <p className="dmms-page-sub">{total} users</p>
        </div>
      </div>

      {users.length === 0 ? (
        <EmptyState title="No users" />
      ) : (
        <ul className="dmms-feed">
          {users.map(u => (
            <li key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontWeight: 500 }}>{u.name}</span>
                  <Badge color={u.role === 'pm' ? 'indigo' : u.role === 'admin' ? 'red' : 'gray'}>{u.role}</Badge>
                </div>
                <p className="meta">@{u.username}{u.email ? ` · ${u.email}` : ''} · Joined {formatDate(u.created_at)}</p>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <Button size="sm" variant="secondary" onClick={() => { setEditUser(u); setNewRole(u.role); }}>Change Role</Button>
                <Button size="sm" variant="danger" onClick={() => setConfirmDeleteUser(u)}>
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
          <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => load(page - 1)}>← Prev</Button>
          <span style={{ lineHeight: '30px', fontSize: 13 }}>{page + 1} / {totalPages}</span>
          <Button variant="secondary" size="sm" disabled={page >= totalPages - 1} onClick={() => load(page + 1)}>Next →</Button>
        </div>
      )}

      {confirmDeleteUser && (
        <Modal title="Delete user?" onClose={() => setConfirmDeleteUser(null)} footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setConfirmDeleteUser(null)}>Cancel</Button>
            <Button variant="danger" onClick={doDeleteUser}>Delete User</Button>
          </div>
        }>
          <p>Are you sure you want to delete <strong>{confirmDeleteUser.name}</strong> (@{confirmDeleteUser.username})? This cannot be undone.</p>
        </Modal>
      )}

      {editUser && (
        <Modal title={`Change role for ${editUser.name}`} onClose={() => setEditUser(null)} footer={
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
