import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../services/api.client';
import { Modal } from '../../components/UI/Modal';
import { PlusCircle, Search, RefreshCw, Edit3, Calendar, CreditCard } from 'lucide-react';
import { Link } from 'react-router-dom';

export const SuperAdminLibraries: React.FC = () => {
  const [libraries, setLibraries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal State
  const [selectedLibrary, setSelectedLibrary] = useState<any | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Edit Mode State
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editAdminName, setEditAdminName] = useState('');
  const [editAdminPhone, setEditAdminPhone] = useState('');
  const [editSaasPlanType, setEditSaasPlanType] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [editSaasAmount, setEditSaasAmount] = useState('');
  const [savingDetails, setSavingDetails] = useState(false);

  const fetchLibraries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest('/super-admin/libraries/summary');
      if (res.success && res.data) {
        setLibraries(res.data || []);
      }
    } catch (e) {
      console.error('Failed to fetch libraries summary:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLibraries();
  }, [fetchLibraries]);

  const filteredLibraries = (libraries || []).filter((lib: any) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      lib.name?.toLowerCase().includes(q) ||
      lib.code?.toLowerCase().includes(q) ||
      lib.adminName?.toLowerCase().includes(q) ||
      lib.adminPhone?.includes(q)
    );
  });

  const handleOpenModal = (lib: any) => {
    setSelectedLibrary(lib);
    setIsEditingDetails(false);
    setEditAdminName(lib.adminName || '');
    setEditAdminPhone(lib.adminPhone || '');
    setEditSaasPlanType(lib.saasPlanType || 'MONTHLY');
    setEditSaasAmount(String(lib.saasAmount || (lib.saasPlanType === 'YEARLY' ? 12000 : 1200)));
    setModalOpen(true);
  };

  const handleToggleAdminStatus = async (lib: any) => {
    const nextStatus = !lib.adminIsActive;
    const actionText = nextStatus ? 'Reactivate' : 'Deactivate';
    const warningMessage = nextStatus
      ? `Reactivating Local Admin "${lib.adminName}" will restore login access for the admin and eligible students of ${lib.name}.`
      : `Deactivating Local Admin "${lib.adminName}" will IMMEDIATELY block login and API access for the admin and ALL students assigned to ${lib.name}.`;

    if (!confirm(`Confirm ${actionText} Local Admin:\n\n${warningMessage}`)) return;

    setUpdatingStatus(true);
    try {
      const res = await apiRequest(`/super-admin/libraries/${lib.libraryId}/admin-status`, 'PATCH', {
        isActive: nextStatus,
      });

      if (res.success) {
        alert(`Local Admin "${lib.adminName}" status updated to ${nextStatus ? 'ACTIVE' : 'INACTIVE'}.`);
        setModalOpen(false);
        setSelectedLibrary(null);
        fetchLibraries();
      } else {
        alert(res.error?.message || 'Failed to update admin status.');
      }
    } catch (err: any) {
      alert(err.message || 'An error occurred updating admin status.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleSaveDetails = async () => {
    if (!selectedLibrary) return;
    if (!editAdminName.trim() || !editAdminPhone.trim()) {
      alert('Please enter both Local Admin Name and Phone Number.');
      return;
    }

    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(editAdminPhone.trim())) {
      alert('Please enter a valid 10-digit Admin Phone Number.');
      return;
    }

    const parsedAmount = parseFloat(editSaasAmount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      alert('Please enter a valid Subscription Amount.');
      return;
    }

    setSavingDetails(true);
    try {
      const res = await apiRequest(`/super-admin/libraries/${selectedLibrary.libraryId}/admin-details`, 'PATCH', {
        adminName: editAdminName.trim(),
        adminPhone: editAdminPhone.trim(),
        saasPlanType: editSaasPlanType,
        saasAmount: parsedAmount,
      });

      if (res.success) {
        alert('Local Admin and SaaS plan details updated successfully! 🎉');
        setIsEditingDetails(false);
        setModalOpen(false);
        setSelectedLibrary(null);
        fetchLibraries();
      } else {
        alert(res.error?.message || 'Failed to update details.');
      }
    } catch (err: any) {
      alert(err.message || 'An unexpected error occurred.');
    } finally {
      setSavingDetails(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A' }}>Local Libraries Directory</h1>
          <p style={{ fontSize: '14px', color: '#64748B' }}>Manage onboarded reading rooms, active licenses and status controls</p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button onClick={fetchLibraries} className="btn btn-secondary" style={{ padding: '10px 16px' }}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh
          </button>
          <Link to="/super-admin/onboard-library" className="btn btn-primary" style={{ padding: '10px 18px' }}>
            <PlusCircle size={18} /> Onboard New Library
          </Link>
        </div>
      </div>

      {/* SEARCH BAR */}
      <div className="card" style={{ padding: '16px' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={18} style={{ position: 'absolute', left: '14px', color: '#64748B' }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '42px', fontSize: '14px' }}
            placeholder="🔍 Search library by name, code, admin phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* LIBRARIES GRID */}
      {loading ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
          <RefreshCw size={24} className="spin" style={{ marginBottom: '8px' }} />
          <div>Loading libraries directory...</div>
        </div>
      ) : filteredLibraries.length === 0 ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
          No matching libraries found.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
          {filteredLibraries.map((lib: any) => {
            const isActive = lib.adminIsActive !== false;
            const isOverdue = lib.saasPaymentStatus === 'OVERDUE_DEFAULTER';

            return (
              <div key={lib.libraryId} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', lineHeight: 1.3 }}>
                      🏛️ {lib.name} <span style={{ color: '#64748B', fontSize: '14px', fontWeight: 600 }}>({lib.code})</span>
                    </h3>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {isOverdue && (
                      <span className="badge badge-danger" style={{ fontSize: '11px', fontWeight: 800 }}>
                        🔴 DEFAULTER
                      </span>
                    )}
                    <span className="badge badge-success" style={{ fontSize: '11px', fontWeight: 800 }}>
                      {lib.status || 'ACTIVE'}
                    </span>
                  </div>
                </div>

                {/* CLICKABLE LOCAL ADMIN ROW */}
                <div
                  onClick={() => handleOpenModal(lib)}
                  style={{
                    backgroundColor: isActive ? '#F0FDF4' : '#FEF2F2',
                    border: `1px solid ${isActive ? '#BBF7D0' : '#FECACA'}`,
                    borderRadius: '10px',
                    padding: '12px 14px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'all 0.2s ease',
                  }}
                  title="Click to view Local Admin info & manage account status"
                >
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      👤 LOCAL ADMIN DETAILS (TAP FOR INFO)
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>
                      {lib.adminName} • 📞 {lib.adminPhone}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      padding: '4px 8px',
                      borderRadius: '6px',
                      backgroundColor: isActive ? '#DCFCE7' : '#FEE2E2',
                      color: isActive ? '#15803D' : '#DC2626',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {isActive ? '🟢 ACTIVE' : '🔴 INACTIVE'}
                  </span>
                </div>

                {/* METRIC GRID */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', paddingTop: '10px', borderTop: '1px solid #F1F5F9' }}>
                  <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', padding: '10px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 700 }}>Active Students</div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>
                      {lib.activeStudentCount} / {lib.totalStudentCount}
                    </div>
                  </div>
                  <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', padding: '10px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 700 }}>Received</div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#16A34A', marginTop: '2px' }}>
                      ₹{lib.paymentsReceived.toLocaleString()}
                    </div>
                  </div>
                  <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', padding: '10px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 700 }}>Pending</div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#D97706', marginTop: '2px' }}>
                      ₹{lib.paymentsPending.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: LOCAL ADMIN DETAILS & RECEIVABLES & EDIT MODE */}
      {selectedLibrary && (
        <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={`Local Admin & Receivables — ${selectedLibrary.name}`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E2E8F0', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>{selectedLibrary.name}</h3>
                <span style={{ fontSize: '13px', color: '#64748B' }}>Code: {selectedLibrary.code}</span>
              </div>
              {!isEditingDetails && (
                <button className="btn btn-secondary" style={{ fontSize: '12px', padding: '6px 12px' }} onClick={() => setIsEditingDetails(true)}>
                  <Edit3 size={14} /> Edit Details
                </button>
              )}
            </div>

            {isEditingDetails ? (
              /* EDIT MODE FORM */
              <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ fontSize: '12px', fontWeight: 900, color: '#2563EB', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  📝 Edit Local Admin & SaaS Plan Details
                </div>

                <div className="form-group">
                  <label className="form-label">Local Admin Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editAdminName}
                    onChange={(e) => setEditAdminName(e.target.value)}
                    placeholder="e.g. Vikram Singh"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Phone Number *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editAdminPhone}
                    onChange={(e) => setEditAdminPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    maxLength={10}
                    placeholder="10-digit phone number"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">SaaS Subscription Plan Type *</label>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                      type="button"
                      className={`btn ${editSaasPlanType === 'MONTHLY' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: 1, padding: '10px' }}
                      onClick={() => {
                        setEditSaasPlanType('MONTHLY');
                        if (!editSaasAmount || editSaasAmount === '12000') setEditSaasAmount('1200');
                      }}
                    >
                      <Calendar size={16} /> Monthly Plan
                    </button>
                    <button
                      type="button"
                      className={`btn ${editSaasPlanType === 'YEARLY' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: 1, padding: '10px' }}
                      onClick={() => {
                        setEditSaasPlanType('YEARLY');
                        if (!editSaasAmount || editSaasAmount === '1200') setEditSaasAmount('12000');
                      }}
                    >
                      <CreditCard size={16} /> Yearly Plan
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Subscription Amount (₹) *</label>
                  <input
                    type="number"
                    className="form-input"
                    value={editSaasAmount}
                    onChange={(e) => setEditSaasAmount(e.target.value)}
                    placeholder="e.g. 1200"
                    min={0}
                    required
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                  <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setIsEditingDetails(false)} disabled={savingDetails}>
                    Cancel
                  </button>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSaveDetails} disabled={savingDetails}>
                    {savingDetails ? 'Saving...' : '💾 Save Changes'}
                  </button>
                </div>
              </div>
            ) : (
              /* READ-ONLY VIEW MODE */
              <>
                <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: '#64748B' }}>Local Admin Name:</span>
                    <strong style={{ fontSize: '14px', color: '#0F172A' }}>{selectedLibrary.adminName}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: '#64748B' }}>Phone Number:</span>
                    <strong style={{ fontSize: '14px', color: '#0F172A' }}>📞 {selectedLibrary.adminPhone}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: '#64748B' }}>Admin Account Status:</span>
                    <span className={`badge ${selectedLibrary.adminIsActive ? 'badge-success' : 'badge-danger'}`}>
                      {selectedLibrary.adminIsActive ? '🟢 ACTIVE' : '🔴 INACTIVE'}
                    </span>
                  </div>
                </div>

                {/* SINGLE ACTIVE PLAN RECEIVABLE BOX */}
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>
                    💰 RECEIVABLE BY SUPER ADMIN
                  </div>
                  <div style={{ backgroundColor: '#EFF6FF', border: '1.5px solid #BFDBFE', borderRadius: '14px', padding: '20px', textAlign: 'center' }}>
                    <span style={{ backgroundColor: '#DBEAFE', color: '#1E40AF', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 900, display: 'inline-block', marginBottom: '8px' }}>
                      {selectedLibrary.saasPlanType === 'YEARLY' ? '🌟 YEARLY PLAN' : '📅 MONTHLY PLAN'}
                    </span>
                    <div style={{ fontSize: '13px', color: '#1E40AF', fontWeight: 700 }}>
                      {selectedLibrary.saasPlanType === 'YEARLY' ? 'Yearly Amount Receivable' : 'Monthly Amount Receivable'}
                    </div>
                    <div style={{ fontSize: '32px', fontWeight: 900, color: '#1D4ED8', margin: '4px 0' }}>
                      ₹{(selectedLibrary.saasAmount || (selectedLibrary.saasPlanType === 'YEARLY' ? 12000 : 1200)).toLocaleString()}
                    </div>
                    <div style={{ fontSize: '12px', color: '#3B82F6', fontWeight: 600 }}>
                      {selectedLibrary.saasPlanType === 'YEARLY' ? 'per year' : 'per month'}
                    </div>
                  </div>
                </div>

                {/* ACCOUNT STATUS WARNING NOTE */}
                <div
                  style={{
                    backgroundColor: selectedLibrary.adminIsActive ? '#F0FDF4' : '#FEF2F2',
                    border: `1px solid ${selectedLibrary.adminIsActive ? '#BBF7D0' : '#FECACA'}`,
                    padding: '12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#334155',
                    lineHeight: '1.5',
                  }}
                >
                  {selectedLibrary.adminIsActive
                    ? '🟢 Active Status: Local Admin and library students can log in and access all features.'
                    : '🔴 Inactive Status: Local Admin and ALL students assigned to this library are BLOCKED from logging in.'}
                </div>

                {/* STATUS TOGGLE ACTION BUTTON */}
                <button
                  className={`btn ${selectedLibrary.adminIsActive ? 'btn-danger' : 'btn-success'}`}
                  style={{ padding: '12px', width: '100%', fontSize: '14px', fontWeight: 800 }}
                  onClick={() => handleToggleAdminStatus(selectedLibrary)}
                  disabled={updatingStatus}
                >
                  {updatingStatus
                    ? 'Updating Status...'
                    : selectedLibrary.adminIsActive
                    ? '🚫 Set Status to INACTIVE'
                    : '🟢 Set Status to ACTIVE'}
                </button>
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
