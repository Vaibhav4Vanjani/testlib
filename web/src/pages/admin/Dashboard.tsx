import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api.client';
import { Lightbox } from '../../components/UI/Lightbox';
import {
  Users,
  Armchair,
  Lock,
  Clock,
  CheckCircle2,
  RefreshCw,
  XCircle,
  AlertTriangle,
  PieChart,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Modal } from '../../components/UI/Modal';

export const AdminDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<any>(null);
  const [earningsData, setEarningsData] = useState<any>(null);
  const [paymentMaster, setPaymentMaster] = useState<any>(null);
  const [pendingPayments, setPendingPayments] = useState<any[]>([]);
  const [pendingAttendance, setPendingAttendance] = useState<any[]>([]);
  const [duePayments, setDuePayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedPayment, setSelectedPayment] = useState<any | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [mRes, eRes, pmRes, pRes, dRes, aRes] = await Promise.all([
        apiRequest('/admin/dashboard-metrics'),
        apiRequest('/admin/earnings'),
        apiRequest('/admin/payment-master'),
        apiRequest('/payments/pending'),
        apiRequest('/payments/due-payments'),
        apiRequest('/attendance/requests'),
      ]);

      if (mRes.success) setMetrics(mRes.data);
      if (eRes.success) setEarningsData(eRes.data);
      if (pmRes.success) setPaymentMaster(pmRes.data);
      if (pRes.success) setPendingPayments(pRes.data || []);
      if (dRes.success) setDuePayments(dRes.data || []);
      if (aRes.success) setPendingAttendance(aRes.data || []);
    } catch (e) {
      console.error('Error loading dashboard metrics:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleApprovePayment = async (paymentId: string) => {
    if (!confirm('Approve this payment and allocate student subscription / seat / locker?')) return;
    try {
      const res = await apiRequest(`/payments/${paymentId}/approve`, 'POST', {
        adminNotes: 'Verified via Web Dashboard',
      });
      if (res.success) {
        alert('Payment approved successfully!');
        setSelectedPayment(null);
        fetchDashboardData();
      } else {
        alert(res.error?.message || 'Failed to approve payment');
      }
    } catch (err: any) {
      alert(err.message || 'Error approving payment');
    }
  };

  const handleRejectPayment = async () => {
    if (!selectedPayment) return;
    const studentRejectionCount = selectedPayment.studentId?.rejectionCount || 0;
    const isStrike3 = studentRejectionCount >= 2;

    const message = isStrike3
      ? '⚠️ Warning: This will be the 3rd rejection strike for this student. Student account will automatically be set to INACTIVE. Proceed?'
      : 'Are you sure you want to reject this payment request?';

    if (!confirm(message)) return;

    try {
      const res = await apiRequest(`/payments/${selectedPayment._id}/reject`, 'POST', {
        adminNotes: rejectReason || 'Payment proof unverified',
      });
      if (res.success) {
        const newCount = res.data?.rejectionCount || studentRejectionCount + 1;
        if (res.data?.isStudentInactive || newCount >= 3) {
          alert('Payment Rejected ⚠️. Student reached 3 rejections and has been set to INACTIVE.');
        } else {
          alert(`Payment request rejected. Student has ${newCount} rejection strike(s).`);
        }
        setSelectedPayment(null);
        setIsRejecting(false);
        setRejectReason('');
        fetchDashboardData();
      } else {
        alert(res.error?.message || 'Failed to reject payment');
      }
    } catch (err: any) {
      alert(err.message || 'Error rejecting payment');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', color: '#64748B' }}>
        <RefreshCw size={24} className="spin" style={{ marginRight: '10px' }} /> Loading library overview dashboard...
      </div>
    );
  }

  const activeStudents = metrics?.activeStudents ?? 0;
  const totalStudents = metrics?.totalStudents ?? 0;
  const seatAvailable = metrics?.seatOccupancy?.available ?? 0;
  const seatTotal = metrics?.seatOccupancy?.total ?? 0;
  const seatOccupied = metrics?.seatOccupancy?.occupied ?? 0;
  const seatRate = metrics?.seatOccupancy?.occupancyRate ?? 0;

  const lockerAvailable = metrics?.lockerOccupancy?.available ?? 0;
  const lockerTotal = metrics?.lockerOccupancy?.total ?? 0;
  const lockerOccupied = metrics?.lockerOccupancy?.occupied ?? 0;
  const lockerRate = metrics?.lockerOccupancy?.occupancyRate ?? 0;

  // Earnings calculations
  const totalRev = earningsData?.totalRevenue || (metrics?.monthlyEarnings || 0);
  const mRev = earningsData?.membershipRevenue || 0;
  const sRev = earningsData?.seatRevenue || 0;
  const lRev = earningsData?.lockerRevenue || 0;

  const mPct = totalRev > 0 ? Math.round((mRev / totalRev) * 100) : 0;
  const sPct = totalRev > 0 ? Math.round((sRev / totalRev) * 100) : 0;
  const lPct = totalRev > 0 ? Math.max(0, 100 - mPct - sPct) : 0;

  const trendData: Array<{ date: string; total: number }> = earningsData?.trendData || [];

  // Advanced SVG Area Chart calculation
  const maxTrendVal = Math.max(...trendData.map((d) => d.total), 100);
  const chartWidth = 340;
  const chartHeight = 70;

  const chartPoints = trendData.length > 0
    ? trendData.map((d, i) => {
      const x = (i / Math.max(trendData.length - 1, 1)) * chartWidth;
      const y = chartHeight - (d.total / maxTrendVal) * (chartHeight - 20) - 10;
      return { x, y, total: d.total, date: d.date };
    })
    : [];

  const polylineStr = chartPoints.map((p) => `${p.x},${p.y}`).join(' ');
  const polygonStr = chartPoints.length > 0
    ? `0,${chartHeight} ${polylineStr} ${chartWidth},${chartHeight}`
    : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* TOP HERO HEADER BANNER */}
      {/* <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)',
          border: '1px solid #E2E8F0',
          borderRadius: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          padding: '18px 24px',
          boxShadow: '0 4px 20px -4px rgba(79, 70, 229, 0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)',
              color: '#4F46E5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.12)',
            }}
          >
            🏢
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', margin: 0 }}>
                {libraryName}
              </h1>
              {libraryCode ? (
                <span style={{ fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '6px', backgroundColor: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0' }}>
                  {libraryCode}
                </span>
              ) : null}
              <span style={{ fontSize: '11px', fontWeight: 800, padding: '3px 10px', borderRadius: '20px', backgroundColor: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span className="live-indicator-dot" /> Live Operations
              </span>
            </div>
            <p style={{ fontSize: '12.5px', color: '#64748B', marginTop: '3px' }}>
              Real-time centre operations, occupancy rates & financial summary
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Link
            to="/admin/enrollment"
            className="btn"
            style={{
              background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
              color: '#FFFFFF',
              padding: '9px 16px',
              fontSize: '13px',
              borderRadius: '10px',
              boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)',
              fontWeight: 700,
            }}
          >
            <Users size={16} /> Enroll Student
          </Link>
          <Link
            to="/admin/earnings"
            className="btn btn-secondary"
            style={{ padding: '9px 16px', fontSize: '13px', borderRadius: '10px', fontWeight: 600 }}
          >
            <TrendingUp size={16} /> Revenue Analytics
          </Link>
          <Link
            to="/admin/update-fees"
            className="btn btn-secondary"
            style={{ padding: '9px 16px', fontSize: '13px', borderRadius: '10px', fontWeight: 600 }}
          >
            <Sliders size={16} /> Pricing Master
          </Link>
        </div>
      </div> */}

      {/* SUPER ADMIN ANNOUNCEMENT BANNER */}
      {/* {metrics?.announcements && metrics.announcements.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {metrics.announcements.map((anc: any) => (
            <div
              key={anc._id}
              style={{
                backgroundColor: '#EFF6FF',
                border: '1.5px solid #93C5FD',
                borderRadius: '14px',
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '14px',
                boxShadow: '0 2px 10px rgba(59, 130, 246, 0.08)',
              }}
            >
              <div style={{ backgroundColor: '#DBEAFE', color: '#1E40AF', padding: '8px', borderRadius: '10px' }}>
                <AlertTriangle size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '10.5px', fontWeight: 900, color: '#1E40AF', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  SYSTEM ANNOUNCEMENT
                </div>
                <div style={{ fontSize: '14.5px', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>
                  {anc.title}
                </div>
                {anc.body ? (
                  <div style={{ fontSize: '12.5px', color: '#334155', marginTop: '4px', lineHeight: 1.4 }}>
                    {anc.body}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )} */}

      {/* KPI METRICS ROW WITH ACCENT TOPS & GLOWING ICONS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
        {/* Today's Revenue */}
        <Link
          to="/admin/earnings"
          className="card card-hover"
          style={{
            padding: '16px',
            textDecoration: 'none',
            display: 'block',
            cursor: 'pointer',
            borderTop: '3.5px solid #0284C7',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Today's Revenue</span>
            <div style={{ backgroundColor: '#E0F2FE', color: '#0284C7', padding: '7px', borderRadius: '10px' }}>
              <Clock size={18} />
            </div>
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#0284C7', marginTop: '8px', letterSpacing: '-0.02em' }}>
            ₹{metrics?.todayEarnings || 0}
          </div>
          <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F1F5F9', paddingTop: '8px' }}>
            <span>Monthly Total:</span>
            <strong style={{ color: '#0F172A', fontWeight: 800 }}>₹{metrics?.monthlyEarnings || 0}</strong>
          </div>
        </Link>

        {/* Active Students */}
        <Link
          to="/admin/students?status=ACTIVE"
          className="card card-hover"
          style={{
            padding: '16px',
            textDecoration: 'none',
            display: 'block',
            cursor: 'pointer',
            borderTop: '3.5px solid #4F46E5',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Active Students</span>
            <div style={{ backgroundColor: '#EEF2FF', color: '#4F46E5', padding: '7px', borderRadius: '10px' }}>
              <Users size={18} />
            </div>
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#4F46E5', marginTop: '8px', letterSpacing: '-0.02em' }}>
            {activeStudents}
          </div>
          <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F1F5F9', paddingTop: '8px' }}>
            <span>Registered Total:</span>
            <strong style={{ color: '#0F172A', fontWeight: 800 }}>{totalStudents}</strong>
          </div>
        </Link>

        {/* Seat Occupancy */}
        {metrics?.featureFlags?.enableReservedSeats !== false && (
          <Link
            to="/admin/seat-master"
            className="card card-hover"
            style={{
              padding: '16px',
              textDecoration: 'none',
              display: 'block',
              cursor: 'pointer',
              borderTop: '3.5px solid #10B981',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Seat Occupancy</span>
              <div style={{ backgroundColor: '#ECFDF5', color: '#059669', padding: '7px', borderRadius: '10px' }}>
                <Armchair size={18} />
              </div>
            </div>
            <div style={{ fontSize: '26px', fontWeight: 900, color: '#059669', marginTop: '8px', letterSpacing: '-0.02em', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              {seatAvailable} <span style={{ fontSize: '13px', fontWeight: 700, color: '#64748B' }}>available</span>
            </div>
            <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F1F5F9', paddingTop: '8px' }}>
              <span>Occupied: {seatOccupied}/{seatTotal}</span>
              <span style={{ backgroundColor: '#ECFDF5', color: '#059669', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>{seatRate}%</span>
            </div>
          </Link>
        )}

        {/* Locker Occupancy */}
        {metrics?.featureFlags?.enableLockers !== false && (
          <Link
            to="/admin/locker-master"
            className="card card-hover"
            style={{
              padding: '16px',
              textDecoration: 'none',
              display: 'block',
              cursor: 'pointer',
              borderTop: '3.5px solid #F59E0B',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Locker Occupancy</span>
              <div style={{ backgroundColor: '#FEF3C7', color: '#D97706', padding: '7px', borderRadius: '10px' }}>
                <Lock size={18} />
              </div>
            </div>
            <div style={{ fontSize: '26px', fontWeight: 900, color: '#D97706', marginTop: '8px', letterSpacing: '-0.02em', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              {lockerAvailable} <span style={{ fontSize: '13px', fontWeight: 700, color: '#64748B' }}>available</span>
            </div>
            <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F1F5F9', paddingTop: '8px' }}>
              <span>Occupied: {lockerOccupied}/{lockerTotal}</span>
              <span style={{ backgroundColor: '#FEF3C7', color: '#D97706', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>{lockerRate}%</span>
            </div>
          </Link>
        )}

        {/* Action Needed Summary */}
        <div
          className="card card-hover"
          onClick={() => {
            const el = document.getElementById('action-needed-section');
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }}
          style={{
            padding: '16px',
            background: 'linear-gradient(135deg, #FAF5FF 0%, #F3E8FF 100%)',
            borderColor: '#E9D5FF',
            cursor: 'pointer',
            borderTop: '3.5px solid #9333EA',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#7E22CE', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Action Needed</span>
            <div style={{ backgroundColor: '#F3E8FF', color: '#9333EA', padding: '7px', borderRadius: '10px' }}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#9333EA', marginTop: '8px', letterSpacing: '-0.02em' }}>
            {pendingPayments.length + pendingAttendance.length + duePayments.length}
          </div>
          <div style={{ fontSize: '11px', color: '#7E22CE', marginTop: '6px', display: 'flex', gap: '8px', borderTop: '1px solid #E9D5FF', paddingTop: '8px' }}>
            <span>Pay: <strong>{pendingPayments.length}</strong></span>
            <span>Attn: <strong>{pendingAttendance.length}</strong></span>
            <span>Due: <strong>{duePayments.length}</strong></span>
          </div>
        </div>
      </div>

      {/* ANALYTICS & VISUAL CHARTS ROW */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '18px' }}>
        {/* REVENUE BREAKDOWN & AREA TREND CHART */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ backgroundColor: '#EEF2FF', color: '#4F46E5', padding: '6px', borderRadius: '8px' }}>
                <PieChart size={18} />
              </div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.01em' }}>
                Revenue Overview
              </h3>
            </div>
            <Link to="/admin/earnings" style={{ fontSize: '12px', fontWeight: 700, color: '#4F46E5', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px' }}>
              Full Analytics <ChevronRight size={14} />
            </Link>
          </div>

          {/* Proportional Segmented Progress Bar */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', fontWeight: 700, marginBottom: '8px' }}>
              <span>Monthly Collected: <strong style={{ color: '#0F172A', fontSize: '14px' }}>₹{totalRev}</strong></span>
              <span style={{ color: '#64748B', fontSize: '11.5px' }}>Membership / Seat / Locker</span>
            </div>
            <div style={{ height: '12px', borderRadius: '8px', backgroundColor: '#F1F5F9', display: 'flex', overflow: 'hidden', border: '1px solid #E2E8F0' }}>
              <div style={{ width: `${mPct}%`, background: 'linear-gradient(90deg, #6366F1, #4F46E5)', transition: 'width 0.3s' }} title={`Membership: ₹${mRev} (${mPct}%)`} />
              <div style={{ width: `${sPct}%`, background: 'linear-gradient(90deg, #10B981, #059669)', transition: 'width 0.3s' }} title={`Seat: ₹${sRev} (${sPct}%)`} />
              <div style={{ width: `${lPct}%`, background: 'linear-gradient(90deg, #F59E0B, #D97706)', transition: 'width 0.3s' }} title={`Locker: ₹${lRev} (${lPct}%)`} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '11.5px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#4F46E5' }}></span>
                <span style={{ color: '#64748B' }}>Membership:</span>
                <strong style={{ color: '#0F172A' }}>₹{mRev}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#059669' }}></span>
                <span style={{ color: '#64748B' }}>Seat:</span>
                <strong style={{ color: '#0F172A' }}>₹{sRev}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#D97706' }}></span>
                <span style={{ color: '#64748B' }}>Locker:</span>
                <strong style={{ color: '#0F172A' }}>₹{lRev}</strong>
              </div>
            </div>
          </div>

          {/* Revenue Timeline Gradient Area Chart */}
          <div style={{ backgroundColor: '#F8FAFC', borderRadius: '12px', padding: '12px 14px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#64748B', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>Daily Revenue Timeline</span>
              <span style={{ backgroundColor: '#EEF2FF', color: '#4F46E5', padding: '1px 8px', borderRadius: '12px', fontSize: '10.5px' }}>{trendData.length} Days Recorded</span>
            </div>
            {chartPoints.length > 0 ? (
              <svg width="100%" height="70" viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none">
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4F46E5" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#4F46E5" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <polygon points={polygonStr} fill="url(#revenueGradient)" />
                <polyline fill="none" stroke="#4F46E5" strokeWidth="2.5" points={polylineStr} strokeLinecap="round" strokeLinejoin="round" />
                {chartPoints.map((p, idx) => (
                  <circle key={idx} cx={p.x} cy={p.y} r="3" fill="#4F46E5" stroke="#FFFFFF" strokeWidth="1.5" />
                ))}
              </svg>
            ) : (
              <div style={{ height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: '12px' }}>
                No recent revenue trend data
              </div>
            )}
          </div>
        </div>

        {/* SEAT & LOCKER CAPACITY UTILIZATION */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ backgroundColor: '#ECFDF5', color: '#059669', padding: '6px', borderRadius: '8px' }}>
                <Layers size={18} />
              </div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.01em' }}>
                Seat & Locker Status
              </h3>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <Link to="/admin/seat-master" style={{ fontSize: '12px', fontWeight: 700, color: '#059669', textDecoration: 'none' }}>
                Seats ➔
              </Link>
              <Link to="/admin/locker-master" style={{ fontSize: '12px', fontWeight: 700, color: '#D97706', textDecoration: 'none' }}>
                Lockers ➔
              </Link>
            </div>
          </div>

          {/* Seat Capacity Gauge */}
          {metrics?.featureFlags?.enableReservedSeats !== false && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', fontWeight: 700, marginBottom: '6px' }}>
                <span style={{ color: '#334155' }}>🪑 Seat Allocation Rate</span>
                <span style={{ color: '#059669', fontWeight: 800 }}>{seatOccupied} / {seatTotal} ({seatRate}%)</span>
              </div>
              <div style={{ height: '10px', borderRadius: '6px', backgroundColor: '#E2E8F0', overflow: 'hidden' }}>
                <div style={{ width: `${seatRate}%`, height: '100%', background: 'linear-gradient(90deg, #10B981, #059669)', transition: 'width 0.3s' }} />
              </div>
              <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '6px', display: 'flex', justifyContent: 'space-between' }}>
                <span>Available Seats: <strong style={{ color: '#059669' }}>{seatAvailable}</strong></span>
                <span>Reserved/Occupied: <strong>{seatOccupied}</strong></span>
              </div>
            </div>
          )}

          {/* Locker Capacity Gauge */}
          {metrics?.featureFlags?.enableLockers !== false && (
            <div style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', fontWeight: 700, marginBottom: '6px' }}>
                <span style={{ color: '#334155' }}>🔒 Locker Allocation Rate</span>
                <span style={{ color: '#D97706', fontWeight: 800 }}>{lockerOccupied} / {lockerTotal} ({lockerRate}%)</span>
              </div>
              <div style={{ height: '10px', borderRadius: '6px', backgroundColor: '#E2E8F0', overflow: 'hidden' }}>
                <div style={{ width: `${lockerRate}%`, height: '100%', background: 'linear-gradient(90deg, #F59E0B, #D97706)', transition: 'width 0.3s' }} />
              </div>
              <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '6px', display: 'flex', justifyContent: 'space-between' }}>
                <span>Available Lockers: <strong style={{ color: '#D97706' }}>{lockerAvailable}</strong></span>
                <span>Reserved/Occupied: <strong>{lockerOccupied}</strong></span>
              </div>
            </div>
          )}

          {/* Current Pricing Overview Box */}
          {paymentMaster && (
            <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '12px 14px', marginTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Update Fees</div>
                <div style={{ fontSize: '12.5px', color: '#0F172A', fontWeight: 800, marginTop: '3px' }}>
                  Full-Day: ₹{paymentMaster.monthlyFee || 1500}/mo • Seat: ₹{paymentMaster.seatMonthlyFee || 500} • Locker: ₹{paymentMaster.lockerMonthlyFee || 200}
                </div>
              </div>
              <Link to="/admin/payment-master" className="btn btn-secondary" style={{ fontSize: '11.5px', padding: '5px 12px', borderRadius: '8px' }}>
                Edit
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* PENDING APPROVALS, ATTENDANCE REQUESTS & DUE PAYMENTS WIDGETS */}
      <div id="action-needed-section" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '18px' }}>
        {/* PENDING PAYMENT APPROVALS */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ backgroundColor: '#ECFDF5', color: '#059669', padding: '6px', borderRadius: '8px' }}>
                <CheckCircle2 size={18} />
              </div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Pending Payments ({pendingPayments.length})
              </h3>
            </div>
            <Link to="/admin/payment-approval" style={{ fontSize: '12px', fontWeight: 700, color: '#4F46E5', textDecoration: 'none' }}>
              View All ➔
            </Link>
          </div>

          {pendingPayments.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#64748B', fontSize: '13px', backgroundColor: '#F8FAFC', borderRadius: '12px', border: '1px dashed #CBD5E1' }}>
              No pending payment proofs to review.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {pendingPayments.slice(0, 3).map((p: any) => (
                <div key={p._id} style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.15s ease' }}>
                  <div>
                    <div style={{ fontWeight: 800, color: '#0F172A', fontSize: '13.5px' }}>{p.studentId?.fullName || p.studentName || 'Student'}</div>
                    <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>Amount: <strong style={{ color: '#059669' }}>₹{p.amount}</strong> • UTR: {p.utrNumber || 'N/A'}</div>
                  </div>
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: '11.5px', padding: '5px 12px', borderRadius: '8px', fontWeight: 700 }}
                    onClick={() => setSelectedPayment(p)}
                  >
                    Review Proof
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* PENDING ATTENDANCE REQUESTS */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ backgroundColor: '#E0F2FE', color: '#0284C7', padding: '6px', borderRadius: '8px' }}>
                <Clock size={18} />
              </div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Pending Attendance ({pendingAttendance.length})
              </h3>
            </div>
            <Link to="/admin/attendance-approvals" style={{ fontSize: '12px', fontWeight: 700, color: '#4F46E5', textDecoration: 'none' }}>
              View All ➔
            </Link>
          </div>

          {pendingAttendance.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#64748B', fontSize: '13px', backgroundColor: '#F8FAFC', borderRadius: '12px', border: '1px dashed #CBD5E1' }}>
              No pending attendance requests.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {pendingAttendance.slice(0, 3).map((a: any) => {
                const name = a.userId?.fullName || a.studentName || 'Student';
                return (
                  <div key={a._id} style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 800, color: '#0F172A', fontSize: '13.5px' }}>{name}</div>
                      <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                        Time: {new Date(a.timestamp || a.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {a.seatNumber ? `Seat ${a.seatNumber}` : 'No Seat'}
                      </div>
                    </div>
                    <Link
                      to="/admin/attendance-approvals"
                      className="btn btn-secondary"
                      style={{ fontSize: '11.5px', padding: '5px 12px', borderRadius: '8px', textDecoration: 'none', fontWeight: 700 }}
                    >
                      Review
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* OVERDUE PAYMENTS */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ backgroundColor: '#FEF2F2', color: '#DC2626', padding: '6px', borderRadius: '8px' }}>
                <AlertTriangle size={18} />
              </div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Overdue Student Fees ({duePayments.length})
              </h3>
            </div>
            <Link to="/admin/pending-payments" style={{ fontSize: '12px', fontWeight: 700, color: '#4F46E5', textDecoration: 'none' }}>
              View All ➔
            </Link>
          </div>

          {duePayments.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#64748B', fontSize: '13px', backgroundColor: '#F8FAFC', borderRadius: '12px', border: '1px dashed #CBD5E1' }}>
              No overdue student payments.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {duePayments.slice(0, 3).map((s: any) => (
                <div key={s._id} style={{ backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '12px', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 800, color: '#991B1B', fontSize: '13.5px' }}>{s.studentName || s.fullName}</div>
                    <div style={{ fontSize: '11.5px', color: '#7F1D1D', marginTop: '2px' }}>Due: {new Date(s.dueDate).toLocaleDateString()}</div>
                  </div>
                  <span className="badge badge-danger" style={{ fontSize: '10.5px' }}>Overdue</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* REVIEW PAYMENT MODAL */}
      <Modal isOpen={!!selectedPayment} onClose={() => setSelectedPayment(null)} title="Review Student Payment Proof">
        {selectedPayment && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px' }}>
              <div><strong>Student Name:</strong> {selectedPayment.studentId?.fullName || selectedPayment.studentName}</div>
              <div><strong>Phone:</strong> {selectedPayment.studentId?.phone || selectedPayment.phone}</div>
              <div><strong>Amount:</strong> ₹{selectedPayment.amount}</div>
              <div><strong>UTR Reference:</strong> {selectedPayment.utrNumber || 'N/A'}</div>
              <div><strong>Payment Type:</strong> {selectedPayment.paymentType}</div>
              <div><strong>Requested Duration:</strong> {selectedPayment.months || 1} Month(s)</div>
            </div>

            {selectedPayment.proofFile && (
              <div style={{ textAlign: 'center' }}>
                <img
                  src={selectedPayment.proofFile.startsWith('http') ? selectedPayment.proofFile : `http://localhost:5000${selectedPayment.proofFile}`}
                  alt="Proof Receipt"
                  onClick={() => setLightboxImage(selectedPayment.proofFile.startsWith('http') ? selectedPayment.proofFile : `http://localhost:5000${selectedPayment.proofFile}`)}
                  style={{ width: '100%', maxHeight: '240px', objectFit: 'contain', borderRadius: '8px', cursor: 'pointer', border: '1px solid #E2E8F0' }}
                />
              </div>
            )}

            {isRejecting ? (
              <div className="form-group">
                <label className="form-label">Rejection Reason</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Enter rejection reason note..."
                />
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  <button className="btn btn-secondary" onClick={() => setIsRejecting(false)}>
                    Cancel
                  </button>
                  <button className="btn btn-danger" onClick={handleRejectPayment}>
                    Confirm Rejection
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => setIsRejecting(true)}>
                  <XCircle size={16} /> Reject Payment
                </button>
                <button className="btn btn-success" style={{ flex: 1 }} onClick={() => handleApprovePayment(selectedPayment._id)}>
                  <CheckCircle2 size={16} /> Approve & Allocate
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {lightboxImage && <Lightbox isOpen={!!lightboxImage} imageUrl={lightboxImage} onClose={() => setLightboxImage(null)} />}
    </div>
  );
};

