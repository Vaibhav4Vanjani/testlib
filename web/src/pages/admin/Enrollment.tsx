import React, { useState, useEffect, useMemo } from 'react';
import { apiRequest } from '../../services/api.client';
import { HOURLY_TIME_SLOTS, getValidToTimeSlots, calculateSlotDurationHours, calculateSlotPricing, validateMonths, parseTimeToHourNum } from '../../utils/timeSlots';
import { SeatGrid, type ISeat } from '../../components/UI/SeatGrid';
import { LockerGrid, type ILocker } from '../../components/UI/LockerGrid';
import { Modal } from '../../components/UI/Modal';
import { UserPlus, Upload, Copy, Calculator, Tag, AlertTriangle } from 'lucide-react';
import { formatDate, addMonths } from '../../utils/dates';

export const AdminEnrollment: React.FC = () => {
  const today = useMemo(() => new Date(), []);
  const defaultToDate = useMemo(() => addMonths(today, 1), [today]);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [aadharNumber, setAadharNumber] = useState('');
  const [fromDate, setFromDate] = useState(formatDate(today));
  const [toDate, setToDate] = useState(formatDate(defaultToDate));

  const minAllowedToDateStr = useMemo(() => {
    if (!fromDate) return formatDate(defaultToDate);
    const parts = fromDate.split('-').map(Number);
    if (parts.length === 3 && !isNaN(parts[0])) {
      const fromObj = new Date(parts[0], parts[1] - 1, parts[2]);
      return formatDate(addMonths(fromObj, 1));
    }
    const fromObj = new Date(fromDate);
    if (!isNaN(fromObj.getTime())) {
      return formatDate(addMonths(fromObj, 1));
    }
    return formatDate(defaultToDate);
  }, [fromDate, defaultToDate]);

  const dateValidation = useMemo(() => {
    if (!fromDate || !toDate) {
      return { isValid: false, errorMsg: 'Please select valid From Date and To Date.' };
    }

    const fromParts = fromDate.split('-').map(Number);
    const toParts = toDate.split('-').map(Number);

    if (fromParts.length !== 3 || toParts.length !== 3) {
      return { isValid: false, errorMsg: 'Please select valid From Date and To Date.' };
    }

    const from = new Date(fromParts[0], fromParts[1] - 1, fromParts[2]);
    const to = new Date(toParts[0], toParts[1] - 1, toParts[2]);

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return { isValid: false, errorMsg: 'Please select valid From Date and To Date.' };
    }

    const minTo = addMonths(from, 1);
    if (to < minTo) {
      return { isValid: false, errorMsg: 'To Date must be at least 1 month after From Date.' };
    }

    return { isValid: true, errorMsg: null };
  }, [fromDate, toDate, today]);

  const handleFromDateChange = (newFromStr: string) => {
    setFromDate(newFromStr);
    if (!newFromStr) return;
    const parts = newFromStr.split('-').map(Number);
    let fromObj: Date;
    if (parts.length === 3 && !isNaN(parts[0])) {
      fromObj = new Date(parts[0], parts[1] - 1, parts[2]);
    } else {
      fromObj = new Date(newFromStr);
    }
    if (!isNaN(fromObj.getTime())) {
      const minToObj = addMonths(fromObj, 1);
      const minToStr = formatDate(minToObj);
      const toParts = toDate.split('-').map(Number);
      let toObj: Date;
      if (toParts.length === 3 && !isNaN(toParts[0])) {
        toObj = new Date(toParts[0], toParts[1] - 1, toParts[2]);
      } else {
        toObj = new Date(toDate);
      }
      if (isNaN(toObj.getTime()) || toObj < minToObj) {
        setToDate(minToStr);
      }
    }
  };
  const months = '1';

  // Time Slot Selection
  const [fromTime, setFromTime] = useState('06:00');
  const [toTime, setToTime] = useState('23:00');

  // Amenities selection
  const [seats, setSeats] = useState<ISeat[]>([]);
  const [lockers, setLockers] = useState<ILocker[]>([]);
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);
  const [selectedLockerId, setSelectedLockerId] = useState<string | null>(null);

  // Referral Coupon
  const [referredByCode, setReferredByCode] = useState('');
  const [appliedReferral, setAppliedReferral] = useState<any | null>(null);
  const [validatingReferral, setValidatingReferral] = useState(false);

  // Payment Master & Mode
  const [paymentMaster, setPaymentMaster] = useState<any>(null);
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'ONLINE_UPI' | 'BANK_TRANSFER'>('CASH');
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);

  // Loading & Popup modal
  const [loading, setLoading] = useState(false);
  const [loadingAmenities, setLoadingAmenities] = useState(false);
  const [createdCredentialsModal, setCreatedCredentialsModal] = useState<any | null>(null);

  useEffect(() => {
    async function loadMasterData() {
      const pmRes = await apiRequest('/payments/plans');
      if (pmRes.success) setPaymentMaster(pmRes.data);
    }
    loadMasterData();
  }, []);

  const loadSlotAmenities = async () => {
    if (!dateValidation.isValid || !fromDate || !toDate || !fromTime || !toTime) {
      setSeats([]);
      setLockers([]);
      setSelectedSeatId(null);
      setSelectedLockerId(null);
      return;
    }
    setLoadingAmenities(true);
    try {
      const queryParams = new URLSearchParams({ fromDate, toDate, fromTime, toTime });
      const [sRes, lRes] = await Promise.all([
        apiRequest(`/admin/seat-master?${queryParams.toString()}`),
        apiRequest(`/admin/locker-master?${queryParams.toString()}`),
      ]);

      const newSeats: ISeat[] = sRes.success ? (sRes.data?.seats || sRes.data || []) : [];
      const newLockers: ILocker[] = lRes.success ? (lRes.data?.lockers || lRes.data || []) : [];

      setSeats(newSeats);
      setLockers(newLockers);

      if (selectedSeatId) {
        const stillAvailable = newSeats.some((s) => s._id === selectedSeatId && s.status === 'AVAILABLE' && s.isAvailableInSlot !== false);
        if (!stillAvailable) setSelectedSeatId(null);
      }
      if (selectedLockerId) {
        const stillAvailable = newLockers.some((l) => l._id === selectedLockerId && l.status === 'AVAILABLE' && l.isAvailableInSlot !== false);
        if (!stillAvailable) setSelectedLockerId(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAmenities(false);
    }
  };

  useEffect(() => {
    loadSlotAmenities();
  }, [fromDate, toDate, fromTime, toTime, dateValidation.isValid]);

  const handleApplyReferral = async () => {
    if (!referredByCode.trim()) {
      alert('Please enter a referral code');
      return;
    }
    setValidatingReferral(true);
    try {
      const res = await apiRequest(`/admin/validate-referral?code=${encodeURIComponent(referredByCode.trim())}`);
      if (res.success && res.data) {
        setAppliedReferral({
          code: res.data.referralCode,
          discountAmount: res.data.discountAmount,
          referrerName: res.data.referrerName,
        });
        alert(`Referral Coupon Applied! 🎉 ₹${res.data.discountAmount} discount applied.`);
      } else {
        setAppliedReferral(null);
        alert(res.error?.message || 'Invalid referral code');
      }
    } catch (err: any) {
      setAppliedReferral(null);
      alert(err.message || 'Error validating referral');
    } finally {
      setValidatingReferral(false);
    }
  };

  const selectedSeatObj = useMemo(() => seats.find((s) => s._id === selectedSeatId), [seats, selectedSeatId]);
  const selectedLockerObj = useMemo(() => lockers.find((l) => l._id === selectedLockerId), [lockers, selectedLockerId]);

  const slotHours = useMemo(() => calculateSlotDurationHours(fromTime, toTime), [fromTime, toTime]);
  const monthVal = useMemo(() => validateMonths(months), [months]);

  const rawPricing = useMemo(() => {
    return calculateSlotPricing(
      paymentMaster,
      slotHours,
      monthVal.parsed,
      !!selectedSeatId,
      !!selectedLockerId,
      selectedSeatObj?.priceMonthly,
      selectedLockerObj?.priceMonthly
    );
  }, [paymentMaster, slotHours, monthVal.parsed, selectedSeatId, selectedLockerId, selectedSeatObj, selectedLockerObj]);

  const finalTotalFee = useMemo(() => {
    const discount = appliedReferral?.discountAmount || 0;
    return Math.max(0, rawPricing.subtotal - discount);
  }, [rawPricing.subtotal, appliedReferral]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setProfileImageFile(file);
    }
  };

  const handleEnrollStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !phone) {
      alert('Student Full Name and Phone Number are required.');
      return;
    }

    if (phone.length !== 10) {
      alert('Phone Number must be exactly 10 digits.');
      return;
    }

    if (aadharNumber && aadharNumber.length !== 12) {
      alert('Aadhar Card Number must be exactly 12 digits.');
      return;
    }

    if (!dateValidation.isValid) {
      alert(dateValidation.errorMsg || 'Please select valid membership dates.');
      return;
    }

    if (!monthVal.isValid) {
      alert(monthVal.errorMsg || 'Invalid months value.');
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('fullName', fullName);
      formData.append('phone', phone);
      formData.append('aadharNumber', aadharNumber);
      formData.append('fromDate', fromDate);
      formData.append('toDate', toDate);
      formData.append('fromTime', fromTime);
      formData.append('toTime', toTime);
      formData.append('months', String(monthVal.parsed));
      formData.append('paymentMode', paymentMode);
      formData.append('totalFee', String(finalTotalFee));

      if (appliedReferral?.code) formData.append('referralCode', appliedReferral.code);
      if (selectedSeatId) {
        formData.append('seatId', selectedSeatId);
        formData.append('assignedSeatId', selectedSeatId);
      }
      if (selectedLockerId) {
        formData.append('lockerId', selectedLockerId);
        formData.append('assignedLockerId', selectedLockerId);
      }
      if (profileImageFile) formData.append('profilePicture', profileImageFile);

      const res = await apiRequest('/admin/enroll-student', 'POST', formData);

      if (res.success && res.data) {
        setCreatedCredentialsModal({
          fullName,
          phone,
          email: res.data.email || `${phone}@nextlib.com`,
          password: res.data.generatedPassword || 'Password123',
          seatNumber: selectedSeatObj?.seatNumber,
          lockerNumber: selectedLockerObj?.lockerNumber,
        });

        // Reset form
        setFullName('');
        setPhone('');
        setAadharNumber('');
        setAppliedReferral(null);
        setReferredByCode('');
        setSelectedSeatId(null);
        setSelectedLockerId(null);
        setProfileImageFile(null);

        // Refetch amenities grid to immediately reflect newly assigned seat & locker
        loadSlotAmenities();
      } else {
        alert(res.error?.message || 'Failed to enroll student');
      }
    } catch (err: any) {
      alert(err.message || 'Error submitting enrollment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A' }}>Enroll New Student</h1>
        <p style={{ fontSize: '14px', color: '#64748B' }}>Register student, assign shift hours, seats, lockers & record fee payment</p>
      </div>

      <form onSubmit={handleEnrollStudent} className="enrollment-form-container">
        {/* LEFT MAIN FORM */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* PERSONAL DETAILS CARD */}
          <div className="card">
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', color: '#4F46E5' }}>1. Student Personal Details</h3>
            <div className="enrollment-personal-grid">
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Phone Number *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="10-digit mobile number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  maxLength={10}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Aadhar Card Number</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="12-digit Aadhar number"
                  value={aadharNumber}
                  onChange={(e) => setAadharNumber(e.target.value.replace(/\D/g, '').slice(0, 12))}
                  maxLength={12}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Profile Image Photo</label>
                <input type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} id="admin-student-photo" />
                <label
                  htmlFor="admin-student-photo"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '10px',
                    backgroundColor: '#F1F5F9',
                    border: '1px solid #CBD5E1',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: '#475569',
                    fontWeight: 600,
                  }}
                >
                  <Upload size={16} /> {profileImageFile ? profileImageFile.name : 'Choose Photo'}
                </label>
              </div>
            </div>
          </div>

          {/* DATES & SHIFT HOURS */}
          <div className="card">
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', color: '#4F46E5' }}>2. Membership Dates & Shift Timing</h3>
            <div className="enrollment-dates-grid">
              <div className="form-group">
                <label className="form-label">From Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={fromDate}
                  onChange={(e) => handleFromDateChange(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">To Date</label>
                <input
                  type="date"
                  className="form-input"
                  min={minAllowedToDateStr}
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">From Time</label>
                <select
                  className="form-select"
                  value={fromTime}
                  onChange={(e) => {
                    const newFrom = e.target.value;
                    setFromTime(newFrom);
                    const fNum = parseTimeToHourNum(newFrom);
                    const tNum = parseTimeToHourNum(toTime);
                    if (tNum <= fNum) {
                      const validToSlots = getValidToTimeSlots(newFrom);
                      if (validToSlots.length > 0) {
                        setToTime(validToSlots[0].value);
                      }
                    }
                  }}
                >
                  {HOURLY_TIME_SLOTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">To Time</label>
                <select className="form-select" value={toTime} onChange={(e) => setToTime(e.target.value)}>
                  {getValidToTimeSlots(fromTime).map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {!dateValidation.isValid && (
              <div
                style={{
                  color: '#DC2626',
                  fontSize: '13px',
                  fontWeight: 600,
                  marginTop: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#FEF2F2',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #FECACA',
                }}
              >
                <AlertTriangle size={16} /> {dateValidation.errorMsg}
              </div>
            )}
          </div>

          {/* REFERRAL COUPON */}
          <div className="card">
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px', color: '#4F46E5', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Tag size={18} /> Referral Coupon Discount
            </h3>
            <div className="enrollment-referral-row">
              <input
                type="text"
                className="form-input"
                placeholder="Enter referral code if any"
                value={referredByCode}
                onChange={(e) => setReferredByCode(e.target.value)}
                disabled={!!appliedReferral}
              />
              {appliedReferral ? (
                <button type="button" className="btn btn-danger" onClick={() => setAppliedReferral(null)}>
                  Remove
                </button>
              ) : (
                <button type="button" className="btn btn-secondary" onClick={handleApplyReferral} disabled={validatingReferral}>
                  {validatingReferral ? 'Validating...' : 'Apply Coupon'}
                </button>
              )}
            </div>
            {appliedReferral && (
              <div style={{ fontSize: '13px', color: '#059669', fontWeight: 700, marginTop: '8px' }}>
                ✓ Coupon Applied: ₹{appliedReferral.discountAmount} discount from referrer {appliedReferral.referrerName}
              </div>
            )}
          </div>

          {/* AMENITIES MAP */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#059669' }}>3. Assign Reading Seat</h3>
            </div>
            {!dateValidation.isValid ? (
              <div style={{ textAlign: 'center', padding: '24px', color: '#94A3B8', fontSize: '13px', backgroundColor: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                Please select valid Membership Dates & Shift Timing above to view available seats.
              </div>
            ) : (
              <SeatGrid
                seats={seats}
                selectedSeatId={selectedSeatId}
                onSelectSeat={(s) => setSelectedSeatId(s._id)}
                onRemoveSeat={() => setSelectedSeatId(null)}
                loading={loadingAmenities}
              />
            )}
          </div>

          {paymentMaster?.featureFlags?.enableLockers !== false && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#D97706' }}>4. Assign Storage Locker</h3>
              </div>
              {!dateValidation.isValid ? (
                <div style={{ textAlign: 'center', padding: '24px', color: '#94A3B8', fontSize: '13px', backgroundColor: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                  Please select valid Membership Dates & Shift Timing above to view available lockers.
                </div>
              ) : (
                <LockerGrid
                  lockers={lockers}
                  selectedLockerId={selectedLockerId}
                  onSelectLocker={(l) => setSelectedLockerId(l._id)}
                  onRemoveLocker={() => setSelectedLockerId(null)}
                  loading={loadingAmenities}
                />
              )}
            </div>
          )}
        </div>

        {/* RIGHT PRICING SUMMARY PANEL */}
        <div className="card enrollment-summary-card">
          <h3 style={{ fontSize: '18px', color: '#4F46E5', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calculator size={20} /> Fee Calculation
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
              <span>Base Library Fee:</span>
              <span>₹{rawPricing.libraryCharge}</span>
            </div>

            {paymentMaster?.featureFlags?.enableReservedSeats !== false && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                <span>Seat Fee:</span>
                <span style={{ color: '#059669' }}>+ ₹{rawPricing.seatCharge}</span>
              </div>
            )}

            {paymentMaster?.featureFlags?.enableLockers !== false && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                <span>Locker Fee:</span>
                <span style={{ color: '#D97706' }}>+ ₹{rawPricing.lockerCharge}</span>
              </div>
            )}

            {appliedReferral && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669', fontWeight: 700 }}>
                <span>Referral Discount:</span>
                <span>- ₹{appliedReferral.discountAmount}</span>
              </div>
            )}

            <div style={{ borderTop: '1px dashed #CBD5E1', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', fontSize: '20px', fontWeight: 900 }}>
              <span>Total Fee:</span>
              <span style={{ color: '#4F46E5' }}>₹{finalTotalFee}</span>
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '20px' }}>
            <label className="form-label">Payment Mode *</label>
            <select className="form-select" value={paymentMode} onChange={(e: any) => setPaymentMode(e.target.value)}>
              <option value="CASH">Cash Payment</option>
              <option value="ONLINE_UPI">Online UPI</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
            </select>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '14px', fontSize: '15px' }}
            disabled={loading}
          >
            {loading ? 'Registering Student...' : <><UserPlus size={18} /> Complete Enrollment</>}
          </button>
        </div>
      </form>

      {/* SUCCESS CREDENTIALS MODAL */}
      <Modal isOpen={!!createdCredentialsModal} onClose={() => setCreatedCredentialsModal(null)} title="Student Enrolled Successfully! 🎉">
        {createdCredentialsModal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ fontSize: '14px', color: '#64748B' }}>
              Student account created. Provide these login details to the student:
            </p>

            <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div><strong>Name:</strong> {createdCredentialsModal.fullName}</div>
              <div><strong>Phone / Username:</strong> {createdCredentialsModal.phone}</div>
              <div><strong>Initial Password:</strong> <code style={{ backgroundColor: '#EEF2FF', padding: '2px 6px', borderRadius: '4px', color: '#4F46E5' }}>{createdCredentialsModal.password}</code></div>
              {createdCredentialsModal.seatNumber && <div><strong>Assigned Seat:</strong> Seat {createdCredentialsModal.seatNumber}</div>}
              {createdCredentialsModal.lockerNumber && <div><strong>Assigned Locker:</strong> Locker {createdCredentialsModal.lockerNumber}</div>}
            </div>

            <button
              className="btn btn-primary"
              onClick={() => {
                const info = `Name: ${createdCredentialsModal.fullName}\nPhone: ${createdCredentialsModal.phone}\nPassword: ${createdCredentialsModal.password}`;
                navigator.clipboard.writeText(info);
                alert('Student login credentials copied to clipboard!');
              }}
            >
              <Copy size={16} /> Copy Credentials
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
};
