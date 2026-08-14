import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';

import DashboardLayout from './components/DashboardLayout';
import ProtectedRoute  from './components/ProtectedRoute';

import LoginPage      from './pages/LoginPage';
import Home           from './pages/Home';
import Resources      from './pages/Resources';
import ResourceManager from './pages/ResourceManager';
//booking
import Booking        from './pages/Booking';
import MyBookings     from './pages/MyBookings';

import AdminDashboard from './pages/AdminDashboard';
import TechDashboard  from './pages/TechDashboard';
import Tickets        from './pages/Tickets';
import Notifications  from './pages/Notifications';

import './App.css';

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';

function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <Router>
        <Routes>
          {/* Public: full-screen login */}
          <Route path="/login" element={<LoginPage />} />

          {/* All authenticated routes use the sidebar/navbar shell */}
          <Route element={<DashboardLayout />}>
            <Route
              path="/"
              element={(
                <ProtectedRoute>
                  <Home />
                </ProtectedRoute>
              )}
            />
            <Route
              path="/resources"
              element={(
                <ProtectedRoute>
                  <Resources />
                </ProtectedRoute>
              )}
            />
            <Route
              path="/booking"
              element={(
                <ProtectedRoute>
                  <Booking />
                </ProtectedRoute>
              )}
            />
            <Route
              path="/my-bookings"
              element={(
                <ProtectedRoute>
                  <MyBookings />
                </ProtectedRoute>
              )}
            />
            <Route
              path="/tickets"
              element={(
                <ProtectedRoute>
                  <Tickets />
                </ProtectedRoute>
              )}
            />
            <Route
              path="/notifications"
              element={(
                <ProtectedRoute>
                  <Notifications />
                </ProtectedRoute>
              )}
            />

            {/* Admin-only */}
            <Route
              path="/admin"
              element={(
                <ProtectedRoute requireAdmin>
                  <AdminDashboard />
                </ProtectedRoute>
              )}
            />
            {/* Technician dashboard */}
            <Route
              path="/tech"
              element={(
                <ProtectedRoute requireAdmin>
                  <TechDashboard />
                </ProtectedRoute>
              )}
            />
            <Route
              path="/resources/manage"
              element={(
                <ProtectedRoute requireAdmin>
                  <ResourceManager />
                </ProtectedRoute>
              )}
            />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </GoogleOAuthProvider>
  );
}

export default App;
