import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../services/api.client';
import { DataTable, type Column } from '../../components/UI/DataTable';
import { Badge } from '../../components/UI/Badge';
import { LogOut } from 'lucide-react';
import { formatDate } from '../../utils/dates';
import { Lightbox } from '../../components/UI/Lightbox';
import { getFullImageUrl } from '../../constants/config';

export const AdminActiveLogs: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalRecords, setTotalRecords] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [dateFilter, setDateFilter] = useState(formatDate(new Date()));
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  void setDateFilter;
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (dateFilter) queryParams.append('date', dateFilter);

      const res = await apiRequest(`/attendance/active-logs?${queryParams.toString()}`);
      if (res.success && res.data) {
        const activeSessions = res.data.activeSessions || [];
        const recentHistory = res.data.recentHistory || [];

        const mappedActive = activeSessions.map((s: any) => {
          const profile = s.studentId || {};
          const user = profile.userId || {};
          const pic = profile.profilePictureUrl || profile.profilePicture || s.profilePicture;
          const name = user.fullName || s.studentName || 'Student';
          const phone = user.phone || s.phone || '';
          const seatNum = profile.currentSeatId?.seatNumber || s.seatNumber;

          return {
            _id: s._id,
            studentId: profile,
            userId: user,
            studentName: name,
            phone: phone,
            profilePicture: pic,
            seatNumber: seatNum,
            checkInTime: s.checkInAt,
            checkOutTime: null,
            durationMinutes: null,
            totalHours: null,
            status: 'IN',
            rawSession: s,
          };
        });

        const mappedHistory = recentHistory.map((s: any) => {
          const profile = s.studentId || {};
          const user = profile.userId || {};
          const pic = profile.profilePictureUrl || profile.profilePicture || s.profilePicture;
          const name = user.fullName || s.studentName || 'Student';
          const phone = user.phone || s.phone || '';
          const seatNum = profile.currentSeatId?.seatNumber || s.seatNumber;

          return {
            _id: s._id,
            studentId: profile,
            userId: user,
            studentName: name,
            phone: phone,
            profilePicture: pic,
            seatNumber: seatNum,
            checkInTime: s.checkInAt,
            checkOutTime: s.checkOutAt,
            durationMinutes: s.durationMinutes,
            totalHours: s.durationMinutes ? s.durationMinutes / 60 : null,
            status: 'OUT',
            rawSession: s,
          };
        });

        let combined = [...mappedActive, ...mappedHistory];

        if (statusFilter === 'IN') {
          combined = combined.filter((r) => r.status === 'IN');
        } else if (statusFilter === 'OUT') {
          combined = combined.filter((r) => r.status === 'OUT');
        }

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          combined = combined.filter(
            (r) =>
              (r.studentName && r.studentName.toLowerCase().includes(q)) ||
              (r.phone && r.phone.includes(q)) ||
              (r.seatNumber && String(r.seatNumber).toLowerCase().includes(q))
          );
        }

        setLogs(combined);
        setTotalRecords(combined.length);
        setTotalPages(Math.ceil(combined.length / 15) || 1);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [dateFilter, statusFilter, searchQuery]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleManualCheckOut = async (sessionId: string) => {
    if (!confirm('Manually check out this student session?')) return;
    try {
      const res = await apiRequest(`/attendance/sessions/${sessionId}/checkout`, 'POST');
      if (res.success) {
        alert('Student checked out successfully!');
        fetchLogs();
      } else {
        alert(res.error?.message || 'Failed to checkout');
      }
    } catch (e: any) {
      alert(e.message || 'Error executing checkout');
    }
  };

  const columns: Column<any>[] = [
    {
      header: 'Student Name',
      accessor: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {(() => {
            const pic = row.profilePicture;
            const name = row.studentName || 'Student';
            const initial = name.charAt(0).toUpperCase();

            if (pic) {
              const imgUrl = getFullImageUrl(pic) || '';
              return (
                <img
                  src={imgUrl}
                  alt={name}
                  title="Click to enlarge profile picture"
                  onClick={() => setPreviewImage({ url: imgUrl, name: `${name} - Identity Verification` })}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '2px solid #CBD5E1',
                    flexShrink: 0,
                    cursor: 'pointer',
                    transition: 'transform 0.15s ease-in-out, border-color 0.15s ease-in-out',
                  }}
                  onMouseEnter={(e) => {
                    (e.target as HTMLElement).style.transform = 'scale(1.1)';
                    (e.target as HTMLElement).style.borderColor = '#4F46E5';
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLElement).style.transform = 'scale(1)';
                    (e.target as HTMLElement).style.borderColor = '#CBD5E1';
                  }}
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              );
            }
            return (
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: '#4F46E5',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '14px',
                  flexShrink: 0,
                }}
              >
                {initial}
              </div>
            );
          })()}
          <div>
            <div style={{ fontWeight: 700, color: '#0F172A' }}>{row.studentName}</div>
            <div style={{ fontSize: '12px', color: '#64748B' }}>{row.phone}</div>
          </div>
        </div>
      ),
    },
    {
      header: 'Seat',
      accessor: (row) => (
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>
          {row.seatNumber ? `🪑 Seat ${row.seatNumber}` : 'General'}
        </span>
      ),
    },
    {
      header: 'Entry Time',
      accessor: (row) => (
        <span style={{ fontSize: '12px', color: '#475569' }}>
          {row.checkInTime ? new Date(row.checkInTime).toLocaleTimeString() : 'N/A'}
        </span>
      ),
    },
    {
      header: 'Exit Time',
      accessor: (row) => (
        <span style={{ fontSize: '12px', color: row.checkOutTime ? '#0F172A' : '#059669', fontWeight: row.checkOutTime ? 400 : 700 }}>
          {row.checkOutTime ? new Date(row.checkOutTime).toLocaleTimeString() : 'Still Inside 🟢'}
        </span>
      ),
    },
    {
      header: 'Duration',
      accessor: (row) => (
        <span style={{ fontSize: '12px', color: '#0284C7', fontWeight: 600 }}>
          {row.durationMinutes != null
            ? `${row.durationMinutes} mins`
            : row.totalHours
              ? `${row.totalHours.toFixed(1)} hrs`
              : 'In Progress'}
        </span>
      ),
    },
    {
      header: 'Status',
      accessor: (row) => <Badge status={row.status} />,
    },
    {
      header: 'Action',
      accessor: (row) =>
        row.status === 'IN' ? (
          <button
            className="btn btn-secondary"
            style={{ padding: '4px 8px', fontSize: '12px', color: '#DC2626', backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' }}
            onClick={() => handleManualCheckOut(row._id)}
          >
            <LogOut size={12} /> Force Check-Out
          </button>
        ) : null,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A' }}>Attendance Entry/Exit Logs</h1>
          <p style={{ fontSize: '14px', color: '#64748B' }}>Real-time library access activity and today's active student sessions</p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select className="form-select" style={{ width: '150px' }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ALL">All Today's Logs</option>
            <option value="IN">Currently IN</option>
            <option value="OUT">Checked OUT</option>
          </select>
        </div>
      </div>

      <div className="card">
        <DataTable
          columns={columns}
          data={logs}
          loading={loading}
          totalRecords={totalRecords}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          onSearch={setSearchQuery}
          onRefresh={fetchLogs}
          searchPlaceholder="Search student name or seat number..."
        />
      </div>

      <Lightbox
        isOpen={!!previewImage}
        onClose={() => setPreviewImage(null)}
        imageUrl={previewImage?.url || ''}
        title={previewImage?.name || 'Student Identity Verification'}
      />
    </div>
  );
};

