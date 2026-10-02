import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api.client';
import { CheckCircle2, XCircle, Eye, AlertTriangle } from 'lucide-react';
import { Modal } from '../../components/UI/Modal';
import { Lightbox } from '../../components/UI/Lightbox';
import { getFullImageUrl } from '../../constants/config';

export const AdminPaymentApprovals: React.FC = () => {
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title: string } | null>(null);
  const [rejectModalPayment, setRejectModalPayment] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState('Payment proof or UTR unverified');

  const fetchPendingPayments = async () => {
    setLoading(true);
    try {
      const res = await apiRequest('/payments/pending');
      if (res.success) {
        setPending(res.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingPayments();
  }, []);

  const handleApprove = async (paymentId: string) => {
    if (!confirm('Approve this payment submission and extend student subscription/allocate seat?')) return;
    setProcessingId(paymentId);
    try {
      const res = await apiRequest(`/payments/${paymentId}/approve`, 'POST', { adminNotes: 'Verified & approved' });
      if (res.success) {
        alert('Payment approved successfully! Student plan extended and amenities allocated.');
        fetchPendingPayments();
      } else {
        alert(res.error?.message || 'Failed to approve payment');
      }
    } catch (err: any) {
      alert(err.message || 'Error approving payment');
    } finally {
      setProcessingId(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectModalPayment) return;
    setProcessingId(rejectModalPayment._id);
    try {
      const res = await apiRequest(`/payments/${rejectModalPayment._id}/reject`, 'POST', { adminNotes: rejectReason });
      if (res.success) {
        if (res.data?.isStudentInactive || (res.data?.rejectionCount || 0) >= 3) {
          alert('Payment rejected! Student reached 3 rejections and has been set to INACTIVE.');
        } else {
          alert(`Payment rejected! Student has ${res.data?.rejectionCount || 1} rejection strike(s).`);
        }
        setRejectModalPayment(null);
        fetchPendingPayments();
      } else {
        alert(res.error?.message || 'Failed to reject payment');
      }
    } catch (err: any) {
      alert(err.message || 'Error rejecting payment');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A' }}>Student Payment Approvals Desk</h1>
        <p style={{ fontSize: '14px', color: '#64748B' }}>Verify student payment UTR numbers and receipt screenshots to approve renewals & reservations</p>
      </div>

      <div className="card">
        <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginBottom: '16px' }}>
          Pending Submissions ({pending.length})
        </h3>

        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#64748B' }}>Loading pending payment verification requests...</div>
        ) : pending.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#64748B' }}>No pending student payment requests awaiting approval.</div>
        ) : (
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Payment Type</th>
                  <th>Amount</th>
                  <th>UTR Reference No.</th>
                  <th>Requested Slot</th>
                  <th>Submitted Date</th>
                  <th>Receipt Proof</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((p: any) => {
                  const studentObj = p.studentId || {};
                  const userObj = studentObj.userId || {};
                  const studentName = userObj.fullName || p.studentName || 'Student';
                  const studentPhone = userObj.phone || p.phone || '';
                  const cardNo = studentObj.studentIdCardNo || '';
                  const profilePic = p.profilePicture || studentObj.profilePictureUrl || studentObj.profilePicture;
                  const rejectionCount = studentObj.rejectionCount || 0;

                  const rawProof = p.proofUrl || p.proofFile || (p.proofObjectKey ? `/uploads/${p.proofObjectKey.replace(/^\/+/, '')}` : null);
                  const fullProofUrl = getFullImageUrl(rawProof);
                  const initial = studentName.charAt(0).toUpperCase();

                  return (
                    <tr key={p._id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {profilePic ? (
                            <img
                              src={getFullImageUrl(profilePic) || ''}
                              alt={studentName}
                              title="Click to enlarge student profile picture"
                              onClick={() =>
                                setLightboxImage({
                                  url: getFullImageUrl(profilePic) || '',
                                  title: `${studentName} - Profile Picture`,
                                })
                              }
                              style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                objectFit: 'cover',
                                border: '2px solid #CBD5E1',
                                flexShrink: 0,
                                cursor: 'pointer',
                              }}
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
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
                                fontSize: '15px',
                                flexShrink: 0,
                              }}
                            >
                              {initial}
                            </div>
                          )}
                          <div>
                            <div style={{ fontWeight: 700, color: '#0F172A' }}>{studentName}</div>
                            <div style={{ fontSize: '12px', color: '#64748B' }}>
                              {cardNo ? `ID: ${cardNo} • ` : ''}
                              {studentPhone}
                            </div>
                            {rejectionCount > 0 && (
                              <span className="badge badge-warning" style={{ fontSize: '10px', marginTop: '2px', padding: '2px 6px' }}>
                                ⚠️ {rejectionCount} Strike(s)
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td style={{ fontWeight: 600 }}>
                        <div style={{ fontSize: '13px', color: '#0F172A' }}>{p.paymentType || 'PLAN'}</div>
                        {p.targetSeatId && (
                          <div style={{ fontSize: '11px', color: '#059669', fontWeight: 700 }}>
                            🪑 Seat {p.targetSeatId.seatNumber} (Floor {p.targetSeatId.floor || 1})
                          </div>
                        )}
                        {p.targetLockerId && (
                          <div style={{ fontSize: '11px', color: '#D97706', fontWeight: 700 }}>
                            🔒 Locker {p.targetLockerId.lockerNumber} (Floor {p.targetLockerId.floor || 1})
                          </div>
                        )}
                      </td>

                      <td style={{ fontWeight: 800, color: '#059669', fontSize: '15px' }}>₹{p.amount}</td>

                      <td>
                        <code style={{ backgroundColor: '#EEF2FF', padding: '3px 8px', borderRadius: '4px', color: '#4F46E5', fontWeight: 700, fontSize: '12px' }}>
                          {p.utrNumber || 'N/A'}
                        </code>
                      </td>

                      <td style={{ fontSize: '12px', color: '#475569' }}>
                        {p.fromTime && p.toTime ? `${p.fromTime} - ${p.toTime}` : 'Full Day'} ({p.months || 1} mo)
                      </td>

                      <td style={{ fontSize: '12px', color: '#64748B' }}>{new Date(p.createdAt).toLocaleDateString()}</td>

                      <td>
                        {fullProofUrl ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <img
                              src={fullProofUrl}
                              alt="Receipt Proof"
                              title="Click to view full payment screenshot"
                              onClick={() => setLightboxImage({ url: fullProofUrl, title: `${studentName} - Payment Proof Screenshot` })}
                              style={{
                                width: '44px',
                                height: '44px',
                                borderRadius: '8px',
                                objectFit: 'cover',
                                border: '1px solid #6366F1',
                                cursor: 'pointer',
                                transition: 'transform 0.15s ease-in-out',
                              }}
                              onMouseEnter={(e) => ((e.target as HTMLElement).style.transform = 'scale(1.1)')}
                              onMouseLeave={(e) => ((e.target as HTMLElement).style.transform = 'scale(1)')}
                            />
                            <button
                              className="btn btn-secondary"
                              style={{ fontSize: '11px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                              onClick={() => setLightboxImage({ url: fullProofUrl, title: `${studentName} - Payment Proof Screenshot` })}
                            >
                              <Eye size={12} /> View
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#94A3B8' }}>No Image</span>
                        )}
                      </td>

                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            className="btn btn-success"
                            style={{ fontSize: '12px', padding: '6px 10px' }}
                            onClick={() => handleApprove(p._id)}
                            disabled={processingId === p._id}
                          >
                            <CheckCircle2 size={14} /> Approve
                          </button>
                          <button
                            className="btn btn-danger"
                            style={{ fontSize: '12px', padding: '6px 10px' }}
                            onClick={() => setRejectModalPayment(p)}
                            disabled={processingId === p._id}
                          >
                            <XCircle size={14} /> Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* REJECT PAYMENT MODAL */}
      <Modal isOpen={!!rejectModalPayment} onClose={() => setRejectModalPayment(null)} title="Reject Payment Request">
        {rejectModalPayment && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {(rejectModalPayment.studentId?.rejectionCount || 0) >= 2 && (
              <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', padding: '14px', borderRadius: '10px', color: '#991B1B', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertTriangle size={20} style={{ color: '#DC2626' }} />
                <div style={{ fontSize: '13px' }}>
                  <strong>3rd Strike Warning:</strong> Rejecting this request will mark 3 consecutive rejections. Student account will be set to INACTIVE and seat/locker released.
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Rejection Reason / Admin Note</label>
              <textarea
                className="form-textarea"
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setRejectModalPayment(null)}>
                Cancel
              </button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={handleConfirmReject} disabled={processingId === rejectModalPayment._id}>
                Confirm Rejection
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* FULL SCREENSHOT LIGHTBOX */}
      <Lightbox
        isOpen={!!lightboxImage}
        onClose={() => setLightboxImage(null)}
        imageUrl={lightboxImage?.url || ''}
        title={lightboxImage?.title || 'Payment Proof Screenshot'}
      />
    </div>
  );
};

