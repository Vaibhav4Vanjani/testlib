import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../services/api.client';
import { RefreshCw, Calendar, TrendingUp, CreditCard, Armchair, Box, AlertCircle } from 'lucide-react';
import { formatDisplayDate, formatDate } from '../../utils/dates';

export const AdminRevenueAnalytics: React.FC = () => {
  const now = new Date();
  const defaultFrom = formatDate(new Date(now.getFullYear(), now.getMonth(), 1));
  const defaultTo = formatDate(now);

  const [fromDate, setFromDate] = useState(defaultFrom);
  const [toDate, setToDate] = useState(defaultTo);
  const [activePreset, setActivePreset] = useState<string>('THIS_MONTH');

  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<any | null>(null);

  const fetchEarnings = useCallback(async (fDate: string, tDate: string) => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({ fromDate: fDate, toDate: tDate });
      const res = await apiRequest(`/admin/earnings?${query.toString()}`);
      if (res.success) {
        setStats(res.data);
      } else {
        setError(res.error?.message || 'Failed to fetch revenue analytics');
      }
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Error fetching analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEarnings(fromDate, toDate);
  }, [fromDate, toDate, fetchEarnings]);

  const applyPreset = (preset: string) => {
    setActivePreset(preset);
    const todayObj = new Date();
    const todayStr = formatDate(todayObj);

    if (preset === 'THIS_MONTH') {
      const startM = formatDate(new Date(todayObj.getFullYear(), todayObj.getMonth(), 1));
      setFromDate(startM);
      setToDate(todayStr);
    } else if (preset === 'LAST_30') {
      const past30 = new Date(todayObj.getTime() - 30 * 24 * 60 * 60 * 1000);
      setFromDate(formatDate(past30));
      setToDate(todayStr);
    } else if (preset === 'THIS_YEAR') {
      const startY = formatDate(new Date(todayObj.getFullYear(), 0, 1));
      setFromDate(startY);
      setToDate(todayStr);
    } else if (preset === 'ALL_TIME') {
      setFromDate('2020-01-01');
      setToDate(todayStr);
    }
  };

  const totalRev = stats?.totalRevenue || 0;
  const membershipRev = stats?.membershipRevenue || 0;
  const seatRev = stats?.seatRevenue || 0;
  const lockerRev = stats?.lockerRevenue || 0;
  const trendData: any[] = stats?.trendData || [];

  const mPercent = totalRev > 0 ? Math.round((membershipRev / totalRev) * 100) : 0;
  const sPercent = totalRev > 0 ? Math.round((seatRev / totalRev) * 100) : 0;
  const lPercent = totalRev > 0 ? Math.round((lockerRev / totalRev) * 100) : 0;

  const maxTrendVal = Math.max(...trendData.map((d) => d.total || 0), 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* HEADER & DATE RANGE FILTER CONTROLS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', margin: 0 }}>Library Revenue Analytics</h1>
          <p style={{ fontSize: '13.5px', color: '#64748B', margin: '4px 0 0 0' }}>
            Earnings breakdown by Membership, Seat & Locker for your library
          </p>
        </div>

        {/* DATE RANGE CONTROLS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', backgroundColor: '#FFFFFF', padding: '8px 12px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#475569' }}>
            <Calendar size={16} style={{ color: '#4F46E5' }} />
            <strong>From:</strong>
            <input
              type="date"
              className="form-input"
              style={{ width: '135px', padding: '4px 8px', fontSize: '12px' }}
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setActivePreset('CUSTOM');
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#475569' }}>
            <strong>To:</strong>
            <input
              type="date"
              className="form-input"
              style={{ width: '135px', padding: '4px 8px', fontSize: '12px' }}
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setActivePreset('CUSTOM');
              }}
            />
          </div>

          {/* PRESET BUTTONS */}
          <div style={{ display: 'flex', gap: '4px', borderLeft: '1px solid #E2E8F0', paddingLeft: '8px' }}>
            <button
              className={`btn ${activePreset === 'THIS_MONTH' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '4px 8px', fontSize: '11.5px' }}
              onClick={() => applyPreset('THIS_MONTH')}
            >
              This Month
            </button>
            <button
              className={`btn ${activePreset === 'LAST_30' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '4px 8px', fontSize: '11.5px' }}
              onClick={() => applyPreset('LAST_30')}
            >
              30 Days
            </button>
            <button
              className={`btn ${activePreset === 'THIS_YEAR' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '4px 8px', fontSize: '11.5px' }}
              onClick={() => applyPreset('THIS_YEAR')}
            >
              This Year
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh', color: '#64748B', gap: '10px' }}>
          <RefreshCw size={24} className="spin" /> Loading revenue metrics...
        </div>
      ) : error ? (
        <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '12px', padding: '24px', textAlign: 'center', color: '#DC2626' }}>
          <AlertCircle size={32} style={{ marginBottom: '8px' }} />
          <div style={{ fontWeight: 700 }}>Failed to Load Revenue Analytics</div>
          <div style={{ fontSize: '13px', marginTop: '4px' }}>{error}</div>
          <button className="btn btn-secondary" style={{ marginTop: '12px' }} onClick={() => fetchEarnings(fromDate, toDate)}>
            Retry
          </button>
        </div>
      ) : (
        <>
          {/* KPI SUMMARY CARDS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
            {/* TOTAL REVENUE */}
            <div className="card" style={{ borderLeft: '4px solid #059669', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12.5px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Revenue</span>
                <div style={{ backgroundColor: '#D1FAE5', padding: '6px', borderRadius: '8px', color: '#059669' }}>
                  <TrendingUp size={18} />
                </div>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#059669', marginTop: '6px' }}>
                ₹{totalRev.toLocaleString()}
              </div>
              <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '4px' }}>
                {stats?.transactionCount || 0} approved transaction(s)
              </div>
            </div>

            {/* MEMBERSHIP REVENUE */}
            <div className="card" style={{ borderLeft: '4px solid #4F46E5', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12.5px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Membership</span>
                <div style={{ backgroundColor: '#EEF2FF', padding: '6px', borderRadius: '8px', color: '#4F46E5' }}>
                  <CreditCard size={18} />
                </div>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#4F46E5', marginTop: '6px' }}>
                ₹{membershipRev.toLocaleString()}
              </div>
              <div style={{ fontSize: '11.5px', color: '#6366F1', marginTop: '4px' }}>
                {mPercent}% of total revenue
              </div>
            </div>

            {/* SEAT REVENUE */}
            <div className="card" style={{ borderLeft: '4px solid #10B981', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12.5px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Seats</span>
                <div style={{ backgroundColor: '#ECFDF5', padding: '6px', borderRadius: '8px', color: '#10B981' }}>
                  <Armchair size={18} />
                </div>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#047857', marginTop: '6px' }}>
                ₹{seatRev.toLocaleString()}
              </div>
              <div style={{ fontSize: '11.5px', color: '#10B981', marginTop: '4px' }}>
                {sPercent}% of total revenue
              </div>
            </div>

            {/* LOCKER REVENUE */}
            <div className="card" style={{ borderLeft: '4px solid #D97706', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12.5px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Lockers</span>
                <div style={{ backgroundColor: '#FEF3C7', padding: '6px', borderRadius: '8px', color: '#D97706' }}>
                  <Box size={18} />
                </div>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#D97706', marginTop: '6px' }}>
                ₹{lockerRev.toLocaleString()}
              </div>
              <div style={{ fontSize: '11.5px', color: '#F59E0B', marginTop: '4px' }}>
                {lPercent}% of total revenue
              </div>
            </div>
          </div>

          {/* MAIN CHARTS SECTION: CATEGORY BREAKDOWN & TIMELINE TREND */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', alignItems: 'stretch' }}>
            {/* CATEGORY REVENUE PROPORTION CARD */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', margin: 0 }}>Revenue by Category</h3>

              {totalRev === 0 ? (
                <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
                  No revenue collected in this period.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* COMBINED PROGRESS BAR */}
                  <div style={{ height: '14px', borderRadius: '7px', backgroundColor: '#F1F5F9', overflow: 'hidden', display: 'flex' }}>
                    <div style={{ width: `${mPercent}%`, backgroundColor: '#4F46E5' }} title={`Membership: ${mPercent}%`} />
                    <div style={{ width: `${sPercent}%`, backgroundColor: '#10B981' }} title={`Seats: ${sPercent}%`} />
                    <div style={{ width: `${lPercent}%`, backgroundColor: '#F59E0B' }} title={`Lockers: ${lPercent}%`} />
                  </div>

                  {/* CATEGORY BREAKDOWN ROWS */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#334155' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#4F46E5' }} />
                        Membership Fees
                      </span>
                      <span style={{ fontWeight: 700, color: '#0F172A' }}>
                        ₹{membershipRev.toLocaleString()} <span style={{ color: '#64748B', fontWeight: 500, fontSize: '11.5px' }}>({mPercent}%)</span>
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#334155' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10B981' }} />
                        Seat Assignments
                      </span>
                      <span style={{ fontWeight: 700, color: '#0F172A' }}>
                        ₹{seatRev.toLocaleString()} <span style={{ color: '#64748B', fontWeight: 500, fontSize: '11.5px' }}>({sPercent}%)</span>
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#334155' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#F59E0B' }} />
                        Locker Assignments
                      </span>
                      <span style={{ fontWeight: 700, color: '#0F172A' }}>
                        ₹{lockerRev.toLocaleString()} <span style={{ color: '#64748B', fontWeight: 500, fontSize: '11.5px' }}>({lPercent}%)</span>
                      </span>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 800 }}>
                    <span>Total Period Revenue:</span>
                    <span style={{ color: '#059669' }}>₹{totalRev.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>

            {/* REVENUE TIMELINE TREND SVG CHART */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', margin: 0 }}>Revenue Trend Timeline</h3>
                <span style={{ fontSize: '12px', color: '#64748B' }}>
                  {formatDisplayDate(fromDate)} → {formatDisplayDate(toDate)}
                </span>
              </div>

              {trendData.length === 0 || totalRev === 0 ? (
                <div style={{ flex: 1, minHeight: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: '13px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px dashed #CBD5E1' }}>
                  No collection data recorded for the selected timeline.
                </div>
              ) : (
                <div style={{ position: 'relative', width: '100%', height: '200px' }}>
                  {/* SVG Trend Visualization */}
                  <svg style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                    {/* Background Grid Lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
                      const yPos = 160 - pct * 140;
                      const val = Math.round(maxTrendVal * pct);
                      return (
                        <g key={idx}>
                          <line x1="40" y1={yPos} x2="100%" y2={yPos} stroke="#E2E8F0" strokeDasharray="3 3" />
                          <text x="35" y={yPos + 4} textAnchor="end" fontSize="10" fill="#94A3B8">
                            ₹{val}
                          </text>
                        </g>
                      );
                    })}

                    {/* Bars for each trend point */}
                    {trendData.map((pt, i) => {
                      const count = trendData.length;
                      const barWidth = Math.max(4, Math.min(24, 700 / count - 4));
                      const xPct = 40 + (i / Math.max(1, count - 1)) * (100 - 50);
                      const height = (pt.total / maxTrendVal) * 140;
                      const yPos = 160 - height;

                      return (
                        <g key={pt.date || i}>
                          <rect
                            x={`${xPct}%`}
                            y={yPos}
                            width={barWidth}
                            height={height}
                            fill="#4F46E5"
                            rx="3"
                            opacity={hoveredPoint?.date === pt.date ? 1 : 0.85}
                            onMouseEnter={() => setHoveredPoint(pt)}
                            onMouseLeave={() => setHoveredPoint(null)}
                            style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
                          />
                        </g>
                      );
                    })}
                  </svg>

                  {/* HOVER TOOLTIP */}
                  {hoveredPoint && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        backgroundColor: '#1E1B4B',
                        color: '#FFFFFF',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        pointerEvents: 'none',
                        zIndex: 10,
                      }}
                    >
                      <div style={{ fontWeight: 700, color: '#A5B4FC' }}>{formatDisplayDate(hoveredPoint.date)}</div>
                      <div>Total Revenue: <strong>₹{hoveredPoint.total}</strong></div>
                      <div style={{ fontSize: '11px', color: '#CBD5E1', marginTop: '2px' }}>
                        Membership: ₹{hoveredPoint.membership} | Seat: ₹{hoveredPoint.seat} | Locker: ₹{hoveredPoint.locker}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
