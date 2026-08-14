import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import BookingList from '../components/BookingList';
import StatusBadge from '../components/StatusBadge';
import './AdminDashboard.css';

/* ── Helpers ───────────────────────────────────────────────── */
const fmt = (dt) => dt ? new Date(dt).toLocaleString() : '—';

const TICKET_STATUS_FLOW = {
  OPEN: ['IN_PROGRESS', 'REJECTED'],
  IN_PROGRESS: ['RESOLVED', 'REJECTED'],
  RESOLVED: ['CLOSED'],
  CLOSED: [],
  REJECTED: [],
};

/* ── Stat Card ─────────────────────────────────────────────── */
const StatCard = ({ label, value, sub, iconBg, icon }) => (
  <div className="stat-card">
    <div className="stat-icon" style={{ background: iconBg }}>{icon}</div>
    <div className="stat-value" style={{ color: 'var(--text-primary)' }}>{value ?? '…'}</div>
    <div className="stat-label">{label}</div>
    {sub && <div className="stat-sub">{sub}</div>}
  </div>
);

/* ── Skeleton row ──────────────────────────────────────────── */
const SkeletonRows = ({ n = 4 }) => (
  <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
    {Array.from({ length: n }).map((_, i) => (
      <div key={i} className="skeleton skel-text" style={{ width: `${75 + (i % 3) * 8}%` }} />
    ))}
  </div>
);

