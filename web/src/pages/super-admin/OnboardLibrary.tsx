import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../services/api.client';
import { PlusCircle, CheckCircle2, RefreshCw, Copy, Calendar, CreditCard } from 'lucide-react';
import { Modal } from '../../components/UI/Modal';

export const SuperAdminOnboardLibrary: React.FC = () => {
  const navigate = useNavigate();

  // Library details
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  // Admin details
  const [adminName, setAdminName] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [adminPassword, setAdminPassword] = useState('123456');

  // SaaS Billing Plan
  const [saasPlanType, setSaasPlanType] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [saasAmount, setSaasAmount] = useState('1200');

  const [loadingNextCode, setLoadingNextCode] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Success Modal & Credentials
  const [onboardedResult, setOnboardedResult] = useState<any | null>(null);
  const [copiedState, setCopiedState] = useState<string | null>(null);

  const fetchNextCode = async (customPrefix = '') => {
    setLoadingNextCode(true);
    try {
      const targetPrefix = customPrefix || code.trim() || 'LIB';
      const res = await apiRequest(`/super-admin/next-code?prefix=${encodeURIComponent(targetPrefix)}`);
      if (res.success && res.data?.nextCode) {
        setCode(res.data.nextCode);
      }
    } catch (e) {
      console.error('Failed to fetch next library code:', e);
    } finally {
      setLoadingNextCode(false);
    }
  };

  useEffect(() => {
    fetchNextCode('LIB');
  }, []);

  const copyToClipboard = (text: string, label: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedState(label);
      setTimeout(() => setCopiedState(null), 2500);
    } catch (e) {
      console.error('Copy failed:', e);
    }
  };

  const handleOnboard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !adminName.trim() || !adminPhone.trim()) {
      alert('Please fill in Library Name, Admin Name, and Admin Phone.');
      return;
    }

    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(adminPhone.trim())) {
      alert('Please enter a valid 10-digit Admin Phone Number.');
      return;
    }

    if (contactPhone.trim() && !phoneRegex.test(contactPhone.trim())) {
      alert('Please enter a valid 10-digit Library Contact Phone Number.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiRequest('/super-admin/libraries', 'POST', {
        name: name.trim(),
        code: code.trim() ? code.trim().toUpperCase() : undefined,
        address: address.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        adminName: adminName.trim(),
        adminPhone: adminPhone.trim(),
        adminPassword: adminPassword.trim() || undefined,
        saasPlanType,
        saasAmount: parseFloat(saasAmount) || (saasPlanType === 'YEARLY' ? 12000 : 1200),
      });

      if (res.success && res.data) {
        const creds = res.data.credentials;
        if (creds) {
          setOnboardedResult({
            libraryName: creds.libraryName,
            libraryCode: creds.libraryCode,
            address: creds.address,
            contactPhone: creds.contactPhone,
            adminName: creds.adminName,
            phone: creds.phone,
            email: creds.email,
            password: creds.password,
          });
        } else {
          alert(`Library '${name}' onboarded successfully! 🎉`);
          navigate('/super-admin/libraries');
        }

        setName('');
        setCode('');
        setAddress('');
        setContactPhone('');
        setAdminName('');
        setAdminPhone('');
        setAdminPassword('123456');
        setSaasPlanType('MONTHLY');
        setSaasAmount('1200');
        fetchNextCode('LIB');
      } else {
        alert(res.error?.message || 'Failed to onboard library.');
      }
    } catch (err: any) {
      alert(err.message || 'An unexpected error occurred during onboarding.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '850px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A' }}>Onboard New Study Library</h1>
        <p style={{ fontSize: '14px', color: '#64748B' }}>Provision new library tenant, seat capacity & setup Local Admin account</p>
      </div>

      <form onSubmit={handleOnboard} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* SECTION 1: LIBRARY DETAILS */}
        <div className="card">
          <h3 style={{ fontSize: '18px', color: '#D97706', marginBottom: '16px', fontWeight: 800 }}>
            1. Library Organization Info
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Library Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Apex Study Centre & Reading Room"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Unique Library Code *</label>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: '11px', padding: '2px 8px' }}
                  onClick={() => fetchNextCode('LIB')}
                  disabled={loadingNextCode}
                >
                  <RefreshCw size={12} className={loadingNextCode ? 'spin' : ''} /> Auto Code
                </button>
              </div>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. LIB001"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                required
                disabled
              />
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Complete Address</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. 2nd Floor, Apex Complex, Main Market, New Delhi"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Library Contact Phone (Public)</label>
              <input
                type="text"
                className="form-input"
                placeholder="10-digit contact number"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                maxLength={10}
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: LOCAL ADMIN ACCOUNT */}
        <div className="card">
          <h3 style={{ fontSize: '18px', color: '#4F46E5', marginBottom: '16px', fontWeight: 800 }}>
            2. Primary Local Admin Account
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Local Admin Full Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Vikram Singh"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Local Admin Phone Number *</label>
              <input
                type="text"
                className="form-input"
                placeholder="10-digit mobile number"
                value={adminPhone}
                onChange={(e) => setAdminPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                maxLength={10}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Initial Admin Password *</label>
              <input
                type="text"
                className="form-input"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                required
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: SAAS SUBSCRIPTION PLAN */}
        <div className="card">
          <h3 style={{ fontSize: '18px', color: '#059669', marginBottom: '16px', fontWeight: 800 }}>
            3. SaaS Subscription Plan & Billing
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Subscription Plan Type *</label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  className={`btn ${saasPlanType === 'MONTHLY' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, padding: '12px' }}
                  onClick={() => {
                    setSaasPlanType('MONTHLY');
                    if (!saasAmount || saasAmount === '12000') setSaasAmount('1200');
                  }}
                >
                  <Calendar size={16} /> Monthly Plan
                </button>
                <button
                  type="button"
                  className={`btn ${saasPlanType === 'YEARLY' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, padding: '12px' }}
                  onClick={() => {
                    setSaasPlanType('YEARLY');
                    if (!saasAmount || saasAmount === '1200') setSaasAmount('12000');
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
                value={saasAmount}
                onChange={(e) => setSaasAmount(e.target.value)}
                placeholder="e.g. 1200"
                min={0}
                required
              />
            </div>
          </div>
        </div>

        {/* SUBMIT BUTTON */}
        <button
          type="submit"
          className="btn btn-primary"
          style={{ backgroundColor: '#D97706', padding: '14px 24px', fontSize: '16px', alignSelf: 'flex-start', fontWeight: 800 }}
          disabled={submitting}
        >
          {submitting ? 'Provisioning Library...' : <><PlusCircle size={18} /> Provision & Create Library Tenant</>}
        </button>
      </form>

      {/* CREDENTIALS SUCCESS MODAL */}
      {onboardedResult && (
        <Modal isOpen={!!onboardedResult} onClose={() => navigate('/super-admin/libraries')} title="🎉 Library Onboarded Successfully!">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ textAlign: 'center', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', padding: '16px', borderRadius: '12px' }}>
              <CheckCircle2 size={44} style={{ color: '#16A34A', marginBottom: '8px' }} />
              <h3 style={{ fontSize: '20px', color: '#0F172A', fontWeight: 800 }}>{onboardedResult.libraryName} Created</h3>
              <p style={{ fontSize: '13px', color: '#64748B', marginTop: '2px' }}>Code: {onboardedResult.libraryCode}</p>
            </div>

            <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#4F46E5', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                🔑 Local Admin Login Credentials
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 700, display: 'block' }}>LOCAL ADMIN NAME</span>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A' }}>{onboardedResult.adminName}</span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F1F5F9', paddingTop: '8px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 700, display: 'block' }}>PHONE (LOGIN ID)</span>
                  <span style={{ fontSize: '15px', fontWeight: 800, color: '#D97706' }}>{onboardedResult.phone}</span>
                </div>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: '11px', padding: '4px 8px' }}
                  onClick={() => copyToClipboard(onboardedResult.phone, 'PHONE')}
                >
                  <Copy size={12} /> {copiedState === 'PHONE' ? 'Copied!' : 'Copy'}
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F1F5F9', paddingTop: '8px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 700, display: 'block' }}>EMAIL</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>{onboardedResult.email}</span>
                </div>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: '11px', padding: '4px 8px' }}
                  onClick={() => copyToClipboard(onboardedResult.email, 'EMAIL')}
                >
                  <Copy size={12} /> {copiedState === 'EMAIL' ? 'Copied!' : 'Copy'}
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F1F5F9', paddingTop: '8px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 700, display: 'block' }}>INITIAL PASSWORD</span>
                  <span style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>{onboardedResult.password}</span>
                </div>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: '11px', padding: '4px 8px' }}
                  onClick={() => copyToClipboard(onboardedResult.password, 'PASSWORD')}
                >
                  <Copy size={12} /> {copiedState === 'PASSWORD' ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            <button
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', fontSize: '14px', fontWeight: 800 }}
              onClick={() => {
                const allText = `NextLib Library Onboarded: ${onboardedResult.libraryName} (${onboardedResult.libraryCode})\nAdmin: ${onboardedResult.adminName}\nPhone: ${onboardedResult.phone}\nEmail: ${onboardedResult.email}\nPassword: ${onboardedResult.password}`;
                copyToClipboard(allText, 'ALL');
              }}
            >
              <Copy size={16} /> {copiedState === 'ALL' ? 'All Credentials Copied!' : 'Copy All Credentials'}
            </button>

            <button
              className="btn btn-secondary"
              style={{ width: '100%', padding: '10px' }}
              onClick={() => navigate('/super-admin/libraries')}
            >
              Go to Library Directory
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};
