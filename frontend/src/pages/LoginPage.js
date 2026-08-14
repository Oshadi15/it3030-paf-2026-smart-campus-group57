import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode }   from 'jwt-decode';
import { useAuth }     from '../contexts/AuthContext';
import './LoginPage.css';

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';

/* ── Mock data for the right-panel preview ──────────────────── */
const previewBookings = [
  { resource: 'Lecture Hall A-101', date: 'Today, 2:00 PM',     status: 'approved' },
  { resource: 'Computer Lab 3B',    date: 'Tomorrow, 10:00 AM', status: 'pending'  },
  { resource: 'Meeting Room 2',     date: 'Apr 12, 9:00 AM',    status: 'approved' },
];
const previewNotifs = [
  { icon: '✅', text: 'Lecture Hall A-101 booking approved', time: '2 min ago',  color: 'rgba(0,184,148,0.15)'  },
  { icon: '🎫', text: 'Ticket #A3F2 assigned to staff',     time: '1 hr ago',   color: 'rgba(116,185,255,0.12)' },
  { icon: '🔔', text: 'System maintenance scheduled',       time: '3 hrs ago',  color: 'rgba(253,203,110,0.12)' },
];
const previewStats = [
  { label: 'Active Bookings', value: '12', color: 'var(--primary-light)' },
  { label: 'Open Tickets',    value: '3',  color: 'var(--danger)' },
  { label: 'Resources',       value: '28', color: 'var(--cyan)' },
  { label: 'Resolved',        value: '45', color: 'var(--success)' },
];

/* ── LoginPage ───────────────────────────────────────────────── */
const LoginPage = () => {
  const { login }  = useAuth();
  const navigate   = useNavigate();
  const [error,    setError]   = useState(
    (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID === 'your-client-id-here')
      ? '⚙️ Google Client ID not configured. Add REACT_APP_GOOGLE_CLIENT_ID to .env and restart.'
      : ''
  );
  const [loading,     setLoading]     = useState(false);
  const [googleReady, setGoogleReady] = useState(false);

  // Defer Google button render until after first paint — page shows instantly
  useEffect(() => {
    const t = setTimeout(() => setGoogleReady(true), 100);
    return () => clearTimeout(t);
  }, []);

  const handleSuccess = async (credentialResponse) => {
    setError('');
    setLoading(true);
    try {
      const decoded = jwtDecode(credentialResponse.credential);
      await login({ email: decoded.email, name: decoded.name, picture: decoded.picture });
      navigate('/');
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleError = () =>
    setError('Google sign-in failed or was cancelled. Ensure http://localhost:3001 is in Authorized JavaScript Origins.');

  return (
    <div className="login-page">
      <div className="login-bg" />

      {/* ── LEFT: login card ───────────────────────────── */}
      <div className="login-left">
        <div className="login-card">
          {/* Logo */}
          <div className="login-logo">🏫</div>

          <h1 className="login-title">
            Smart Campus<br />
            <span className="gradient-text">Management System</span>
          </h1>
          <p className="login-subtitle">
            Manage bookings, assets, and campus operations — all in one intelligent platform built for universities.
          </p>

          {/* Feature highlights */}
          <div className="login-features">
            {[
              { icon: '📅', label: 'Resource Booking',      desc: 'Halls, labs & equipment',      bg: 'rgba(108,92,231,0.15)' },
              { icon: '🎫', label: 'Support Tickets',        desc: 'Issue tracking & resolution',   bg: 'rgba(0,184,148,0.12)' },
              { icon: '🔔', label: 'Smart Notifications',    desc: 'Real-time status updates',      bg: 'rgba(0,206,201,0.12)' },
              { icon: '⚡', label: 'Admin Controls',         desc: 'Approve, manage, analyse',      bg: 'rgba(253,203,110,0.12)' },
            ].map(f => (
              <div key={f.label} className="login-feature">
                <div className="login-feature-icon" style={{ background: f.bg }}>{f.icon}</div>
                <div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>{f.label}</div>
                  <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="divider" />

          {error && <div className="alert alert-error">{error}</div>}

          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '12px', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              <span className="spin" style={{ width: 16, height: 16, border: '2px solid var(--border)', borderTop: '2px solid var(--primary)', borderRadius: '50%', display: 'inline-block' }} />
              Signing you in…
            </div>
          ) : !googleReady ? (
            /* Instant placeholder — shows before Google script loads */
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{
                width: 300, height: 44,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 10, color: 'var(--text-secondary)', fontSize: '0.875rem',
              }}>
                <span style={{ fontSize: 18 }}>G</span> Loading Sign-In…
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <GoogleLogin
                onSuccess={handleSuccess}
                onError={handleError}
                useOneTap={false}
                text="signin_with"
                shape="rectangular"
                theme="filled_black"
                size="large"
                width="300"
              />
            </div>
          )}

          <p style={{ marginTop: 18, fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
            First-time users are automatically registered with USER role.<br />
            Contact your administrator for ADMIN access.
          </p>
        </div>
      </div>

      {/* ── RIGHT: animated preview panel ──────────────── */}
      <div className="login-right">
        <div className="preview-panel">

          {/* Bookings preview */}
          <div className="preview-card">
            <div className="preview-title">📅 Recent Bookings</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {previewBookings.map((b, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>{b.resource}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{b.date}</div>
                  </div>
                  <span className={`badge badge-${b.status}`}>{b.status.toUpperCase()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Notification preview */}
          <div className="preview-card">
            <div className="preview-title">🔔 Notifications Feed</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {previewNotifs.map((n, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: n.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>
                    {n.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>{n.text}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{n.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stats mini board */}
          <div className="preview-card">
            <div className="preview-title">📊 Live Dashboard</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {previewStats.map(s => (
                <div key={s.label} style={{ textAlign: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '10px 6px' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 3 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default LoginPage;
