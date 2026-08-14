import axios from 'axios';
import { authStorage } from './authStorage';

const api = axios.create({
  baseURL: 'http://localhost:8081/api',
});

// ── Request interceptor — attach real auth headers from localStorage ──────
api.interceptors.request.use((config) => {
  const userId = authStorage.userId;
  const role   = authStorage.role;

  // Skip auth headers for the login endpoint itself
  if (!config.url?.startsWith('/auth/')) {
    if (userId) config.headers['X-User-Id']   = userId;
    if (role)   config.headers['X-User-Role'] = role;
  }
  return config;
}, (error) => Promise.reject(error));

// ── Response interceptor — normalise errors to human-readable messages ────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status  = error.response?.status;
    const message = error.response?.data?.message || error.message || 'An unexpected error occurred';

    if (status === 401 && !error.config?.url?.startsWith('/auth/')) {
      // Session truly invalid — clear storage and redirect to login
      localStorage.removeItem('campus_auth');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    console.error(`API Error [${status}]:`, message);
    const err = new Error(message);
    err.status = status;
    err.url = error.config?.url;
    return Promise.reject(err);
  }
);

export const apiService = {
  // ── Auth ─────────────────────────────────────────────────────────────────
  loginWithGoogle: (data)   => api.post('/auth/google', data),
  getProfile:      (userId) => api.get(`/auth/me/${userId}`),

  // ── Admin ─────────────────────────────────────────────────────────────────
  getAdminStats: () => api.get('/admin/stats'),
  getUsers:      () => api.get('/admin/users'),
  createUser:    (data) => api.post('/admin/users', data),
  updateUserRole:(id, role) => api.put(`/admin/users/${id}/role`, null, { params: { role } }),

  // ── Resources ─────────────────────────────────────────────────────────────
  getResources:      (params)    => api.get('/resources', { params }),
  createResource:    (data)      => api.post('/resources', data),
  updateResource:    (id, data)  => api.put(`/resources/${id}`, data),
  setResourceStatus: (id, val)   => api.patch(`/resources/${id}/status`, null, { params: { value: val } }),
  deleteResource:    (id)        => api.delete(`/resources/${id}`),

  // ── Bookings ───────────────────────────────────
  createBooking:  (data)              => api.post('/bookings', data),
  getUserBookings:(userId)            => api.get(`/bookings/user/${userId}`),
  getAllBookings:  (status, resourceId)=> api.get('/bookings', { params: { ...(status && { status }), ...(resourceId && { resourceId }) } }),
  approveBooking: (id)                => api.put(`/bookings/${id}/approve`),
  rejectBooking:  (id, reason)        => api.put(`/bookings/${id}/reject`, null, { params: { reason } }),
  cancelBooking:  (id)                => api.put(`/bookings/${id}/cancel`),

  // ── Tickets ────────────────────────────────────────────────────────────────
  // Ticket endpoints used by the ticket dashboard, form, and comments UI.
  createTicket:       (data)               => api.post('/tickets', data),
  updateTicket:       (id, data)           => api.put(`/tickets/${id}`, data),
  getUserTickets:     (userId)             => api.get(`/tickets/user/${userId}`),
  getAllTickets:       ()                   => api.get('/tickets'),
  getTicket:          (id)                  => api.get(`/tickets/${id}`),
  assignTicket:       (id, adminId)         => api.put(`/tickets/${id}/assign`, null, { params: { adminId } }),
  updateTicketStatus: (id, status, reason)  =>
    api.put(`/tickets/${id}/status`, null, { params: reason ? { status, reason } : { status } }),
  resolveTicket:      (id, notes)           =>
    api.put(`/tickets/${id}/resolve`, null, { params: notes ? { notes } : {} }),
  addTicketComment:   (id, _ignored, content) =>
    api.post(`/tickets/${id}/comments`, { content }),
  editTicketComment:  (id, commentId, content) =>
    api.put(`/tickets/${id}/comments/${commentId}`, { content }),
  deleteTicketComment:(id, commentId)       => api.delete(`/tickets/${id}/comments/${commentId}`),
  // POST fallback avoids CORS preflight issues with DELETE method on some environments.
  deleteTicket: async (id) => {
    const safeId = encodeURIComponent(id);
    try {
      return await api.post(`/tickets/${safeId}/delete`);
    } catch (err) {
      // If backend doesn't have the POST fallback route yet, retry with DELETE.
      if (err?.status === 404 || err?.status === 405) {
        return await api.delete(`/tickets/${safeId}`);
      }
      throw err;
    }
  },
  uploadTicketAttachment: (id, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/tickets/${id}/attachments`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  },

  // ── Notifications ─────────────────────────────────────────────────────────
  getUserNotifications: (userId) => api.get(`/notifications/user/${userId}`),
  getUnreadCount:       (userId) => api.get(`/notifications/user/${userId}/unread-count`),
  markNotificationRead: (id)     => api.put(`/notifications/${id}/read`),
  markAllNotificationsRead: (userId) => api.put(`/notifications/user/${userId}/read-all`),
  deleteNotification:   (id)     => api.delete(`/notifications/${id}`),
  clearAllNotifications:(userId) => api.delete(`/notifications/user/${userId}/clear-all`),
};

export default api;
