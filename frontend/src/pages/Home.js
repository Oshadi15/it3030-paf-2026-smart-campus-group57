import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import './Home.css';

const fmtDate = (dt) => dt ? new Date(dt).toLocaleString(undefined, {
  month: 'short', day: 'numeric',
  hour: '2-digit', minute: '2-digit',
}) : '—';

const Home = () => {
  const { user, isAdmin, isTechnician } = useAuth();
  const navigate = useNavigate();
  const displayName = user?.name || 'User';

  const [bookings,     setBookings]     = useState([]);
  const [unreadCount,  setUnreadCount]  = useState(null);
  const [ticketCount,  setTicketCount]  = useState(0);

  // Admins land directly on the admin dashboard
  useEffect(() => {
    if (isAdmin) {
      navigate('/admin', { replace: true });
    }
  }, [navigate, isAdmin]);

  // Fetch upcoming bookings, unread notification count, and open ticket count
  useEffect(() => {
    if (!user?.userId) return;

    apiService.getUserBookings(user.userId)
      .then((res) => setBookings(res.data || []))
      .catch(() => {});

    apiService.getUnreadCount(user.userId)
      .then((res) => setUnreadCount(typeof res.data === 'number' ? res.data : (res.data?.count ?? 0)))
      .catch(() => setUnreadCount(null));

    apiService.getUserTickets(user.userId)
      .then(res => {
        const all = Array.isArray(res.data) ? res.data : [];
        setTicketCount(all.filter(t => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length);
      })
      .catch(() => {});
  }, [user?.userId]);

  const upcoming = useMemo(() => {
    const now = new Date();
    return (bookings || [])
      .filter((b) => b?.startTime && new Date(b.startTime) > now)
      .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
      .slice(0, 4);
  }, [bookings]);

  return (
    <div className="home-page">
      <div className="page-header">
        <h1 className="page-title">Welcome, {displayName}</h1>
        <p className="page-subtitle">
          Plan your bookings, report issues, and track updates in one place.
        </p>
      </div>

      {/* Hero card */}
      <div className="home-hero-card">
        <div className="home-hero-head">
          <span className="home-hero-icon">🏫</span>
          <div>
            <h2 className="home-hero-title">Smart Campus Operations Hub</h2>
            <p className="home-hero-subtitle">
              {unreadCount === null
                ? 'Everything is connected and ready.'
                : `You have ${unreadCount} unread notification(s).`}
            </p>
          </div>
        </div>
        <p className="home-hero-text">
          Monitor resources, handle support requests, and keep campus operations running smoothly from one place.
        </p>
      </div>

      {/* Quick-action cards */}
      <p className="home-section-label">Quick Access</p>
      <div className="home-quick-grid">
        <button className="home-quick-card" onClick={() => navigate('/resources')} type="button">
          <div className="home-quick-icon">🏛️</div>
          <div className="home-quick-title">Browse Resources</div>
          <div className="home-quick-text">Find rooms and equipment available for booking.</div>
        </button>

        {!isTechnician && (
          <button className="home-quick-card" onClick={() => navigate('/booking')} type="button">
            <div className="home-quick-icon">📅</div>
            <div className="home-quick-title">New Booking</div>
            <div className="home-quick-text">Request a resource booking (admin approval required).</div>
          </button>
        )}

        {!isTechnician && (
          <button className="home-quick-card" onClick={() => navigate('/my-bookings')} type="button">
            <div className="home-quick-icon">🧾</div>
            <div className="home-quick-title">My Bookings</div>
            <div className="home-quick-text">Track your booking status and history.</div>
          </button>
        )}

        <button
          className="home-quick-card"
          onClick={() => navigate(isTechnician ? '/tickets' : '/tickets?openForm=1')}
          type="button"
        >
          <div className="home-quick-icon">
            🎫
            {ticketCount > 0 && (
              <span style={{
                marginLeft: 6, background: '#fbbf24', color: '#1e293b',
                borderRadius: '50%', fontSize: '0.65rem', fontWeight: 800,
                padding: '1px 6px', verticalAlign: 'middle',
              }}>{ticketCount}</span>
            )}
          </div>
          <div className="home-quick-title">Support Tickets</div>
          <div className="home-quick-text">
            {isTechnician ? 'View tickets assigned to you.' : 'Report issues and follow status updates.'}
          </div>
        </button>

        <button className="home-quick-card" onClick={() => navigate('/notifications')} type="button">
          <div className="home-quick-icon">
            🔔
            {unreadCount > 0 && (
              <span style={{
                marginLeft: 6, background: '#f87171', color: '#fff',
                borderRadius: '50%', fontSize: '0.65rem', fontWeight: 800,
                padding: '1px 6px', verticalAlign: 'middle',
              }}>{unreadCount}</span>
            )}
          </div>
          <div className="home-quick-title">Notifications</div>
          <div className="home-quick-text">Stay informed with real-time alerts.</div>
        </button>

        {isAdmin && (
          <button className="home-quick-card" onClick={() => navigate('/admin')} type="button">
            <div className="home-quick-icon">⚙️</div>
            <div className="home-quick-title">Admin Dashboard</div>
            <div className="home-quick-text">Manage users, bookings and all tickets.</div>
          </button>
        )}

        {isTechnician && (
          <button className="home-quick-card" onClick={() => navigate('/tech')} type="button">
            <div className="home-quick-icon">🛠️</div>
            <div className="home-quick-title">Tech Dashboard</div>
            <div className="home-quick-text">View and resolve tickets assigned to you.</div>
          </button>
        )}
      </div>

      {/* Upcoming bookings panel — hidden for technicians */}
      {!isTechnician && (
        <div className="home-panels">
          <div className="home-panel">
            <div className="home-panel-head">
              <div>
                <div className="home-panel-title">Upcoming bookings</div>
                <div className="home-panel-subtitle">Next reservations starting soon</div>
              </div>
              <button className="home-panel-link" onClick={() => navigate('/my-bookings')} type="button">
                View all →
              </button>
            </div>

            {upcoming.length === 0 ? (
              <div className="home-panel-empty">
                No upcoming bookings. Create one from <strong>New Booking</strong>.
              </div>
            ) : (
              <div className="home-upcoming-list">
                {upcoming.map((b) => (
                  <div className="home-upcoming-item" key={b.id}>
                    <div className="home-upcoming-main">
                      <div className="home-upcoming-resource">{b.resourceName || 'Resource'}</div>
                      <div className="home-upcoming-meta">
                        <span>🕒 {fmtDate(b.startTime)} – {fmtDate(b.endTime)}</span>
                        <span className={`badge badge-${String(b.status || '').toLowerCase()}`}>
                          {String(b.status || '').replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                    <div className="home-upcoming-purpose" title={b.purpose || ''}>
                      {b.purpose || '—'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
