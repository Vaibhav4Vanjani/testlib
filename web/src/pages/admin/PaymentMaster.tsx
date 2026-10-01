import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api.client';
import { Save, Clock, Armchair, Lock, RefreshCw } from 'lucide-react';

const DEFAULT_LIBRARY_RATES = ['400', '400', '400', '400', '800', '800', '800', '800', '1200', '1200', '1200', '1200'];
const DEFAULT_SEAT_RATES = ['200', '200', '200', '200', '350', '350', '350', '350', '500', '500', '500', '500'];
const DEFAULT_LOCKER_RATES = ['100', '100', '100', '100', '150', '150', '150', '150', '200', '200', '200', '200'];

export const AdminPaymentMaster: React.FC = () => {
  const [libraryRates, setLibraryRates] = useState<string[]>(DEFAULT_LIBRARY_RATES);
  const [seatRates, setSeatRates] = useState<string[]>(DEFAULT_SEAT_RATES);
  const [lockerRates, setLockerRates] = useState<string[]>(DEFAULT_LOCKER_RATES);
  const [annualFee, setAnnualFee] = useState('12000');
  const [referralReward, setReferralReward] = useState('100');
  const [upiId, setUpiId] = useState('');
  const [activeTab, setActiveTab] = useState<'LIBRARY' | 'SEAT' | 'LOCKER'>('LIBRARY');

  const [featureFlags, setFeatureFlags] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchMasterData = async () => {
    setLoading(true);
    try {
      const res = await apiRequest('/admin/payment-master');
      if (res.success && res.data) {
        const pm = res.data;
        if (pm.featureFlags) {
          setFeatureFlags(pm.featureFlags);
        }
        if (Array.isArray(pm.libraryHourlyRates) && pm.libraryHourlyRates.length === 12) {
          setLibraryRates(pm.libraryHourlyRates.map(String));
        }
        if (Array.isArray(pm.seatHourlyRates) && pm.seatHourlyRates.length === 12) {
          setSeatRates(pm.seatHourlyRates.map(String));
        }
        if (Array.isArray(pm.lockerHourlyRates) && pm.lockerHourlyRates.length === 12) {
          setLockerRates(pm.lockerHourlyRates.map(String));
        }
        if (pm.annualFee) setAnnualFee(String(pm.annualFee));
        if (pm.referralRewardAmount) setReferralReward(String(pm.referralRewardAmount));
        if (pm.upiId) setUpiId(pm.upiId);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMasterData();
  }, []);

  const enableSeats = featureFlags?.enableReservedSeats !== false;
  const enableLockers = featureFlags?.enableLockers !== false;

  useEffect(() => {
    if (!enableSeats && activeTab === 'SEAT') {
      setActiveTab('LIBRARY');
    }
    if (!enableLockers && activeTab === 'LOCKER') {
      setActiveTab('LIBRARY');
    }
  }, [enableSeats, enableLockers, activeTab]);

  const handleRateChange = (rates: string[], setRates: React.Dispatch<React.SetStateAction<string[]>>, idx: number, val: string) => {
    const updated = [...rates];
    updated[idx] = val;
    setRates(updated);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload: any = {
        libraryHourlyRates: libraryRates.map((v) => parseFloat(v) || 0),
        annualFee: parseFloat(annualFee) || 0,
        referralRewardAmount: parseFloat(referralReward) || 0,
        upiId: upiId.trim(),
      };
      if (enableSeats) {
        payload.seatHourlyRates = seatRates.map((v) => parseFloat(v) || 0);
      }
      if (enableLockers) {
        payload.lockerHourlyRates = lockerRates.map((v) => parseFloat(v) || 0);
      }

      const res = await apiRequest('/admin/payment-master', 'PUT', payload);

      if (res.success) {
        alert('Fees saved successfully!');
        fetchMasterData();
      } else {
        alert(res.error?.message || 'Failed to save fees');
      }
    } catch (err: any) {
      alert(err.message || 'Error saving fees');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', color: '#64748B' }}>
        Loading payment master configuration...
      </div>
    );
  }

  const currentRates = activeTab === 'LIBRARY' ? libraryRates : activeTab === 'SEAT' ? seatRates : lockerRates;
  const currentSetter = activeTab === 'LIBRARY' ? setLibraryRates : activeTab === 'SEAT' ? setSeatRates : setLockerRates;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A' }}>Library Fee & Hourly Rate Master</h1>
          <p style={{ fontSize: '14px', color: '#64748B' }}>Configure 1-12 hour shift rates, annual fee, referral reward amount & UPI ID</p>
        </div>

        <button className="btn btn-primary" onClick={handleSave} disabled={submitting}>
          {submitting ? <RefreshCw size={16} className="spin" /> : <Save size={16} />} Save Pricing Master
        </button>
      </div>

      {/* CATEGORY SELECTOR TABS */}
      <div className="card" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <button
          className={activeTab === 'LIBRARY' ? 'btn btn-primary' : 'btn btn-secondary'}
          onClick={() => setActiveTab('LIBRARY')}
        >
          <Clock size={16} /> Base Library Hourly Rates
        </button>
        {enableSeats && (
          <button
            className={activeTab === 'SEAT' ? 'btn btn-primary' : 'btn btn-secondary'}
            onClick={() => setActiveTab('SEAT')}
          >
            <Armchair size={16} /> Seat Hourly Rates
          </button>
        )}
        {enableLockers && (
          <button
            className={activeTab === 'LOCKER' ? 'btn btn-primary' : 'btn btn-secondary'}
            onClick={() => setActiveTab('LOCKER')}
          >
            <Lock size={16} /> Locker Hourly Rates
          </button>
        )}
      </div>

      {/* 1-12 HOURS RATE GRID */}
      <div className="card">
        <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', marginBottom: '16px' }}>
          {activeTab === 'LIBRARY' ? 'Base Library Fees' : activeTab === 'SEAT' ? 'Reserved Seat Fees' : 'Storage Locker Fees'} (Student Fees for Sitting for 'X' Hours for a Month)
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '16px' }}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((hr) => (
            <div key={hr} className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">{hr} Hour(s) Shift Fee (₹)</label>
              <input
                type="number"
                className="form-input"
                value={currentRates[hr - 1] || ''}
                onChange={(e) => handleRateChange(currentRates, currentSetter, hr - 1, e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* GLOBAL MISC SETTINGS */}
      <div className="card">
        <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', marginBottom: '16px' }}>
          Additional Fee & UPI Settings
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <div className="form-group">
            <label className="form-label">Annual Membership Package Fee (₹)</label>
            <input type="number" className="form-input" value={annualFee} onChange={(e) => setAnnualFee(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">Referral Reward Discount (₹)</label>
            <input type="number" className="form-input" value={referralReward} onChange={(e) => setReferralReward(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">Official Library UPI ID</label>
            <input type="text" className="form-input" placeholder="e.g. library@upi" value={upiId} onChange={(e) => setUpiId(e.target.value)} />
          </div>
        </div>
      </div>
    </div>
  );
};
