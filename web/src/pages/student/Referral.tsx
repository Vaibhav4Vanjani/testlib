import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api.client';
import { Copy, Check, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';

export const StudentReferral: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchReferrals = async () => {
    setLoading(true);
    try {
      const res = await apiRequest('/students/referrals');
      if (res.success) {
        setData(res.data);
      } else {
        setErrorMsg(res.error?.message || 'Referral feature disabled');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to load referrals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReferrals();
  }, []);

  const handleCopy = () => {
    if (data?.referralCode) {
      navigator.clipboard.writeText(data.referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', color: '#64748B' }}>
        Loading referral rewards...
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center' }}>
        <ShieldAlert size={56} style={{ color: '#DC2626', marginBottom: '16px' }} />
        <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', marginBottom: '8px' }}>Referral System Disabled</h2>
        <p style={{ fontSize: '14px', color: '#64748B', maxWidth: '400px', marginBottom: '24px' }}>{errorMsg}</p>
        <Link to="/student/dashboard" className="btn btn-primary">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const referralCode = data?.referralCode || 'N/A';
  const referralCount = data?.referralCount || 0;
  const totalRewardEarned = data?.totalRewardEarned || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A' }}>Invite Friends & Earn Rewards</h1>
        <p style={{ fontSize: '14px', color: '#64748B' }}>Share your unique referral code with fellow students to earn instant discounts</p>
      </div>

      {/* CODE CARD */}
      <div className="card" style={{ backgroundColor: '#EEF2FF', borderColor: '#C7D2FE', textAlign: 'center', padding: '32px' }}>
        <div style={{ fontSize: '12px', fontWeight: 800, color: '#4338CA', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
          YOUR REFERRAL CODE
        </div>
        <div style={{ fontSize: '32px', fontWeight: 900, color: '#1E1B4B', letterSpacing: '2px', margin: '8px 0' }}>{referralCode}</div>
        <button className="btn btn-primary" style={{ backgroundColor: '#4F46E5', margin: '12px auto 0' }} onClick={handleCopy}>
          {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copied to Clipboard!' : 'Copy Code'}
        </button>
      </div>

      {/* STATS ROW */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div className="card">
          <div style={{ fontSize: '13px', color: '#64748B', fontWeight: 600 }}>Friends Referred</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#0F172A', marginTop: '4px' }}>{referralCount}</div>
        </div>
        <div className="card">
          <div style={{ fontSize: '13px', color: '#64748B', fontWeight: 600 }}>Total Rewards Earned</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#059669', marginTop: '4px' }}>₹{totalRewardEarned}</div>
        </div>
      </div>

      {/* REFERRED FRIENDS LIST
      <div className="card">
        <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginBottom: '16px' }}>Referred Students</h3>

        {referrals.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>
            You haven't referred any students yet. Share your code to get started!
          </div>
        ) : (
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>Joined Date</th>
                  <th>Status</th>
                  <th>Reward</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((ref: any, idx: number) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 600, color: '#0F172A' }}>{ref.fullName || ref.name}</td>
                    <td>{new Date(ref.createdAt || ref.joinedAt).toLocaleDateString()}</td>
                    <td>
                      <span className="badge badge-success">ACTIVE</span>
                    </td>
                    <td style={{ fontWeight: 700, color: '#059669' }}>₹{ref.rewardAmount || 100}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div> */}
    </div>
  );
};
