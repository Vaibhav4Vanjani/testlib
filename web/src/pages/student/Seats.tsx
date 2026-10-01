import React, { useState, useEffect, useMemo } from 'react';
import { apiRequest } from '../../services/api.client';
import { HOURLY_TIME_SLOTS, getValidToTimeSlots, calculateSlotDurationHours, calculateSlotPricing, validateMonths, parseTimeToHourNum } from '../../utils/timeSlots';
import { sortItemsNaturally } from '../../utils/sorting';
import { Modal } from '../../components/UI/Modal';
import { Armchair, Clock, AlertTriangle, Upload, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';

export const StudentSeats: React.FC = () => {
  const [fromTime, setFromTime] = useState<string>('16:00');
  const [toTime, setToTime] = useState<string>('18:00');
  const [months, setMonths] = useState<string>('1');

  const [seats, setSeats] = useState<any[]>([]);
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);
  const [selectedSeat, setSelectedSeat] = useState<any | null>(null);
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
      const [sRes, dRes, pHistRes, pmRes] = await Promise.all([
        apiRequest('/seats'),
        apiRequest('/students/dashboard'),
        apiRequest('/payments/history'),
        apiRequest('/payments/plans'),
      ]);

      if (sRes.success) setSeats(sRes.data || []);
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

  const currentSeat = dashboardData?.student?.currentSeat;
  const currentSeatId = currentSeat?._id || currentSeat;

  const isSeatDisabled = dashboardData?.library?.featureFlags?.enableReservedSeats === false;

  const pendingSeatPayment = paymentHistory.find((p: any) => p.paymentType === 'SEAT' && p.status === 'PENDING');
  const hasPendingReservation = !!pendingSeatPayment;

  const availableFloors: number[] = useMemo(() => {
    const set = new Set<number>(seats.map((s: any) => Number(s.floor || 1)));
    return Array.from(set).sort((a, b) => a - b);
  }, [seats]);

  useEffect(() => {
    if (availableFloors.length > 0 && selectedFloor === null) {
      setSelectedFloor(availableFloors[0]);
    }
  }, [availableFloors, selectedFloor]);

  const displayedSeats = useMemo(() => {
    if (selectedFloor === null) return [];
    const filtered = seats.filter((s: any) => {
      const seatFloor = Number(s.floor || 1);
      if (seatFloor !== selectedFloor) return false;
      const isAssignedToMe = currentSeatId && s._id.toString() === currentSeatId.toString();
      return s.status === 'AVAILABLE' || isAssignedToMe;
    });
    return sortItemsNaturally(filtered, (s: any) => s.seatNumber || '');
  }, [seats, selectedFloor, currentSeatId]);

  const slotHours = useMemo(() => calculateSlotDurationHours(fromTime, toTime), [fromTime, toTime]);
  const monthVal = useMemo(() => validateMonths(months), [months]);

  const pricing = useMemo(() => {
    if (!selectedSeat) return { libraryCharge: 0, seatCharge: 0, lockerCharge: 0, subtotal: 0 };
    return calculateSlotPricing(paymentMaster, slotHours, monthVal.parsed, true, false, selectedSeat.priceMonthly);
  }, [paymentMaster, slotHours, monthVal.parsed, selectedSeat]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setProofFile(file);
      setProofPreview(URL.createObjectURL(file));
    }
  };

  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSeat) return;
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
      formData.append('paymentType', 'SEAT');
      if (selectedSeat._id && !selectedSeat._id.startsWith('fallback-')) {
        formData.append('targetSeatId', selectedSeat._id);
      }
      formData.append('amount', pricing.seatCharge.toString());
      formData.append('hours', slotHours.toString());
      formData.append('months', monthVal.parsed.toString());
      formData.append('fromTime', fromTime);
      formData.append('toTime', toTime);
      formData.append('utrNumber', utrNumber.trim());
      formData.append('proofFile', proofFile);

      const res = await apiRequest('/payments/submit-manual', 'POST', formData);

      if (res.success) {
        alert('Reservation Request Submitted! ⏳ Your seat reservation request has been submitted and is pending Local Admin approval.');
        setSelectedSeat(null);
        setUtrNumber('');
        setProofFile(null);
        setProofPreview(null);
        fetchData();
      } else {
        alert(res.error?.message || 'Failed to submit reservation request');
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
        Loading seat map & plans...
      </div>
    );
  }

  if (isSeatDisabled) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center' }}>
        <ShieldAlert size={56} style={{ color: '#DC2626', marginBottom: '16px' }} />
        <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', marginBottom: '8px' }}>Seat Reservation Disabled</h2>
        <p style={{ fontSize: '14px', color: '#64748B', maxWidth: '400px', marginBottom: '24px' }}>
          Seat reservation functionality is currently disabled for your library.
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
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A' }}>Seat Reservation</h1>
        <p style={{ fontSize: '14px', color: '#64748B' }}>
          Select shift hours, choose a floor, and pick an available reading seat
        </p>
      </div>

      {hasPendingReservation && (
        <div style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '12px', padding: '16px', color: '#B45309', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <AlertTriangle size={24} style={{ color: '#D97706', flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: '14px' }}>⏳ Pending Reservation Request</div>
            <div style={{ fontSize: '13px' }}>
              You have a pending seat reservation payment submitted to Local Admin. You cannot submit another request until it is processed.
            </div>
          </div>
        </div>
      )}

      {/* SHIFT HOURS & DURATION SELECTION */}
      <div className="card">
        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={18} style={{ color: '#4F46E5' }} /> 1. Select Shift Hours & Duration
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
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

          <div className="form-group">
            <label className="form-label">Duration (Months 1-50)</label>
            <input type="number" className="form-input" min={1} max={50} value={months} onChange={(e) => setMonths(e.target.value)} />
          </div>
        </div>
      </div>

      {/* FLOOR SELECTION TABS */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Armchair size={18} style={{ color: '#059669' }} /> 2. Select Floor & Available Seat
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

        {/* SEATS GRID */}
        {displayedSeats.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#64748B' }}>No available seats found on Floor {selectedFloor}.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '14px' }}>
            {displayedSeats.map((seat: any) => {
              const isAssignedToMe = currentSeatId && seat._id.toString() === currentSeatId.toString();
              const isAvailable = seat.status === 'AVAILABLE' && !isAssignedToMe;
              const isOccupied = !isAvailable && !isAssignedToMe;

              return (
                <button
                  key={seat._id}
                  disabled={!isAvailable || hasPendingReservation}
                  onClick={() => setSelectedSeat(seat)}
                  style={{
                    backgroundColor: isAssignedToMe ? '#EFF6FF' : isAvailable ? '#FFFFFF' : '#F1F5F9',
                    border: `1px solid ${isAssignedToMe ? '#2563EB' : isAvailable ? '#059669' : '#CBD5E1'}`,
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
                  <span style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>{seat.seatNumber}</span>
                  <span style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>Floor {seat.floor || 1}</span>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#059669', marginTop: '4px' }}>₹{seat.priceMonthly}/mo</span>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      marginTop: '8px',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: isAssignedToMe ? '#DBEAFE' : isAvailable ? '#DCFCE7' : '#E2E8F0',
                      color: isAssignedToMe ? '#1E40AF' : isAvailable ? '#15803D' : '#475569',
                    }}
                  >
                    {isAssignedToMe ? 'YOUR SEAT' : isAvailable ? 'AVAILABLE' : 'BOOKED'}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* RESERVATION PAYMENT MODAL */}
      <Modal isOpen={!!selectedSeat} onClose={() => setSelectedSeat(null)} title={`Reserve Seat ${selectedSeat?.seatNumber}`}>
        {selectedSeat && (
          <form onSubmit={handleConfirmBooking} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* PRICING BREAKDOWN BOX */}
            <div style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '12px', padding: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#2563EB', textTransform: 'uppercase' }}>Booking Summary</div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', marginTop: '4px' }}>
                Seat {selectedSeat.seatNumber} (Floor {selectedSeat.floor || 1})
              </div>
              <div style={{ fontSize: '13px', color: '#475569', marginTop: '2px' }}>
                Shift: {fromTime} to {toTime} ({slotHours} hours) • {monthVal.parsed} Month(s)
              </div>
              <div style={{ fontSize: '20px', fontWeight: 900, color: '#059669', marginTop: '8px' }}>
                Total Fee: ₹{pricing.seatCharge}
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
                    src={paymentMaster.qrCodeImage.startsWith('http') ? paymentMaster.qrCodeImage : `http://localhost:5000${paymentMaster.qrCodeImage}`}
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
              <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} id="proof-upload-input" />
              <label
                htmlFor="proof-upload-input"
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
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setSelectedSeat(null)}>
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
