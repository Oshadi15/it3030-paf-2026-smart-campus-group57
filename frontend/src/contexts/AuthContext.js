import React, { createContext, useContext, useState, useCallback } from 'react';
import { authStorage } from '../services/authStorage';
import api from '../services/api';

/**
 * AuthContext — provides login/logout state to the whole app.
 *
 * Usage:
 *   const { user, login, logout, isLoggedIn } = useAuth();
 */
const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  // Initialise from localStorage so session survives page refresh
  const [user, setUser] = useState(() => authStorage.load());

  /**
   * Called after Google sign-in succeeds.
   * Sends profile data to backend, stores the response.
   */
  const login = useCallback(async (googleProfile) => {
    try {
      const response = await api.post('/auth/google', {
        email:   googleProfile.email,
        name:    googleProfile.name,
        picture: googleProfile.picture,
      });
      const userData = response.data;
      authStorage.save(userData);
      setUser(userData);
      return userData;
    } catch (err) {
      // Make network errors human-readable
      const message = err.message === 'Network Error'
        ? 'Cannot connect to the backend (port 8081). Make sure the Spring Boot server is running.'
        : err.message || 'Login failed. Please try again.';
      throw new Error(message);
    }
  }, []);

  /** Clears localStorage and resets state. */
  const logout = useCallback(() => {
    authStorage.clear();
    setUser(null);
  }, []);

  const isLoggedIn = !!user?.userId;
  const isAdmin    = user?.role === 'ADMIN';
  const isTechnician = user?.role === 'TECHNICIAN';

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoggedIn, isAdmin, isTechnician }}>
      {children}
    </AuthContext.Provider>
  );
};

/** Hook — throws if used outside AuthProvider */
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
