import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../services/api.client';
import { useAuthStore } from '../../store/authStore';
import { Modal } from '../../components/UI/Modal';
import { LogIn, ArrowRight, Eye, EyeOff } from 'lucide-react';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [phone, setPhone] = useState('7777777777');
  const [password, setPassword] = useState('Password123');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [availableLibraries, setAvailableLibraries] = useState<any[]>([]);
  const [libraryModalOpen, setLibraryModalOpen] = useState(false);

  const handleLogin = async (selectedLibId?: string) => {
    if (!phone || !password) {
      setErrorMessage('Please enter both phone number and password');
      return;
    }

    setErrorMessage('');
    setLoading(true);

    try {
      const res = await apiRequest('/auth/login', 'POST', {
        phone,
        password,
        selectedLibraryId: selectedLibId,
      });

      if (res.success && res.data) {
        if (res.data.requiresLibrarySelection) {
          setAvailableLibraries(res.data.availableLibraries || []);
          setLibraryModalOpen(true);
          setLoading(false);
          return;
        }

        setLibraryModalOpen(false);
        const { user, accessToken, refreshToken } = res.data;
        setAuth(user, accessToken, refreshToken, res.data.availableLibraries || []);

        if (user.role === 'STUDENT') {
          navigate('/student/dashboard');
        } else if (user.role === 'SUPER_ADMIN') {
          navigate('/super-admin/libraries');
        } else {
          navigate('/admin/dashboard');
        }
      } else {
        setErrorMessage(res.error?.message || 'Invalid credentials');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (demoPhone: string, demoRoleLabel: string) => {
    setPhone(demoPhone);
    setPassword('Password123');
    setErrorMessage(`Selected ${demoRoleLabel} credentials. Click Sign In.`);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#F8FAFC',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div className="card" style={{ width: '100%', maxWidth: '440px', padding: '36px', border: '1px solid #E2E8F0', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              backgroundColor: '#4F46E5',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              fontWeight: 800,
              color: '#FFF',
              marginBottom: '12px',
              boxShadow: '0 8px 20px rgba(79, 70, 229, 0.25)',
            }}
          >
            N
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#1E1B4B' }}>NextLib</h1>
          <p style={{ fontSize: '14px', color: '#64748B', marginTop: '4px' }}>
            Study Centre & Reading Room ERP Platform
          </p>
        </div>

        {errorMessage && (
          <div
            style={{
              backgroundColor: errorMessage.includes('Selected') ? '#EEF2FF' : '#FEF2F2',
              border: `1px solid ${errorMessage.includes('Selected') ? '#C7D2FE' : '#FCA5A5'}`,
              color: errorMessage.includes('Selected') ? '#3730A3' : '#991B1B',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '13px',
              marginBottom: '20px',
              textAlign: 'center',
              fontWeight: 500,
            }}
          >
            {errorMessage}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleLogin();
          }}
        >
          <div className="form-group">
            <label className="form-label">Phone Number or Email</label>
            <input
              type="text"
              className="form-input"
              placeholder="Enter registered phone or email"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label className="form-label">Password</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                style={{ paddingRight: '42px' }}
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#64748B',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px',
                }}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px', fontSize: '15px' }}
            disabled={loading}
          >
            {loading ? (
              'Signing In...'
            ) : (
              <>
                <LogIn size={18} /> Sign In
              </>
            )}
          </button>
        </form>

        {/* DEMO ACCELERATORS */}
        <div style={{ marginTop: '28px', paddingTop: '20px', borderTop: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', marginBottom: '10px' }}>
            ⚡ Fast Demo Login Presets:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              className="btn btn-secondary"
              style={{ justifyContent: 'space-between', fontSize: '12px', padding: '10px 14px' }}
              onClick={() => fillDemo('7777777777', 'Student')}
            >
              <span>👨‍🎓 Student (7777777777)</span>
              <ArrowRight size={14} />
            </button>
            <button
              className="btn btn-secondary"
              style={{ justifyContent: 'space-between', fontSize: '12px', padding: '10px 14px' }}
              onClick={() => fillDemo('8888888888', 'Local Admin')}
            >
              <span>👔 Local Admin (8888888888)</span>
              <ArrowRight size={14} />
            </button>
            <button
              className="btn btn-secondary"
              style={{ justifyContent: 'space-between', fontSize: '12px', padding: '10px 14px' }}
              onClick={() => fillDemo('9999999999', 'Super Admin')}
            >
              <span>🔑 Super Admin (9999999999)</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* MULTI-LIBRARY SELECTION MODAL */}
      <Modal isOpen={libraryModalOpen} onClose={() => setLibraryModalOpen(false)} title="Select Active Library">
        <p style={{ fontSize: '14px', color: '#64748B', marginBottom: '16px' }}>
          Your account belongs to multiple libraries. Please select which library profile to log into:
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {availableLibraries.map((lib) => (
            <button
              key={lib.libraryId}
              onClick={() => handleLogin(lib.libraryId)}
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #4F46E5',
                borderRadius: '12px',
                padding: '14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>🏛️ {lib.libraryName}</div>
                <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                  {lib.city ? `📍 ${lib.city} • ` : ''}Code: {lib.code}
                </div>
              </div>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#059669', backgroundColor: '#ECFDF5', padding: '4px 10px', borderRadius: '6px' }}>
                Select ➔
              </span>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
};
