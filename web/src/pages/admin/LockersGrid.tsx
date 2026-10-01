import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api.client';
import { LockerGrid, type ILocker } from '../../components/UI/LockerGrid';
import { RefreshCw } from 'lucide-react';

export const AdminLockersGrid: React.FC = () => {
  const [lockers, setLockers] = useState<ILocker[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLockers = async () => {
    setLoading(true);
    try {
      const res = await apiRequest('/admin/locker-master');
      if (res.success) setLockers(res.data?.lockers || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLockers();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', color: '#64748B' }}>
        <RefreshCw size={24} className="spin" /> Loading locker occupancy map...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A' }}>Locker Occupancy Map</h1>
          <p style={{ fontSize: '14px', color: '#64748B' }}>Visual floor layout of assigned, locked and available storage lockers</p>
        </div>
        <button className="btn btn-secondary" onClick={fetchLockers}>
          <RefreshCw size={16} /> Refresh Map
        </button>
      </div>

      <div className="card">
        <LockerGrid lockers={lockers} showDetailsOnHover={true} />
      </div>
    </div>
  );
};
