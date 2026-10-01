import React, { useState, useEffect, useMemo } from 'react';
import { apiRequest } from '../../services/api.client';
import { HOURLY_TIME_SLOTS, getValidToTimeSlots, calculateSlotDurationHours, calculateSlotPricing, validateMonths, parseTimeToHourNum } from '../../utils/timeSlots';
import { CreditCard, Upload, Armchair, Lock, CheckCircle2, Clock3, XCircle } from 'lucide-react';

export const StudentPayments: React.FC = () => {
  const [fromTime, setFromTime] = useState<string>('06:00');
  const [toTime, setToTime] = useState<string>('14:00');
  const [months, setMonths] = useState<string>('1');
  const [wantSeat, setWantSeat] = useState<boolean>(false);
  const [selectedSeatId, setSelectedSeatId] = useState<string>('');
  const [wantLocker, setWantLocker] = useState<boolean>(false);
  const [selectedLockerId, setSelectedLockerId] = useState<string>('');

  const [utrNumber, setUtrNumber] = useState<string>('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);

  const [paymentMaster, setPaymentMaster] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [seats, setSeats] = useState<any[]>([]);
  const [lockers, setLockers] = useState<any[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pmRes, histRes, sRes, lRes] = await Promise.all([
        apiRequest('/payments/plans'),
        apiRequest('/payments/history'),
        apiRequest('/seats'),
        apiRequest('/lockers'),
      ]);

      if (pmRes.success) setPaymentMaster(pmRes.data);
      if (histRes.success) setHistory(histRes.data || []);
      if (sRes.success) setSeats(sRes.data || []);
      if (lRes.success) setLockers(lRes.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const slotHours = useMemo(() => calculateSlotDurationHours(fromTime, toTime), [fromTime, toTime]);
  const monthVal = useMemo(() => validateMonths(months), [months]);

  const selectedSeatObj = useMemo(() => seats.find((s) => s._id === selectedSeatId), [seats, selectedSeatId]);
  const selectedLockerObj = useMemo(() => lockers.find((l) => l._id === selectedLockerId), [lockers, selectedLockerId]);

  const pricing = useMemo(() => {
    return calculateSlotPricing(
      paymentMaster,
      slotHours,
      monthVal.parsed,
      wantSeat && !!selectedSeatId,
      wantLocker && !!selectedLockerId,
      selectedSeatObj?.priceMonthly,
      selectedLockerObj?.priceMonthly
    );
  }, [paymentMaster, slotHours, monthVal.parsed, wantSeat, selectedSeatId, wantLocker, selectedLockerId, selectedSeatObj, selectedLockerObj]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setProofFile(file);
      setProofPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!utrNumber.trim()) {
      alert('Please enter UTR / Transaction Reference Number');
      return;
    }
    if (!proofFile) {
      alert('Please upload payment proof screenshot receipt');
      return;
    }
    if (!monthVal.isValid) {
      alert(monthVal.errorMsg);
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('paymentType', wantSeat || wantLocker ? 'PLAN' : 'MEMBERSHIP');
      formData.append('amount', pricing.subtotal.toString());
      formData.append('hours', slotHours.toString());
      formData.append('months', monthVal.parsed.toString());
      formData.append('fromTime', fromTime);
      formData.append('toTime', toTime);
      formData.append('utrNumber', utrNumber.trim());
      formData.append('proofFile', proofFile);

      if (wantSeat && selectedSeatId) formData.append('targetSeatId', selectedSeatId);
      if (wantLocker && selectedLockerId) formData.append('targetLockerId', selectedLockerId);

      const res = await apiRequest('/payments/submit-manual', 'POST', formData);

      if (res.success) {
        alert('Payment Proof Submitted! ⏳ Your payment request has been submitted to Local Admin for verification.');
        setUtrNumber('');
        setProofFile(null);
        setProofPreview(null);
        fetchData();
      } else {
        alert(res.error?.message || 'Failed to submit payment proof');
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
        Loading payment details & history...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A' }}>Plans & Payments</h1>
        <p style={{ fontSize: '14px', color: '#64748B' }}>
          Renew your subscription, reserve seat/locker, and upload payment verification receipts
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '24px', alignItems: 'start' }}>
        {/* LEFT COLUMN: RENEWAL & PAYMENT PROOF FORM */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <form className="card" onSubmit={handleSubmitPayment}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CreditCard size={20} style={{ color: '#4F46E5' }} /> Subscription Renewal & Fee Payment
            </h3>

            {/* SHIFT SELECTION */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '20px' }}>
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

            {/* SEAT OPTION */}
            <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '16px', marginBottom: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 700, color: '#0F172A', fontSize: '14px' }}>
                <input type="checkbox" checked={wantSeat} onChange={(e) => setWantSeat(e.target.checked)} />
                <Armchair size={18} style={{ color: '#059669' }} /> Add Seat Reservation
              </label>

              {wantSeat && (
                <div style={{ marginTop: '12px', paddingLeft: '26px' }}>
                  <select className="form-select" value={selectedSeatId} onChange={(e) => setSelectedSeatId(e.target.value)} required={wantSeat}>
                    <option value="">-- Select Available Seat --</option>
                    {seats
                      .filter((s) => s.status === 'AVAILABLE')
                      .map((s) => (
                        <option key={s._id} value={s._id}>
                          Seat {s.seatNumber} (Floor {s.floor || 1}) - ₹{s.priceMonthly}/mo
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>

            {/* LOCKER OPTION */}
            <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '16px', marginBottom: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 700, color: '#0F172A', fontSize: '14px' }}>
                <input type="checkbox" checked={wantLocker} onChange={(e) => setWantLocker(e.target.checked)} />
                <Lock size={18} style={{ color: '#D97706' }} /> Add Locker Reservation
              </label>

              {wantLocker && (
                <div style={{ marginTop: '12px', paddingLeft: '26px' }}>
                  <select className="form-select" value={selectedLockerId} onChange={(e) => setSelectedLockerId(e.target.value)} required={wantLocker}>
                    <option value="">-- Select Available Locker --</option>
                    {lockers
                      .filter((l) => l.status === 'AVAILABLE')
                      .map((l) => (
                        <option key={l._id} value={l._id}>
                          Locker {l.lockerNumber} (Floor {l.floor || 1}) - ₹{l.priceMonthly}/mo
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>

            {/* UTR & PROOF FILE */}
            <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '16px' }}>
              <div className="form-group">
                <label className="form-label">UTR / Transaction Reference No. *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter 12-digit UTR transaction number"
                  value={utrNumber}
                  onChange={(e) => setUtrNumber(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Payment Receipt Screenshot *</label>
                <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} id="payment-receipt-upload" />
                <label
                  htmlFor="payment-receipt-upload"
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
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '16px', padding: '14px' }} disabled={submitting}>
              {submitting ? 'Submitting Payment Proof...' : 'Submit Payment Verification'}
            </button>
          </form>
        </div>

        {/* RIGHT COLUMN: PAYMENT QR & SUMMARY */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card" style={{ borderColor: '#4F46E5' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', marginBottom: '16px' }}>Fee Calculation Summary</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                <span>Shift Duration:</span>
                <span style={{ fontWeight: 700, color: '#0F172A' }}>
                  {fromTime} - {toTime} ({slotHours}h)
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                <span>Base Library Fee ({monthVal.parsed} mo):</span>
                <span>₹{pricing.libraryCharge}</span>
              </div>
              {wantSeat && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                  <span>Seat Fee:</span>
                  <span style={{ color: '#059669' }}>+ ₹{pricing.seatCharge}</span>
                </div>
              )}
              {wantLocker && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                  <span>Locker Fee:</span>
                  <span style={{ color: '#D97706' }}>+ ₹{pricing.lockerCharge}</span>
                </div>
              )}

              <div style={{ borderTop: '1px dashed #CBD5E1', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', fontSize: '20px', fontWeight: 900 }}>
                <span>Total Payable:</span>
                <span style={{ color: '#4F46E5' }}>₹{pricing.subtotal}</span>
              </div>
            </div>
          </div>

          {paymentMaster && (
            <div className="card" style={{ textAlign: 'center' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', marginBottom: '12px' }}>Library Payment QR Code</h3>
              {paymentMaster.qrCodeImage && (
                <img
                  src={paymentMaster.qrCodeImage.startsWith('http') ? paymentMaster.qrCodeImage : `http://localhost:5000${paymentMaster.qrCodeImage}`}
                  alt="Payment QR"
                  style={{ width: '180px', height: '180px', objectFit: 'cover', borderRadius: '12px', margin: '0 auto 12px', border: '1px solid #E2E8F0' }}
                />
              )}
              {paymentMaster.upiId && <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>UPI ID: {paymentMaster.upiId}</div>}
            </div>
          )}
        </div>
      </div>

      {/* PAYMENT HISTORY TABLE */}
      <div className="card">
        <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginBottom: '16px' }}>Payment Verification History</h3>

        {history.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>No payment verification history recorded.</div>
        ) : (
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>UTR No.</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((p: any) => (
                  <tr key={p._id}>
                    <td>{new Date(p.createdAt || p.paymentDate).toLocaleDateString()}</td>
                    <td style={{ fontWeight: 600 }}>{p.paymentType || 'MEMBERSHIP'}</td>
                    <td style={{ fontWeight: 700, color: '#0F172A' }}>₹{p.amount}</td>
                    <td>{p.utrNumber || 'N/A'}</td>
                    <td>
                      <span
                        className={
                          p.status === 'APPROVED'
                            ? 'badge badge-success'
                            : p.status === 'REJECTED'
                              ? 'badge badge-danger'
                              : 'badge badge-warning'
                        }
                      >
                        {p.status === 'APPROVED' && <CheckCircle2 size={12} />}
                        {p.status === 'REJECTED' && <XCircle size={12} />}
                        {p.status === 'PENDING' && <Clock3 size={12} />}
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
