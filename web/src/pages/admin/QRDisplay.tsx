import React, { useState, useEffect, useRef, useCallback } from 'react';
import QRCode from 'qrcode';
import { apiRequest } from '../../services/api.client';
import { useAuthStore } from '../../store/authStore';
import { RefreshCw, Monitor, ShieldCheck, AlertCircle } from 'lucide-react';

export const AdminQRDisplay: React.FC = () => {
  const { user } = useAuthStore();
  const [qrToken, setQrToken] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const fetchQRCodeToken = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await apiRequest('/admin/qr-code');
      if (res.success && res.data) {
        // res.data contains { libraryId, timestamp, nonce, expiry, signature }
        const payloadString = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
        setQrToken(payloadString);
      } else {
        setErrorMsg(res.error?.message || 'Failed to generate QR code payload');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Unable to connect to server for QR generation');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQRCodeToken();
    // Auto refresh QR code payload every 12 hours (same as mobile)
    const timer = setInterval(fetchQRCodeToken, 12 * 60 * 60 * 1000);
    return () => clearInterval(timer);
  }, [fetchQRCodeToken]);

  useEffect(() => {
    if (canvasRef.current && qrToken) {
      QRCode.toCanvas(canvasRef.current, qrToken, {
        width: 320,
        margin: 2,
        color: {
          dark: '#0F172A',
          light: '#FFFFFF',
        },
      });
    }
  }, [qrToken]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '75vh', padding: '20px' }}>
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '520px',
          textAlign: 'center',
          padding: '36px 24px',
          border: '2px solid #2563EB',
          boxShadow: '0 12px 32px rgba(37, 99, 235, 0.12)',
        }}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', backgroundColor: '#EFF6FF', padding: '6px 14px', borderRadius: '20px', color: '#1D4ED8', marginBottom: '16px', fontSize: '13px', fontWeight: 700 }}>
          <Monitor size={16} /> Library Desk Kiosk Display
        </div>

        <h2 style={{ fontSize: '26px', fontWeight: 800, color: '#0F172A', marginBottom: '4px' }}>
          {user?.libraryName || 'NextLib Study Centre'}
        </h2>
        <p style={{ fontSize: '14px', color: '#64748B', marginBottom: '24px' }}>
          Students scan this QR Code using NextLib Mobile App to Check-In & Check-Out
        </p>

        <div style={{ backgroundColor: '#FFFFFF', padding: '16px', borderRadius: '16px', display: 'inline-block', marginBottom: '20px', border: '1px solid #E2E8F0', minWidth: '320px', minHeight: '320px' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '320px', color: '#2563EB', fontWeight: 700 }}>
              <RefreshCw size={28} className="spin" style={{ marginBottom: '12px' }} />
              Generating Secure QR Code...
            </div>
          ) : errorMsg ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '320px', color: '#DC2626', gap: '10px', padding: '16px' }}>
              <AlertCircle size={32} />
              <div style={{ fontSize: '14px', fontWeight: 700 }}>{errorMsg}</div>
              <button className="btn btn-primary" style={{ marginTop: '8px', fontSize: '13px' }} onClick={fetchQRCodeToken}>
                Retry Generation
              </button>
            </div>
          ) : (
            <canvas ref={canvasRef} />
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#15803D', fontWeight: 700, backgroundColor: '#F0FDF4', padding: '6px 12px', borderRadius: '8px', border: '1px solid #BBF7D0' }}>
            <ShieldCheck size={16} /> Secured • Valid for 1 Day
          </div>

          <button className="btn btn-secondary" style={{ fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={fetchQRCodeToken} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh QR Code
          </button>
        </div>
      </div>
    </div>
  );
};