/* ── Admin Dashboard ───────────────────────────────────────── */
const AdminDashboard = () => {
  const { user, isAdmin, isTechnician } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('bookings');
  const [bookings, setBookings] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [resources, setResources] = useState([]);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [rejectModal, setRejectModal] = useState({ open: false, id: null, type: '', reason: '' });
  const [userModal, setUserModal] = useState({ open: false, name: '', email: '', role: 'USER' });
  const [ticketSearch, setTicketSearch] = useState('');

  const clearAlerts = () => { setError(''); setMessage(''); };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [bookRes, tickRes, statsRes, userRes, resRes] = await Promise.all([
        apiService.getAllBookings(),
        apiService.getAllTickets(),
        apiService.getAdminStats(),
        apiService.getUsers(),
        apiService.getResources(),
      ]);
      setBookings(bookRes.data || []);
      setTickets(tickRes.data || []);
      setStats(statsRes.data || null);
      setUsers(userRes.data || []);
      setResources(resRes.data || []);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.userId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => {
    if (isTechnician && !isAdmin) {
      setTab('tickets');
    }
  }, [isAdmin, isTechnician]);
  useEffect(() => { if (message) { const t = setTimeout(() => setMessage(''), 4000); return () => clearTimeout(t); } }, [message]);

  const fetchBookings = useCallback(async () => {
    try {
      const res = await apiService.getAllBookings(
        statusFilter || undefined,
        resourceFilter || undefined
      );
      setBookings(res.data || []);
    } catch (err) {
      setError(err.message);
    }
  }, [statusFilter, resourceFilter]);

  useEffect(() => {
    if (tab !== 'bookings') return;
    fetchBookings();
  }, [tab, fetchBookings]);

  // Booking actions
  const handleApprove = async (id) => {
    clearAlerts();
    try { await apiService.approveBooking(id); setMessage('✅ Booking approved.'); fetchAll(); }
    catch (err) { setError(err.message); }
  };
  const handleCancelBooking = async (id) => {
    if (!window.confirm('Cancel this APPROVED booking?')) return;
    clearAlerts();
    try {
      await apiService.cancelBooking(id);
      setMessage('✅ Booking cancelled.');
      fetchAll();
    } catch (err) {
      setError(err.message);
    }
  };
  const openRejectModal = (id, type = 'booking') =>
    setRejectModal({ open: true, id, type, reason: '' });

  const handleRejectConfirm = async () => {
    if (!rejectModal.reason.trim()) { setError('Please provide a rejection reason.'); return; }
    clearAlerts();
    try {
      if (rejectModal.type === 'booking') {
        await apiService.rejectBooking(rejectModal.id, rejectModal.reason);
        setMessage('Booking rejected.');
      } else {
        await apiService.updateTicketStatus(rejectModal.id, 'REJECTED', rejectModal.reason);
        setMessage('Ticket rejected.');
      }
      setRejectModal({ open: false, id: null, type: '', reason: '' });
      fetchAll();
    } catch (err) { setError(err.message); }
  };

  /* ── Ticket actions ── */
  const handleTicketStatus = async (id, newStatus) => {
    if (newStatus === 'REJECTED') { openRejectModal(id, 'ticket'); return; }
    clearAlerts();
    try {
      if (newStatus === 'RESOLVED') {
        await apiService.resolveTicket(id);
        setMessage('Ticket fixed by technician.');
      } else {
        await apiService.updateTicketStatus(id, newStatus);
        setMessage(`Ticket moved to ${newStatus}.`);
      }
      fetchAll();
    }
    catch (err) { setError(err.message); }
  };
  const handleAssignTicket = async (id, technicianId) => {
    clearAlerts();
    try {
      await apiService.assignTicket(id, technicianId || user.userId);
      setMessage('✅ Ticket assigned successfully. The technician will see it on their dashboard.');
      fetchAll();
    }
    catch (err) { setError(err.message); }
  };
  const canAdminDeleteTicket = (ticket) =>
    ['RESOLVED', 'REJECTED'].includes(ticket.status);
  const handleDeleteTicket = async (id) => {
    if (!window.confirm('Delete this ticket? This action cannot be undone.')) return;
    clearAlerts();
    try {
      await apiService.deleteTicket(id);
      setMessage('Ticket deleted.');
      fetchAll();
    } catch (err) { setError(err.message); }
  };

  /* Clear all resolved/rejected tickets in one go (admin only) */
  const [clearing, setClearing] = useState(false);
  const handleClearAllTickets = async () => {
    const deletable = tickets.filter(t => ['RESOLVED', 'REJECTED'].includes(t.status));
    if (deletable.length === 0) {
      setMessage('ℹ️ No resolved or rejected tickets to clear.');
      return;
    }
    if (!window.confirm(`Delete all ${deletable.length} resolved/rejected ticket(s)? This cannot be undone.`)) return;
    clearAlerts();
    setClearing(true);
    let deleted = 0;
    let failed = 0;
    for (const t of deletable) {
      try { await apiService.deleteTicket(t.id); deleted++; }
      catch { failed++; }
    }
    setClearing(false);
    setMessage(`🗑 Cleared ${deleted} ticket(s)${failed > 0 ? ` (${failed} failed)` : ''}.`);
    fetchAll();
  };

  /* Refresh — re-fetch everything from backend */
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    clearAlerts();
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
    setMessage('🔄 Dashboard refreshed.');
  };

  /* ── User actions ── */
  const handleCreateUser = async () => {
    if (!userModal.name || !userModal.email) { setError('Name and Email are required.'); return; }
    clearAlerts();
    try {
      await apiService.createUser({ name: userModal.name, email: userModal.email, role: userModal.role });
      setMessage('User created successfully.');
      setUserModal({ open: false, name: '', email: '', role: 'USER' });
      fetchAll();
    } catch (err) { setError(err.message); }
  };

  const handleSetRole = async (u, newRole) => {
    clearAlerts();
    try {
      await apiService.updateUserRole(u.id, newRole);
      setMessage(`User role updated to ${newRole}.`);
      fetchAll();
    } catch (err) { setError(err.message); }
  };

  const filteredBookings = statusFilter ? bookings.filter(b => b.status === statusFilter) : bookings;
  const filteredTickets = tickets.filter(t => {
    const byStatus = !statusFilter || t.status === statusFilter;
    const q = ticketSearch.trim().toLowerCase();
    if (!q) return byStatus;
    const bySearch = [t.category, t.description, t.resourceName, t.id]
      .filter(Boolean)
      .some(v => String(v).toLowerCase().includes(q));
    return byStatus && bySearch;
  });

  return (
    <div className="admin-dashboard-page">
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">Admin Dashboard</h1>
        <p className="page-subtitle">Manage bookings, tickets, and monitor system health</p>
      </div>

      {message && (
        <div className="alert alert-success" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <span>{message}</span>
        </div>
      )}
      {error && <div className="alert alert-error">{error}</div>}

      {/* ── Stats Grid ── */}
      {isAdmin && (
        <div className="stats-grid">
          <StatCard label="Total Resources" value={stats?.totalResources} icon="🏛" iconBg="rgba(116,185,255,0.15)" />
          <StatCard label="Total Users" value={stats?.totalUsers} icon="👥" iconBg="rgba(108,92,231,0.15)" />
          <StatCard label="Pending Bookings" value={stats?.bookings?.pending} icon="📅" iconBg="rgba(253,203,110,0.15)" sub={`${stats?.bookings?.total ?? 0} total bookings`} />
          <StatCard label="Open Tickets" value={stats?.tickets?.open} icon="🎫" iconBg="rgba(255,118,117,0.15)" sub={`${stats?.tickets?.total ?? 0} total tickets`} />
          <StatCard label="Resolved Tickets" value={stats?.tickets?.resolved} icon="✅" iconBg="rgba(0,184,148,0.15)" />
        </div>
      )}

      {/* ── Reject Modal ── */}
      {rejectModal.open && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-title">
              <span>❌</span>
              Reject {rejectModal.type === 'booking' ? 'Booking' : 'Ticket'}
            </div>
            <div className="form-group">
              <label className="form-label">Rejection Reason *</label>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="Enter reason for rejection…"
                value={rejectModal.reason}
                onChange={e => setRejectModal({ ...rejectModal, reason: e.target.value })}
                autoFocus
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-danger" onClick={handleRejectConfirm}>Confirm Reject</button>
              <button className="btn btn-ghost" onClick={() => setRejectModal({ open: false, id: null, type: '', reason: '' })}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add User Modal ── */}
      {userModal.open && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-title"><span>👤</span> Add New User</div>
            <div className="form-group">
              <label className="form-label">Name</label>
              <input className="form-input" value={userModal.name} onChange={e => setUserModal({ ...userModal, name: e.target.value })} placeholder="Jane Doe" />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input type="email" className="form-input" value={userModal.email} onChange={e => setUserModal({ ...userModal, email: e.target.value })} placeholder="jane@example.com" />
            </div>
            <div className="form-group">
              <label className="form-label">Role</label>
              <select className="form-select" value={userModal.role} onChange={e => setUserModal({ ...userModal, role: e.target.value })}>
                <option value="USER">USER</option>
                <option value="ADMIN">ADMIN</option>
                <option value="TECHNICIAN">TECHNICIAN</option>
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={handleCreateUser}>Create User</button>
              <button className="btn btn-ghost" onClick={() => setUserModal({ open: false, name: '', email: '', role: 'USER' })}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── TICKET ── */}
      {/* ── Tabs ── */}
      <div className="flex items-center justify-between" style={{ marginBottom: 22 }}>
        <div className="tabs" style={{ marginBottom: 0 }}>
          {isAdmin && (
            <button className={`tab${tab === 'bookings' ? ' active' : ''}`} onClick={() => { setTab('bookings'); setStatusFilter(''); }}>
              📅 Bookings <span className="tab-count">{bookings.length}</span>
            </button>
          )}
          <button className={`tab${tab === 'tickets' ? ' active' : ''}`} onClick={() => { setTab('tickets'); setStatusFilter(''); }}>
            🎫 Tickets <span className="tab-count">{tickets.length}</span>
          </button>
          {isAdmin && (
            <button className={`tab${tab === 'users' ? ' active' : ''}`} onClick={() => setTab('users')}>
              👥 Users <span className="tab-count">{users.length}</span>
            </button>
          )}
        </div>
        {isAdmin && tab === 'users' && (
          <button className="btn btn-primary" onClick={() => setUserModal({ open: true, name: '', email: '', role: 'USER' })}>+ Add User</button>
        )}
      </div>

      {/* ── Filter Bar ── */}
      {tab !== 'users' && (
        <div className="filter-bar">
          <div className="form-group">
            <label className="form-label">Filter by Status</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="form-select" style={{ minWidth: 160 }}>
              <option value="">All Statuses</option>
              {tab === 'bookings' ? (
                <>
                  <option value="PENDING">PENDING</option>
                  <option value="APPROVED">APPROVED</option>
                  <option value="REJECTED">REJECTED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </>
              ) : (
                <>
                  <option value="OPEN">OPEN</option>
                  <option value="IN_PROGRESS">IN PROGRESS</option>
                  <option value="RESOLVED">RESOLVED</option>
                  <option value="CLOSED">CLOSED</option>
                  <option value="REJECTED">REJECTED</option>
                </>
              )}
            </select>
          </div>
          {tab === 'tickets' && (
            <div className="form-group" style={{ minWidth: 220 }}>
              <label className="form-label">Search Tickets</label>
              <input
                type="text"
                className="form-input"
                value={ticketSearch}
                onChange={(e) => setTicketSearch(e.target.value)}
                placeholder="Search by id, category, description..."
              />
            </div>
          )}
          {statusFilter && (
            <button className="btn btn-ghost btn-sm" onClick={() => setStatusFilter('')}>✕ Clear Filter</button>
          )}
          <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            {tab === 'bookings' ? filteredBookings.length : filteredTickets.length} result(s)
          </span>
          {/* ── Testing / Admin Tools ── */}
          {isAdmin && tab === 'tickets' && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', borderLeft: '1px solid rgba(148,163,184,0.15)', paddingLeft: 12, marginLeft: 4 }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>Admin Tools</span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={handleRefresh}
                disabled={refreshing}
                title="Reload all tickets and users from the database"
                style={{ display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}
              >
                <span style={{ display: 'inline-block', animation: refreshing ? 'adminSpin 0.8s linear infinite' : 'none' }}>🔄</span>
                {refreshing ? 'Refreshing…' : 'Refresh'}
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={handleClearAllTickets}
                disabled={clearing || tickets.filter(t => t.status === 'RESOLVED').length === 0}
                title={`Delete all ${tickets.filter(t => t.status === 'RESOLVED').length} RESOLVED ticket(s)`}
                style={{ whiteSpace: 'nowrap' }}
              >
                {clearing ? '⏳ Clearing…' : `🗑 Clear All (${tickets.filter(t => t.status === 'RESOLVED').length})`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Content ── */}
      {loading ? (
        <div className="table-wrap"><SkeletonRows n={5} /></div>
      ) : tab === 'bookings' ? (
        <BookingList
          bookings={filteredBookings}
          onApprove={handleApprove}
          onReject={(id) => openRejectModal(id, 'booking')}
          onCancel={handleCancelBooking}
          showActions
        />
      ) : tab === 'tickets' ? (
        /* ── Ticket Table ── */
        <div className="table-wrap">
          {filteredTickets.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🎫</div>
              <p className="empty-text">No tickets found{statusFilter ? ` with status "${statusFilter}"` : ''}.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 260 }}>Ticket</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Resource</th>
                  <th>Reporter</th>
                  <th>Created</th>
                  <th style={{ minWidth: 220 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map(ticket => {
                  const priorityColor = {
                    CRITICAL: '#f87171', HIGH: '#fbbf24',
                    MEDIUM: '#60a5fa', LOW: '#34d399'
                  }[ticket.priority] || '#94a3b8';
                  const isResolved = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED';
                  return (
                    <tr key={ticket.id} className={isResolved ? 'ticket-row-fixed' : ''}>
                      {/* Ticket Info */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <span
                            className="priority-dot"
                            style={{ background: priorityColor, marginTop: 5, boxShadow: `0 0 6px ${priorityColor}88` }}
                          />
                          <div>
                            <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>{ticket.category}</strong>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 3 }}>
                              <code style={{ fontSize: '0.68rem', color: 'var(--text-muted)', background: 'rgba(148,163,184,0.1)', padding: '1px 5px', borderRadius: 4 }}>
                                #{ticket.id?.slice(-8)}
                              </code>
                              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                {ticket.description?.substring(0, 45)}{ticket.description?.length > 45 ? '…' : ''}
                              </span>
                            </div>
                            {ticket.preferredContactDetails && (
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                📞 {ticket.preferredContactDetails}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Priority */}
                      <td>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          fontSize: '0.72rem', fontWeight: 700,
                          color: priorityColor,
                          background: `${priorityColor}18`,
                          border: `1px solid ${priorityColor}40`,
                          borderRadius: 6, padding: '3px 8px'
                        }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: priorityColor, display: 'inline-block' }} />
                          {ticket.priority}
                        </span>
                      </td>

                      {/* Status */}
                      <td><StatusBadge status={ticket.status} /></td>

                      {/* Resource */}
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        {ticket.resourceName
                          ? <span style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.15)', borderRadius: 6, padding: '2px 7px', fontSize: '0.76rem' }}>
                            📍 {ticket.resourceName}
                          </span>
                          : <span style={{ color: 'var(--text-muted)' }}>—</span>
                        }
                      </td>

                      {/* Reporter */}
                      <td>
                        <code style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'rgba(148,163,184,0.08)', padding: '2px 6px', borderRadius: 5 }}>
                          …{ticket.reporterId?.slice(-8)}
                        </code>
                        {ticket.assignedTo && (
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 3 }}>
                            🔧 …{ticket.assignedTo.slice(-6)}
                          </div>
                        )}
                      </td>

                      {/* Created */}
                      <td style={{ fontSize: '0.76rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {fmt(ticket.createdAt)}
                      </td>

                      {/* Actions */}
                      <td>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                          {/* Assign Technician */}
                          {isAdmin && !ticket.assignedTo && ticket.status === 'OPEN' && (
                            <select
                              className="form-select"
                              style={{ fontSize: '0.75rem', padding: '2px 6px', minWidth: '120px' }}
                              onChange={(e) => {
                                if (e.target.value) handleAssignTicket(ticket.id, e.target.value);
                              }}
                              value=""
                            >
                              <option value="">🔧 Assign Technician...</option>
                              {users.filter(u => u.role === 'TECHNICIAN' || u.role === 'ADMIN').map(tech => (
                                <option key={tech.id} value={tech.id}>{tech.name || tech.email} ({tech.role})</option>
                              ))}
                            </select>
                          )}
                          {/* In progress indicator */}
                          {ticket.assignedTo && ticket.status === 'IN_PROGRESS' && (
                            <span style={{ fontSize: '0.68rem', color: 'var(--warning)', fontWeight: 700, whiteSpace: 'nowrap', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 5, padding: '2px 6px' }}>
                              ⚙️ In Progress
                            </span>
                          )}
                          {/* Status flow buttons */}
                          {(isAdmin || (isTechnician && ticket.assignedTo === user.userId)) && TICKET_STATUS_FLOW[ticket.status]?.map(next => (
                            <button
                              key={next}
                              className={`btn btn-xs ${next === 'REJECTED' ? 'btn-danger' : next === 'RESOLVED' ? 'btn-success' : 'btn-ghost'}`}
                              onClick={() => handleTicketStatus(ticket.id, next)}
                            >
                              {next === 'RESOLVED' ? '✅ Fix' : `→ ${next.replace('_', ' ')}`}
                            </button>
                          ))}
                          {/* Fixed badge */}
                          {isResolved && (
                            <span style={{ fontSize: '0.68rem', color: 'var(--success)', fontWeight: 700, whiteSpace: 'nowrap', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: 5, padding: '2px 7px' }}>
                              ✅ Fixed{ticket.resolvedBy ? ` ·…${ticket.resolvedBy.slice(-5)}` : ''}
                            </span>
                          )}
                          {/* Delete */}
                          {isAdmin && canAdminDeleteTicket(ticket) && (
                            <button className="btn btn-danger btn-xs" onClick={() => handleDeleteTicket(ticket.id)}>
                              🗑
                            </button>
                          )}
                        </div>
                        {ticket.rejectionReason && (
                          <div className="ticket-note-danger">❌ {ticket.rejectionReason}</div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        /* ── Users Table ── */
        <div className="table-wrap">
          {users.length === 0 ? (
            <div className="empty-state"><p className="empty-text">No users found.</p></div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <img src={u.picture || 'https://via.placeholder.com/30'} alt="" style={{ width: 30, height: 30, borderRadius: '50%' }} />
                        <strong>{u.name}</strong>
                      </div>
                    </td>
                    <td>{u.email}</td>
                    <td><StatusBadge status={`ROLE-${u.role}`} /></td>
                    <td>{fmt(u.createdAt)}</td>
                    <td>
                      {u.id !== user.userId && (
                        <select
                          className="form-select"
                          style={{ minWidth: 140 }}
                          value={u.role}
                          onChange={(e) => handleSetRole(u, e.target.value)}
                        >
                          <option value="USER">USER</option>
                          <option value="ADMIN">ADMIN</option>
                          <option value="TECHNICIAN">TECHNICIAN</option>
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
