import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api.client';
import { useAuthStore } from '../../store/authStore';
import { QrCode, Armchair, Lock, CreditCard, Gift, Clock, RefreshCw, AlertTriangle, Bell, CheckCircle2, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export const StudentDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const res = await apiRequest('/students/dashboard');
      if (res.success && res.data) {
        setData(res.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', color: '#64748B' }}>
        <RefreshCw size={24} className="spin" style={{ marginRight: '8px' }} /> Loading dashboard...
      </div>
    );
  }

  const library = data?.library;
  const student = data?.student;
  const stats = data?.stats;

  const currentAttendanceState = stats?.currentAttendanceState;
  const pendingRequest = stats?.pendingRequest || currentAttendanceState?.pendingRequest;
  const rejectedRequest = stats?.rejectedRequest || currentAttendanceState?.rejectedRequest;
  const activeSession = stats?.activeSession || currentAttendanceState?.activeSession;
  const lastSession = stats?.lastSession;

  const attendanceState = currentAttendanceState?.state || (activeSession ? 'APPROVED' : pendingRequest ? 'PENDING' : 'NO_ACTIVE_REQUEST');

  const todayHours = Math.floor((stats?.todayMinutes || 0) / 60);
  const todayMins = (stats?.todayMinutes || 0) % 60;

  const monthlyHours = Math.floor((stats?.monthlyTotalMinutes || 0) / 60);
  const monthlyMins = (stats?.monthlyTotalMinutes || 0) % 60;

  const activeNotifications: any[] = (data?.activeNotifications || []).filter((notif: any) => {
    if (notif.status && notif.status !== 'ACTIVE') return false;
    if (notif.expiresAt && new Date(notif.expiresAt) <= new Date()) return false;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* WELCOME BANNER & LIBRARY STATUS */}
      <div
        className="card"
        style={{
          backgroundColor: '#FFFFFF',
          borderColor: '#E2E8F0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          padding: '24px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span style={{ fontSize: '13px', fontWeight: 800, color: '#4F46E5', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              🏛️ {library?.name || user?.libraryName || 'Study Centre'}
            </span>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '6px',
                backgroundColor: library?.status === 'OPEN' ? '#DCFCE7' : '#FEE2E2',
                color: library?.status === 'OPEN' ? '#15803D' : '#991B1B',
              }}
            >
              {library?.status || 'OPEN'}
            </span>
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#0F172A' }}>
            Welcome back, {student?.fullName || user?.fullName}! 👋
          </h1>
          <p style={{ fontSize: '14px', color: '#64748B', marginTop: '4px' }}>
            Membership Expire: <strong style={{ color: '#0F172A' }}>{student?.membershipExpiresAt ? new Date(student.membershipExpiresAt).toLocaleDateString() : 'N/A'}</strong>
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {attendanceState === 'PENDING' ? (
            <button className="btn btn-secondary" disabled style={{ padding: '12px 20px', fontSize: '15px', opacity: 0.6, cursor: 'not-allowed' }}>
              <Clock size={18} /> Pending Approval...
            </button>
          ) : (
            <Link to="/student/qr-scanner" className="btn btn-primary" style={{ padding: '12px 20px', fontSize: '15px' }}>
              <QrCode size={18} /> {attendanceState === 'APPROVED' ? 'Scan Check-Out QR' : 'Scan Attendance QR'}
            </Link>
          )}
        </div>
      </div>

      {/* ACTIVE NOTIFICATION BANNERS */}
      {activeNotifications.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {activeNotifications.map((notif: any) => (
            <div
              key={notif._id}
              style={{
                backgroundColor: '#EFF6FF',
                border: '1px solid #BFDBFE',
                borderRadius: '12px',
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
              }}
            >
              <Bell size={20} style={{ color: '#2563EB', marginTop: '2px', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#1E40AF' }}>{notif.title}</div>
                {notif.body && <div style={{ fontSize: '13px', color: '#1E3A8A', marginTop: '2px' }}>{notif.body}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* REJECTION STRIKES WARNING BANNER IF ANY */}
      {(student?.rejectionCount || 0) > 0 && (
        <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', padding: '16px', borderRadius: '12px', color: '#991B1B', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <AlertTriangle size={24} style={{ color: '#DC2626' }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: '15px' }}>Payment Rejection Notice ({student.rejectionCount}/3 Strikes)</div>
            <div style={{ fontSize: '13px', color: '#7F1D1D' }}>
              Your previous payment proof was rejected. 3 consecutive rejections will deactivate your account and release your seat.
            </div>
          </div>
        </div>
      )}

      {/* CURRENT ATTENDANCE STATE */}
      <div
        className="card"
        style={{
          borderLeft:
            attendanceState === 'APPROVED'
              ? '4px solid #059669'
              : attendanceState === 'PENDING'
              ? '4px solid #D97706'
              : attendanceState === 'REJECTED'
              ? '4px solid #DC2626'
              : '4px solid #64748B',
          backgroundColor: '#FFFFFF',
          padding: '20px',
        }}
      >
        <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
          Current Attendance State
        </div>
        {attendanceState === 'PENDING' ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={20} style={{ color: '#D97706' }} />
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#D97706' }}>PENDING APPROVAL</span>
              <span style={{ fontSize: '13px', color: '#64748B', marginLeft: '8px' }}>
                Scan timestamp: {pendingRequest?.scanTimestamp ? new Date(pendingRequest.scanTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}. Awaiting Local Admin approval.
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button onClick={fetchDashboardData} className="btn btn-secondary" style={{ fontSize: '13px', padding: '8px 14px' }}>
                <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh Status
              </button>
              <button className="btn btn-primary" disabled style={{ fontSize: '13px', opacity: 0.5, cursor: 'not-allowed' }}>
                Scan Disabled
              </button>
            </div>
          </div>
        ) : attendanceState === 'APPROVED' ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={20} style={{ color: '#059669' }} />
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#059669' }}>CHECKED IN</span>
              <span style={{ fontSize: '13px', color: '#64748B', marginLeft: '8px' }}>
                Since {activeSession?.checkInAt ? new Date(activeSession.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button onClick={fetchDashboardData} className="btn btn-secondary" style={{ fontSize: '13px', padding: '8px 14px' }}>
                <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
              </button>
              <Link to="/student/qr-scanner" className="btn btn-secondary" style={{ fontSize: '13px' }}>
                Check Out via QR
              </Link>
            </div>
          </div>
        ) : attendanceState === 'REJECTED' ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <XCircle size={20} style={{ color: '#DC2626' }} />
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#DC2626' }}>CHECK-IN REJECTED</span>
              <span style={{ fontSize: '13px', color: '#B91C1C', marginLeft: '8px' }}>
                Reason: "{rejectedRequest?.rejectionReason || currentAttendanceState?.rejectionReason || 'Rejected by Admin'}". You can scan the QR code again.
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button onClick={fetchDashboardData} className="btn btn-secondary" style={{ fontSize: '13px', padding: '8px 14px' }}>
                <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh Status
              </button>
              <Link to="/student/qr-scanner" className="btn btn-primary" style={{ fontSize: '13px' }}>
                Scan QR Code Again
              </Link>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <XCircle size={20} style={{ color: '#64748B' }} />
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#64748B' }}>CHECKED OUT</span>
              <span style={{ fontSize: '13px', color: '#64748B', marginLeft: '8px' }}>
                {lastSession?.isAutoCheckedOut
                  ? '⚡ Auto checked-out at midnight. Scan QR code to check in again.'
                  : 'Scan QR code at entry desk to check in'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button onClick={fetchDashboardData} className="btn btn-secondary" style={{ fontSize: '13px', padding: '8px 14px' }}>
                <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh Status
              </button>
              <Link to="/student/qr-scanner" className="btn btn-primary" style={{ fontSize: '13px' }}>
                Check In via QR
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* STUDY STATS GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <Clock size={22} style={{ color: '#4F46E5' }} />
            <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 600 }}>Today's Time</span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A' }}>
            {todayHours}h {todayMins}m
          </div>
          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>Tracked attendance today</div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <Clock size={22} style={{ color: '#0284C7' }} />
            <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 600 }}>This Month</span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A' }}>
            {monthlyHours}h {monthlyMins}m
          </div>
          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>Total monthly study time</div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <Armchair size={22} style={{ color: '#059669' }} />
            <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 600 }}>Assigned Seat</span>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A' }}>
            {student?.currentSeat?.seatNumber ? `Seat ${student.currentSeat.seatNumber}` : 'No Seat Assigned'}
          </div>
          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
            {student?.currentSeat?.floor ? `Floor ${student.currentSeat.floor}` : 'Select a seat from menu'}
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <Lock size={22} style={{ color: '#D97706' }} />
            <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 600 }}>Assigned Locker</span>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A' }}>
            {student?.currentLocker?.lockerNumber ? `Locker ${student.currentLocker.lockerNumber}` : 'No Locker Assigned'}
          </div>
          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
            {student?.currentLocker?.floor ? `Floor ${student.currentLocker.floor}` : 'Select a locker from menu'}
          </div>
        </div>
      </div>

      {/* QUICK SHORTCUTS */}
      <div className="card">
        <h3 style={{ fontSize: '18px', marginBottom: '16px', color: '#0F172A' }}>Quick Workspaces</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          <Link to="/student/seats" className="btn btn-secondary" style={{ padding: '16px', flexDirection: 'column', gap: '8px' }}>
            <Armchair size={24} style={{ color: '#059669' }} />
            <span>Reserve Seat</span>
          </Link>
          <Link to="/student/lockers" className="btn btn-secondary" style={{ padding: '16px', flexDirection: 'column', gap: '8px' }}>
            <Lock size={24} style={{ color: '#0284C7' }} />
            <span>Reserve Locker</span>
          </Link>
          <Link to="/student/payments" className="btn btn-secondary" style={{ padding: '16px', flexDirection: 'column', gap: '8px' }}>
            <CreditCard size={24} style={{ color: '#4F46E5' }} />
            <span>Renew Plan</span>
          </Link>
          <Link to="/student/referral" className="btn btn-secondary" style={{ padding: '16px', flexDirection: 'column', gap: '8px' }}>
            <Gift size={24} style={{ color: '#D97706' }} />
            <span>Refer & Earn</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
