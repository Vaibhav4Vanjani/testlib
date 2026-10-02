import React, { useState, useEffect, useMemo } from 'react';
import { apiRequest } from '../../services/api.client';
import { getFullImageUrl } from '../../constants/config';
import { calculateSlotPricing, validateMonths } from '../../utils/timeSlots';
import { sortItemsNaturally } from '../../utils/sorting';
import { Modal } from '../../components/UI/Modal';
import { Lock, Clock, AlertTriangle, Upload, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';

export const StudentLockers: React.FC = () => {
  const [months, setMonths] = useState<string>('1');

  const [lockers, setLockers] = useState<any[]>([]);
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);
  const [selectedLocker, setSelectedLocker] = useState<any | null>(null);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [paymentMaster, setPaymentMaster] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [utrNumber, setUtrNumber] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [lRes, dRes, pHistRes, pmRes] = await Promise.all([
        apiRequest('/lockers'),
        apiRequest('/students/dashboard'),
        apiRequest('/payments/history'),
        apiRequest('/payments/plans'),
      ]);

      if (lRes.success) setLockers(lRes.data || []);
      if (dRes.success) setDashboardData(dRes.data);
      if (pHistRes.success) setPaymentHistory(pHistRes.data || []);
      if (pmRes.success) setPaymentMaster(pmRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const currentLocker = dashboardData?.student?.currentLocker;
  const currentLockerId = currentLocker?._id || currentLocker;

  const isLockerDisabled = dashboardData?.library?.featureFlags?.enableLockers === false;

  const pendingLockerPayment = paymentHistory.find((p: any) => p.paymentType === 'LOCKER' && p.status === 'PENDING');
  const hasPendingReservation = !!pendingLockerPayment;

  const availableFloors: number[] = useMemo(() => {
    const set = new Set<number>(lockers.map((l: any) => Number(l.floor || 1)));
    return Array.from(set).sort((a, b) => a - b);
  }, [lockers]);

  useEffect(() => {
    if (availableFloors.length > 0 && selectedFloor === null) {
      setSelectedFloor(availableFloors[0]);
    }
  }, [availableFloors, selectedFloor]);

  const displayedLockers = useMemo(() => {
    if (selectedFloor === null) return [];
    const filtered = lockers.filter((l: any) => {
      const lockerFloor = Number(l.floor || 1);
      if (lockerFloor !== selectedFloor) return false;
      const isAssignedToMe = currentLockerId && l._id.toString() === currentLockerId.toString();
      return l.status === 'AVAILABLE' || isAssignedToMe;
    });
    return sortItemsNaturally(filtered, (l: any) => l.lockerNumber || '');
  }, [lockers, selectedFloor, currentLockerId]);

  const monthVal = useMemo(() => validateMonths(months), [months]);

  const pricing = useMemo(() => {
    if (!selectedLocker) return { libraryCharge: 0, seatCharge: 0, lockerCharge: 0, subtotal: 0 };
    return calculateSlotPricing(paymentMaster, 12, monthVal.parsed, false, true, 0, selectedLocker.priceMonthly);
  }, [paymentMaster, monthVal.parsed, selectedLocker]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setProofFile(file);
      setProofPreview(URL.createObjectURL(file));
    }
  };

  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLocker) return;
    if (!utrNumber.trim()) {
      alert('Please enter UTR / Transaction Reference Number');
      return;
    }
    if (!proofFile) {
      alert('Please upload payment proof receipt image');
      return;
    }
    if (!monthVal.isValid) {
      alert(monthVal.errorMsg);
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('paymentType', 'LOCKER');
      if (selectedLocker._id && !selectedLocker._id.startsWith('fallback-')) {
        formData.append('targetLockerId', selectedLocker._id);
      }
      formData.append('amount', pricing.lockerCharge.toString());
      formData.append('months', monthVal.parsed.toString());
      formData.append('utrNumber', utrNumber.trim());
      formData.append('proofFile', proofFile);

      const res = await apiRequest('/payments/submit-manual', 'POST', formData);

      if (res.success) {
        alert('Locker Reservation Request Submitted! ⏳ Your locker reservation request has been submitted and is pending Local Admin approval.');
        setSelectedLocker(null);
        setUtrNumber('');
        setProofFile(null);
        setProofPreview(null);
        fetchData();
      } else {
        alert(res.error?.message || 'Failed to submit locker reservation request');
      }
    } catch (err: any) {
      alert(err.message || 'Error submitting payment proof');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', color: '#64748B' }}>
        Loading lockers map & plans...
      </div>
    );
  }

  if (isLockerDisabled) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center' }}>
        <ShieldAlert size={56} style={{ color: '#DC2626', marginBottom: '16px' }} />
        <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', marginBottom: '8px' }}>Locker Reservation Disabled</h2>
        <p style={{ fontSize: '14px', color: '#64748B', maxWidth: '400px', marginBottom: '24px' }}>
          Locker reservation functionality is currently disabled for your library.
        </p>
        <Link to="/student/dashboard" className="btn btn-primary">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A' }}>Locker Reservation</h1>
        <p style={{ fontSize: '14px', color: '#64748B' }}>
          Select floor, duration, and reserve a secure storage locker
        </p>
      </div>

      {hasPendingReservation && (
        <div style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '12px', padding: '16px', color: '#B45309', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <AlertTriangle size={24} style={{ color: '#D97706', flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: '14px' }}>⏳ Pending Locker Request</div>
            <div style={{ fontSize: '13px' }}>
              You have a pending locker reservation payment submitted to Local Admin. You cannot submit another request until it is processed.
            </div>
          </div>
        </div>
      )}

      {/* DURATION SELECTION */}
      <div className="card">
        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={18} style={{ color: '#0284C7' }} /> 1. Select Locker Rental Duration
        </h3>

        <div className="form-group" style={{ maxWidth: '300px' }}>
          <label className="form-label">Duration (Months 1-50)</label>
          <input type="number" className="form-input" min={1} max={50} value={months} onChange={(e) => setMonths(e.target.value)} />
        </div>
      </div>

      {/* FLOOR SELECTION TABS */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Lock size={18} style={{ color: '#D97706' }} /> 2. Select Floor & Available Locker
          </h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            {availableFloors.map((fl) => (
              <button
                key={fl}
                onClick={() => setSelectedFloor(fl)}
                className={selectedFloor === fl ? 'btn btn-primary' : 'btn btn-secondary'}
                style={{ fontSize: '12px', padding: '6px 14px' }}
              >
                Floor {fl}
              </button>
            ))}
          </div>
        </div>

        {/* LOCKERS GRID */}
        {displayedLockers.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#64748B' }}>No available lockers found on Floor {selectedFloor}.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '14px' }}>
            {displayedLockers.map((locker: any) => {
              const isAssignedToMe = currentLockerId && locker._id.toString() === currentLockerId.toString();
              const isAvailable = locker.status === 'AVAILABLE' && !isAssignedToMe;
              const isOccupied = !isAvailable && !isAssignedToMe;

              return (
                <button
                  key={locker._id}
                  disabled={!isAvailable || hasPendingReservation}
                  onClick={() => setSelectedLocker(locker)}
                  style={{
                    backgroundColor: isAssignedToMe ? '#EFF6FF' : isAvailable ? '#FFFFFF' : '#F1F5F9',
                    border: `1px solid ${isAssignedToMe ? '#2563EB' : isAvailable ? '#D97706' : '#CBD5E1'}`,
                    borderRadius: '12px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    cursor: isAvailable && !hasPendingReservation ? 'pointer' : 'not-allowed',
                    opacity: isOccupied ? 0.6 : 1,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>Locker {locker.lockerNumber}</span>
                  <span style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>Floor {locker.floor || 1}</span>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#D97706', marginTop: '4px' }}>₹{locker.priceMonthly}/mo</span>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      marginTop: '8px',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: isAssignedToMe ? '#DBEAFE' : isAvailable ? '#FEF3C7' : '#E2E8F0',
                      color: isAssignedToMe ? '#1E40AF' : isAvailable ? '#B45309' : '#475569',
                    }}
                  >
                    {isAssignedToMe ? 'YOUR LOCKER' : isAvailable ? 'AVAILABLE' : 'BOOKED'}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* RESERVATION PAYMENT MODAL */}
      <Modal isOpen={!!selectedLocker} onClose={() => setSelectedLocker(null)} title={`Reserve Locker ${selectedLocker?.lockerNumber}`}>
        {selectedLocker && (
          <form onSubmit={handleConfirmBooking} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* PRICING BREAKDOWN BOX */}
            <div style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '12px', padding: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#2563EB', textTransform: 'uppercase' }}>Booking Summary</div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', marginTop: '4px' }}>
                Locker {selectedLocker.lockerNumber} (Floor {selectedLocker.floor || 1})
              </div>
              <div style={{ fontSize: '13px', color: '#475569', marginTop: '2px' }}>
                Duration: {monthVal.parsed} Month(s)
              </div>
              <div style={{ fontSize: '20px', fontWeight: 900, color: '#059669', marginTop: '8px' }}>
                Total Fee: ₹{pricing.lockerCharge}
              </div>
            </div>

            {/* PAYMENT INSTRUCTIONS */}
            {paymentMaster && (
              <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Pay via UPI / QR Code
                </div>
                {paymentMaster.qrCodeImage && (
                  <img
                    src={getFullImageUrl(paymentMaster.qrCodeImage) || ''}
                    alt="UPI QR Code"
                    style={{ width: '160px', height: '160px', borderRadius: '12px', objectFit: 'cover', margin: '0 auto 12px' }}
                  />
                )}
                {paymentMaster.upiId && (
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>UPI ID: {paymentMaster.upiId}</div>
                )}
              </div>
            )}

            {/* UTR INPUT */}
            <div className="form-group">
              <label className="form-label">UTR / Transaction Reference No. *</label>
              <input
                type="text"
                className="form-input"
                placeholder="Enter 12-digit UTR number"
                value={utrNumber}
                onChange={(e) => setUtrNumber(e.target.value)}
                required
              />
            </div>

            {/* PROOF FILE UPLOAD */}
            <div className="form-group">
              <label className="form-label">Payment Proof Screenshot *</label>
              <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} id="locker-proof-upload-input" />
              <label
                htmlFor="locker-proof-upload-input"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '12px',
                  backgroundColor: '#F1F5F9',
                  border: '2px dashed #CBD5E1',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: '#475569',
                  fontWeight: 600,
                }}
              >
                <Upload size={18} /> {proofFile ? proofFile.name : 'Choose Payment Screenshot'}
              </label>

              {proofPreview && (
                <img
                  src={proofPreview}
                  alt="Proof preview"
                  style={{ width: '100%', maxHeight: '180px', objectFit: 'contain', marginTop: '10px', borderRadius: '8px', border: '1px solid #E2E8F0' }}
                />
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setSelectedLocker(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" style={{ flex: 1, backgroundColor: '#059669' }} disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Reservation'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
