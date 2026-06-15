// src/components/layout/AppShell.jsx
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Search, Bell, LogOut, Upload, LayoutDashboard, Receipt, Wallet, Users, ArrowLeftRight, ScrollText } from 'lucide-react';
import useAuthStore from '../../store/auth.store';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { groupsApi } from '../../api/index.js';
import useAppStore from '../../store/app.store.js';

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
  const { selectedGroupId, setSelectedGroupId } = useAppStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  // Fetch groups globally so we can set a valid default group
  const { data: groupsData } = useQuery({
    queryKey: ['my-groups'],
    queryFn: () => groupsApi.list().then(r => r.data.data),
  });

  useEffect(() => {
    if (groupsData) {
      // If user has no groups, set to null
      if (groupsData.length === 0) {
        setSelectedGroupId(null);
      } 
      // If selected group is 1 (the hardcoded default) but user is not in group 1,
      // or if selectedGroupId is null but they now have groups, pick the first one
      else if (!selectedGroupId || !groupsData.find(g => g.id === selectedGroupId)) {
        setSelectedGroupId(groupsData[0].id);
      }
    }
  }, [groupsData, selectedGroupId, setSelectedGroupId]);

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
