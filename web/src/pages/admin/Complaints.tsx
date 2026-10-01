import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api.client';
import { DataTable, type Column } from '../../components/UI/DataTable';
import { Badge } from '../../components/UI/Badge';
import { Modal } from '../../components/UI/Modal';
import { MessageSquare, Send } from 'lucide-react';
import { formatDateTime } from '../../utils/dates';

export const AdminComplaints: React.FC = () => {
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedComplaint, setSelectedComplaint] = useState<any | null>(null);
  const [respondModalOpen, setRespondModalOpen] = useState(false);
  const [adminResponse, setAdminResponse] = useState('');
  const [newStatus, setNewStatus] = useState('IN_PROGRESS');

  const fetchComplaints = async () => {
    setLoading(true);
    try {
      const res = await apiRequest('/admin/complaints');
      if (res.success) setComplaints(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, []);

  const handleUpdateComplaint = async () => {
    if (!selectedComplaint) return;
    try {
      const res = await apiRequest(`/admin/complaints/${selectedComplaint._id}`, 'PATCH', {
        status: newStatus,
        adminResponse,
      });

      if (res.success) {
        alert('Complaint updated and student notified!');
        setRespondModalOpen(false);
        setSelectedComplaint(null);
        setAdminResponse('');
        fetchComplaints();
      } else {
        alert(res.error?.message || 'Failed to update complaint');
      }
    } catch (e: any) {
      alert(e.message || 'Error updating complaint');
    }
  };

  const columns: Column<any>[] = [
    {
      header: 'Student Name',
      accessor: (row) => (
        <div>
          <div style={{ fontWeight: 700, color: '#0F172A' }}>{row.studentId?.fullName || row.userId?.fullName || 'Student'}</div>
          <div style={{ fontSize: '12px', color: '#64748B' }}>📞 {row.studentId?.phone || row.userId?.phone}</div>
        </div>
      ),
    },
    {
      header: 'Category',
      accessor: (row) => <span style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>{row.category || 'General Issue'}</span>,
    },
    {
      header: 'Subject / Description',
      accessor: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: '#0F172A' }}>{row.subject || row.title}</div>
          <div style={{ fontSize: '12px', color: '#64748B' }}>{row.description}</div>
        </div>
      ),
    },
    {
      header: 'Submitted At',
      accessor: (row) => <span style={{ fontSize: '12px', color: '#64748B' }}>{formatDateTime(row.createdAt)}</span>,
    },
    {
      header: 'Status',
      accessor: (row) => <Badge status={row.status || 'PENDING'} />,
    },
    {
      header: 'Action',
      accessor: (row) => (
        <button
          className="btn btn-secondary"
          style={{ padding: '6px 12px', fontSize: '12px' }}
          onClick={() => {
            setSelectedComplaint(row);
            setNewStatus(row.status || 'IN_PROGRESS');
            setAdminResponse(row.adminResponse || '');
            setRespondModalOpen(true);
          }}
        >
          <MessageSquare size={14} /> Reply / Update
        </button>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A' }}>Student Complaints Desk</h1>
        <p style={{ fontSize: '14px', color: '#64748B' }}>Review, investigate and resolve student issues and feedback</p>
      </div>

      <div className="card">
        <DataTable columns={columns} data={complaints} loading={loading} onRefresh={fetchComplaints} searchPlaceholder="Search complaint subject or student..." />
      </div>

      {selectedComplaint && (
        <Modal isOpen={respondModalOpen} onClose={() => setRespondModalOpen(false)} title="Respond to Complaint">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', padding: '14px', borderRadius: '10px' }}>
              <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>COMPLAINT DETAILS</div>
              <div style={{ fontWeight: 700, fontSize: '15px', color: '#0F172A', marginTop: '2px' }}>{selectedComplaint.subject || selectedComplaint.title}</div>
              <div style={{ fontSize: '13px', color: '#475569', marginTop: '4px' }}>{selectedComplaint.description}</div>
            </div>

            <div className="form-group">
              <label className="form-label">Update Status</label>
              <select className="form-select" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                <option value="PENDING">Pending Review</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="RESOLVED">Resolved ✅</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Admin Reply to Student</label>
              <textarea
                className="form-textarea"
                rows={4}
                placeholder="Enter response details for the student..."
                value={adminResponse}
                onChange={(e) => setAdminResponse(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
              <button className="btn btn-secondary" onClick={() => setRespondModalOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleUpdateComplaint}>
                <Send size={16} /> Save Response
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
