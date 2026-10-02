import React from 'react';
import { getFullImageUrl } from '../../constants/config';

interface LightboxProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  title?: string;
}

export const Lightbox: React.FC<LightboxProps> = ({ isOpen, onClose, imageUrl, title = 'Image Preview' }) => {
  if (!isOpen || !imageUrl) return null;

  const fullUrl = getFullImageUrl(imageUrl) || imageUrl;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        style={{
          position: 'relative',
          maxWidth: '90vw',
          maxHeight: '90vh',
          backgroundColor: '#1E293B',
          borderRadius: '16px',
          padding: '16px',
          border: '1px solid #334155',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#94A3B8' }}>{title}</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            {/* <a
              href={fullUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '12px' }}
            >
              <Download size={14} /> Open Full Original
            </a> */}
            <button
              onClick={onClose}
              style={{ background: 'red', border: 'none', borderRadius: '99px', color: '#fff', cursor: 'pointer', padding: '8px', margin: '4px' }}
            >
              Close
            </button>
          </div>
        </div>
        <img
          src={fullUrl}
          alt={title}
          style={{ maxWidth: '100%', maxHeight: '75vh', borderRadius: '8px', objectFit: 'contain' }}
        />
      </div>
    </div>
  );
};
