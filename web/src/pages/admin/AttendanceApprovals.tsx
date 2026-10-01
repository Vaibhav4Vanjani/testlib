import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api.client';
import { CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { Modal } from '../../components/UI/Modal';
import { Lightbox } from '../../components/UI/Lightbox';

export const AdminAttendanceApprovals: React.FC = () => {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [rejectModalItem, setRejectModalItem] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState('Subscription expired / Unverified check-in');
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await apiRequest('/attendance/requests');
      if (res.success) {
        setRequests(res.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleApprove = async (id: string) => {
    if (!confirm('Approve attendance check-in scan for student?')) return;
    setProcessingId(id);
    try {
      const res = await apiRequest(`/attendance/requests/${id}/approve`, 'POST');
      if (res.success) {
        alert('Attendance approved! Student checked-in.');
        fetchRequests();
      } else {
        alert(res.error?.message || 'Failed to approve attendance');
      }
    } catch (err: any) {
      alert(err.message || 'Error approving attendance');
    } finally {
      setProcessingId(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectModalItem) return;
    setProcessingId(rejectModalItem._id);
    try {
      const res = await apiRequest(`/attendance/requests/${rejectModalItem._id}/reject`, 'POST', { rejectionReason: rejectReason });
      if (res.success) {
        alert('Attendance request rejected.');
        setRejectModalItem(null);
        fetchRequests();
      } else {
        alert(res.error?.message || 'Failed to reject attendance');
      }
    } catch (err: any) {
      alert(err.message || 'Error rejecting attendance');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A' }}>Attendance Approval Desk</h1>
          <p style={{ fontSize: '14px', color: '#64748B' }}>Verify pending student QR check-in & check-out scans at entry desk</p>
        </div>
        <button onClick={fetchRequests} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh Requests
        </button>
      </div>

      <div className="card">
        <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginBottom: '16px' }}>
          Pending Attendance Requests ({requests.length})
        </h3>

        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#64748B' }}>Loading pending attendance requests...</div>
        ) : requests.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#64748B' }}>No pending attendance scan requests waiting for approval.</div>
        ) : (
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>Scan Time</th>
                  <th>Assigned Seat</th>
                  <th>Type</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r: any) => (
                  <tr key={r._id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {(() => {
                          const profile = r.studentProfileId || {};
                          const pic = profile.profilePictureUrl || profile.profilePicture || r.profilePicture;
                          const name = r.userId?.fullName || r.studentName || 'Student';
                          const initial = name.charAt(0).toUpperCase();

                          if (pic) {
                            const imgUrl = pic.startsWith('http') ? pic : `http://localhost:5000${pic}`;
                            return (
                              <img
                                src={imgUrl}
                                alt={name}
                                title="Click to enlarge profile picture"
                                onClick={() => setPreviewImage({ url: imgUrl, name: `${name} - Identity Verification` })}
                                style={{
                                  width: '40px',
                                  height: '40px',
                                  borderRadius: '50%',
                                  objectFit: 'cover',
                                  border: '2px solid #CBD5E1',
                                  flexShrink: 0,
                                  cursor: 'pointer',
                                  transition: 'transform 0.15s ease-in-out, border-color 0.15s ease-in-out',
                                }}
                                onMouseEnter={(e) => {
                                  (e.target as HTMLElement).style.transform = 'scale(1.1)';
                                  (e.target as HTMLElement).style.borderColor = '#4F46E5';
                                }}
                                onMouseLeave={(e) => {
                                  (e.target as HTMLElement).style.transform = 'scale(1)';
                                  (e.target as HTMLElement).style.borderColor = '#CBD5E1';
                                }}
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                            );
                          }
                          return (
                            <div
                              style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                backgroundColor: '#4F46E5',
                                color: '#FFFFFF',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 800,
                                fontSize: '16px',
                                flexShrink: 0,
                              }}
                            >
                              {initial}
                            </div>
                          );
                        })()}
                        <div>
                          <div style={{ fontWeight: 700, color: '#0F172A' }}>{r.userId?.fullName || r.studentName}</div>
                          <div style={{ fontSize: '12px', color: '#64748B' }}>{r.userId?.phone || r.phone}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontWeight: 600, color: '#0F172A' }}>{new Date(r.timestamp || r.createdAt).toLocaleTimeString()}</td>
                    <td>{r.seatNumber ? <span className="badge badge-info">Seat {r.seatNumber}</span> : 'No Seat'}</td>
                    <td>
                      <span className="badge badge-warning">
                        {r.type === 'CHECK_IN' ? 'CHECK IN' : r.type === 'CHECK_OUT' ? 'CHECK OUT' : (r.type || 'CHECK IN')}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          className="btn btn-success"
                          style={{ fontSize: '12px', padding: '6px 10px' }}
                          onClick={() => handleApprove(r._id)}
                          disabled={processingId === r._id}
                        >
                          <CheckCircle2 size={14} /> Approve
                        </button>
                        <button
                          className="btn btn-danger"
                          style={{ fontSize: '12px', padding: '6px 10px' }}
                          onClick={() => setRejectModalItem(r)}
                          disabled={processingId === r._id}
                        >
                          <XCircle size={14} /> Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={!!rejectModalItem} onClose={() => setRejectModalItem(null)} title="Reject Attendance Check-In">
        {rejectModalItem && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Rejection Reason</label>
              <textarea
                className="form-textarea"
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setRejectModalItem(null)}>
                Cancel
              </button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={handleConfirmReject} disabled={processingId === rejectModalItem._id}>
                Confirm Rejection
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Lightbox
        isOpen={!!previewImage}
        onClose={() => setPreviewImage(null)}
        imageUrl={previewImage?.url || ''}
        title={previewImage?.name || 'Student Identity Verification'}
      />
    </div>
  );
};

