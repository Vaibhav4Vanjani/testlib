import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../services/api.client';
import { RefreshCw, Armchair, Lock, Gift } from 'lucide-react';

export const SuperAdminFeatureFlags: React.FC = () => {
  const [libraries, setLibraries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingLibId, setUpdatingLibId] = useState<string | null>(null);

  const fetchLibraries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest('/super-admin/libraries/summary');
      if (res.success && res.data) {
        setLibraries(res.data || []);
      }
    } catch (e) {
      console.error('Failed to fetch libraries summary:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLibraries();
  }, [fetchLibraries]);

  const handleToggleFeature = async (lib: any, featureKey: string, newValue: boolean) => {
    try {
      setUpdatingLibId(lib.libraryId);
      const currentFlags = lib.featureFlags || {
        enableReservedSeats: true,
        enableLockers: true,
        enableReferrals: true,
      };

      const newFlags = {
        ...currentFlags,
        [featureKey]: newValue,
      };

      const res = await apiRequest(`/super-admin/libraries/${lib.libraryId}/features`, 'PATCH', {
        featureFlags: newFlags,
      });

      if (res.success) {
        fetchLibraries();
      } else {
        alert(res.error?.message || 'Failed to update feature flags');
      }
    } catch (err: any) {
      alert(err.message || 'Error updating feature flags');
    } finally {
      setUpdatingLibId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A' }}>Feature Visibility Management</h1>
          <p style={{ fontSize: '14px', color: '#64748B' }}>Enable or disable platform features dynamically per local library</p>
        </div>

        <button onClick={fetchLibraries} className="btn btn-secondary" style={{ padding: '10px 16px' }}>
          <RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
          <RefreshCw size={24} className="spin" style={{ marginBottom: '8px' }} />
          <div>Loading per-library feature flags...</div>
        </div>
      ) : libraries.length === 0 ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
          No libraries onboarded yet.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '20px' }}>
          {libraries.map((lib: any) => {
            const flags = lib.featureFlags || {
              enableReservedSeats: true,
              enableLockers: true,
              enableReferrals: true,
            };

            const isReservedSeatActive = flags.enableReservedSeats !== false;
            const isLockerActive = flags.enableLockers !== false;
            const isReferralActive = flags.enableReferrals !== false;
            const isUpdating = updatingLibId === lib.libraryId;

            return (
              <div key={lib.libraryId} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px' }}>
                <div style={{ borderBottom: '1px solid #E2E8F0', paddingBottom: '12px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>
                    🏛️ {lib.name} <span style={{ fontSize: '14px', color: '#64748B' }}>({lib.code})</span>
                  </h3>
                </div>

                {/* FEATURE 1: RESERVED SEATS */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Armchair size={16} style={{ color: '#059669' }} /> Reserved Seat Module
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                      Enable or disable seat reservation for this library
                    </div>
                  </div>

                  <button
                    className={`btn ${isReservedSeatActive ? 'btn-success' : 'btn-secondary'}`}
                    style={{ minWidth: '90px', padding: '6px 12px', fontSize: '12px', fontWeight: 800 }}
                    onClick={() => handleToggleFeature(lib, 'enableReservedSeats', !isReservedSeatActive)}
                    disabled={isUpdating}
                  >
                    {isReservedSeatActive ? 'ENABLED' : 'DISABLED'}
                  </button>
                </div>

                {/* FEATURE 2: LOCKERS */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Lock size={16} style={{ color: '#0284C7' }} /> Locker Management Module
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                      Enable or disable locker allocation for this library
                    </div>
                  </div>

                  <button
                    className={`btn ${isLockerActive ? 'btn-success' : 'btn-secondary'}`}
                    style={{ minWidth: '90px', padding: '6px 12px', fontSize: '12px', fontWeight: 800 }}
                    onClick={() => handleToggleFeature(lib, 'enableLockers', !isLockerActive)}
                    disabled={isUpdating}
                  >
                    {isLockerActive ? 'ENABLED' : 'DISABLED'}
                  </button>
                </div>

                {/* FEATURE 3: REFERRALS */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Gift size={16} style={{ color: '#D97706' }} /> Student Referral System
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                      Enable or disable referral program & coupons for this library
                    </div>
                  </div>

                  <button
                    className={`btn ${isReferralActive ? 'btn-success' : 'btn-secondary'}`}
                    style={{ minWidth: '90px', padding: '6px 12px', fontSize: '12px', fontWeight: 800 }}
                    onClick={() => handleToggleFeature(lib, 'enableReferrals', !isReferralActive)}
                    disabled={isUpdating}
                  >
                    {isReferralActive ? 'ENABLED' : 'DISABLED'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
