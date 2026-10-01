import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api.client';
import { UserCheck, CheckCircle2, AlertCircle, RefreshCw, Clock, LogOut } from 'lucide-react';

export const StudentQRScanner: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [currentSessionState, setCurrentSessionState] = useState<any>(null);
  const [resultMsg, setResultMsg] = useState<{ success: boolean; text: string } | null>(null);

  const checkCurrentSession = async () => {
    setSessionLoading(true);
    try {
      const res = await apiRequest('/attendance/current-session');
      if (res.success && res.data) {
        setCurrentSessionState(res.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSessionLoading(false);
    }
  };

  useEffect(() => {
    checkCurrentSession();
  }, []);

  const isPending = currentSessionState?.state === 'PENDING';
  const isApproved = currentSessionState?.state === 'APPROVED';
  const isRejected = currentSessionState?.state === 'REJECTED';
  const pendingRequest = currentSessionState?.pendingRequest;
  const activeSession = currentSessionState?.activeSession;
  const rejectedRequest = currentSessionState?.rejectedRequest;

  const handleMarkAttendance = async () => {
    if (isPending) {
      alert('Your attendance request is already pending approval from Local Admin.');
      return;
    }

    setLoading(true);
    setResultMsg(null);

    try {
      const res = await apiRequest('/attendance/scan-qr', 'POST', {});

      if (res.success) {
        const isPendingResult = res.data?.action === 'PENDING_APPROVAL' || res.data?.action === 'REQUEST_SUBMITTED';
        setResultMsg({
          success: true,
          text: res.message || (isPendingResult ? 'Attendance check-in request sent! Awaiting Local Admin approval.' : 'Attendance updated successfully!'),
        });
        await checkCurrentSession();
      } else {
        setResultMsg({ success: false, text: res.error?.message || 'Attendance request failed' });
      }
    } catch (err: any) {
      setResultMsg({ success: false, text: err.message || 'Failed to submit attendance' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '600px', margin: '0 auto' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A' }}>Attendance Check-In Desk</h1>
        <p style={{ fontSize: '14px', color: '#64748B' }}>
          Mark your daily library check-in or check-out at entry desk
        </p>
      </div>

      <div className="card" style={{ padding: '32px', textAlign: 'center' }}>
        <div
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '20px',
            backgroundColor: isPending ? '#FEF3C7' : isApproved ? '#DCFCE7' : '#EEF2FF',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isPending ? '#D97706' : isApproved ? '#16A34A' : '#4F46E5',
            marginBottom: '20px',
          }}
        >
          {isPending ? <Clock size={44} /> : isApproved ? <CheckCircle2 size={44} /> : <UserCheck size={44} />}
        </div>

        {/* PENDING APPROVAL STATE CARD */}
        {isPending && (
          <div
            style={{
              backgroundColor: '#FEF3C7',
              border: '1px solid #FDE68A',
              color: '#B45309',
              padding: '20px',
              borderRadius: '12px',
              marginBottom: '24px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: '16px', marginBottom: '6px' }}>⏳ Attendance Check-In Request Pending Approval</div>
            <div style={{ fontSize: '13px', color: '#92400E', marginBottom: '16px', lineHeight: '1.5' }}>
              Your attendance check-in request has been sent to Local Admin and is currently awaiting approval at the entry desk. You cannot submit another request until approved or rejected.
            </div>

            {pendingRequest && (
              <div style={{ fontSize: '12px', color: '#78350F', marginBottom: '16px', backgroundColor: '#FFFBEB', padding: '10px', borderRadius: '8px', border: '1px solid #FCD34D' }}>
                Request Time: <strong>{new Date(pendingRequest.scanTimestamp || pendingRequest.createdAt).toLocaleTimeString()}</strong>
              </div>
            )}

            <button
              onClick={checkCurrentSession}
              className="btn btn-secondary"
              style={{ fontSize: '13px', padding: '8px 18px', backgroundColor: '#FFFFFF' }}
              disabled={sessionLoading}
            >
              <RefreshCw size={14} className={sessionLoading ? 'spin' : ''} style={{ marginRight: '6px' }} />
              Refresh Status
            </button>
          </div>
        )}

        {/* APPROVED / ACTIVE SESSION STATE CARD */}
        {isApproved && (
          <div
            style={{
              backgroundColor: '#F0FDF4',
              border: '1px solid #BBF7D0',
              color: '#15803D',
              padding: '20px',
              borderRadius: '12px',
              marginBottom: '24px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: '16px', marginBottom: '6px' }}>🟢 Checked-In (Active Session)</div>
            <div style={{ fontSize: '13px', color: '#166534', marginBottom: '12px' }}>
              Checked in at: <strong>{activeSession?.checkInAt ? new Date(activeSession.checkInAt).toLocaleTimeString() : 'N/A'}</strong>
            </div>

            <button
              onClick={checkCurrentSession}
              className="btn btn-secondary"
              style={{ fontSize: '13px', padding: '6px 14px', backgroundColor: '#FFFFFF' }}
              disabled={sessionLoading}
            >
              <RefreshCw size={14} className={sessionLoading ? 'spin' : ''} style={{ marginRight: '6px' }} />
              Refresh Status
            </button>
          </div>
        )}

        {/* REJECTED STATE ALERT */}
        {isRejected && !resultMsg && (
          <div
            style={{
              backgroundColor: '#FEF2F2',
              border: '1px solid #FCA5A5',
              color: '#B91C1C',
              padding: '16px',
              borderRadius: '12px',
              marginBottom: '24px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: '15px', marginBottom: '4px' }}>❌ Attendance Request Rejected</div>
            <div style={{ fontSize: '13px', color: '#991B1B', marginBottom: '12px' }}>
              Reason: "{rejectedRequest?.rejectionReason || 'Rejected by Local Admin'}"
            </div>
          </div>
        )}

        {/* RESULT MESSAGE BANNER */}
        {resultMsg && (
          <div
            style={{
              backgroundColor: resultMsg.success ? '#ECFDF5' : '#FEF2F2',
              border: `1px solid ${resultMsg.success ? '#A7F3D0' : '#FCA5A5'}`,
              color: resultMsg.success ? '#047857' : '#B91C1C',
              padding: '14px',
              borderRadius: '10px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              fontWeight: 600,
            }}
          >
            {resultMsg.success ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            {resultMsg.text}
          </div>
        )}

        {/* MAIN ATTENDANCE ACTION BUTTON */}
        <div style={{ marginTop: '12px' }}>
          <button
            type="button"
            className={`btn ${isApproved ? 'btn-danger' : 'btn-primary'}`}
            style={{ width: '100%', padding: '16px', fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            onClick={handleMarkAttendance}
            disabled={isPending || loading}
          >
            {loading ? (
              <>
                <RefreshCw size={20} className="spin" /> Processing Request...
              </>
            ) : isPending ? (
              <>
                <Clock size={20} /> Pending Local Admin Approval
              </>
            ) : isApproved ? (
              <>
                <LogOut size={20} /> Check-Out / Mark Exit
              </>
            ) : (
              <>
                <UserCheck size={20} /> Check-In / Mark Attendance
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

