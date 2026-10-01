import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiRequest } from '../../services/api.client';
import {
  HOURLY_TIME_SLOTS,
  parseTimeToHourNum,
} from '../../utils/timeSlots';
import {
  Send,
  Sparkles,
  X,
  AlertTriangle,
  EyeOff,
  RefreshCw,
} from 'lucide-react';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function formatDisplayDateTime(dateStr?: string | Date): string {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'N/A';
  const dayStr = String(d.getDate()).padStart(2, '0');
  const monthStr = MONTH_NAMES[d.getMonth()];
  const year = d.getFullYear();
  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${dayStr}-${monthStr}-${year} ${timeStr}`;
}

function toDateInputValue(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateInputValue(strVal: string): Date {
  const [y, m, d] = strVal.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

export const AdminSendNotification: React.FC = () => {
  const [target, setTarget] = useState<'ALL' | 'SELECTED'>('ALL');
  const [title, setTitle] = useState('');

  // Default initial expiry (+24h)
  const defaultInitialExp = useMemo(() => new Date(Date.now() + 24 * 60 * 60 * 1000), []);
  const [expiryDate, setExpiryDate] = useState<Date>(defaultInitialExp);
  const [expiryHourVal, setExpiryHourVal] = useState<string>(() => {
    const h = defaultInitialExp.getHours();
    return `${String(h).padStart(2, '0')}:00`;
  });

  // Selected Students State
  const [studentSearch, setStudentSearch] = useState('');
  const [activeStudents, setActiveStudents] = useState<any[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<any[]>([]);

  // Form & History Loading States
  const [submitting, setSubmitting] = useState(false);
  const [sentNotifications, setSentNotifications] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [actionNotifId, setActionNotifId] = useState<string | null>(null);

  // Fetch Active Students for Library
  const fetchActiveStudents = useCallback(async () => {
    try {
      const res = await apiRequest('/admin/students?status=ACTIVE');
      if (res.success) {
        setActiveStudents(res.data?.students || []);
      }
    } catch (e) {
      console.error('Error fetching active students:', e);
    }
  }, []);

  // Fetch Sent Notification History
  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await apiRequest('/admin/notifications');
      if (res.success) {
        setSentNotifications(res.data || []);
      }
    } catch (e) {
      console.error('Error fetching notification history:', e);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    fetchActiveStudents();
    fetchHistory();
  }, [fetchActiveStudents, fetchHistory]);

  // Search Active Students
  const searchedStudents = useMemo(() => {
    if (!studentSearch.trim()) return [];
    const term = studentSearch.trim().toLowerCase();
    const selectedIds = new Set(selectedStudents.map((s) => s._id));

    return activeStudents.filter((s) => {
      if (selectedIds.has(s._id)) return false;
      const name = (s.userId?.fullName || '').toLowerCase();
      const phone = (s.userId?.phone || '').toLowerCase();
      const cardNo = (s.studentIdCardNo || '').toLowerCase();
      return name.includes(term) || phone.includes(term) || cardNo.includes(term);
    });
  }, [studentSearch, activeStudents, selectedStudents]);

  // Valid Time Slots (Hides past/invalid hours for today)
  const validTimeSlots = useMemo(() => {
    const now = new Date();
    const minAllowed = now.getTime() + 60 * 60 * 1000 - 5000;

    return HOURLY_TIME_SLOTS.slice(0, -1).filter((slot) => {
      const candidateDate = new Date(
        expiryDate.getFullYear(),
        expiryDate.getMonth(),
        expiryDate.getDate(),
        slot.hourNum,
        0,
        0
      );
      return candidateDate.getTime() >= minAllowed;
    });
  }, [expiryDate]);

  // Auto-adjust selected hour if current hour becomes invalid (e.g. switching date to Today)
  useEffect(() => {
    if (validTimeSlots.length > 0) {
      const isCurrentHourValid = validTimeSlots.some((s) => s.value === expiryHourVal);
      if (!isCurrentHourValid) {
        setExpiryHourVal(validTimeSlots[0].value);
      }
    }
  }, [expiryDate, validTimeSlots, expiryHourVal]);

  // Combined Expiry Timestamp Computation
  const calculatedExpiryDate = useMemo(() => {
    const hourNum = parseTimeToHourNum(expiryHourVal);
    const d = new Date(expiryDate);
    d.setHours(hourNum, 0, 0, 0);
    return d;
  }, [expiryDate, expiryHourVal]);

  // Expiry Validation Check
  const expiryValidation = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const selectedDayStart = new Date(expiryDate.getFullYear(), expiryDate.getMonth(), expiryDate.getDate(), 0, 0, 0, 0);

    if (selectedDayStart.getTime() < startOfToday.getTime()) {
      return { isValid: false, message: 'Expiry Date must be today or a future date.' };
    }

    const minAllowedTime = now.getTime() + 60 * 60 * 1000 - 5000;
    if (calculatedExpiryDate.getTime() < minAllowedTime) {
      return { isValid: false, message: 'Minimum expiry time must be at least 1 hour from current time.' };
    }

    return { isValid: true, expiryDateObj: calculatedExpiryDate };
  }, [expiryDate, calculatedExpiryDate]);

  // Quick Presets
  const applyPresetExpiry = (hoursToAdd: number) => {
    const targetDate = new Date(Date.now() + hoursToAdd * 60 * 60 * 1000);
    setExpiryDate(targetDate);
    const h = targetDate.getHours();
    setExpiryHourVal(`${String(h).padStart(2, '0')}:00`);
  };

  const handleToggleSelectStudent = (student: any) => {
    if (selectedStudents.some((s) => s._id === student._id)) {
      setSelectedStudents((prev) => prev.filter((s) => s._id !== student._id));
    } else {
      setSelectedStudents((prev) => [...prev, student]);
    }
    setStudentSearch('');
  };

  const handleRemoveSelectedStudent = (studentId: string) => {
    setSelectedStudents((prev) => prev.filter((s) => s._id !== studentId));
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Headline is required.');
      return;
    }

    if (target === 'SELECTED' && selectedStudents.length === 0) {
      alert('Please select at least one student recipient.');
      return;
    }

    if (!expiryValidation.isValid) {
      alert(expiryValidation.message);
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        target,
        title: title.trim(),
        expiresAt: calculatedExpiryDate.toISOString(),
      };

      if (target === 'SELECTED') {
        payload.recipientStudentIds = selectedStudents.map((s) => s._id);
      }

      const res = await apiRequest('/admin/send-notification', 'POST', payload);

      if (res.success) {
        alert('Notification Broadcasted Successfully! 📢');
        setTitle('');
        setSelectedStudents([]);
        setStudentSearch('');
        fetchHistory();
      } else {
        alert(res.error?.message || 'Failed to send notification.');
      }
    } catch (err: any) {
      alert(err.message || 'Error sending notification');
    } finally {
      setSubmitting(false);
    }
  };

  const handleHideNotification = async (notificationId: string, headline: string) => {
    const targetNotif = sentNotifications.find((n: any) => n._id === notificationId);
    if (targetNotif && (targetNotif.type === 'SUPER_ADMIN_BROADCAST' || targetNotif.type === 'SUPER_ADMIN_ANNOUNCEMENT')) {
      alert('Local Admins are not permitted to hide or reset notifications created by Super Admin.');
      return;
    }

    if (!confirm(`Hide "${headline}" immediately from all student dashboards?`)) return;

    setActionNotifId(notificationId);
    try {
      const res = await apiRequest(`/admin/notifications/${notificationId}/hide`, 'PATCH');
      if (res.success) {
        alert('Notification hidden from student dashboards successfully.');
        fetchHistory();
      } else {
        alert(res.error?.message || 'Failed to hide notification.');
      }
    } catch (err: any) {
      alert(err.message || 'Error hiding notification');
    } finally {
      setActionNotifId(null);
    }
  };

  const applyTemplate = (tmplTitle: string, hoursToAdd: number = 24) => {
    setTitle(tmplTitle);
    applyPresetExpiry(hoursToAdd);
  };

  const todayStr = useMemo(() => toDateInputValue(new Date()), []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A' }}>Send Notification</h1>
        <p style={{ fontSize: '14px', color: '#64748B' }}>Push light-theme announcement banners to student dashboards</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px', alignItems: 'start' }}>
        {/* LEFT PANEL: FORM & HISTORY */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* BROADCAST FORM CARD */}
          <form onSubmit={handleSendNotification} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A' }}>Announcement</h3>

            {/* RECIPIENT TARGET */}
            <div className="form-group">
              <label className="form-label">Recipient Target *</label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  className={target === 'ALL' ? 'btn btn-primary' : 'btn btn-secondary'}
                  onClick={() => setTarget('ALL')}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  📢 ALL STUDENTS
                </button>
                <button
                  type="button"
                  className={target === 'SELECTED' ? 'btn btn-primary' : 'btn btn-secondary'}
                  onClick={() => setTarget('SELECTED')}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  🎯 SELECTED STUDENTS
                </button>
              </div>
            </div>

            {/* SELECTED STUDENTS SEARCH & CHIPS */}
            {target === 'SELECTED' && (
              <div className="form-group" style={{ backgroundColor: '#F8FAFC', padding: '16px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                <label className="form-label">Search & Select Students *</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Search student by name, phone, or ID..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                  />

                  {/* Dropdown Search Results */}
                  {searchedStudents.length > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #CBD5E1',
                        borderRadius: '8px',
                        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                        maxHeight: '180px',
                        overflowY: 'auto',
                        zIndex: 50,
                        marginTop: '4px',
                      }}
                    >
                      {searchedStudents.map((st) => (
                        <div
                          key={st._id}
                          onClick={() => handleToggleSelectStudent(st)}
                          style={{
                            padding: '10px 14px',
                            borderBottom: '1px solid #F1F5F9',
                            cursor: 'pointer',
                            transition: 'background-color 0.15s ease',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#EEF2FF')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
                        >
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                            {st.userId?.fullName || 'Student'}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748B' }}>
                            📞 {st.userId?.phone || '-'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Selected Students Chips */}
                {selectedStudents.length > 0 && (
                  <div style={{ marginTop: '14px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>
                      Selected Recipients ({selectedStudents.length}):
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {selectedStudents.map((st) => (
                        <div
                          key={st._id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            backgroundColor: '#EEF2FF',
                            border: '1px solid #C7D2FE',
                            borderRadius: '20px',
                            padding: '4px 10px',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#3730A3',
                          }}
                        >
                          <span>👤 {st.userId?.fullName || 'Student'}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveSelectedStudent(st._id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#DC2626', display: 'flex', alignItems: 'center' }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* HEADLINE (TITLE) */}
            <div className="form-group">
              <label className="form-label">Headline (Announcement Title) *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Holiday Notice / Extended Library Hours"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            {/* EXPIRY SCHEDULE */}
            <div className="form-group">
              <label className="form-label">Expiry Schedule *</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: '#64748B', display: 'block', marginBottom: '4px' }}>
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    min={todayStr}
                    value={toDateInputValue(expiryDate)}
                    onChange={(e) => {
                      if (e.target.value) setExpiryDate(parseDateInputValue(e.target.value));
                    }}
                    required
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: '#64748B', display: 'block', marginBottom: '4px' }}>
                    Expiry Time (Hourly)
                  </label>
                  <select
                    className="form-select"
                    value={expiryHourVal}
                    onChange={(e) => setExpiryHourVal(e.target.value)}
                    required
                  >
                    {validTimeSlots.map((slot) => (
                      <option key={slot.value} value={slot.value}>
                        {slot.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quick Presets */}
              <div style={{ marginTop: '12px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', marginBottom: '6px' }}>
                  Quick Presets:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  <button type="button" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => applyPresetExpiry(1)}>
                    +1 Hour
                  </button>
                  <button type="button" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => applyPresetExpiry(6)}>
                    +6 Hours
                  </button>
                  <button type="button" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => applyPresetExpiry(12)}>
                    +12 Hours
                  </button>
                  <button type="button" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => applyPresetExpiry(24)}>
                    +24 Hours
                  </button>
                  <button type="button" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => applyPresetExpiry(72)}>
                    +3 Days
                  </button>
                  <button type="button" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => applyPresetExpiry(168)}>
                    +7 Days
                  </button>
                </div>
              </div>

              {/* Validation Warning */}
              {!expiryValidation.isValid && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#DC2626', fontSize: '12px', fontWeight: 600, marginTop: '8px' }}>
                  <AlertTriangle size={15} /> {expiryValidation.message}
                </div>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ padding: '12px 24px', alignSelf: 'flex-start' }}
              disabled={submitting || !expiryValidation.isValid}
            >
              {submitting ? 'Publishing Banner...' : <><Send size={18} /> Publish Notification Banner</>}
            </button>
          </form>

          {/* SENT NOTIFICATION HISTORY CARD */}
          <div className="card">
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginBottom: '16px' }}>
              Sent Notification History
            </h3>

            {loadingHistory ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', color: '#64748B' }}>
                <RefreshCw size={20} className="spin" style={{ marginRight: '8px' }} /> Loading history...
              </div>
            ) : sentNotifications.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#94A3B8', fontSize: '14px' }}>
                No notifications sent yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {sentNotifications.map((notif: any) => {
                  const isActive = notif.status === 'ACTIVE';
                  const isHidden = notif.status === 'HIDDEN';
                  const isSuperAdminBroadcast = notif.type === 'SUPER_ADMIN_BROADCAST';
                  const isSuperAdminAnnouncement = notif.type === 'SUPER_ADMIN_ANNOUNCEMENT';
                  const isStudentBroadcast = notif.type === 'BROADCAST';

                  const targetText = isSuperAdminBroadcast
                    ? '👑 Received from Super Admin (Global Platform Announcement)'
                    : isSuperAdminAnnouncement
                      ? '👑 Received from Super Admin (Direct Announcement)'
                      : isStudentBroadcast
                        ? 'All Students'
                        : `Selected Students (${notif.recipientStudentIds?.length || 1})`;

                  return (
                    <div
                      key={notif._id}
                      style={{
                        backgroundColor: (isSuperAdminBroadcast || isSuperAdminAnnouncement) ? '#EFF6FF' : '#F8FAFC',
                        border: (isSuperAdminBroadcast || isSuperAdminAnnouncement) ? '1px solid #BFDBFE' : '1px solid #E2E8F0',
                        borderRadius: '10px',
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>
                          {(isSuperAdminBroadcast || isSuperAdminAnnouncement) && <span style={{ marginRight: '6px' }}>👑</span>}
                          {notif.title}
                        </div>
                        <span
                          className={`badge ${isActive ? 'badge-success' : isHidden ? 'badge-danger' : 'badge-secondary'
                            }`}
                        >
                          {notif.status}
                        </span>
                      </div>

                      <div style={{ fontSize: '13px', color: '#475569' }}>
                        🎯 Target: {targetText}
                      </div>

                      <div style={{ fontSize: '13px', color: '#64748B' }}>
                        ⏱️ Expires: {formatDisplayDateTime(notif.expiresAt)}
                      </div>

                      {/* Reset / Hide Action */}
                      {isActive && !isSuperAdminBroadcast && !isSuperAdminAnnouncement ? (
                        <div style={{ marginTop: '4px' }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '6px 12px', fontSize: '12px', color: '#DC2626', borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' }}
                            onClick={() => handleHideNotification(notif._id, notif.title)}
                            disabled={actionNotifId === notif._id}
                          >
                            {actionNotifId === notif._id ? (
                              'Hiding...'
                            ) : (
                              <><EyeOff size={14} /> Reset / Hide Notification Now</>
                            )}
                          </button>
                        </div>
                      ) : (isSuperAdminBroadcast || isSuperAdminAnnouncement) ? (
                        <div style={{ marginTop: '4px', fontSize: '12px', color: '#64748B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          🔒 (Notification)
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL: PRESET TEMPLATES */}
        <div className="card" style={{ position: 'sticky', top: '88px' }}>
          <h3 style={{ fontSize: '16px', color: '#D97706', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} /> Notification Presets
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ justifyContent: 'flex-start', textAlign: 'left', fontSize: '13px' }}
              onClick={() => applyTemplate('Fee Payment Due Notice 📢', 24)}
            >
              🔔 Monthly Fee Due Reminder
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ justifyContent: 'flex-start', textAlign: 'left', fontSize: '13px' }}
              onClick={() => applyTemplate('Library Holiday Notice 🏛️', 24)}
            >
              🏛️ Library Holiday Announcement
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ justifyContent: 'flex-start', textAlign: 'left', fontSize: '13px' }}
              onClick={() => applyTemplate('Maintain Silence & Cleanliness 🤫', 48)}
            >
              🤫 Quiet Zone Reminder
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
