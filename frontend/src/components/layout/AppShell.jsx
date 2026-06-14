// src/components/layout/AppShell.jsx
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Search, Bell, LogOut, Upload, LayoutDashboard, Receipt, Wallet, Users, ArrowLeftRight, ScrollText } from 'lucide-react';
import useAuthStore from '../../store/auth.store';
import { useState } from 'react';

const NAV_ITEMS = [
  { to: '/dashboard',    label: 'Overview',     icon: LayoutDashboard },
  { to: '/expenses',     label: 'Expenses',     icon: Receipt },
  { to: '/balances',     label: 'Balances',     icon: Wallet },
  { to: '/settlements',  label: 'Settlements',  icon: ArrowLeftRight },
  { to: '/groups',       label: 'Groups',       icon: Users },
  { to: '/import',       label: 'Import CSV',   icon: Upload },
  { to: '/audit',        label: 'Audit Log',    icon: ScrollText },
];

// Avatar color palette — assigns a consistent color per user initial
const AVATAR_COLORS = ['lime','purple','coral','amber','teal','sky','peach'];
function avatarColor(name = '') {
  const idx = (name.charCodeAt(0) || 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

export default function AppShell() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navigation */}
      <nav className="topnav">
        <NavLink to="/dashboard" className="topnav-logo">SpilTeX</NavLink>

        {/* Search */}
        <div className="search-bar hide-mobile" style={{ flex: 1, maxWidth: 380 }}>
          <Search size={16} color="var(--text-muted)" />
          <input
            placeholder="Search expenses, members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div style={{ flex: 1 }} />

        {/* Actions */}
        <div className="flex items-center gap-sm">

          {/* User avatar */}
          <div
            className={`avatar avatar-md stat-card ${avatarColor(user?.name)}`}
            style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', cursor: 'default' }}
            title={user?.name}
          >
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>

          <span className="text-sm hide-mobile" style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
            {user?.name}
          </span>

          <button className="btn btn-outline btn-sm" style={{ borderColor: 'var(--coral)', color: 'var(--coral)' }} onClick={handleLogout} title="Logout">
            <LogOut size={15} />
            <span className="hide-mobile">Logout</span>
          </button>
        </div>
      </nav>

      {/* Tab Navigation */}
      <div className="tabnav">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `tabnav-item flex items-center gap-sm ${isActive ? 'active' : ''}`}
          >
            <Icon size={15} />
            {label}
          </NavLink>
        ))}
      </div>

      {/* Page Content */}
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>
    </div>
  );
}
