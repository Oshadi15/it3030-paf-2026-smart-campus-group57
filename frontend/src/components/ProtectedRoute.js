import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * ProtectedRoute — redirects unauthenticated users to /login.
 * Optionally requires admin role via requireAdmin prop.
 */
const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const { isLoggedIn, isAdmin, isTechnician } = useAuth();
  const location = useLocation();

  if (!isLoggedIn) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireAdmin && !isAdmin && !isTechnician) {
    return (
      <div className="access-denied-page">
        <div style={{ fontSize: '3.5rem', marginBottom: 16 }}>🔒</div>
        <h1>Access Denied</h1>
        <p>
          This page is restricted to administrators only.
          Contact your campus admin to request elevated access.
        </p>
        <span className="badge badge-role-user" style={{ fontSize: '0.8rem', padding: '6px 14px' }}>
          Your role: USER
        </span>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
