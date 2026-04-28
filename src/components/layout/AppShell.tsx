import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../store/authStore';

// SVG icons (Lucide-style, inline for zero dep)
const Icon = {
  Dashboard: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  Projects: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
    </svg>
  ),
  Tree: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
      <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
    </svg>
  ),
  Store: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/>
      <path d="M16 10a4 4 0 01-8 0"/>
    </svg>
  ),
  Proposals: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
  Work: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/>
    </svg>
  ),
  Review: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
    </svg>
  ),
  Kanban: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="12" rx="1"/><rect x="17" y="3" width="5" height="15" rx="1"/>
    </svg>
  ),
  Ledger: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6"/>
    </svg>
  ),
  Budget: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  ),
  Users: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
    </svg>
  ),
  LogOut: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
};

interface NavItem { to: string; label: string; icon: React.ReactNode; roles: string[]; }

const navItems: NavItem[] = [
  { to: '/dashboard',  label: 'Dashboard',     icon: <Icon.Dashboard />,  roles: ['pm','contributor','admin'] },
  { to: '/projects',   label: 'Projects',      icon: <Icon.Projects />,   roles: ['pm','admin'] },
  { to: '/marketplace',label: 'Marketplace',   icon: <Icon.Store />,      roles: ['contributor','pm'] },
  { to: '/proposals',  label: 'My Proposals',  icon: <Icon.Proposals />,  roles: ['contributor'] },
  { to: '/workspace',  label: 'My Work',       icon: <Icon.Work />,       roles: ['contributor'] },
  { to: '/kanban',     label: 'Kanban',        icon: <Icon.Kanban />,     roles: ['pm','contributor','admin'] },
  { to: '/review',     label: 'Review Center', icon: <Icon.Review />,     roles: ['pm'] },
  { to: '/ledger',     label: 'Rewards',       icon: <Icon.Ledger />,     roles: ['pm','contributor','admin'] },
  { to: '/budget',     label: 'Budget',        icon: <Icon.Budget />,     roles: ['pm','admin'] },
  { to: '/admin',      label: 'Admin',         icon: <Icon.Users />,      roles: ['admin'] },
];

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user) return null;
  const visible = navItems.filter(n => n.roles.includes(user.role));

  // Derive topbar title from current path
  const currentItem = visible.find(n => location.pathname.startsWith(n.to));
  const pageTitle = currentItem?.label ?? 'DMMS';

  function handleLogout() { logout(); navigate('/login'); }

  return (
    <div className="dmms-app">
      {/* ── Sidebar ── */}
      <aside className="dmms-sidebar">
        <div className="dmms-brand">
          <div className="dmms-signet">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z"/>
              <path d="M9 12l3-4 3 4M9 16h6"/>
            </svg>
          </div>
          <span className="dmms-wordmark">DM<span>MS</span></span>
        </div>

        <nav className="dmms-nav">
          {visible.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `dmms-navitem${isActive ? ' active' : ''}`}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="dmms-nav-foot">
          <div className="dmms-user-pill">
            <div className="dmms-avatar">{initials(user.name)}</div>
            <div className="dmms-user-info">
              <div className="dmms-user-name">{user.name}</div>
              <div className="dmms-user-role">{user.role}</div>
            </div>
          </div>
          <button className="dmms-navitem" onClick={handleLogout} style={{ marginTop: 2 }}>
            <Icon.LogOut />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="dmms-main">
        <header className="dmms-topbar">
          <span className="dmms-topbar-title">{pageTitle}</span>
          <div className="dmms-topbar-right">
            <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          </div>
        </header>
        <Outlet />
      </div>
    </div>
  );
}
