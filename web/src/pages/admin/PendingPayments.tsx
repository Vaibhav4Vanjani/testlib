import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api.client';
import { UserX, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Lightbox } from '../../components/UI/Lightbox';
import { Modal } from '../../components/UI/Modal';

export const AdminPendingPayments: React.FC = () => {
  const [dueList, setDueList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const [selectedInactiveStudent, setSelectedInactiveStudent] = useState<any | null>(null);
  const [inactivatingId, setInactivatingId] = useState<string | null>(null);

  const fetchDuePayments = async () => {
    setLoading(true);
    try {
      const res = await apiRequest('/payments/due-payments');
      if (res.success && res.data) {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const filtered = (res.data || []).filter((s: any) => {
          if (!s.dueDate) return false;
          return new Date(s.dueDate).getTime() < startOfToday.getTime();
        });
        setDueList(filtered);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDuePayments();
  }, []);

  const handleConfirmMarkInactive = async () => {
    if (!selectedInactiveStudent) return;
    const studentId = selectedInactiveStudent._id;
    setInactivatingId(studentId);
    try {
      const res = await apiRequest(`/admin/students/${studentId}/status`, 'PATCH', { status: 'INACTIVE' });
      if (res.success) {
        alert(`Student "${selectedInactiveStudent.studentName || selectedInactiveStudent.fullName || 'Account'}" marked as INACTIVE successfully.`);
        setSelectedInactiveStudent(null);
        fetchDuePayments();
      } else {
        alert(res.error?.message || 'Failed to mark student as inactive');
      }
    } catch (err: any) {
      alert(err.message || 'Error marking student as inactive');
    } finally {
      setInactivatingId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A' }}>Pending Overdue Payments</h1>
          <p style={{ fontSize: '14px', color: '#64748B' }}>Students whose plan validity/due date has passed without approved payment</p>
        </div>

        <Link to="/admin/payment-approvals" className="btn btn-primary">
          Check Pending Approvals Desk ➔
        </Link>
      </div>

      <div className="card">
        <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginBottom: '16px' }}>
          Overdue Student Accounts ({dueList.length})
        </h3>

        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#64748B' }}>Loading overdue payments...</div>
        ) : dueList.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#64748B' }}>No overdue student payments found. All members are active!</div>
        ) : (
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Due Date</th>
                  <th>Days Overdue</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {dueList.map((s: any) => {
                  const dueTime = new Date(s.dueDate).getTime();
                  const nowTime = new Date().getTime();
                  const overdueDays = Math.max(1, Math.floor((nowTime - dueTime) / (1000 * 60 * 60 * 24)));
                  const name = s.studentName || s.fullName || 'Student';
                  const photo = s.profilePictureUrl || s.profilePicture;
                  const photoUrl = photo ? (photo.startsWith('http') ? photo : `http://localhost:5000${photo}`) : null;

                  return (
                    <tr key={s._id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {photoUrl ? (
                            <img
                              src={photoUrl}
                              alt={name}
                              onClick={() => setLightboxImage(photoUrl)}
                              title="Click to view full profile photo"
                              style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #CBD5E1', flexShrink: 0, cursor: 'pointer' }}
                            />
                          ) : (
                            <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#4F46E5', fontSize: '14px', flexShrink: 0 }}>
                              {name.charAt(0) || 'S'}
                            </div>
                          )}
                          <div>
                            <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '13.5px' }}>{name}</div>
                            <div style={{ fontSize: '12px', color: '#64748B' }}>{s.studentPhone || s.phone || 'N/A'}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontWeight: 600, color: '#DC2626' }}>{new Date(s.dueDate).toLocaleDateString()}</td>
                      <td>
                        <span className="badge badge-danger">{overdueDays} Day(s) Late</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <button
                            className="btn"
                            style={{
                              fontSize: '12px',
                              padding: '6px 12px',
                              color: '#DC2626',
                              borderColor: '#FCA5A5',
                              backgroundColor: '#FEF2F2',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '5px',
                              cursor: 'pointer',
                              fontWeight: 600,
                              borderRadius: '6px'
                            }}
                            onClick={() => setSelectedInactiveStudent(s)}
                            disabled={inactivatingId === s._id}
                          >
                            <UserX size={14} /> Mark Inactive
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* LIGHTBOX FOR FULL PROFILE PHOTO PREVIEW */}
      {lightboxImage && (
        <Lightbox
          isOpen={!!lightboxImage}
          imageUrl={lightboxImage}
          onClose={() => setLightboxImage(null)}
          title="Student Profile Photo"
        />
      )}

      {/* CONFIRM MARK INACTIVE MODAL */}
      {selectedInactiveStudent && (
        <Modal
          isOpen={!!selectedInactiveStudent}
          onClose={() => !inactivatingId && setSelectedInactiveStudent(null)}
          title="Confirm Mark Student Inactive"
          maxWidth="480px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', backgroundColor: '#FEF2F2', padding: '14px', borderRadius: '8px', border: '1px solid #FCA5A5' }}>
              <AlertTriangle size={24} color="#DC2626" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <div style={{ fontWeight: 700, color: '#991B1B', fontSize: '15px' }}>
                  Mark Student as Inactive?
                </div>
                <div style={{ fontSize: '13.5px', color: '#7F1D1D', marginTop: '4px', lineHeight: '1.4' }}>
                  Are you sure you want to set <strong>{selectedInactiveStudent.studentName || selectedInactiveStudent.fullName || 'this student'}</strong> to <strong>INACTIVE</strong>?
                </div>
              </div>
            </div>

            <div style={{ fontSize: '13px', color: '#64748B', backgroundColor: '#F8FAFC', padding: '12px', borderRadius: '6px' }}>
              <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <li>Student membership will be changed to <strong>INACTIVE</strong>.</li>
                <li>Login access for the student will be suspended.</li>
                <li>Any reserved seat or locker will be automatically released.</li>
              </ul>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setSelectedInactiveStudent(null)}
                disabled={!!inactivatingId}
              >
                Cancel
              </button>
              <button
                className="btn"
                style={{
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  cursor: inactivatingId ? 'not-allowed' : 'pointer',
                  opacity: inactivatingId ? 0.7 : 1
                }}
                onClick={handleConfirmMarkInactive}
                disabled={!!inactivatingId}
              >
                {inactivatingId ? 'Inactivating...' : 'Confirm, Mark Inactive'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
