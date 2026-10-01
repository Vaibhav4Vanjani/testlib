import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../services/api.client';
import { RefreshCw, TrendingUp, Building2, CreditCard } from 'lucide-react';

export const SuperAdminAnalytics: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchPlatformEarnings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest('/super-admin/earnings');
      if (res.success) setData(res.data);
    } catch (e) {
      console.error('Failed to fetch platform earnings:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlatformEarnings();
  }, [fetchPlatformEarnings]);

  const totalMonthlyEarnings = data?.totalMonthlyEarnings || 0;
  const perLibraryEarnings = data?.perLibraryEarnings || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A' }}>Platform Financial Analytics</h1>
          <p style={{ fontSize: '14px', color: '#64748B' }}>SaaS platform earnings per month and library breakdown</p>
        </div>

        <button onClick={fetchPlatformEarnings} className="btn btn-secondary" style={{ padding: '10px 16px' }}>
          <RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
          <RefreshCw size={24} className="spin" style={{ marginBottom: '8px' }} />
          <div>Loading platform earnings analytics...</div>
        </div>
      ) : (
        <>
          {/* HERO STAT CARD */}
          <div
            className="card"
            style={{
              backgroundColor: '#FFFFFF',
              border: '2px solid #2563EB',
              borderRadius: '16px',
              padding: '32px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 800, color: '#64748B', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              TOTAL PLATFORM EARNINGS (THIS MONTH)
            </div>
            <div style={{ fontSize: '42px', fontWeight: 900, color: '#2563EB' }}>
              ₹{totalMonthlyEarnings.toLocaleString()}
            </div>
            <div style={{ fontSize: '13px', color: '#059669', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <TrendingUp size={16} /> Recurring platform licensing revenue
            </div>
          </div>

          {/* PER-LIBRARY EARNINGS BREAKDOWN */}
          <div className="card">
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', marginBottom: '16px' }}>
              Earnings Breakdown per Library
            </h3>

            {perLibraryEarnings.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>
                No revenue generated yet this month.
              </div>
            ) : (
              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Library Name & Code</th>
                      <th>Monthly Revenue Generated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perLibraryEarnings.map((lib: any) => (
                      <tr key={lib.libraryId}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Building2 size={20} style={{ color: '#4F46E5' }} />
                            <div>
                              <div style={{ fontWeight: 800, fontSize: '15px', color: '#0F172A' }}>{lib.libraryName}</div>
                              <div style={{ fontSize: '12px', color: '#64748B' }}>Code: {lib.libraryCode}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 900, fontSize: '18px', color: '#16A34A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <CreditCard size={18} /> ₹{lib.total.toLocaleString()}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
