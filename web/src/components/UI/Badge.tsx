import React from 'react';

interface BadgeProps {
  status: string;
}

export const Badge: React.FC<BadgeProps> = ({ status }) => {
  const s = (status || '').toUpperCase();

  let variantClass = 'badge-info';
  if (['ACTIVE', 'APPROVED', 'SUCCESS', 'PAID', 'VERIFIED'].includes(s)) {
    variantClass = 'badge-success';
  } else if (['EXPIRED', 'REJECTED', 'FAILED', 'SUSPENDED', 'OVERDUE'].includes(s)) {
    variantClass = 'badge-danger';
  } else if (['PENDING', 'DUE', 'IN_PROGRESS'].includes(s)) {
    variantClass = 'badge-warning';
  }

  return <span className={`badge ${variantClass}`}>{s}</span>;
};
