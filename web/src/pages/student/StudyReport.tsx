import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api.client';
import { Calendar } from 'lucide-react';

export const StudentStudyReport: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await apiRequest(`/attendance/monthly-report?month=${selectedMonth}`);
      if (res.success) {
        setData(res.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [selectedMonth]);

  const dailyBreakdown = data?.dailyBreakdown || [];
  const totalHours = data?.totalStudyHours || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A' }}>Monthly Study Hours Report</h1>
          <p style={{ fontSize: '14px', color: '#64748B' }}>Track your daily study consistency and attendance logs</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Calendar size={18} style={{ color: '#4F46E5' }} />
          <input
            type="month"
            className="form-input"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{ width: '180px' }}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh', color: '#64748B' }}>
          Loading monthly report...
        </div>
      ) : (
        <>
          {/* SUMMARY CARDS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div className="card">
              <div style={{ fontSize: '13px', color: '#64748B', fontWeight: 600 }}>Total Study Hours</div>
              <div style={{ fontSize: '28px', fontWeight: 900, color: '#059669', marginTop: '4px' }}>{totalHours} hrs</div>
            </div>
          </div>

          {/* DAILY BREAKDOWN TABLE */}
          <div className="card">
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginBottom: '16px' }}>
              Daily Attendance Breakdown ({selectedMonth})
            </h3>

            {dailyBreakdown.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: '#64748B' }}>
                No completed study sessions recorded for this month.
              </div>
            ) : (
              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Minutes Logged</th>
                      <th>Total Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyBreakdown.map((item: any, idx: number) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600, color: '#0F172A' }}>{item.date}</td>
                        <td>{item.minutes} minutes</td>
                        <td style={{ fontWeight: 700, color: '#4F46E5' }}>{item.hours} hrs</td>
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
