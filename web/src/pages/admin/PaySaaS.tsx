import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api.client';
import { CreditCard, Upload, Eye } from 'lucide-react';
import { Modal } from '../../components/UI/Modal';

function formatDateDDMonthYYYY(dateString?: string | Date): string {
  if (!dateString) return 'N/A';
  const d = typeof dateString === 'string' ? new Date(dateString) : dateString;
  if (isNaN(d.getTime())) return 'N/A';
  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const day = String(d.getDate()).padStart(2, '0');
  const month = MONTH_NAMES[d.getMonth()];
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

export const AdminPaySaaS: React.FC = () => {
  const [saasData, setSaasData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'BANK_TRANSFER' | 'CASH'>('UPI');
  const [transactionRef, setTransactionRef] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [viewingReceiptUrl, setViewingReceiptUrl] = useState<string | null>(null);

  const fetchSaaSDetails = async () => {
    setLoading(true);
    try {
      const res = await apiRequest('/admin/saas-payment');
      if (res.success) {
        setSaasData(res.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSaaSDetails();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setProofFile(file);
      setProofPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmitSaaSPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transactionRef.trim() && !proofFile) {
      alert('Please provide either a Transaction Ref / UTR number or upload a Payment Proof Screenshot.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('amount', String(saasData?.saasAmount || 1200));
      formData.append('paymentMethod', paymentMethod);
      if (transactionRef.trim()) formData.append('transactionRef', transactionRef.trim());
      if (proofFile) formData.append('proofImage', proofFile);

      const res = await apiRequest('/admin/saas-payment', 'POST', formData);

      if (res.success) {
        alert('Your payment request has been submitted for verification.');
        setTransactionRef('');
        setProofFile(null);
        setProofPreview(null);
        fetchSaaSDetails();
      } else {
        alert(res.error?.message || 'Failed to submit payment proof');
      }
    } catch (err: any) {
      alert(err.message || 'Error submitting payment proof');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', color: '#64748B' }}>
        Loading SaaS platform billing details...
      </div>
    );
  }

  const libraryName = saasData?.libraryName || 'Library Centre';
  const saasPlanType = saasData?.saasPlanType || 'MONTHLY';
  const saasAmount = saasData?.saasAmount || 1200;
  const dueDateFormatted = formatDateDDMonthYYYY(saasData?.saasNextDueDate);
  const status = saasData?.saasPaymentStatus || 'UP_TO_DATE';
  const isOverdue = status === 'OVERDUE_DEFAULTER';
  const isPending = status === 'PENDING_APPROVAL';
  const history = saasData?.paymentHistory || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A' }}>App Service Payment</h1>
        <p style={{ fontSize: '14px', color: '#64748B' }}>Pay monthly/annual Software service charges & submit payment screenshot</p>
      </div>

      {isOverdue && (
        <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '12px', padding: '16px', color: '#991B1B' }}>
          <div style={{ fontWeight: 800, fontSize: '15px' }}>⚠️ APP SUBSCRIPTION PAYMENT OVERDUE</div>
          <div style={{ fontSize: '13px', marginTop: '4px' }}>
            Your subscription payment of ₹{saasAmount.toLocaleString()} was due on <strong>{dueDateFormatted}</strong>. Please submit payment proof immediately to avoid service interruption.
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '24px', alignItems: 'start' }}>
        {/* LEFT COLUMN: SUBMISSION FORM */}
        <form className="card" onSubmit={handleSubmitSaaSPayment}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CreditCard size={20} style={{ color: '#4F46E5' }} /> Software Payment
          </h3>

          <div style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#2563EB', textTransform: 'uppercase' }}>Current Library Subscription</div>
              <span className={`badge ${isOverdue ? 'badge-danger' : isPending ? 'badge-warning' : 'badge-success'}`}>
                {isOverdue ? '🔴 PAYMENT OVERDUE' : isPending ? '⏳ PENDING APPROVAL' : '🟢 UP TO DATE'}
              </span>
            </div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', marginTop: '6px' }}>
              {libraryName}
            </div>
            <div style={{ fontSize: '14px', color: '#475569', marginTop: '4px' }}>
              Plan: <strong style={{ color: '#1E40AF' }}>{saasPlanType}</strong> • Due Date: <strong style={{ color: '#0F172A' }}>{dueDateFormatted}</strong>
            </div>
            <div style={{ fontSize: '22px', fontWeight: 900, color: '#059669', marginTop: '10px' }}>
              Payable Amount: ₹{saasAmount.toLocaleString()}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Payment Method</label>
            <select className="form-select" value={paymentMethod} onChange={(e: any) => setPaymentMethod(e.target.value)}>
              <option value="UPI">UPI Payment</option>
              <option value="BANK_TRANSFER">Bank Transfer / IMPS</option>
              <option value="CASH">Direct Cash</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Transaction Ref / UTR Number</label>
            <input
              type="text"
              className="form-input"
              placeholder="Enter 12-digit UTR reference number"
              value={transactionRef}
              onChange={(e) => setTransactionRef(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Payment Proof Screenshot</label>
            <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} id="saas-proof-upload" />
            <label
              htmlFor="saas-proof-upload"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px',
                backgroundColor: '#F1F5F9',
                border: '2px dashed #CBD5E1',
                borderRadius: '10px',
                cursor: 'pointer',
                fontSize: '14px',
                color: '#475569',
                fontWeight: 600,
              }}
            >
              <Upload size={18} /> {proofFile ? proofFile.name : 'Choose Payment Screenshot'}
            </label>

            {proofPreview && (
              <img
                src={proofPreview}
                alt="Proof preview"
                style={{ width: '100%', maxHeight: '180px', objectFit: 'contain', marginTop: '10px', borderRadius: '8px', border: '1px solid #E2E8F0' }}
              />
            )}
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '12px', padding: '14px' }} disabled={submitting}>
            {submitting ? 'Submitting Payment Proof...' : 'Submit Payment Proof'}
          </button>
        </form>

        {/* RIGHT COLUMN: SUPER ADMIN QR / BANK DETAILS */}
        <div className="card" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', marginBottom: '14px' }}>Super Admin Payment Details</h3>

          <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '16px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 4px 14px rgba(0,0,0,0.03)' }}>
            <img
              src={saasData?.qrCodeImage ? (saasData.qrCodeImage.startsWith('http') || saasData.qrCodeImage.startsWith('/') ? saasData.qrCodeImage : `http://localhost:5000${saasData.qrCodeImage}`) : '/super-admin-qr.png'}
              alt="Super Admin QR Code"
              style={{ width: '100%', maxWidth: '240px', objectFit: 'contain', borderRadius: '12px', marginBottom: '14px', border: '1px solid #E2E8F0' }}
            />

            <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '12px 14px', width: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Official Super Admin UPI</div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#4F46E5', wordBreak: 'break-all' }}>
                {saasData?.upiId || '9873109637@ptsbi'}
              </div>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>
                Account: {saasData?.accountHolderName || 'Vaibhav Vanjani'}
              </div>
            </div>

            <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '10px', fontStyle: 'italic' }}>
              Scan QR code with Paytm, PhonePe, GPay or BHIM UPI app
            </div>
          </div>
        </div>
      </div>

      {/* SAAS PAYMENT HISTORY */}
      <div className="card">
        <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginBottom: '16px' }}>SaaS Payment Submission History</h3>

        {history.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>No previous SaaS payment submissions recorded.</div>
        ) : (
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Submission Date</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>UTR Ref</th>
                  <th>Status</th>
                  <th>Proof</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h: any) => (
                  <tr key={h._id}>
                    <td>{formatDateDDMonthYYYY(h.createdAt)}</td>
                    <td style={{ fontWeight: 800, color: '#059669' }}>₹{h.amount}</td>
                    <td>{h.paymentMethod}</td>
                    <td>{h.transactionRef || 'N/A'}</td>
                    <td>
                      <span className={h.status === 'APPROVED' ? 'badge badge-success' : h.status === 'REJECTED' ? 'badge badge-danger' : 'badge badge-warning'}>
                        {h.status}
                      </span>
                    </td>
                    <td>
                      {h.proofImage ? (
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: '12px', padding: '4px 8px' }}
                          onClick={() => setViewingReceiptUrl(h.proofImage.startsWith('http') ? h.proofImage : `http://localhost:5000${h.proofImage}`)}
                        >
                          <Eye size={14} /> View
                        </button>
                      ) : (
                        'N/A'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={!!viewingReceiptUrl} onClose={() => setViewingReceiptUrl(null)} title="Payment Proof">
        {viewingReceiptUrl && (
          <div style={{ textAlign: 'center' }}>
            <img src={viewingReceiptUrl} alt="Proof" style={{ width: '100%', maxHeight: '480px', objectFit: 'contain', borderRadius: '12px' }} />
          </div>
        )}
      </Modal>
    </div>
  );
};
