import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api.client';
import { MessageSquare, Send } from 'lucide-react';

export const StudentComplaints: React.FC = () => {
  const [category, setCategory] = useState('AC / Ventilation');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchComplaints = async () => {
    setLoading(true);
    try {
      const res = await apiRequest('/complaints/my-complaints');
      if (res.success) {
        setComplaints(res.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      alert('Please enter both issue title and detailed description');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiRequest('/complaints', 'POST', { category, title, description });
      if (res.success) {
        alert('Complaint Logged! Your ticket has been submitted to Reading Room management.');
        setTitle('');
        setDescription('');
        fetchComplaints();
      } else {
        alert(res.error?.message || 'Failed to submit complaint ticket');
      }
    } catch (err: any) {
      alert(err.message || 'Error submitting complaint ticket');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A' }}>Need Help or Reporting an Issue?</h1>
        <p style={{ fontSize: '14px', color: '#64748B' }}>Log a complaint directly to your Reading Room management team</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
        {/* NEW TICKET FORM */}
        <form className="card" onSubmit={handleSubmit}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MessageSquare size={20} style={{ color: '#4F46E5' }} /> Submit New Complaint Ticket
          </h3>

          <div className="form-group">
            <label className="form-label">Issue Category</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {['AC / Ventilation', 'Seat / Desk', 'Wi-Fi / Noise', 'Cleanliness'].map((cat) => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={category === cat ? 'btn btn-primary' : 'btn btn-secondary'}
                  style={{ fontSize: '12px', padding: '6px 12px' }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Issue Summary / Subject *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. AC cooling low in Row B"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Detailed Description *</label>
            <textarea
              className="form-textarea"
              rows={4}
              placeholder="Describe the issue clearly..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px' }} disabled={submitting}>
            {submitting ? 'Submitting Ticket...' : <><Send size={16} /> Submit Ticket</>}
          </button>
        </form>

        {/* TICKET HISTORY */}
        <div className="card">
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginBottom: '16px' }}>
            Your Ticket History ({complaints.length})
          </h3>

          {loading ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>Loading complaint tickets...</div>
          ) : complaints.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>No complaint tickets logged yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '550px', overflowY: 'auto' }}>
              {complaints.map((item: any) => (
                <div key={item._id} style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '14px' }}>
                      [{item.category}] {item.title}
                    </div>
                    <span
                      className={
                        item.status === 'RESOLVED' || item.status === 'CLOSED'
                          ? 'badge badge-success'
                          : item.status === 'IN_PROGRESS'
                            ? 'badge badge-warning'
                            : 'badge badge-info'
                      }
                    >
                      {item.status}
                    </span>
                  </div>
                  <p style={{ fontSize: '13px', color: '#475569', marginTop: '6px' }}>{item.description}</p>
                  {item.adminResponse && (
                    <div style={{ backgroundColor: '#EFF6FF', borderLeft: '3px solid #2563EB', borderRadius: '4px', padding: '10px', marginTop: '10px', fontSize: '13px' }}>
                      <div style={{ fontWeight: 700, color: '#1E40AF' }}>Admin Resolution Note:</div>
                      <div style={{ color: '#1E3A8A', marginTop: '2px' }}>{item.adminResponse}</div>
                    </div>
                  )}
                  <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '8px' }}>
                    {new Date(item.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
