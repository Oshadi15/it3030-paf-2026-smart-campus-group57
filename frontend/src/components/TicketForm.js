import React, { useState, useEffect, useRef } from 'react';
import { apiService } from '../services/api';
import { useAuth }    from '../contexts/AuthContext';
import './TicketForm.css';

const TicketForm = ({ onSuccess, onCancel, initialData }) => {
  const { user } = useAuth();
  const [resources, setResources] = useState([]);
  const [form, setForm] = useState({
    category: initialData?.category || '',
    priority: initialData?.priority || '',
    description: initialData?.description || '',
    resourceId: initialData?.resourceId || '',
    preferredContactDetails: initialData?.preferredContactDetails || '',
  });
  const [files,    setFiles]    = useState([]);
  const [errors,   setErrors]   = useState({});
  const [loading,  setLoading]  = useState(false);
  const [apiError, setApiError] = useState('');
  const fileRef = useRef(null);

  // Load available resources once so user can optionally link a ticket.
  useEffect(() => {
    apiService.getResources()
      .then(res => setResources(res.data))
      .catch(() => {});
  }, []);

  // Validate the ticket form fields before submission.
  // Ensures required fields are present, description length is sufficient,
  // and optional phone contact is normalized to 10 digits.
  const validate = () => {
    const e = {};
    if (!form.category)           e.category    = 'Category is required.';
    if (!form.priority)           e.priority    = 'Priority is required.';
    if (!form.description.trim()) e.description = 'Description is required.';
    if (form.description.trim().length < 3)  e.description = 'Description should be at least 3 characters.';
    if (form.preferredContactDetails && !/^\d{10}$/.test(form.preferredContactDetails)) {
      e.preferredContactDetails = 'Phone number must be exactly 10 digits.';
    }
    if (files.length > 3)         e.files       = 'Maximum 3 images allowed.';
    return e;
  };

  // Update form values and sanitize phone input to numeric 10-digit format.
  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'preferredContactDetails') {
      const digitsOnly = value.replace(/\D/g, '').slice(0, 10);
      setForm({ ...form, [name]: digitsOnly });
      setErrors({ ...errors, [name]: '' });
      setApiError('');
      return;
    }
    setForm({ ...form, [name]: value });
    setErrors({ ...errors, [e.target.name]: '' });
    setApiError('');
  };

  // Handle image attachment selection (max 3 files).
  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files);
    if (selected.length > 3) { setErrors({ ...errors, files: 'Maximum 3 images allowed.' }); return; }
    if (selected.some(file => file.size > 5 * 1024 * 1024)) {
      setErrors({ ...errors, files: 'Each image must be 5MB or less.' });
      return;
    }
    setFiles(selected);
    setErrors({ ...errors, files: '' });
  };

  // Remove one selected attachment preview.
  const handleRemoveFile = (index) => setFiles(files.filter((_, i) => i !== index));

  // Submit ticket first, then upload selected attachments for the created ticket.
  const handleSubmit = async (e) => {
    e.preventDefault();
    const ve = validate();
    if (Object.keys(ve).length > 0) { setErrors(ve); return; }
    setLoading(true);
    try {
      let newTicketId = null;
      const payload = {
        reporterId:  user.userId,
        category:    form.category,
        priority:    form.priority,
        description: form.description,
        preferredContactDetails: form.preferredContactDetails,
        ...(form.resourceId ? { resourceId: form.resourceId } : {}),
      };

      if (initialData?.id) {
        await apiService.updateTicket(initialData.id, payload);
        newTicketId = initialData.id;
      } else {
        const res = await apiService.createTicket(payload);
        newTicketId = res.data?.id;
      }

      if (files.length > 0 && newTicketId) {
        for (const file of files) {
          await apiService.uploadTicketAttachment(newTicketId, file);
        }
      }

      setForm({ category: '', priority: '', description: '', resourceId: '', preferredContactDetails: '' });
      setFiles([]); setErrors({});
      if (fileRef.current) fileRef.current.value = '';
      if (onSuccess) onSuccess();
    } catch (err) {
      setApiError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Keep submit button disabled until required fields are filled with valid shape.
  // Enable submit as soon as required fields are non-empty; full validation runs on submit.
  const isFormValid = !!(form.category && form.priority && form.description.trim().length >= 3);
  const descriptionChars = form.description?.length || 0;

  return (
    <form onSubmit={handleSubmit} className="ticket-form">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 className="ticket-form-title">
          {initialData ? '✏️ Update Ticket' : '🎫 Submit New Ticket'}
        </h3>
        {onCancel && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>✕ Cancel</button>
        )}
      </div>

      {apiError && <div className="alert alert-error">{apiError}</div>}

      {/* Category & Priority */}
      <div className="two-col">
        <div className="form-group">
          <label className="form-label">Category *</label>
          <select name="category" value={form.category} onChange={handleChange} className="form-select" id="ticket-category">
            <option value="">Select category…</option>
            <option value="MAINTENANCE">🔨 Maintenance</option>
            <option value="IT_SUPPORT">💻 IT Support</option>
            <option value="CLEANING">🧹 Cleaning</option>
            <option value="SECURITY">🔐 Security</option>
            <option value="OTHER">📌 Other</option>
          </select>
          {errors.category && <span className="validation-error">{errors.category}</span>}
        </div>
        <div className="form-group">
          <label className="form-label">Priority *</label>
          <select name="priority" value={form.priority} onChange={handleChange} className="form-select" id="ticket-priority">
            <option value="">Select priority…</option>
            <option value="LOW">🟢 Low</option>
            <option value="MEDIUM">🟡 Medium</option>
            <option value="HIGH">🔴 High</option>
            <option value="CRITICAL">🟣 Critical</option>
          </select>
          {errors.priority && <span className="validation-error">{errors.priority}</span>}
        </div>
      </div>

      {/* Affected resource */}
      <div className="form-group">
        <label className="form-label">Affected Resource <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
        <select name="resourceId" value={form.resourceId} onChange={handleChange} className="form-select" id="ticket-resource">
          <option value="">— None / Not applicable —</option>
          {resources.map(r => (
            <option key={r.id} value={r.id}>{r.name} ({r.type?.replace(/_/g,' ')}) — {r.location}</option>
          ))}
        </select>
      </div>

      {/* Description */}
      <div className="form-group">
        <label className="form-label">
          Description *
          <span className="ticket-form-hint">{descriptionChars}/800</span>
        </label>
        <textarea
          name="description"
          value={form.description}
          onChange={handleChange}
          className="form-textarea"
          rows={4}
          placeholder="Describe the issue in detail — what happened, where, when…"
          id="ticket-description"
          maxLength={800}
        />
        {errors.description && <span className="validation-error">{errors.description}</span>}
      </div>

      {/* Preferred Contact Details */}
      <div className="form-group">
        <label className="form-label">Preferred Contact Details <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
        <input
          type="tel"
          name="preferredContactDetails"
          value={form.preferredContactDetails}
          onChange={handleChange}
          className="form-input"
          placeholder="Enter 10-digit phone number"
          inputMode="numeric"
          maxLength={10}
          id="ticket-contact-details"
        />
        {errors.preferredContactDetails && <span className="validation-error">{errors.preferredContactDetails}</span>}
      </div>

      {/* Attachments */}
      <div className="form-group">
        <label className="form-label">📷 Attachments <span className="ticket-form-optional">(optional, max 3 images)</span></label>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          id="ticket-attachments"
          className="ticket-file-input"
        />
        {errors.files && <span className="validation-error">{errors.files}</span>}

        {/* Preview thumbnails */}
        {files.length > 0 && (
          <div className="ticket-file-preview-list">
            {files.map((file, i) => (
              <div key={i} className="ticket-file-preview-item">
                <img
                  src={URL.createObjectURL(file)}
                  alt={`preview-${i}`}
                  className="ticket-file-preview-img"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveFile(i)}
                  className="ticket-file-remove-btn"
                >✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="ticket-form-actions">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            setForm({ category: '', priority: '', description: '', resourceId: '', preferredContactDetails: '' });
            setFiles([]);
            setErrors({});
            setApiError('');
            if (fileRef.current) fileRef.current.value = '';
          }}
          disabled={loading}
        >
          Reset
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading}
          id="ticket-submit-btn"
        >
          {loading ? (
            <>
              <span className="spin ticket-submit-spin" />
              {initialData ? 'Updating…' : 'Submitting…'}
            </>
          ) : (initialData ? '💾 Update Ticket' : '📤 Submit Ticket')}
        </button>
      </div>
    </form>
  );
};

export default TicketForm;
