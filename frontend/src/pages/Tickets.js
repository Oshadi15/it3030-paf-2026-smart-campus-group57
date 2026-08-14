import React, { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';
import { useAuth }    from '../contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import TicketForm     from '../components/TicketForm';
import StatusBadge    from '../components/StatusBadge';
import './Tickets.css';

/* ── Tickets Page ───────────────────────────────────────────── */
// Main ticket management page: fetches tickets, renders ticket cards,
// handles status updates, ticket actions, comments, and ticket creation.
/* ── Constants ─────────────────────────────────────────────── */
const STATUS_TRANSITIONS = {
  OPEN:        ['IN_PROGRESS', 'REJECTED'],
  IN_PROGRESS: ['REJECTED'],
  RESOLVED:    ['CLOSED'],
  CLOSED:      [],
  REJECTED:    [],
};
const fmt = (dt) => dt ? new Date(dt).toLocaleString() : '—';

/* ── Tickets Page ──────────────────────────────────────────── */
const Tickets = () => {
  const { user, isAdmin, isTechnician } = useAuth();
  const location = useLocation();
  const [tickets,        setTickets]        = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState('');
  const [success,        setSuccess]        = useState('');
  const [comment,        setComment]        = useState({});        // ticketId → text
  const [editingComment, setEditingComment] = useState(null);       // {ticketId, commentId, text}
  const [expandedTicket, setExpandedTicket] = useState(null);
  const [filterStatus,   setFilterStatus]   = useState('');
  const [searchText,     setSearchText]     = useState('');
  const [showForm,       setShowForm]       = useState(false);
  const [editingTicket,  setEditingTicket]  = useState(null);

  const [rejectModal,  setRejectModal]  = useState({ open: false, ticketId: null, reason: '' });
  const [resolveModal, setResolveModal] = useState({ open: false, ticketId: null, notes: '' });
  // Return true only when current user can fix this ticket.
  const canFixTicket = (ticket) =>
    ticket.status === 'IN_PROGRESS' && (isAdmin || (isTechnician && ticket.assignedTo === user.userId));
  // Ticket is considered fixed once resolved or closed.
  const isFixedTicket = (ticket) => ticket.status === 'RESOLVED' || ticket.status === 'CLOSED';

  // Fetch tickets based on role scope (admin all, technician assigned+own, user own).
  const fetchTickets = useCallback(async () => {
    if (!user?.userId) return;
    try {
      setLoading(true);
      if (isAdmin || isTechnician) {
        const res = await apiService.getAllTickets();
        const list = Array.isArray(res.data) ? res.data : [];
        const scoped = isTechnician
          ? list.filter(t => t.assignedTo === user.userId || t.reporterId === user.userId)
          : list;
        setTickets(scoped);
      } else {
        const res = await apiService.getUserTickets(user.userId);
        setTickets(res.data);
      }
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, isTechnician, user?.userId]);

  // Initial/refresh data load.
  useEffect(() => { fetchTickets(); }, [fetchTickets]);
  // Open a specific ticket from query params (ticketId or short ticketRef), or open form if ?openForm=1.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const ticketId  = params.get('ticketId');
    const ticketRef = params.get('ticketRef');
    const openForm  = params.get('openForm');

    // Auto-open the New Ticket form when navigated from Home card
    if (openForm === '1' && !isTechnician) {
      setShowForm(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (ticketId) {
      setExpandedTicket(ticketId);
      return;
    }

    if (ticketRef && tickets.length > 0) {
      const matched = tickets.find(t => t.id === ticketRef || t.id?.endsWith(ticketRef));
      if (matched?.id) {
        setExpandedTicket(matched.id);
      }
    }
  }, [location.search, tickets, isTechnician]);
  // Smooth-scroll to expanded ticket card for better UX.
  useEffect(() => {
    if (!expandedTicket) return;
    const el = document.getElementById(`ticket-${expandedTicket}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [expandedTicket]);
  useEffect(() => { if (success) { const t = setTimeout(() => setSuccess(''), 4000); return () => clearTimeout(t); } }, [success]);
  useEffect(() => { if (error)   { const t = setTimeout(() => setError(''),   6000); return () => clearTimeout(t); } }, [error]);

  /* ── Status transitions ── */
  // Move ticket to the next workflow status (used by admin/assigned technician).
  const handleAdvanceStatus = async (ticketId, nextStatus) => {
    try { await apiService.updateTicketStatus(ticketId, nextStatus); setSuccess(`Ticket → ${nextStatus}.`); fetchTickets(); }
    catch (err) { setError(err.message); }
  };
  const handleRejectConfirm = async () => {
    if (!rejectModal.reason.trim()) { setError('Rejection reason is required.'); return; }
    try {
      await apiService.updateTicketStatus(rejectModal.ticketId, 'REJECTED', rejectModal.reason);
      setSuccess('Ticket rejected.'); setRejectModal({ open: false, ticketId: null, reason: '' }); fetchTickets();
    } catch (err) { setError(err.message); }
  };
  // Confirm ticket fix and save optional resolution notes to backend.
  const handleResolveConfirm = async () => {
    try {
      await apiService.resolveTicket(resolveModal.ticketId, resolveModal.notes);
      setSuccess('Ticket resolved.'); setResolveModal({ open: false, ticketId: null, notes: '' }); fetchTickets();
    } catch (err) { setError(err.message); }
  };

  /* ── Comments ── */
  // Add a new comment with basic length validation.
  const handleAddComment = async (ticketId) => {
    const text = comment[ticketId]?.trim();
    if (!text) return;
    if (text.length < 2) { setError('Comment must be at least 2 characters.'); return; }
    if (text.length > 500) { setError('Comment must be 500 characters or less.'); return; }
    try {
      await apiService.addTicketComment(ticketId, user.userId, text);
      setComment({ ...comment, [ticketId]: '' }); setSuccess('Comment added.'); fetchTickets();
    } catch (err) { setError(err.message); }
  };
  // Save edited comment text.
  const handleEditComment = async () => {
    if (!editingComment?.text?.trim()) { setError('Comment cannot be empty.'); return; }
    if (editingComment.text.trim().length > 500) { setError('Comment must be 500 characters or less.'); return; }
    try {
      await apiService.editTicketComment(editingComment.ticketId, editingComment.commentId, editingComment.text);
      setEditingComment(null); setSuccess('Comment updated.'); fetchTickets();
    } catch (err) { setError(err.message); }
  };
  // Delete one comment after confirmation.
  const handleDeleteComment = async (ticketId, commentId) => {
    if (!window.confirm('Delete this comment?')) return;
    try { await apiService.deleteTicketComment(ticketId, commentId); fetchTickets(); }
    catch (err) { setError(err.message); }
  };
  // Check if current user can delete a ticket.
  const canDeleteTicket = (ticket) => {
    const isResolvedOrRejected = ['RESOLVED', 'REJECTED', 'CLOSED'].includes(ticket.status);
    if (isAdmin) return isResolvedOrRejected;
    return ticket.reporterId === user?.userId && isResolvedOrRejected;
  };
  // Delete a ticket after user confirmation (allowed by backend role rules).
  const handleDeleteTicket = async (ticketId) => {
    if (!window.confirm('Delete this ticket? This action cannot be undone.')) return;
    try {
      await apiService.deleteTicket(ticketId);
      setSuccess('Ticket deleted successfully.');
      if (expandedTicket === ticketId) setExpandedTicket(null);
      fetchTickets();
    } catch (err) {
      setError(err.message || 'Failed to delete ticket. Please try again.');
    }
  };

  // Filter tickets by selected status and search term.
  const filtered = tickets.filter(t => {
    const byStatus = !filterStatus || t.status === filterStatus;
    const q = searchText.trim().toLowerCase();
    if (!q) return byStatus;
    const bySearch = [t.category, t.description, t.resourceName, t.id]
      .filter(Boolean)
      .some(v => String(v).toLowerCase().includes(q));
    return byStatus && bySearch;
  });
  const openCount = tickets.filter(t => t.status === 'OPEN').length;
  const inProgressCount = tickets.filter(t => t.status === 'IN_PROGRESS').length;
  const fixedCount = tickets.filter(t => t.status === 'RESOLVED' || t.status === 'CLOSED').length;

  return (
    <div className="tickets-page">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">🎫 Support Tickets</h1>
          <p className="page-subtitle">
            {isAdmin ? 'Manage and resolve all campus support tickets'
             : isTechnician ? 'Handle tickets assigned to you'
             : 'Track, update and submit your campus support tickets'}
          </p>
        </div>
        {!isTechnician && (
          <button className="btn btn-primary" onClick={() => setShowForm(s => !s)} id="toggle-ticket-form-btn">
            {showForm ? '✕ Close Form' : '+ New Ticket'}
          </button>
        )}
      </div>

      {success && <div className="alert alert-success">✅ {success}</div>}
      {error   && <div className="alert alert-error">⚠️ {error}</div>}

      {/* Submit form */}
      {showForm && (
        <div className="glass-card" style={{ marginBottom: 22 }}>
          <TicketForm onSuccess={() => { setSuccess('Ticket submitted!'); fetchTickets(); setShowForm(false); }} />
        </div>
      )}

      {/* Modals */}
      {rejectModal.open && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-title">❌ Reject Ticket</div>
            <div className="form-group">
              <label className="form-label">Rejection Reason *</label>
              <textarea className="form-textarea" rows={3} placeholder="Reason for rejection…"
                value={rejectModal.reason} onChange={e => setRejectModal({ ...rejectModal, reason: e.target.value })} autoFocus />
            </div>
            <div className="modal-actions">
              <button className="btn btn-danger" onClick={handleRejectConfirm}>Confirm Reject</button>
              <button className="btn btn-ghost"  onClick={() => setRejectModal({ open: false, ticketId: null, reason: '' })}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {resolveModal.open && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-title">✅ Resolve Ticket</div>
            <div className="form-group">
              <label className="form-label">Resolution Notes (optional)</label>
              <textarea className="form-textarea" rows={3} placeholder="What was done to fix the issue?"
                value={resolveModal.notes} onChange={e => setResolveModal({ ...resolveModal, notes: e.target.value })} autoFocus />
            </div>
            <div className="modal-actions">
              <button className="btn btn-success" onClick={handleResolveConfirm}>Mark Resolved</button>
              <button className="btn btn-ghost"   onClick={() => setResolveModal({ open: false, ticketId: null, notes: '' })}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {editingComment && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-title">✏️ Edit Comment</div>
            <textarea className="form-textarea" rows={3}
              value={editingComment.text} onChange={e => setEditingComment({ ...editingComment, text: e.target.value })} autoFocus />
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={handleEditComment}>Save Changes</button>
              <button className="btn btn-ghost"   onClick={() => setEditingComment(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {/* Edit / reopen ticket form */}
      {editingTicket && (
        <div className="modal-overlay" style={{ zIndex: 1000, overflowY: 'auto', padding: '20px' }}>
          <div className="glass-card" style={{ maxWidth: 600, width: '100%', margin: 'auto', background: 'var(--bg-color)' }}>
            <TicketForm 
              initialData={editingTicket} 
              onCancel={() => setEditingTicket(null)} 
              onSuccess={() => { setSuccess('Ticket updated successfully!'); fetchTickets(); setEditingTicket(null); }} 
            />
          </div>
        </div>
      )}

      {/* Summary stats */}
      <div className="ticket-summary-grid">
        <div className="ticket-summary-card">
          <span>Total</span>
          <strong>{tickets.length}</strong>
        </div>
        <div className="ticket-summary-card">
          <span>Open</span>
          <strong style={{ color: '#60a5fa' }}>{openCount}</strong>
        </div>
        <div className="ticket-summary-card">
          <span>In Progress</span>
          <strong style={{ color: '#fbbf24' }}>{inProgressCount}</strong>
        </div>
        <div className="ticket-summary-card">
          <span>Fixed</span>
          <strong style={{ color: '#34d399' }}>{fixedCount}</strong>
        </div>
      </div>
      <div className="filter-bar">
        <div className="form-group">
          <label className="form-label">Filter by Status</label>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="form-select" style={{ minWidth: 160 }}>
            <option value="">All Statuses</option>
            <option value="OPEN">OPEN</option>
            <option value="IN_PROGRESS">IN PROGRESS</option>
            <option value="RESOLVED">RESOLVED</option>
            <option value="CLOSED">CLOSED</option>
            <option value="REJECTED">REJECTED</option>
          </select>
        </div>
        <div className="form-group ticket-search-group">
          <label className="form-label">Search</label>
          <input
            type="text"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            className="form-input"
            placeholder="Search by category, id, description..."
          />
        </div>
        {filterStatus && <button className="btn btn-ghost btn-sm" onClick={() => setFilterStatus('')}>✕ Clear</button>}
        <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
          {filtered.length} of {tickets.length} ticket(s)
        </span>
      </div>

      {/* Ticket cards */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1,2,3].map(i => <div key={i} className="skeleton skel-card" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card">
          <div className="empty-state">
            <div className="empty-icon">🎫</div>
            <p className="empty-text">No tickets found{filterStatus ? ` with status "${filterStatus}"` : ''}.</p>
          </div>
        </div>
      ) : (
        <div>
          {filtered.map(ticket => {
            const isExpanded = expandedTicket === ticket.id;
            const priorityColor = { CRITICAL: '#f87171', HIGH: '#fbbf24', MEDIUM: '#60a5fa', LOW: '#34d399' }[ticket.priority] || '#94a3b8';
            return (
              <div
                key={ticket.id}
                id={`ticket-${ticket.id}`}
                className={`ticket-card${isFixedTicket(ticket) ? ' ticket-card-fixed' : ''}`}
                style={{ '--card-accent': priorityColor }}
              >
                {/* Header */}
                <div className="ticket-header">
                  <div className="ticket-meta">
                    <StatusBadge status={ticket.priority} />
                    <strong style={{ color: 'var(--text-primary)', fontSize: '0.92rem' }}>{ticket.category}</strong>
                    <code style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'rgba(148,163,184,0.1)', padding: '2px 6px', borderRadius: 5 }}>#{ticket.id?.slice(-8)}</code>
                    {ticket.resourceName && (
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', background: 'rgba(96,165,250,0.08)', padding: '2px 7px', borderRadius: 6, border: '1px solid rgba(96,165,250,0.15)' }}>
                        📍 {ticket.resourceName}
                      </span>
                    )}
                  </div>
                  <StatusBadge status={ticket.status} />
                </div>

                {/* Description */}
                <p className="ticket-body">{ticket.description}</p>

                {ticket.preferredContactDetails && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 10 }}>
                    📞 <strong>Contact:</strong> {ticket.preferredContactDetails}
                  </p>
                )}

                {/* Rejection */}
                {ticket.rejectionReason && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: 'var(--danger-bg)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 10, padding: '8px 12px', marginBottom: 10, fontSize: '0.8rem', color: 'var(--danger)' }}>
                    ❌ <span><strong>Rejected:</strong> {ticket.rejectionReason}</span>
                  </div>
                )}

                {/* Resolution */}
                {ticket.resolutionNotes && (
                  <div className="ticket-resolution-box">
                    ✅ <strong>Resolution:</strong> {ticket.resolutionNotes}
                  </div>
                )}

                {/* Fixed banner */}
                {isFixedTicket(ticket) && (
                  <div className="ticket-fixed-banner">
                    ✅ Issue fixed
                    {ticket.resolvedBy && <> · by <strong>…{ticket.resolvedBy.slice(-6)}</strong></>}
                  </div>
                )}

                {/* Footer */}
                <div className="ticket-footer">
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                    🕐 {fmt(ticket.createdAt)}
                    {ticket.assignedTo && ' · 🔧 Assigned'}
                    {ticket.resolvedBy && ` · Fixed by …${ticket.resolvedBy.slice(-6)}`}
                  </span>

                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setExpandedTicket(isExpanded ? null : ticket.id)}
                    >
                      {isExpanded ? '▲ Collapse' : `💬 Details (${ticket.comments?.length || 0})`}
                    </button>

                    {(isAdmin || (isTechnician && ticket.assignedTo === user.userId)) &&
                      (STATUS_TRANSITIONS[ticket.status] || []).map(next => (
                        <button
                          key={next}
                          className={`btn btn-sm ${next === 'REJECTED' ? 'btn-danger' : 'btn-ghost'}`}
                          onClick={() => next === 'REJECTED'
                            ? setRejectModal({ open: true, ticketId: ticket.id, reason: '' })
                            : handleAdvanceStatus(ticket.id, next)}
                        >
                          → {next.replace('_', ' ')}
                        </button>
                      ))
                    }

                    {canFixTicket(ticket) && (
                      <button className="btn btn-success btn-sm" onClick={() => setResolveModal({ open: true, ticketId: ticket.id, notes: '' })}>
                        ✅ Fix
                      </button>
                    )}

                    {ticket.reporterId === user?.userId && ticket.status === 'OPEN' && !ticket.assignedTo && (
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditingTicket(ticket)}>
                        ✏️ Edit
                      </button>
                    )}

                    {canDeleteTicket(ticket) && (
                      <button className="btn btn-danger btn-sm" onClick={() => handleDeleteTicket(ticket.id)}>
                        🗑 Delete
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded detail + comments */}
                {isExpanded && (
                  <div className="comments-section">
                    {/* Full detail panel */}
                    <div className="ticket-detail-panel">
                      <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        📋 Full Ticket Details
                      </div>
                      <div className="detail-grid">
                        {[['ID', ticket.id], ['Category', ticket.category], ['Priority', ticket.priority], ['Status', ticket.status],
                          ['Reporter', `…${ticket.reporterId?.slice(-10)}`], ['Assigned To', ticket.assignedTo ? `…${ticket.assignedTo.slice(-10)}` : 'Unassigned'],
                          ['Resource', ticket.resourceName || '—'], ['Contact', ticket.preferredContactDetails || '—']
                        ].map(([label, val]) => (
                          <div key={label}>
                            <div className="detail-label">{label}</div>
                            <div className="detail-value">{val}</div>
                          </div>
                        ))}
                        <div style={{ gridColumn: '1/-1' }}>
                          <div className="detail-label">Description</div>
                          <div className="detail-value" style={{ whiteSpace: 'pre-wrap' }}>{ticket.description}</div>
                        </div>
                        {ticket.attachments?.length > 0 && (
                          <div style={{ gridColumn: '1/-1' }}>
                            <div className="detail-label">Attachments ({ticket.attachments.length})</div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                              {ticket.attachments.map((url, i) => (
                                <a key={i} href={url} target="_blank" rel="noreferrer"
                                  style={{ fontSize: '0.76rem', color: 'var(--primary-light)', textDecoration: 'underline' }}>
                                  📎 Attachment {i + 1}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {canFixTicket(ticket) && (
                        <div style={{ marginTop: 12, borderTop: '1px solid var(--border-soft)', paddingTop: 10 }}>
                          <button className="btn btn-success btn-sm" onClick={() => setResolveModal({ open: true, ticketId: ticket.id, notes: '' })}>
                            ✅ Fix This Issue
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Comments */}
                    <p style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                      💬 Comments ({ticket.comments?.length || 0})
                    </p>

                    {ticket.comments?.length > 0 ? ticket.comments.map(c => (
                      <div key={c.id} className="comment-item">
                        <div className="comment-head">
                          <span className="comment-author">
                            {c.authorId === user.userId ? '👤 You' : `🧑 …${c.authorId?.slice(-6)}`}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className="comment-time">{fmt(c.createdAt)}</span>
                            {c.authorId === user.userId && (
                              <>
                                <button
                                  onClick={() => setEditingComment({ ticketId: ticket.id, commentId: c.id, text: c.content })}
                                  title="Edit"
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary-light)', fontSize: '0.8rem', padding: '2px 4px', borderRadius: 4 }}
                                >✏️</button>
                                <button
                                  onClick={() => handleDeleteComment(ticket.id, c.id)}
                                  title="Delete"
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: '0.8rem', padding: '2px 4px', borderRadius: 4 }}
                                >🗑</button>
                              </>
                            )}
                          </div>
                        </div>
                        <p className="comment-text">{c.content}</p>
                      </div>
                    )) : (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', fontStyle: 'italic' }}>No comments yet.</p>
                    )}

                    {ticket.status !== 'CLOSED' && ticket.status !== 'REJECTED' && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        <input
                          type="text"
                          className="form-input"
                          style={{ flex: 1 }}
                          placeholder="Write a comment and press Enter…"
                          value={comment[ticket.id] || ''}
                          onChange={e => setComment({ ...comment, [ticket.id]: e.target.value })}
                          onKeyDown={e => e.key === 'Enter' && handleAddComment(ticket.id)}
                        />
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleAddComment(ticket.id)}
                          disabled={!comment[ticket.id]?.trim()}
                        >
                          Post
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Tickets;
