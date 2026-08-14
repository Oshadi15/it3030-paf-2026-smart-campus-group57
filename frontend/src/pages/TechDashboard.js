import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge';
import './TechDashboard.css';

const fmt = (dt) => dt ? new Date(dt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

const PRIORITY_COLOR = {
  CRITICAL: { text: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.3)' },
  HIGH: { text: '#fbbf24', bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.3)' },
  MEDIUM: { text: '#60a5fa', bg: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.3)' },
  LOW: { text: '#34d399', bg: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.3)' },
};

/* ── Small Stat ─────────────────────────────────────────────── */
const StatPill = ({ value, label, color }) => (
  <div className="tech-stat-pill" style={{ borderColor: color + '44' }}>
    <span className="tech-stat-value" style={{ color }}>{value ?? '—'}</span>
    <span className="tech-stat-label">{label}</span>
  </div>
);

/* ── TechDashboard ───────────────────────────────────────────── */
const TechDashboard = () => {
  const { user } = useAuth();
  const location = useLocation();
  const cardRefs = useRef({});           // ticketId → DOM ref for scroll
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [expanded, setExpanded] = useState(null);   // ticket id
  const [rejectId, setRejectId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchTickets = useCallback(async () => {
    if (!user?.userId) return;
    try {
      setLoading(true);
      const res = await apiService.getAllTickets();
      const all = Array.isArray(res.data) ? res.data : [];
      // Show only tickets assigned to this technician
      setTickets(all.filter(t => t.assignedTo === user.userId));
      setError('');
    } catch (err) {
      setError('Failed to load tickets: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.userId]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  // When tickets load, check URL for ?ticketId= and auto-expand + scroll to it
  useEffect(() => {
    if (loading || tickets.length === 0) return;
    const params = new URLSearchParams(location.search);
    const targetId = params.get('ticketId');
    if (!targetId) return;
    // Find the ticket in the list (full id match)
    const matched = tickets.find(t => t.id === targetId);
    if (matched) {
      setExpanded(matched.id);
      // Small delay so the card renders before we scroll
      setTimeout(() => {
        const el = cardRefs.current[matched.id];
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 120);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, tickets]);

  useEffect(() => { if (message) { const t = setTimeout(() => setMessage(''), 4000); return () => clearTimeout(t); } }, [message]);

  const handleResolve = async (id) => {
    try {
      await apiService.resolveTicket(id);
      setMessage('✅ Ticket marked as Resolved!');
      fetchTickets();
    } catch (err) { setError(err.message); }
  };

  const handleRejectConfirm = async () => {
    if (!rejectReason.trim()) { setError('Please enter a rejection reason.'); return; }
    try {
      await apiService.updateTicketStatus(rejectId, 'REJECTED', rejectReason);
      setMessage('Ticket rejected.');
      setRejectId(null);
      setRejectReason('');
      fetchTickets();
    } catch (err) { setError(err.message); }
  };

  const assignedOpen = tickets.filter(t => t.status === 'IN_PROGRESS').length;
  const resolvedByMe = tickets.filter(t => t.status === 'RESOLVED' || t.status === 'CLOSED').length;
  const totalAssigned = tickets.length;

  return (
    <div className="tech-dashboard-page">
      {/* ── Header ── */}
      <div className="tech-header">
        <div className="tech-header-text">
          <h1 className="tech-title">🛠️ Technician Dashboard</h1>
          <p className="tech-subtitle">
            Welcome, <strong>{user?.name || user?.email}</strong> — here are all tickets assigned to you.
          </p>
        </div>
        <button className="tech-refresh-btn" onClick={fetchTickets} disabled={loading}>
          <span style={{ display: 'inline-block', animation: loading ? 'techSpin 0.8s linear infinite' : 'none' }}>🔄</span>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {/* ── Alerts ── */}
      {message && <div className="tech-alert tech-alert-success">{message}</div>}
      {error && <div className="tech-alert tech-alert-error">{error}</div>}

      {/* ── Stats ── */}
      <div className="tech-stats-row">
        <StatPill value={totalAssigned} label="Total Assigned" color="#60a5fa" />
        <StatPill value={assignedOpen} label="In Progress" color="#fbbf24" />
        <StatPill value={resolvedByMe} label="Resolved by Me" color="#34d399" />
      </div>

      {/* ── Ticket Cards ── */}
      {loading ? (
        <div className="tech-skeleton-list">
          {[1, 2, 3].map(i => (
            <div key={i} className="tech-skeleton-card">
              <div className="tech-skel-head">
                <div className="skel tech-skel-title" />
                <div className="skel tech-skel-badge" />
              </div>
              <div className="skel tech-skel-line" />
              <div className="skel tech-skel-line short" />
            </div>
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <div className="tech-empty">
          <div className="tech-empty-icon">📭</div>
          <p className="tech-empty-text">No tickets are assigned to you yet.</p>
          <p className="tech-empty-sub">When an admin assigns a ticket to you, it will appear here.</p>
        </div>
      ) : (
        <div className="tech-ticket-list">
          {tickets.map(ticket => {
            const pc = PRIORITY_COLOR[ticket.priority] || PRIORITY_COLOR.LOW;
            const isOpen = expanded === ticket.id;
            const isResolved = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED';

            return (
              <div
                key={ticket.id}
                ref={el => { cardRefs.current[ticket.id] = el; }}
                className={`tech-ticket-card${isResolved ? ' resolved' : ''}${isOpen ? ' expanded' : ''}`}
                style={{ '--priority-color': pc.text }}
              >
                {/* ── Card Header ── */}
                <div className="tech-card-header" onClick={() => setExpanded(isOpen ? null : ticket.id)}>
                  <div className="tech-card-left">
                    {/* Priority dot */}
                    <span className="tech-priority-dot" style={{ background: pc.text, boxShadow: `0 0 6px ${pc.text}` }} />
                    <div>
                      <div className="tech-card-title">{ticket.category}</div>
                      <div className="tech-card-id">
                        <code>#{ticket.id?.slice(-10)}</code>
                        {ticket.resourceName && (
                          <span className="tech-resource-chip">📍 {ticket.resourceName}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="tech-card-right">
                    <span
                      className="tech-priority-chip"
                      style={{ color: pc.text, background: pc.bg, border: `1px solid ${pc.border}` }}
                    >
                      {ticket.priority}
                    </span>
                    <StatusBadge status={ticket.status} />
                    <span className="tech-expand-arrow">{isOpen ? '▲' : '▼'}</span>
                  </div>
                </div>

                {/* ── Expanded Detail Panel ── */}
                {isOpen && (
                  <div className="tech-card-body">
                    {/* Description */}
                    <div className="tech-detail-section">
                      <div className="tech-detail-label">📋 Description</div>
                      <div className="tech-detail-value desc">{ticket.description}</div>
                    </div>

                    {/* Two-col info grid */}
                    <div className="tech-info-grid">
                      <div className="tech-info-item">
                        <span className="tech-info-label">Reporter ID</span>
                        <code className="tech-info-value">…{ticket.reporterId?.slice(-10)}</code>
                      </div>
                      <div className="tech-info-item">
                        <span className="tech-info-label">Assigned To</span>
                        <code className="tech-info-value">…{ticket.assignedTo?.slice(-10)}</code>
                      </div>
                      <div className="tech-info-item">
                        <span className="tech-info-label">Created</span>
                        <span className="tech-info-value">{fmt(ticket.createdAt)}</span>
                      </div>
                      <div className="tech-info-item">
                        <span className="tech-info-label">Last Updated</span>
                        <span className="tech-info-value">{fmt(ticket.updatedAt)}</span>
                      </div>
                      {ticket.preferredContactDetails && (
                        <div className="tech-info-item">
                          <span className="tech-info-label">📞 Contact</span>
                          <span className="tech-info-value">{ticket.preferredContactDetails}</span>
                        </div>
                      )}
                      {ticket.rejectionReason && (
                        <div className="tech-info-item full">
                          <span className="tech-info-label">❌ Rejection Reason</span>
                          <span className="tech-info-value danger">{ticket.rejectionReason}</span>
                        </div>
                      )}
                      {isResolved && ticket.resolvedBy && (
                        <div className="tech-info-item full">
                          <span className="tech-info-label">✅ Resolved By</span>
                          <code className="tech-info-value success">…{ticket.resolvedBy.slice(-10)}</code>
                        </div>
                      )}
                    </div>

                    {/* Comments */}
                    {ticket.comments?.length > 0 && (
                      <div className="tech-detail-section">
                        <div className="tech-detail-label">💬 Comments ({ticket.comments.length})</div>
                        <div className="tech-comments-list">
                          {ticket.comments.map((c, i) => (
                            <div key={i} className="tech-comment">
                              <code className="tech-comment-author">…{c.userId?.slice(-6)}</code>
                              <span className="tech-comment-text">{c.content}</span>
                              <span className="tech-comment-time">{fmt(c.createdAt)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Attachments */}
                    {ticket.attachments?.length > 0 && (
                      <div className="tech-detail-section">
                        <div className="tech-detail-label">📎 Attachments</div>
                        <div className="tech-attachments">
                          {ticket.attachments.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="tech-attachment-link">
                              🖼 Attachment {i + 1}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    {!isResolved && ticket.status !== 'REJECTED' && (
                      <div className="tech-card-actions">
                        {ticket.status === 'IN_PROGRESS' && (
                          <button
                            className="tech-btn tech-btn-success"
                            onClick={() => handleResolve(ticket.id)}
                          >
                            ✅ Mark as Resolved
                          </button>
                        )}
                        <button
                          className="tech-btn tech-btn-danger"
                          onClick={() => { setRejectId(ticket.id); setRejectReason(''); }}
                        >
                          ❌ Reject Ticket
                        </button>
                      </div>
                    )}
                    {isResolved && (
                      <div className="tech-resolved-banner">
                        ✅ This ticket has been resolved. Great work!
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Reject Modal ── */}
      {rejectId && (
        <div className="tech-modal-overlay" onClick={() => setRejectId(null)}>
          <div className="tech-modal" onClick={e => e.stopPropagation()}>
            <div className="tech-modal-title">❌ Reject Ticket</div>
            <p className="tech-modal-sub">Please provide a reason for rejecting this ticket:</p>
            <textarea
              className="tech-modal-textarea"
              rows={4}
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Enter rejection reason…"
              autoFocus
            />
            <div className="tech-modal-actions">
              <button className="tech-btn tech-btn-ghost" onClick={() => setRejectId(null)}>Cancel</button>
              <button className="tech-btn tech-btn-danger" onClick={handleRejectConfirm}>Confirm Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TechDashboard;
