import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../services/api.client';
import { Send, BellRing, EyeOff, RefreshCw, Building2 } from 'lucide-react';
import { formatDateTime } from '../../utils/dates';

export const SuperAdminNotifications: React.FC = () => {
  const [targetMode, setTargetMode] = useState<'ALL' | 'SINGLE'>('ALL');
  const [selectedLibraryId, setSelectedLibraryId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  // Data States
  const [libraries, setLibraries] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actionNotifId, setActionNotifId] = useState<string | null>(null);

  const fetchLibraries = useCallback(async () => {
    try {
      const res = await apiRequest('/super-admin/libraries/summary');
      if (res.success && res.data) {
        setLibraries(res.data || []);
      }
    } catch (e) {
      console.error('Failed to fetch libraries for notification target:', e);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await apiRequest('/super-admin/notifications');
      if (res.success && res.data) {
        setHistory(res.data || []);
      }
    } catch (e) {
      console.error('Failed to fetch notification history:', e);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    fetchLibraries();
    fetchHistory();
  }, [fetchLibraries, fetchHistory]);

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      alert('Please enter a title and message body.');
      return;
    }

    const targetLibraryId = targetMode === 'ALL' ? 'ALL' : selectedLibraryId;
    if (targetMode === 'SINGLE' && !targetLibraryId) {
      alert('Please select a target library.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiRequest('/super-admin/broadcast-notification', 'POST', {
        targetLibraryId,
        title: title.trim(),
        body: body.trim(),
      });

      if (res.success) {
        alert(targetMode === 'ALL'
          ? 'Super Admin announcement broadcasted to all local library admins! 🔔'
          : 'Announcement sent to selected library successfully! 🔔'
        );
        setTitle('');
        setBody('');
        fetchHistory();
      } else {
        alert(res.error?.message || 'Broadcast failed');
      }
    } catch (err: any) {
      alert(err.message || 'Error sending notification');
    } finally {
      setSubmitting(false);
    }
  };

  const handleHideNotification = async (notificationId: string, headline: string) => {
    if (!confirm(`Hide "${headline}" from recipient dashboards?`)) return;

    setActionNotifId(notificationId);
    try {
      const res = await apiRequest(`/super-admin/notifications/${notificationId}/hide`, 'PATCH');
      if (res.success) {
        alert('Notification reset / hidden successfully.');
        fetchHistory();
      } else {
        alert(res.error?.message || 'Failed to hide notification');
      }
    } catch (err: any) {
      alert(err.message || 'Error hiding notification');
    } finally {
      setActionNotifId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A' }}>Global Broadcast System</h1>
          <p style={{ fontSize: '14px', color: '#64748B' }}>Publish system notifications to local libraries platform-wide</p>
        </div>

        <button onClick={fetchHistory} className="btn btn-secondary" style={{ padding: '10px 16px' }}>
          <RefreshCw size={16} className={loadingHistory ? 'spin' : ''} /> Refresh
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
        {/* CREATE NOTIFICATION FORM CARD */}
        <form onSubmit={handleBroadcast} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', padding: '14px 18px', borderRadius: '12px', color: '#1E40AF' }}>
            <BellRing size={20} style={{ flexShrink: 0 }} />
            <div style={{ fontSize: '13px', fontWeight: 600 }}>
              {targetMode === 'ALL'
                ? 'Broadcasts will be published to all local library admins across all registered tenant libraries.'
                : 'Announcement will be delivered specifically to the selected local library admin.'}
            </div>
          </div>

          {/* TARGET RECIPIENTS MODE */}
          <div className="form-group">
            <label className="form-label">Target Recipients *</label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                className={`btn ${targetMode === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setTargetMode('ALL')}
                style={{ flex: 1, padding: '10px', justifyContent: 'center' }}
              >
                📢 ALL LIBRARIES
              </button>
              <button
                type="button"
                className={`btn ${targetMode === 'SINGLE' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setTargetMode('SINGLE')}
                style={{ flex: 1, padding: '10px', justifyContent: 'center' }}
              >
                🏛️ SPECIFIC LIBRARY
              </button>
            </div>
          </div>

          {/* SPECIFIC LIBRARY SELECTOR */}
          {targetMode === 'SINGLE' && (
            <div className="form-group">
              <label className="form-label">Select Target Library *</label>
              <select
                className="form-select"
                value={selectedLibraryId}
                onChange={(e) => setSelectedLibraryId(e.target.value)}
                required
              >
                <option value="">-- Choose Target Library --</option>
                {libraries.map((lib: any) => (
                  <option key={lib.libraryId} value={lib.libraryId}>
                    {lib.name} ({lib.code}) — Admin: {lib.adminName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* BROADCAST TITLE */}
          <div className="form-group">
            <label className="form-label">Broadcast Title *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Platform Maintenance / Policy Update Notice"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {/* BROADCAST MESSAGE BODY */}
          <div className="form-group">
            <label className="form-label">Broadcast Message *</label>
            <textarea
              className="form-textarea"
              rows={5}
              placeholder="Write announcement body..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ padding: '14px 24px', fontSize: '15px', fontWeight: 800 }}
            disabled={submitting}
          >
            {submitting ? 'Sending Broadcast...' : <><Send size={18} /> Send Notification Broadcast</>}
          </button>
        </form>

        {/* SENT NOTIFICATIONS HISTORY CARD */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>
            Broadcast History & Status
          </h3>

          {loadingHistory ? (
            <div style={{ textAlign: 'center', padding: '30px', color: '#64748B' }}>
              <RefreshCw size={20} className="spin" style={{ marginBottom: '8px' }} />
              <div>Loading broadcast history...</div>
            </div>
          ) : history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: '#94A3B8', fontSize: '14px' }}>
              No notifications sent yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '520px', overflowY: 'auto' }}>
              {history.map((notif: any) => {
                const isActive = notif.status === 'ACTIVE';
                const isHidden = notif.status === 'HIDDEN';

                return (
                  <div
                    key={notif._id}
                    style={{
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      borderRadius: '12px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                      <div style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>
                        {notif.title}
                      </div>
                      <span className={`badge ${isActive ? 'badge-success' : isHidden ? 'badge-danger' : 'badge-secondary'}`}>
                        {notif.status}
                      </span>
                    </div>

                    <div style={{ fontSize: '13px', color: '#475569', lineHeight: 1.4 }}>
                      {notif.body}
                    </div>

                    <div style={{ fontSize: '12px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                      <Building2 size={14} style={{ color: '#2563EB' }} />
                      Target: {notif.type === 'SUPER_ADMIN_BROADCAST' ? <strong>All Libraries (Global)</strong> : <strong>{notif.libraryId?.name || 'Selected Library'} ({notif.libraryId?.code})</strong>}
                    </div>

                    <div style={{ fontSize: '11px', color: '#94A3B8' }}>
                      Sent: {formatDateTime(notif.createdAt)} • Expires: {formatDateTime(notif.expiresAt)}
                    </div>

                    {/* Reset / Hide Action */}
                    {isActive && (
                      <div style={{ marginTop: '6px' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '12px', color: '#DC2626', borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' }}
                          onClick={() => handleHideNotification(notif._id, notif.title)}
                          disabled={actionNotifId === notif._id}
                        >
                          {actionNotifId === notif._id ? 'Hiding...' : <><EyeOff size={14} /> Reset / Hide Notification</>}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
