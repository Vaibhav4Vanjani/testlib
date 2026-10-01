import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api.client';
import { Lightbox } from '../../components/UI/Lightbox';
import { Modal } from '../../components/UI/Modal';
import { CheckCircle2, XCircle, Eye, RefreshCw, Clock, AlertTriangle, History } from 'lucide-react';
import { getFullImageUrl } from '../../constants/config';
import { formatDateTime } from '../../utils/dates';

export const SuperAdminSaasPayments: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'PENDING' | 'DEFAULTERS' | 'HISTORY'>('PENDING');

  const [payments, setPayments] = useState<any[]>([]);
  const [libraries, setLibraries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Lightbox & Rejection Modal State
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [rejectingItem, setRejectingItem] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState('Payment verification failed.');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [payRes, libRes] = await Promise.all([
        apiRequest('/super-admin/saas-payments'),
        apiRequest('/super-admin/libraries/summary'),
      ]);

      if (payRes.success) setPayments(payRes.data || []);
      if (libRes.success) setLibraries(libRes.data || []);
    } catch (e) {
      console.error('Failed to fetch SaaS payments data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const pendingPayments = payments.filter((p: any) => {
    if (p.status === 'PENDING') return true;
    if (p.status === 'REJECTED') {
      const rawDueDate = p.libraryId?.saasNextDueDate || p.dueDate;
      if (!rawDueDate) return false;
      const dueDate = new Date(rawDueDate);
      return !isNaN(dueDate.getTime()) && dueDate < todayStart;
    }
    return false;
  });
  const defaulterLibraries = libraries.filter((lib: any) => lib.saasPaymentStatus === 'OVERDUE_DEFAULTER');

  const handleApprove = async (id: string) => {
    if (!confirm('Approve SaaS subscription payment? The library subscription next due date will be extended.')) return;
    setProcessingId(id);
    try {
      const res = await apiRequest(`/super-admin/saas-payments/${id}/approve`, 'PATCH');
      if (res.success) {
        alert('SaaS payment approved! Library license extended. 🎉');
        fetchData();
      } else {
        alert(res.error?.message || 'Approval failed');
      }
    } catch (e: any) {
      alert(e.message || 'Error approving payment');
    } finally {
      setProcessingId(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectingItem) return;
    setProcessingId(rejectingItem._id);
    try {
      const res = await apiRequest(`/super-admin/saas-payments/${rejectingItem._id}/reject`, 'PATCH', {
        rejectionReason: rejectionReason.trim() || 'Payment verification failed.',
      });

      if (res.success) {
        alert('SaaS payment receipt rejected.');
        setRejectingItem(null);
        setRejectionReason('Payment verification failed.');
        fetchData();
      } else {
        alert(res.error?.message || 'Rejection failed');
      }
    } catch (e: any) {
      alert(e.message || 'Error rejecting payment');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A' }}>Local Admin SaaS Payments</h1>
          <p style={{ fontSize: '14px', color: '#64748B' }}>Approve subscription payments and manage payment defaulters</p>
        </div>

        <button onClick={fetchData} className="btn btn-secondary" style={{ padding: '10px 16px' }}>
          <RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {/* TABS HEADER */}
      <div style={{ display: 'flex', gap: '12px', borderBottom: '2px solid #E2E8F0', paddingBottom: '2px' }}>
        <button
          className={`btn ${activeTab === 'PENDING' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '10px 18px', borderRadius: '10px 10px 0 0', fontWeight: 800 }}
          onClick={() => setActiveTab('PENDING')}
        >
          <Clock size={16} /> Pending ({pendingPayments.length})
        </button>
        <button
          className={`btn ${activeTab === 'DEFAULTERS' ? 'btn-danger' : 'btn-secondary'}`}
          style={{ padding: '10px 18px', borderRadius: '10px 10px 0 0', fontWeight: 800 }}
          onClick={() => setActiveTab('DEFAULTERS')}
        >
          <AlertTriangle size={16} /> Defaulters ({defaulterLibraries.length})
        </button>
        <button
          className={`btn ${activeTab === 'HISTORY' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '10px 18px', borderRadius: '10px 10px 0 0', fontWeight: 800 }}
          onClick={() => setActiveTab('HISTORY')}
        >
          <History size={16} /> All History ({payments.length})
        </button>
      </div>

      {/* TAB CONTENTS */}
      {loading ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
          <RefreshCw size={24} className="spin" style={{ marginBottom: '8px' }} />
          <div>Loading SaaS payments data...</div>
        </div>
      ) : activeTab === 'PENDING' ? (
        pendingPayments.length === 0 ? (
          <div className="card" style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
            🎉 No pending SaaS payments to review.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '20px' }}>
            {pendingPayments.map((item: any) => {
              const proofUrl = getFullImageUrl(item.proofImage || item.receiptImage);

              return (
                <div key={item._id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>
                        🏛️ {item.libraryId?.name || item.libraryName}
                      </h3>
                      <div style={{ fontSize: '13px', color: '#64748B', marginTop: '2px' }}>
                        👤 Admin: {item.adminUserId?.fullName || item.submittedBy} • 📞 {item.adminUserId?.phone || 'N/A'}
                      </div>
                    </div>
                    <span className={`badge ${item.status === 'REJECTED' ? 'badge-danger' : 'badge-warning'}`} style={{ fontSize: '11px', fontWeight: 800 }}>
                      {item.status}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', padding: '12px', borderRadius: '10px' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 700 }}>Plan & Amount</div>
                      <div style={{ fontSize: '16px', fontWeight: 900, color: '#059669', marginTop: '2px' }}>
                        ₹{item.amount?.toLocaleString()} <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>({item.planType})</span>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 700 }}>Submitted Date</div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>
                        {formatDateTime(item.submittedAt || item.createdAt)}
                      </div>
                    </div>
                  </div>

                  {item.transactionRef || item.utrNumber ? (
                    <div style={{ fontSize: '13px', color: '#64748B' }}>
                      Ref / UTR: <strong style={{ color: '#1E40AF' }}>{item.transactionRef || item.utrNumber}</strong>
                    </div>
                  ) : null}

                  {item.status === 'REJECTED' && item.rejectionReason ? (
                    <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600 }}>
                      Reason for Rejection: {item.rejectionReason}
                    </div>
                  ) : null}

                  {proofUrl ? (
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '10px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                      onClick={() => setLightboxImage(proofUrl)}
                    >
                      <Eye size={16} /> 🖼️ View Payment Proof Screenshot
                    </button>
                  ) : (
                    <div style={{ fontSize: '12px', color: '#94A3B8', fontStyle: 'italic', textAlign: 'center' }}>
                      📷 Proof Screenshot: No file attached
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                    <button
                      className="btn btn-success"
                      style={{ flex: 1, padding: '10px', fontSize: '13px' }}
                      onClick={() => handleApprove(item._id)}
                      disabled={processingId === item._id}
                    >
                      <CheckCircle2 size={16} /> Approve Payment
                    </button>
                    <button
                      className="btn btn-danger"
                      style={{ flex: 1, padding: '10px', fontSize: '13px' }}
                      onClick={() => setRejectingItem(item)}
                      disabled={processingId === item._id}
                    >
                      <XCircle size={16} /> Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : activeTab === 'DEFAULTERS' ? (
        defaulterLibraries.length === 0 ? (
          <div className="card" style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
            🎉 No payment defaulters! All libraries are up to date.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
            {defaulterLibraries.map((lib: any) => (
              <div key={lib.libraryId} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '20px', borderLeft: '4px solid #DC2626' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>
                      🏛️ {lib.name} <span style={{ fontSize: '14px', color: '#64748B' }}>({lib.code})</span>
                    </h3>
                    <div style={{ fontSize: '13px', color: '#64748B', marginTop: '2px' }}>
                      👤 Admin: {lib.adminName} • 📞 {lib.adminPhone}
                    </div>
                  </div>
                  <span className="badge badge-danger" style={{ fontSize: '11px', fontWeight: 800 }}>
                    🔴 DEFAULTER
                  </span>
                </div>

                <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', padding: '14px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: '#64748B' }}>Subscribed Plan:</span>
                    <strong style={{ fontSize: '13px', color: '#0F172A' }}>
                      {lib.saasPlanType || 'MONTHLY'} (₹{(lib.saasAmount || 1200).toLocaleString()})
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: '#64748B' }}>Payment Deadline:</span>
                    <strong style={{ fontSize: '13px', color: '#DC2626' }}>
                      {lib.saasNextDueDate ? new Date(lib.saasNextDueDate).toLocaleDateString() : 'N/A'}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: '#64748B' }}>Admin Account Status:</span>
                    <span className={`badge ${lib.adminIsActive ? 'badge-success' : 'badge-danger'}`}>
                      {lib.adminIsActive ? '🟢 Active' : '🔴 Inactive'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* HISTORY TAB */
        payments.length === 0 ? (
          <div className="card" style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
            No payment history records found.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
            {payments.map((item: any) => {
              const proofUrl = getFullImageUrl(item.proofImage || item.receiptImage);

              return (
                <div key={item._id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#0F172A' }}>
                        🏛️ {item.libraryId?.name || item.libraryName}
                      </h3>
                      <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                        Submitted: {formatDateTime(item.submittedAt || item.createdAt)}
                      </div>
                    </div>
                    <span className={`badge ${item.status === 'APPROVED' ? 'badge-success' : item.status === 'REJECTED' ? 'badge-danger' : 'badge-warning'}`}>
                      {item.status}
                    </span>
                  </div>

                  <div style={{ fontSize: '14px', color: '#0F172A' }}>
                    Amount: <strong style={{ fontWeight: 900, color: '#0F172A', fontSize: '16px' }}>₹{item.amount?.toLocaleString()}</strong> ({item.planType})
                  </div>

                  {item.transactionRef || item.utrNumber ? (
                    <div style={{ fontSize: '12px', color: '#64748B' }}>
                      Ref / UTR: {item.transactionRef || item.utrNumber}
                    </div>
                  ) : null}

                  {proofUrl ? (
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '8px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      onClick={() => setLightboxImage(proofUrl)}
                    >
                      <Eye size={14} /> 🖼️ View Payment Proof Screenshot
                    </button>
                  ) : null}

                  {item.rejectionReason ? (
                    <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', padding: '8px 12px', borderRadius: '8px', fontSize: '12px' }}>
                      Reason: {item.rejectionReason}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* LIGHTBOX FOR PROOF IMAGE */}
      {lightboxImage && (
        <Lightbox isOpen={!!lightboxImage} onClose={() => setLightboxImage(null)} imageUrl={lightboxImage} title="Payment Proof" />
      )}

      {/* REJECTION REASON MODAL */}
      {rejectingItem && (
        <Modal isOpen={!!rejectingItem} onClose={() => setRejectingItem(null)} title="Reject SaaS Payment Receipt">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Rejection Reason *</label>
              <textarea
                className="form-textarea"
                rows={4}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Type reason for rejecting payment receipt..."
                required
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setRejectingItem(null)}>
                Cancel
              </button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={handleConfirmReject} disabled={processingId === rejectingItem._id}>
                Confirm Rejection
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
