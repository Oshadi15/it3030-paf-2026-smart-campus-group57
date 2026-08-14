import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { useAuth }    from '../contexts/AuthContext';
import './Notifications.css';

const TYPE_META = {
  BOOKING_APPROVED:      { icon: '✅', bg: 'rgba(0,184,148,0.15)',   label: 'Booking Approved' },
  BOOKING_REJECTED:      { icon: '❌', bg: 'rgba(255,118,117,0.15)', label: 'Booking Rejected' },
  BOOKING_CANCELLED:     { icon: '🚫', bg: 'rgba(100,116,139,0.15)', label: 'Booking Cancelled' },
  TICKET_STATUS_CHANGED: { icon: '📋', bg: 'rgba(116,185,255,0.15)', label: 'Ticket Updated' },
  NEW_COMMENT:           { icon: '💬', bg: 'rgba(162,155,254,0.15)', label: 'New Comment' },
  GENERAL:               { icon: '🔔', bg: 'rgba(108,92,231,0.15)',  label: 'General' },
};

const relativeTime = (dt) => {
  if (!dt) return '';
  const diff = Date.now() - new Date(dt).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)    return 'just now';
  if (mins < 60)   return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  return `${days}d ago`;
};

const Notifications = () => {
  const { user, isTechnician } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [message,  setMessage]  = useState('');
  const [filter,   setFilter]   = useState('all');

  const extractTicketRef = (notification) => {
    if (notification.referenceType === 'TICKET' && notification.referenceId) {
      return notification.referenceId;
    }
    // Fallback for older notifications that only store #<shortTicketId> in message.
    const msg = notification.message || '';
    const match = msg.match(/#([A-Za-z0-9-]{6,36})/);
    return match ? match[1] : null;
  };

  const fetchNotifications = useCallback(async () => {
    if (!user?.userId) return;
    try {
      setLoading(true);
      const res = await apiService.getUserNotifications(user.userId);
      setNotifications(res.data);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.userId]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);
  useEffect(() => { if (error)   { const t = setTimeout(() => setError(''),   6000); return () => clearTimeout(t); } }, [error]);
  useEffect(() => { if (message) { const t = setTimeout(() => setMessage(''), 3000); return () => clearTimeout(t); } }, [message]);

  const handleMarkRead = async (notification) => {
    try {
      if (!notification.readStatus) {
        await apiService.markNotificationRead(notification.id);
      }
      setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, readStatus: true } : n));
      // Keep user in notifications and show complete list after marking one as read.
      setFilter('all');
    } catch (err) { setError(err.message); }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiService.markAllNotificationsRead(user.userId);
      setNotifications(prev => prev.map(n => ({ ...n, readStatus: true })));
      setMessage('All notifications marked as read.');
    } catch (err) { setError(err.message); }
  };

  const handleDelete = async (id) => {
    try {
      await apiService.deleteNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (err) { setError(err.message); }
  };

  const handleOpenTicket = async (notification) => {
    try {
      if (!notification.readStatus) {
        await apiService.markNotificationRead(notification.id);
      }
      const ref = extractTicketRef(notification);
      // Technicians go to their Tech Dashboard with the ticket auto-expanded.
      // Regular users / admins go to the Tickets page.
      if (isTechnician) {
        navigate(ref ? `/tech?ticketId=${ref}` : '/tech');
      } else {
        if (ref) {
          const param = ref.length > 8 ? `ticketId=${ref}` : `ticketRef=${ref}`;
          navigate(`/tickets?${param}`);
        } else {
          navigate('/tickets');
        }
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Delete all notifications? This cannot be undone.')) return;
    try {
      await apiService.clearAllNotifications(user.userId);
      setNotifications([]);
      setMessage('All notifications cleared.');
    } catch (err) { setError(err.message); }
  };

  const unreadCount = notifications.filter(n => !n.readStatus).length;
  const displayed   = filter === 'unread' ? notifications.filter(n => !n.readStatus) : notifications;

  return (
    <div className="notifications-page">
      {/* Header */}
      <div className="page-header notifications-header">
        <div>
          <h1 className="page-title">
            🔔 Notifications
            {unreadCount > 0 && (
              <span className="badge badge-rejected unread-badge">
                {unreadCount} unread
              </span>
            )}
          </h1>
          <p className="page-subtitle">Stay updated on your bookings and ticket progress</p>
        </div>
        <div className="notifications-actions">
          {unreadCount > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={handleMarkAllRead} id="mark-all-read-btn">✓ Mark All Read</button>
          )}
          {notifications.length > 0 && (
            <button className="btn btn-danger btn-sm" onClick={handleClearAll} id="clear-all-notifs-btn">🗑 Clear All</button>
          )}
        </div>
      </div>

      {message && <div className="alert alert-success">{message}</div>}
      {error   && <div className="alert alert-error">{error}</div>}

      {/* Filter tabs */}
      <div className="tabs notifications-tabs">
        <button className={`tab${filter === 'all' ? ' active' : ''}`} onClick={() => setFilter('all')}>
          All <span className="tab-count">{notifications.length}</span>
        </button>
        <button className={`tab${filter === 'unread' ? ' active' : ''}`} onClick={() => setFilter('unread')}>
          Unread <span className="tab-count">{unreadCount}</span>
        </button>
      </div>

      {/* Notification list */}
      {loading ? (
        <div className="notifications-loading-list">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="notif-skeleton-item">
              <div className="skeleton notif-skeleton-icon" />
              <div className="notif-skeleton-body">
                <div className="skeleton skel-text notif-skeleton-line-lg" />
                <div className="skeleton skel-text notif-skeleton-line-sm" />
              </div>
            </div>
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div className="glass-card">
          <div className="empty-state">
            <div className="empty-icon">🔕</div>
            <p className="empty-text">
              {filter === 'unread' ? 'No unread notifications.' : 'No notifications yet. Actions will appear here.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="notif-list" style={{ background: 'var(--glass-bg)' }}>
          {displayed.map(n => {
            const meta = TYPE_META[n.type] || TYPE_META.GENERAL;
            return (
              <div key={n.id} className={`notif-item${!n.readStatus ? ' unread' : ''}`}>
                {/* Icon */}
                <div className="notif-icon-wrap" style={{ background: meta.bg }}>
                  {meta.icon}
                </div>

                {/* Content */}
                <div className="notif-body">
                  <p className="notif-msg">{n.message}</p>
                  <p className="notif-meta">
                    {meta.label} · {relativeTime(n.createdAt)}
                  </p>
                </div>

                {/* Actions */}
                <div className="notif-actions">
                  {n.referenceType === 'TICKET' && n.referenceId && (
                    <button
                      onClick={() => handleOpenTicket(n)}
                      className="btn btn-primary btn-xs"
                      title="Open ticket details"
                    >
                      Open Ticket
                    </button>
                  )}
                  {!n.readStatus && (
                    <button
                      onClick={() => handleMarkRead(n)}
                      className="btn btn-ghost btn-xs"
                      title="Fix"
                    >
                      ✅ Fix
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(n.id)}
                    className="btn btn-danger btn-xs"
                    title="Delete notification"
                  >
                    ✕
                  </button>
                </div>

                {/* Unread indicator dot */}
                {!n.readStatus && <div className="notif-unread-dot" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Notifications;
