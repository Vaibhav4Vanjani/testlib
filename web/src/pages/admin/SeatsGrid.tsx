import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api.client';
import { SeatGrid, type ISeat } from '../../components/UI/SeatGrid';
import { RefreshCw } from 'lucide-react';

export const AdminSeatsGrid: React.FC = () => {
  const [seats, setSeats] = useState<ISeat[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSeats = async () => {
    setLoading(true);
    try {
      const res = await apiRequest('/admin/seat-master');
      if (res.success) setSeats(res.data?.seats || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSeats();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', color: '#64748B' }}>
        <RefreshCw size={24} className="spin" /> Loading seat occupancy map...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A' }}>Seat Occupancy Map</h1>
          <p style={{ fontSize: '14px', color: '#64748B' }}>Visual floor layout of reserved, occupied and available library seats</p>
        </div>
        <button className="btn btn-secondary" onClick={fetchSeats}>
          <RefreshCw size={16} /> Refresh Map
        </button>
      </div>

      <div className="card">
        <SeatGrid seats={seats} showDetailsOnHover={true} />
      </div>
    </div>
  );
};
