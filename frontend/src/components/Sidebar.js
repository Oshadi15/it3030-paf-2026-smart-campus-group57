import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Sidebar = ({ collapsed, onToggle, mobileOpen, onMobileClose }) => {
  const { isAdmin, isTechnician, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const userNav = [
    { path: '/',              icon: '⊞',  label: 'Dashboard',      end: true },
    { path: '/my-bookings',   icon: '📅', label: 'My Bookings' },
    { path: '/resources',     icon: '🏛',  label: 'Resources' },
    { path: '/tickets',       icon: '🎫', label: 'Tickets' },
    { path: '/notifications', icon: '🔔', label: 'Notifications' },
  ];

  const adminNav = [
    { path: '/admin',            icon: '⚡', label: 'Admin Dashboard' },
    { path: '/resources/manage', icon: '🔧', label: 'Manage Resources' },
  ];

  const NavItem = ({ item }) => (
    <NavLink
      to={item.path}
      end={item.end}
      className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}
      onClick={onMobileClose}
      title={collapsed ? item.label : undefined}
    >
      <span className="sidebar-icon">{item.icon}</span>
      <span className="sidebar-label">{item.label}</span>
    </NavLink>
  );

  return (
    <>
      {/* Mobile dim overlay */}
      <div
        className={`sidebar-overlay${mobileOpen ? ' active' : ''}`}
        onClick={onMobileClose}
      />

      <aside className={`sidebar${collapsed ? ' collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}>
        {/* Brand */}
        <div className="sidebar-brand">
          <div className="sidebar-logo">🏫</div>
          <div className="sidebar-brand-text">
            <h2>Smart Campus</h2>
            <span>Management System</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Main Menu</div>
          {userNav.map(item => <NavItem key={item.path} item={item} />)}

          {isAdmin && (
            <>
              <div className="sidebar-section-label">Admin</div>
              {adminNav.map(item => <NavItem key={item.path} item={item} />)}
            </>
          )}
          {isTechnician && !isAdmin && (
            <>
              <div className="sidebar-section-label">Staff</div>
              <NavItem item={{ path: '/admin', icon: '🔧', label: 'Tech Dashboard' }} />
            </>
          )}
        </nav>

        {/* Footer: Logout + Collapse */}
        <div className="sidebar-footer">
          {/* Logout button */}
          <button
            id="logout-btn"
            onClick={handleLogout}
            title="Logout"
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              width: '100%', padding: '9px 10px',
              marginBottom: 6,
              background: 'rgba(220,38,38,0.07)',
              border: '1px solid rgba(220,38,38,0.18)',
              borderRadius: 'var(--radius-md)',
              color: '#DC2626', fontWeight: 600,
              fontSize: '0.85rem', cursor: 'pointer',
              transition: 'all 0.2s',
              fontFamily: 'inherit',
              justifyContent: collapsed ? 'center' : 'flex-start',
            }}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(220,38,38,0.15)'; }}
            onMouseLeave={e => { e.currentTarget.style.background='rgba(220,38,38,0.07)'; }}
          >
            <span style={{ fontSize: 16, flexShrink: 0 }}>🚪</span>
            {!collapsed && <span>Logout</span>}
          </button>

          {/* Collapse toggle */}
          <button
            className="sidebar-toggle"
            onClick={onToggle}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            id="sidebar-toggle-btn"
          >
            {collapsed ? '→' : '← Collapse'}
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
