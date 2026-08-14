import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import './Sidebar.css';

const Sidebar = ({ collapsed, onToggle, mobileOpen, onMobileClose }) => {
  const { user, isAdmin, isTechnician, logout } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  // Poll for unread notifications every 30 seconds
  useEffect(() => {
    if (!user?.userId) return;
    const load = () => {
      apiService.getUserNotifications(user.userId)
        .then(res => {
          const list = Array.isArray(res.data) ? res.data : [];
          setUnreadCount(list.filter(n => !n.readStatus).length);
        })
        .catch(() => {});
    };
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [user?.userId]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const userNav = [
    { path: '/',              icon: '⊞',  label: 'Dashboard',      end: true },
    ...(!isTechnician ? [
      { path: '/my-bookings', icon: '📅', label: 'My Bookings' },
      { path: '/resources',   icon: '🏛',  label: 'Resources' },
    ] : []),
    { path: '/tickets',       icon: '🎫', label: 'Tickets' },
    { path: '/notifications', icon: '🔔', label: 'Notifications', badge: unreadCount },
  ];

  const adminNav = [
    { path: '/admin',            icon: '⚡', label: 'Admin Dashboard' },
    { path: '/resources/manage', icon: '🔧', label: 'Manage Resources' },
  ];

  const techNav = [
    { path: '/tech', icon: '🛠️', label: 'Tech Dashboard' },
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
      {item.badge > 0 && (
        <span className="sidebar-badge">{item.badge > 99 ? '99+' : item.badge}</span>
      )}
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
              {techNav.map(item => <NavItem key={item.path} item={item} />)}
            </>
          )}
        </nav>

        {/* Footer: Logout + Collapse */}
        <div className="sidebar-footer">
          <button
            className={`sidebar-logout${collapsed ? ' collapsed' : ''}`}
            onClick={handleLogout}
            title="Logout"
          >
            <span className="sidebar-logout-icon">🚪</span>
            {!collapsed && <span>Logout</span>}
          </button>

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
